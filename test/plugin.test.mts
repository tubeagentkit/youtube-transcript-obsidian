import assert from "node:assert/strict";
import { createRequire } from "node:module";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { beforeEach, describe, it } from "node:test";

import { build } from "esbuild";

// Bundle the real plugin source with the `obsidian` import swapped for the stub, then load it.
const outfile = path.join(mkdtempSync(path.join(tmpdir(), "obs-plugin-")), "plugin.cjs");
await build({
  entryPoints: [path.resolve(import.meta.dirname, "../src/main.ts")],
  outfile,
  bundle: true,
  platform: "node",
  format: "cjs",
  alias: { obsidian: path.resolve(import.meta.dirname, "obsidian-stub.ts") },
});
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const PluginClass = createRequire(import.meta.url)(outfile).default as new (app: unknown) => any;

interface StubState {
  notices: string[];
  requests: string[];
  respond: (url: string) => { status: number; text: string };
}
const stub = (globalThis as unknown as { __obsStub: StubState }).__obsStub;

const transcript = {
  video_id: "jNQXAC9IVRw",
  language_code: "en",
  requested_language: "en",
  caption_type: "manual",
  title: "Me at the zoo",
  author_name: "jawed",
  author_url: "",
  thumbnail_url: "",
  transcript: "All right, so here we are.",
  word_count: 6,
  cached: true,
  fetched_at: "",
};
const ok = () => ({ status: 200, text: JSON.stringify({ success: true, data: transcript }) });

const files = new Map<string, string>();
const folders = new Set<string>();
const opened: string[] = [];
const app = {
  vault: {
    getFolderByPath: (p: string) => (folders.has(p) ? {} : null),
    createFolder: async (p: string) => void folders.add(p),
    getAbstractFileByPath: (p: string) => (files.has(p) ? {} : null),
    create: async (p: string, content: string) => {
      files.set(p, content);
      return { path: p, basename: p.split("/").pop()!.replace(/\.md$/, "") };
    },
  },
  workspace: { getLeaf: () => ({ openFile: async (f: { path: string }) => void opened.push(f.path) }) },
};

async function makePlugin(settings: Record<string, unknown> = { apiKey: "sk_live_x" }) {
  const plugin = new PluginClass(app);
  plugin.loadData = async () => settings;
  await plugin.onload();
  return plugin;
}

describe("plugin with a stubbed Obsidian API", () => {
  beforeEach(() => {
    files.clear();
    folders.clear();
    opened.length = 0;
    stub.notices.length = 0;
    stub.requests.length = 0;
    stub.respond = ok;
  });

  it("registers the three commands", async () => {
    const plugin = await makePlugin();
    assert.deepEqual(Object.keys(plugin.commands).sort(), ["create-note", "insert-transcript", "show-credits"]);
  });

  it("creates the folder and a note with properties, then opens it", async () => {
    const plugin = await makePlugin();
    await plugin.createNote("jNQXAC9IVRw");
    assert.ok(folders.has("YouTube transcripts"));
    const note = files.get("YouTube transcripts/Me at the zoo.md");
    assert.ok(note, "note created");
    assert.match(note, /^---\ntitle: "Me at the zoo"\nsource: "https:\/\/www\.youtube\.com\/watch\?v=jNQXAC9IVRw"/);
    assert.match(note, /All right, so here we are\./);
    assert.deepEqual(opened, ["YouTube transcripts/Me at the zoo.md"]);
  });

  it("never overwrites an existing note", async () => {
    const plugin = await makePlugin();
    await plugin.createNote("jNQXAC9IVRw");
    await plugin.createNote("jNQXAC9IVRw");
    await plugin.createNote("jNQXAC9IVRw");
    assert.deepEqual([...files.keys()].sort(), [
      "YouTube transcripts/Me at the zoo 2.md",
      "YouTube transcripts/Me at the zoo 3.md",
      "YouTube transcripts/Me at the zoo.md",
    ]);
  });

  it("saves to the vault root when the folder setting is empty", async () => {
    const plugin = await makePlugin({ apiKey: "sk_live_x", folder: "" });
    await plugin.createNote("jNQXAC9IVRw");
    assert.ok(files.has("Me at the zoo.md"));
    assert.equal(folders.size, 0);
  });

  it("sends language and timestamps from settings", async () => {
    const plugin = await makePlugin({ apiKey: "sk_live_x", language: "es", timestamps: true });
    await plugin.createNote("jNQXAC9IVRw");
    const url = new URL(stub.requests[0]);
    assert.equal(url.searchParams.get("language"), "es");
    assert.equal(url.searchParams.get("timestamps"), "true");
  });

  it("without an API key it explains and makes no request or file", async () => {
    const plugin = await makePlugin({ apiKey: "  " });
    await plugin.createNote("jNQXAC9IVRw");
    assert.match(stub.notices.join("\n"), /Add your API key/);
    assert.equal(stub.requests.length, 0);
    assert.equal(files.size, 0);
  });

  it("shows the API message and creates nothing when out of credits", async () => {
    stub.respond = () => ({
      status: 402,
      text: JSON.stringify({ success: false, code: "PAYMENT_REQUIRED", message: "x" }),
    });
    const plugin = await makePlugin();
    await plugin.createNote("jNQXAC9IVRw");
    assert.match(stub.notices.join("\n"), /out of credits/);
    assert.equal(files.size, 0);
  });

  it("inserts the transcript over a selected link without opening a prompt", async () => {
    const plugin = await makePlugin();
    let inserted = "";
    const editor = {
      getSelection: () => "https://youtu.be/jNQXAC9IVRw",
      replaceSelection: (text: string) => void (inserted = text),
    };
    await plugin.insertTranscript(editor);
    assert.match(inserted, /^# Me at the zoo/);
    assert.match(inserted, /All right, so here we are\./);
  });
});

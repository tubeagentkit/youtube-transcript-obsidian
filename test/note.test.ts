import assert from "node:assert/strict";
import { describe, it } from "node:test";

import { buildNote, cleanFolderPath, noteFileName } from "../src/note";
import type { TranscriptData } from "../src/shared/client";

const data: TranscriptData = {
  video_id: "jNQXAC9IVRw",
  language_code: "en",
  requested_language: "en",
  caption_type: "manual",
  title: 'Me at the "zoo": part 1/2',
  author_name: "jawed",
  author_url: "",
  thumbnail_url: "",
  transcript: "All right, so here we are.",
  word_count: 6,
  cached: true,
  fetched_at: "",
};

describe("buildNote", () => {
  it("starts with valid YAML properties and keeps the transcript body", () => {
    const note = buildNote(data);
    const [, frontmatter, body] = note.split(/^---$/m);
    assert.match(frontmatter, /source: "https:\/\/www\.youtube\.com\/watch\?v=jNQXAC9IVRw"/);
    assert.match(frontmatter, /channel: "jawed"/);
    assert.match(frontmatter, /tags:\n {2}- youtube\n {2}- transcript/);
    assert.match(body, /All right, so here we are\./);
  });

  it("keeps the exact title as a property instead of an H1 (Obsidian already shows the file name as the title)", () => {
    const note = buildNote(data);
    const [, frontmatter, body] = note.split(/^---$/m);
    assert.match(frontmatter, /title: "Me at the \\"zoo\\": part 1\/2"/);
    assert.doesNotMatch(body, /^# /m);
    assert.match(body, /^Channel: jawed/m);
  });

  it("quotes a channel name with YAML-special characters", () => {
    const note = buildNote({ ...data, author_name: 'Mr: "Bean" # 1' });
    assert.match(note, /channel: "Mr: \\"Bean\\" # 1"/);
  });
});

describe("noteFileName", () => {
  it("removes characters Obsidian and file systems reject", () => {
    assert.equal(noteFileName(data), "Me at the zoo part 1 2.md");
  });
  it("falls back to the video id for an empty title", () => {
    assert.equal(noteFileName({ ...data, title: "///" }), "jNQXAC9IVRw.md");
  });
});

describe("cleanFolderPath", () => {
  it("normalizes slashes and spaces", () => {
    assert.equal(cleanFolderPath(" a//b/ "), "a/b");
    assert.equal(cleanFolderPath(""), "");
    assert.equal(cleanFolderPath("/"), "");
  });
});

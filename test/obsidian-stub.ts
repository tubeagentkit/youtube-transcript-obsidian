// Minimal stand-in for the `obsidian` module, just enough to run the plugin's logic in Node.
// State lives on globalThis because the test bundles this file into the plugin, so the test and the
// plugin each get their own module copy.
interface StubState {
  notices: string[];
  requests: string[];
  respond: (url: string) => { status: number; text: string };
}
const globals = globalThis as unknown as { __obsStub?: StubState };
globals.__obsStub ??= { notices: [], requests: [], respond: () => ({ status: 500, text: "" }) };
const state = globals.__obsStub;

export class Notice {
  constructor(message: string) {
    state.notices.push(message);
  }
  hide() {}
}
export class Modal {
  contentEl = { empty() {} };
  constructor(public app: unknown) {}
  open() {}
  close() {}
  setTitle() {}
}
export class Setting {
  constructor(_el: unknown) {}
}
export class PluginSettingTab {
  containerEl = { empty() {} };
  constructor(
    public app: unknown,
    public plugin: unknown,
  ) {}
}
export class TFile {
  constructor(public path: string) {}
  get basename() {
    return this.path.split("/").pop()!.replace(/\.md$/, "");
  }
}
export class Plugin {
  commands: Record<string, { name: string }> = {};
  saved: unknown;
  constructor(public app: unknown) {}
  addCommand(command: { id: string; name: string }) {
    this.commands[command.id] = command;
  }
  addSettingTab() {}
  async loadData() {
    return null;
  }
  async saveData(data: unknown) {
    this.saved = data;
  }
}
export const normalizePath = (path: string) => path.replace(/\/+/g, "/");
export async function requestUrl(request: { url: string }) {
  state.requests.push(request.url);
  return state.respond(request.url);
}

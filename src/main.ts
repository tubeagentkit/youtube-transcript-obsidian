import {
  App,
  Editor,
  Modal,
  Notice,
  Plugin,
  PluginSettingTab,
  Setting,
  TFile,
  normalizePath,
  requestUrl,
} from "obsidian";

import { buildNote, cleanFolderPath, noteFileName } from "./note";
import {
  createClient,
  looksLikeYouTubeVideo,
  SIGN_UP_URL,
  TranscriptApiError,
  type HttpGet,
  type TranscriptClient,
  type TranscriptData,
} from "./shared/client";
import { formatTranscript } from "./shared/format";

interface YouTubeTranscriptSettings {
  apiKey: string;
  language: string;
  timestamps: boolean;
  folder: string;
}

const DEFAULT_SETTINGS: YouTubeTranscriptSettings = {
  apiKey: "",
  language: "",
  timestamps: false,
  folder: "YouTube transcripts",
};

const USER_AGENT = "GetYouTubeTranscript-Obsidian/0.1.0";

/** requestUrl is used instead of fetch: it ignores CORS and also works on mobile. */
const obsidianHttp: HttpGet = async (url, headers) => {
  const response = await requestUrl({ url, headers, throw: false });
  return { status: response.status, body: response.text };
};

async function readClipboardLink(): Promise<string> {
  try {
    const text = (await navigator.clipboard.readText()).trim();
    return looksLikeYouTubeVideo(text) ? text : "";
  } catch {
    return "";
  }
}

class VideoLinkModal extends Modal {
  private value: string;

  constructor(
    app: App,
    initialValue: string,
    private readonly title: string,
    private readonly onSubmit: (video: string) => void,
  ) {
    super(app);
    this.value = initialValue;
  }

  onOpen() {
    this.setTitle(this.title);
    const submit = () => {
      if (!looksLikeYouTubeVideo(this.value)) {
        new Notice("Enter a YouTube link or an 11-character video ID.");
        return;
      }
      this.close();
      this.onSubmit(this.value.trim());
    };

    new Setting(this.contentEl).setName("YouTube link").addText((text) => {
      text
        .setPlaceholder("https://www.youtube.com/watch?v=...")
        .setValue(this.value)
        .onChange((value) => (this.value = value));
      text.inputEl.addEventListener("keydown", (event) => {
        if (event.key === "Enter") submit();
      });
      window.setTimeout(() => text.inputEl.focus(), 0);
    });
    new Setting(this.contentEl).addButton((button) => button.setButtonText("Get transcript").setCta().onClick(submit));
  }

  onClose() {
    this.contentEl.empty();
  }
}

export default class YouTubeTranscriptPlugin extends Plugin {
  settings: YouTubeTranscriptSettings = DEFAULT_SETTINGS;

  async onload() {
    await this.loadSettings();

    this.addCommand({
      id: "insert-transcript",
      name: "Insert transcript at cursor",
      editorCallback: (editor) => this.insertTranscript(editor),
    });
    this.addCommand({
      id: "create-note",
      name: "Create note from transcript",
      callback: () => this.promptForVideo("Create note from transcript", (video) => this.createNote(video)),
    });
    this.addCommand({ id: "show-credits", name: "Show credit balance", callback: () => this.showCredits() });

    this.addSettingTab(new YouTubeTranscriptSettingTab(this.app, this));
  }

  async loadSettings() {
    this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
  }

  async saveSettings() {
    await this.saveData(this.settings);
  }

  /** Returns a client, or tells the user how to get a key and returns undefined. */
  private getClient(): TranscriptClient | undefined {
    if (!this.settings.apiKey.trim()) {
      new Notice(`Add your API key in the plugin settings first. Get a free one at ${SIGN_UP_URL}`, 10000);
      return undefined;
    }
    return createClient(this.settings.apiKey, obsidianHttp, USER_AGENT);
  }

  private async fetchTranscript(video: string): Promise<TranscriptData | undefined> {
    const client = this.getClient();
    if (!client) return undefined;
    const notice = new Notice("Fetching transcript...", 0);
    try {
      return await client.getTranscript(video, {
        language: this.settings.language,
        timestamps: this.settings.timestamps,
      });
    } catch (error) {
      new Notice(
        error instanceof TranscriptApiError ? error.message : "Something went wrong. Please try again.",
        10000,
      );
      return undefined;
    } finally {
      notice.hide();
    }
  }

  private async promptForVideo(title: string, onVideo: (video: string) => void) {
    new VideoLinkModal(this.app, await readClipboardLink(), title, onVideo).open();
  }

  /** A selected link is used directly; otherwise ask, pre-filled from the clipboard. */
  private async insertTranscript(editor: Editor) {
    const insert = async (video: string) => {
      const data = await this.fetchTranscript(video);
      if (data) editor.replaceSelection(formatTranscript(data, "markdown"));
    };
    const selection = editor.getSelection().trim();
    if (looksLikeYouTubeVideo(selection)) {
      await insert(selection);
      return;
    }
    await this.promptForVideo("Insert transcript at cursor", insert);
  }

  private async createNote(video: string) {
    const data = await this.fetchTranscript(video);
    if (!data) return;

    const folder = cleanFolderPath(this.settings.folder);
    if (folder && !this.app.vault.getFolderByPath(folder)) await this.app.vault.createFolder(folder);

    // Never overwrite: "Title.md" -> "Title 2.md" -> "Title 3.md"
    const fileName = noteFileName(data);
    const stem = fileName.replace(/\.md$/, "");
    let path = normalizePath(folder ? `${folder}/${fileName}` : fileName);
    for (let copy = 2; this.app.vault.getAbstractFileByPath(path); copy++) {
      path = normalizePath(folder ? `${folder}/${stem} ${copy}.md` : `${stem} ${copy}.md`);
    }

    const file: TFile = await this.app.vault.create(path, buildNote(data));
    await this.app.workspace.getLeaf(false).openFile(file);
    new Notice(`Created ${file.basename}`);
  }

  private async showCredits() {
    const client = this.getClient();
    if (!client) return;
    try {
      const credits = await client.getCredits();
      new Notice(
        `${credits.plan} plan: ${credits.plan_credits_left} plan credits, ${credits.topup_credits_left} top-up credits left`,
      );
    } catch (error) {
      new Notice(
        error instanceof TranscriptApiError ? error.message : "Something went wrong. Please try again.",
        10000,
      );
    }
  }
}

class YouTubeTranscriptSettingTab extends PluginSettingTab {
  constructor(
    app: App,
    private readonly plugin: YouTubeTranscriptPlugin,
  ) {
    super(app, plugin);
  }

  display() {
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl)
      .setName("API key")
      .setDesc(
        `Create a free key at ${SIGN_UP_URL}. New accounts get 100 free credits. The key is saved in this vault's plugin data.`,
      )
      .addText((text) => {
        text.inputEl.type = "password";
        text
          .setPlaceholder("sk_live_...")
          .setValue(this.plugin.settings.apiKey)
          .onChange(async (value) => {
            this.plugin.settings.apiKey = value.trim();
            await this.plugin.saveSettings();
          });
      });

    new Setting(containerEl)
      .setName("Caption language")
      .setDesc("A language code such as en, es or ja. Leave empty to use the video's default.")
      .addText((text) =>
        text
          .setPlaceholder("en")
          .setValue(this.plugin.settings.language)
          .onChange(async (value) => {
            this.plugin.settings.language = value.trim();
            await this.plugin.saveSettings();
          }),
      );

    new Setting(containerEl)
      .setName("Timestamps")
      .setDesc("Add a clickable timestamp to every line. Same credit cost either way.")
      .addToggle((toggle) =>
        toggle.setValue(this.plugin.settings.timestamps).onChange(async (value) => {
          this.plugin.settings.timestamps = value;
          await this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName("Folder for new notes")
      .setDesc('Where "Create note from transcript" saves notes. Leave empty for the vault root.')
      .addText((text) =>
        text
          .setPlaceholder("YouTube transcripts")
          .setValue(this.plugin.settings.folder)
          .onChange(async (value) => {
            this.plugin.settings.folder = value;
            await this.plugin.saveSettings();
          }),
      );
  }
}

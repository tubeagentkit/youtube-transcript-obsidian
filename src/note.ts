import type { TranscriptData } from "./shared/client";
import { formatTranscript, safeFileName } from "./shared/format";

/** A JSON string is also a valid YAML double-quoted string, so titles with colons or quotes stay safe. */
const yamlString = (value: string) => JSON.stringify(value);

/**
 * Full note: YAML properties followed by the Markdown transcript. The shared formatter's
 * "# Title" line is dropped because Obsidian already shows the file name as the title; the
 * exact title (the file name is sanitized) is kept as the `title` property.
 */
export function buildNote(data: TranscriptData): string {
  const markdown = formatTranscript(data, "markdown");
  const heading = `# ${data.title}\n\n`;
  const body = markdown.startsWith(heading) ? markdown.slice(heading.length) : markdown;
  return [
    "---",
    `title: ${yamlString(data.title)}`,
    `source: ${yamlString(`https://www.youtube.com/watch?v=${data.video_id}`)}`,
    `channel: ${yamlString(data.author_name)}`,
    `language: ${yamlString(data.language_code)}`,
    "tags:",
    "  - youtube",
    "  - transcript",
    "---",
    "",
    body,
  ].join("\n");
}

export function noteFileName(data: TranscriptData): string {
  return `${safeFileName(data.title, data.video_id)}.md`;
}

/** "a/b/", " a//b " -> "a/b"; empty means the vault root. */
export function cleanFolderPath(folder: string): string {
  return folder
    .split("/")
    .map((part) => part.trim())
    .filter(Boolean)
    .join("/");
}

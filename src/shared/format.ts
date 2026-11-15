import type { TranscriptData } from "./client";

export type OutputFormat = "markdown" | "text";

/** 75.4 -> "1:15", 3725 -> "1:02:05" */
export function formatTimestamp(totalSeconds: number): string {
  const seconds = Math.floor(totalSeconds);
  const h = Math.floor(seconds / 3600);
  const m = Math.floor((seconds % 3600) / 60);
  const s = seconds % 60;
  const pad = (n: number) => String(n).padStart(2, "0");
  return h > 0 ? `${h}:${pad(m)}:${pad(s)}` : `${m}:${pad(s)}`;
}

export function watchUrl(videoId: string, startSeconds?: number): string {
  const base = `https://www.youtube.com/watch?v=${videoId}`;
  return startSeconds === undefined ? base : `${base}&t=${Math.floor(startSeconds)}s`;
}

/** Body only: timestamped lines when segments exist, otherwise the plain transcript. */
function transcriptBody(data: TranscriptData, format: OutputFormat): string {
  if (!data.segments?.length) return data.transcript;
  return data.segments
    .map((segment) => {
      const stamp = formatTimestamp(segment.start);
      return format === "markdown"
        ? `[${stamp}](${watchUrl(data.video_id, segment.start)}) ${segment.text}`
        : `[${stamp}] ${segment.text}`;
    })
    .join("\n");
}

/** Markdown with a title, source link and the transcript, ready to paste into notes or an AI chat. */
export function formatTranscript(data: TranscriptData, format: OutputFormat = "markdown"): string {
  const body = transcriptBody(data, format);
  if (format === "text") return body;

  const captionNote = data.caption_type === "auto" ? " (auto-generated captions)" : "";
  return [
    `# ${data.title}`,
    "",
    `Channel: ${data.author_name}  `,
    `Source: ${watchUrl(data.video_id)}  `,
    `Language: ${data.language_code}${captionNote}`,
    "",
    "## Transcript",
    "",
    body,
    "",
  ].join("\n");
}

/** Keeps a video title usable as a file name on every OS. */
export function safeFileName(title: string, fallback: string): string {
  const cleaned = title
    .replace(/[\\/:*?"<>|#^[\]]/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 100);
  return cleaned || fallback;
}

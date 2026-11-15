// Single source of truth for the API client used by the VS Code, Raycast and
// Obsidian plugins. Edit it here, then run `npm run sync` in packages/editor-shared
// to copy it into each plugin (each one must ship self-contained).

export const API_BASE = "https://getyoutubetranscript.com/api/v1";
export const SIGN_UP_URL = "https://getyoutubetranscript.com/developers";
export const PRICING_URL = "https://getyoutubetranscript.com/pricing";

export interface TranscriptSegment {
  start: number;
  duration: number;
  text: string;
}

export interface TranscriptData {
  video_id: string;
  language_code: string;
  requested_language: string;
  caption_type: "manual" | "auto" | null;
  title: string;
  author_name: string;
  author_url: string;
  thumbnail_url: string;
  transcript: string;
  word_count: number;
  cached: boolean;
  fetched_at: string;
  segments?: TranscriptSegment[];
}

export interface CreditsData {
  plan_credits_left: number;
  topup_credits_left: number;
  plan: "free" | "monthly" | "yearly";
  rate_limit_per_minute: number;
}

export interface HttpResponse {
  status: number;
  body: string;
}

/** Each host supplies its own HTTP call (Obsidian needs its requestUrl to avoid CORS). */
export type HttpGet = (url: string, headers: Record<string, string>) => Promise<HttpResponse>;

export class TranscriptApiError extends Error {
  constructor(
    message: string,
    readonly code: string,
    readonly status: number,
  ) {
    super(message);
    this.name = "TranscriptApiError";
  }
}

export const fetchHttp: HttpGet = async (url, headers) => {
  const response = await fetch(url, { headers, signal: AbortSignal.timeout(60_000) });
  return { status: response.status, body: await response.text() };
};

function parseJson(body: string): Record<string, unknown> | null {
  try {
    const parsed: unknown = JSON.parse(body);
    return parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : null;
  } catch {
    return null;
  }
}

/** Plain-language message for the errors a user can act on; the API's own message otherwise. */
function describeError(status: number, code: string, apiMessage: string | undefined): string {
  if (status === 401) return `The API key was rejected. Check it, or create one at ${SIGN_UP_URL}`;
  if (status === 402) return `You are out of credits. Top up or upgrade at ${PRICING_URL}`;
  if (status === 429) return "Too many requests. Wait a moment and try again.";
  return apiMessage || `Request failed (${code || status}).`;
}

/** Quick client-side check so typos are caught before a request; the API does the real parsing. */
export function looksLikeYouTubeVideo(input: string): boolean {
  const value = input.trim();
  if (/^[\w-]{11}$/.test(value)) return true;
  try {
    const host = new URL(value).hostname.replace(/^(www|m)\./, "");
    return host === "youtube.com" || host === "youtu.be" || host === "youtube-nocookie.com";
  } catch {
    return false;
  }
}

export function createClient(apiKey: string, http: HttpGet, userAgent: string, apiBase: string = API_BASE) {
  const key = apiKey.trim();

  async function get<T>(path: string, params: Record<string, string> = {}): Promise<T> {
    if (!key) throw new TranscriptApiError(`No API key set. Get one free at ${SIGN_UP_URL}`, "MISSING_API_KEY", 401);
    const query = new URLSearchParams(params).toString();
    const url = `${apiBase}${path}${query ? `?${query}` : ""}`;

    let response: HttpResponse;
    try {
      // A named User-Agent is required: generic ones can be blocked at the edge (Cloudflare 1010).
      response = await http(url, {
        Authorization: `Bearer ${key}`,
        "User-Agent": userAgent,
        Accept: "application/json",
      });
    } catch {
      throw new TranscriptApiError(
        "Could not reach getyoutubetranscript.com. Check your connection.",
        "NETWORK_ERROR",
        0,
      );
    }

    const json = parseJson(response.body);
    if (response.status >= 200 && response.status < 300 && json?.success === true) {
      return json.data as T;
    }
    const code = typeof json?.code === "string" ? json.code : "";
    const apiMessage = typeof json?.message === "string" ? json.message : undefined;
    throw new TranscriptApiError(
      describeError(response.status, code, apiMessage),
      code || "HTTP_ERROR",
      response.status,
    );
  }

  return {
    /** `video` may be an 11-character ID or any YouTube URL; the API parses it. */
    getTranscript: (video: string, options: { language?: string; timestamps?: boolean } = {}) => {
      const params: Record<string, string> = { v: video.trim() };
      if (options.language?.trim()) params.language = options.language.trim();
      if (options.timestamps) params.timestamps = "true";
      return get<TranscriptData>("/transcript", params);
    },
    /** Free call (0 credits). */
    getCredits: () => get<CreditsData>("/credits"),
  };
}

export type TranscriptClient = ReturnType<typeof createClient>;

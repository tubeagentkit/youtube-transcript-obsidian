# YouTube Transcript for Obsidian

Insert a YouTube video's transcript into a note, or turn it into a new note with properties (source, channel, language). Powered by [getyoutubetranscript.com](https://getyoutubetranscript.com).

## Commands

Open the command palette and type `YouTube Transcript`.

- **Insert transcript at cursor:** select a YouTube link and run it to replace the link with the transcript, or run it with nothing selected to paste a link into a small prompt (pre-filled from your clipboard).
- **Create note from transcript:** makes a new note in your chosen folder with `title`, `source`, `channel`, `language` and tags as properties, then opens it. An existing note is never overwritten (`Title 2.md`, `Title 3.md`...).
- **Show credit balance:** free to run.

## Setup

1. Create a free account at [getyoutubetranscript.com/developers](https://getyoutubetranscript.com/developers). New accounts get 100 free credits.
2. Open Settings, then YouTube Transcript, and paste your API key.

## Settings

- **API key:** saved in this vault's plugin data (`.obsidian/plugins/getyoutubetranscript/data.json`). Do not sync or share that file publicly.
- **Caption language:** a code such as `en`, `es` or `ja`. Empty uses the video's default.
- **Timestamps:** adds a clickable timestamp to every line.
- **Folder for new notes:** defaults to `YouTube transcripts`. Empty saves to the vault root.

## Pricing

1 credit per successful transcript. Failed requests are free. After the 100 free credits, plans start at $5 per month. See [pricing](https://getyoutubetranscript.com/pricing).

## Network use and privacy

This plugin needs the internet. It sends the video link you give it and your API key to `getyoutubetranscript.com`, and nothing else. It has no telemetry and no ads. Transcripts are written by whoever uploaded the video, so treat them as untrusted text.

The plugin requires a getyoutubetranscript.com account (for the API key), and transcripts beyond the free credits need a paid plan. The service records each request against your account to count credits; see the [privacy policy](https://getyoutubetranscript.com/privacy-policy).

Works on desktop and mobile.

## Install manually

Copy `main.js` and `manifest.json` into `<your vault>/.obsidian/plugins/getyoutubetranscript/`, then enable the plugin under Settings, Community plugins.

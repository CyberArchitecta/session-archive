# Session Archive

**Pick up a conversation in another assistant.**

Import ChatGPT and Claude exports into one searchable local archive. Ask a connected assistant to find a session, retrieve a compact handoff, and continue with the relevant context.

Separate from [Agent Relay](https://github.com/CyberArchitecta/claude-codex-relay): this project retrieves conversations; it does not launch agent models.

## Features

- Local browser UI: full-text search across titles, messages, notes, and attached text files.
- ChatGPT/Claude conversations.json and Markdown/plain-text imports.
- Source/date labels distinguish identically named sessions.
- Repeat imports update provider sessions without duplicates; older dated exports cannot overwrite newer ones.
- Editable handoff notes, bounded transcript excerpts, copy/download continuation packets.
- Read-only MCP over stdio and Streamable HTTP.
- Optional single-owner OAuth: consent, PKCE, expiring tokens, refresh rotation, revocation.
- No API keys, embeddings, paid model calls, or telemetry.

**Imports are snapshots, not continuous synchronization.** MCP does not export private histories from either app. Import again to include later messages. Actual ChatGPT/Claude app connection acceptance has not been verified; protocol tests use the official MCP SDK client.

For Codex/Claude Code users: [step-by-step local installation](docs/local-install.md) and [practical handoff assessment](docs/practical-handoff.md). Native coding-session ingestion and live workspace inspection are not implemented in v0.1.0.

## Quick start

Requires **Node.js 24.13 or newer**.

~~~sh
git clone https://github.com/CyberArchitecta/session-archive.git
cd session-archive
npm ci
npm start
~~~

Open the private URL printed in your terminal. Click **Import**, extract your export ZIP, and select **conversations.json**. Choose a session, save any handoff notes, then **Copy handoff** into another assistant.

Try the synthetic exports in examples/ first.

An npm-installable tarball is available in [GitHub Releases](https://github.com/CyberArchitecta/session-archive/releases). This package is not published to the npm registry.

~~~sh
npm install -g ./cyberarchitecta-session-archive-0.1.0.tgz
session-archive serve
~~~

## Connect assistants

See [connector setup](docs/connectors.md) for Claude Desktop stdio and remote OAuth.

> Search Session Archive for "Garden studio plan". If several match, show the source and date. Fetch the selected session's handoff and help me continue. Retrieve more transcript only if needed.

| Tool | Purpose |
| --- | --- |
| search | Keyword search, source/date disambiguation, pagination |
| fetch | Compact handoff, notes, and available text attachment IDs |
| get_transcript | Bounded transcript chunks with next offsets |
| get_attachment | Bounded text from explicitly imported attachments |

MCP cannot import, edit, delete, read arbitrary paths, or access live app history. Each authorized connector can read **all sessions** in its archive. Use separate data directories for different access boundaries.

## CLI

~~~sh
node bin/session-archive.mjs import /path/to/conversations.json
node bin/session-archive.mjs search garden studio
node bin/session-archive.mjs handoff SESSION_ID
node bin/session-archive.mjs mcp
~~~

All commands accept --data /path/to/private-directory. Default: ~/.session-archive. SESSION_ARCHIVE_DATA also sets it. The browser owner key permits archive administration; do not share its private URL.

## Limits and fidelity

- ChatGPT follows current_node through parents. Alternative branches are excluded with a warning. A missing current_node falls back to the latest leaf with a warning.
- Claude text/content messages are supported; thinking and tool payload blocks are excluded.
- Unknown JSON schemas fail clearly. Export formats can change; fixtures cover supported shapes.
- Export attachment names are references, not bytes. Attach up to 20 text files per session (200,000 characters each) explicitly to make them retrievable. No image/PDF/binary retrieval or remote fetching.
- Maximum import: 50 MB, 10,000 conversations. Extract ZIP exports first.
- Markdown/text imports are documents without inferred roles. Changed contents create new document snapshots.
- Handoffs are extractive, not AI summaries. Character budgets are not exact token counts.
- OAuth state is in memory; restart revokes connections and requires reconnecting.
- No automatic capture, native session restoration, multi-user isolation, or managed hosting.
- SQLite is unencrypted on disk. Protect the data directory and backups with OS controls.

## Development

~~~sh
npm ci
npm run check
npm test
python -m pip install -r requirements-dev.txt
python -m playwright install chromium
python scripts/test-ui.py
~~~

Tests use synthetic exports, isolated databases, and no model calls. See [verification](docs/verification.md), [architecture](docs/architecture.md), and [security](SECURITY.md).

MIT license.

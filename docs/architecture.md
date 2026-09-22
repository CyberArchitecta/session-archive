# Architecture

Export -> parser -> SQLite/FTS5 -> search -> bounded handoff -> selected transcript/attachment chunks -> assistant.

The browser manages the archive; model inference and provider logins are absent.

- src/import.mjs normalizes exports and documents.
- src/store.mjs owns transactional indexing, notes, files, deletion and retrieval.
- src/mcp.mjs exposes four read-only tools through the official SDK.
- src/auth.mjs implements single-owner OAuth; SDK middleware validates PKCE, requests, and standard errors.
- src/server.mjs serves the private browser API and Streamable HTTP.
- bin/session-archive.mjs provides serve/import/search/handoff/mcp/key.
- public/ is the framework-free browser UI.

IDs hash provider source IDs, prefixed by provider; titles are not identity. Upserts preserve notes/attachments. Older known timestamps are skipped; absent timestamps use import order. ChatGPT branches are reconstructed, not flattened.

SQLite/index updates are transactional. Foreign keys delete attachments with sessions. Parameterized FTS queries use normalized quoted prefix terms instead of raw user query syntax.

## Security boundaries

Browser administration uses an owner key kept in per-tab sessionStorage. Imported content renders as text under a restrictive CSP.

MCP is read-only and grants access to all imported content. Tokens bind client, scope and resource; authorization codes bind redirect, expire, and are single-use. SDK PKCE verifies exchanges. Refresh rotation revokes the prior access token. SDK rate limits protect registration/token endpoints. Redirects require HTTPS or loopback HTTP.

HTTP binds only to loopback. An explicit public HTTPS origin permits the reverse proxy Host. Host/Origin validation prevents arbitrary cross-origin browser requests. MCP never fetches URLs or reads supplied paths.

Imported instructions are historical data, not authority; downstream models must respect this. Secrets are not automatically redacted. Protect private archive files and backups.

## Retrieval budgets

MCP search: 10 results by default, 50 maximum, with pagination. Handoff text: 6,000 characters by default, range 1,000-16,000. Transcript/text-file reads: at most 16,000 characters per call; continue using nextOffset.

No embeddings, background model summaries, provider APIs, telemetry, or automatic uploads. Characters are not a token usage measurement.

## Next steps

Real-app compatibility tests, broader export fixtures, opt-in incremental sources, and scoped checkpoint writing if requested. Never imply automatic private chat capture from MCP alone.

# Security

Single-owner archive: authorized MCP readers see all imported sessions. Use separate data directories for different access boundaries.

SQLite and owner.key live in ~/.session-archive by default. Data is unencrypted. Protect files and backups; never commit exports, keys, databases or logs. Imports are not automatically secret-redacted.

Remote use requires HTTPS and OAuth. No tunnel is opened automatically. Do not log credentials or conversation bodies. Restart revokes in-memory OAuth connections. To rotate the owner key, stop the server, replace owner.key with a strong random value, and restart.

Historical content can contain malicious instructions. Treat it as data. Plain-text rendering, bounded retrieval and read-only tools do not guarantee downstream model resistance.

Do not post private data in issues. Use repository private vulnerability reporting when enabled.

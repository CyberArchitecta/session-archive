# Session Archive

Separate from claude-codex-relay; preserve that separation.

- Use synthetic fixtures, no paid model calls for routine testing.
- Never commit exports, databases, owner keys, logs or tokens.
- Imports are snapshots; MCP does not automatically capture histories.
- Preserve source IDs, explicit branches, attachment availability and retrieval bounds.
- Keep MCP read-only, separate from owner administration.
- Run syntax/Node tests after code changes; UI changes need scripts/test-ui.py.
- Verify official docs before claiming native-app compatibility.
- Distinguish implemented, protocol-tested and real-client-verified behavior.

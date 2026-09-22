# Local installation: Codex and Claude Code

This is the simplest setup for two coding agents on the same computer. It uses a local stdio connector; no public website, OAuth server or paid API is needed.

Current limitation: v0.1.0 reads manually imported ChatGPT/Claude exports or Markdown/text. It does **not** automatically import native Codex/Claude Code session histories or expose current project files. Read the [practical assessment](practical-handoff.md) before treating it as a complete handoff solution.

## 1. Install and run

Install Node.js 24.13 or newer and Git. Check:

~~~powershell
node --version
git --version
~~~

In PowerShell, choose a parent folder, then:

~~~powershell
git clone https://github.com/CyberArchitecta/session-archive.git
cd session-archive
npm ci
npm start
~~~

Open the private URL printed by the server. Keep the terminal open while using the browser manager. Ctrl+C stops it. If you already cloned the repository, enter that existing folder rather than cloning over it.

Default data location: ~/.session-archive (on Windows, under your user profile). Keep that directory outside the source repository.

## 2. Import something

In the browser, click Import and choose examples/claude.json from the repository. This is synthetic sample data. You can also import examples/chatgpt.json to test identical titles from different providers.

For your own conversations, extract the provider export ZIP and select conversations.json. Existing Markdown/text transcripts can also be imported, but their message roles/project metadata are not inferred.

Select a session, save handoff notes, then copy its handoff. Pasting that text into either assistant works without installing a connector.

## 3. Connect both coding agents

Open a second PowerShell terminal in the cloned repository. These commands register the connector; they do not call models.

~~~powershell
$archiveRepo = (Get-Location).Path
$archiveNode = (Get-Command node).Source
$archiveEntry = Join-Path $archiveRepo "bin/session-archive.mjs"
$archiveData = Join-Path $env:USERPROFILE ".session-archive"

codex mcp add session-archive -- "$archiveNode" "$archiveEntry" mcp --data "$archiveData"
claude mcp add --transport stdio --scope user session-archive -- "$archiveNode" "$archiveEntry" mcp --data "$archiveData"
~~~

The second command is for **Claude Code**, not the standalone Claude chat app. Claude Desktop JSON configuration and remote ChatGPT setup are in [connectors.md](connectors.md).

If using a different browser --data directory, replace $archiveData with that same absolute path. Both agents must read the same database. Moving the repository later requires updating the registered entry path.

For macOS/Linux, use absolute paths in these equivalent commands:

~~~sh
codex mcp add session-archive -- node /absolute/path/session-archive/bin/session-archive.mjs mcp --data /absolute/private/archive
claude mcp add --transport stdio --scope user session-archive -- node /absolute/path/session-archive/bin/session-archive.mjs mcp --data /absolute/private/archive
~~~

Restart/reload the clients as required and start a fresh session. In CLI sessions, use /mcp to inspect availability. Codex desktop users can inspect their MCP server settings. The existing running assistant may not discover a newly configured server until refreshed.

The browser server does not have to remain running for stdio retrieval. Each client launches its own MCP process against the shared SQLite database.

## 4. Check it

With the sample exports imported, ask:

> Use Session Archive to search for "Garden studio plan". If there are multiple results, show their source and date. Fetch the selected handoff. Retrieve older transcript chunks if necessary. Tell me what was decided and what remains.

After manual re-import of an updated export, a connected client can retrieve its latest contents without restarting.

For real coding continuation, additionally open the **same actual project checkout** in the new coding agent. Ask it to inspect current files, git status and diffs rather than trusting an old attachment. The archive does not perform that verification itself.

## Troubleshooting and removal

- No sessions: check that browser and MCP use the same --data directory.
- Cannot find a recent conversation: it has not been imported; live capture is not implemented.
- Files look old: attachments are snapshots. Use the agent's project access to read current files.
- Unknown JSON format: native CLI JSONL is unsupported. Renaming it to .json will not convert it.
- Server not found: verify the Node executable and entry file paths.
- Port 4328 busy: use the existing server or run serve --port 4329. Both can use the same private archive.
- Remove configuration with codex mcp remove session-archive or claude mcp remove --scope user session-archive. This does not erase the archive database.

## Command references

Commands were checked against installed CLI help and official documentation on 2026-09-22:
- [Codex MCP](https://developers.openai.com/codex/mcp)
- [Claude Code MCP](https://code.claude.com/docs/en/mcp)

Actual assistant-account acceptance remains unverified. Local MCP protocol tests pass; no paid inference was required for those tests.

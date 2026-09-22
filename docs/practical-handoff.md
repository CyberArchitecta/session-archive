# Practical Codex / Claude Code handoff assessment

Tested 2026-09-22 against v0.1.0.

**Verdict: usable for manually imported conversation recall; incomplete for automatic project continuation.**

The test used a real MCP SDK client in a separate process, a synthetic conversation, and a real disposable Git working tree. No paid model inference or actual ChatGPT/Claude app account was used. This tests the incoming assistant's available tools, not its reasoning.

| Requirement | Observed result |
| --- | --- |
| Find an imported conversation by topic | Worked |
| Retrieve latest imported next step | Worked in the bounded handoff |
| Recover an earlier decision missing from the compact handoff | Worked through transcript retrieval |
| See a new message after export | Missing until re-import |
| See latest file changes | Imported attachment remained stale after the real file changed |
| See uncommitted edits, untracked files and Git history | No workspace/Git tools exist in this archive |
| Import native Codex session JSONL | Unsupported |
| Import native Claude Code session JSONL | Unsupported |
| Refresh an already-connected reader after re-import | Worked without reconnecting |

The test's earlier integer-cents decision was absent from the compact packet but present in a transcript chunk. This demonstrates why an extractive handoff cannot guarantee that every important decision is included.

## What complete project continuation requires

1. **Continuous local ingestion:** adapters for Codex and Claude Code session logs, including messages, captured tool actions/results, timestamps, session IDs and project paths. Handle partial writes, edits, resumes and restarts. Do not rely on a final model-generated summary after the account has exhausted its quota.
2. **Project identity:** repository, actual checkout/worktree, branch, HEAD, relevant external files and artifact locations. The same repository name does not mean the same files.
3. **Current workspace inspection:** read live files, inspect Git status and diffs, include untracked files, and identify the most recent test results and outstanding work. A path mentioned in an old transcript does not make its content current.
4. **History:** captured transcripts, command results and Git revisions. Uncommitted historical versions need snapshots if they must be recoverable; Git cannot reconstruct changes it never recorded.
5. **Freshness and ownership:** last captured event/time, import health, incomplete turns and whether another agent is still editing. Warn about stale capture; avoid two agents unknowingly modifying the same checkout.
6. **Bounded retrieval:** keep full captured history available, retrieve relevant portions as needed, and inspect fresh files before continuing. Loading everything into the next prompt would consume its context budget quickly.
7. **Permission-aware access:** the new agent needs access to the project and its tools. Archive access does not transfer credentials, integrations, edit permissions, running processes or another model's internal state.

For local coding work, target Codex + Claude Code in the same explicitly selected checkout first. Both can use their own file/Git tools while a shared service supplies indexed history and handoff metadata. Native consumer chat apps have a different file-access/integration surface.

The existing Claude Code Markdown archive on the developer's machine is a possible ingestion source, but v0.1.0 does not watch or automatically register it. Importing Markdown treats it as a document, not a structured native session.

## Acceptance scenario for the next version

1. Start an actual coding session and make a decision early in a long conversation.
2. Modify a tracked file without committing and create an untracked test.
3. Interrupt the first agent abruptly, without asking it for a handoff.
4. In the other agent, request continuation by topic/session name.
5. Verify it resolves the correct worktree, sees the latest captured turn, identifies the old decision, reads current file bytes, notices the untracked test and can run the relevant verification.
6. Repeat in the opposite direction and with two identically named sessions.

This assessment records missing functionality; it does not claim those features have been implemented.

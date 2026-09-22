# Verification

Initial local testing: Windows, Node 24.13.0.

Coverage:
- Selected ChatGPT branches, Claude content, missing attachment bytes.
- Invalid schemas/cyclic graphs; transactional import rollback.
- Idempotent updates, preserved notes, older snapshot rejection.
- Duplicate titles, safe keyword search, bounded handoffs, exact chunk reconstruction.
- Attachment scope, indexing and cascading deletion.
- Owner auth, origin checks, unauthorized MCP.
- OAuth PKCE, redirect/resource binding, one-use codes, refresh rotation, revocation.
- Real official SDK clients over HTTP and stdio.
- Unsafe redirects and failed consent.
- Chromium import/search/notes/copy/download/attachments/reload, unsaved-note navigation, XSS text rendering, deletion and desktop/mobile widths.

~~~sh
npm run check
npm test
python scripts/test-ui.py
~~~

Synthetic data only; no provider accounts or model inference. Generated screenshots stay in ignored scratch/.

Not verified: actual ChatGPT/Claude account connections, public TLS deployment, large real customer exports, all historical export formats. CI checks Windows/macOS/Linux and Chromium on Ubuntu; consult the release's GitHub Actions result.

OAuth has focused security regression tests, not an independent audit. Owner keys are not OAuth access tokens.

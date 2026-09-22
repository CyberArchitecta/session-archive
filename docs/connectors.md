# Connect ChatGPT and Claude

## Populate the archive first

Import conversations.json from an extracted provider export, or import Markdown/text. Connecting MCP does not export either app's history. Try examples/chatgpt.json and examples/claude.json: they deliberately use the same title.

See [Claude export instructions](https://support.claude.com/en/articles/9450526-export-your-claude-data). ChatGPT exports are requested through account data controls where available. Eligibility/delivery can vary.

## Claude Desktop: stdio

Merge this entry into your MCP configuration. Use absolute paths and the same private data directory as the browser instance.

~~~json
{
  "mcpServers": {
    "session-archive": {
      "command": "node",
      "args": [
        "/absolute/path/to/session-archive/bin/session-archive.mjs",
        "mcp",
        "--data",
        "/absolute/path/to/private-archive"
      ]
    }
  }
}
~~~

Windows JSON paths need escaped backslashes or forward slashes (C:/Users/you/...). Use an absolute Node executable if Desktop cannot resolve it from PATH. Restart/reload the client as its current setup instructions require.

The browser server need not run for stdio. Both processes share SQLite. Only configure trusted local clients; stdio runs with the local user's permissions.

## Remote ChatGPT or Claude: OAuth

A reachable HTTPS endpoint is required. This repository supplies the server; it does not purchase domains, deploy hosting, or open tunnels.

1. Run the archive on your chosen machine with a private data directory.
2. Put an HTTPS reverse proxy in front of loopback port 4328, preserving Host and Authorization headers. Forward /mcp, /authorize, /consent, /token, /register, /revoke, /.well-known/* and /style.css. Proxying the whole app is also supported; /api/* requires the owner key.
3. Configure the exact public origin:

~~~sh
node bin/session-archive.mjs serve --public-url https://archive.example.com
~~~

Example Caddy configuration on the same host:

~~~text
archive.example.com {
    reverse_proxy 127.0.0.1:4328
}
~~~

Configure DNS and HTTPS through your host/provider. Do not log authorization headers, owner keys, token responses, or conversation bodies.

4. Add https://archive.example.com/mcp in the client's custom connector/plugin setup. Choose OAuth with dynamic client registration if asked. Scope: archive:read.
5. Verify the consent page's client and redirect URL. Retrieve your owner key locally on the server:

~~~sh
node bin/session-archive.mjs key
~~~

Pass the same --data directory if customized. Enter this key only on your own archive authorization page. The connector receives a read-only OAuth token, not the owner key.

6. Enable the connector, then ask:

> Find my session named "Garden studio plan". If several match, ask which source/date I mean. Fetch a compact handoff and help me continue.

Access tokens expire after one hour; rotating refresh tokens after seven days. Restart revokes all OAuth state. Reconnect clients after restarting. This initial implementation is single-owner, not a multi-tenant identity service.

## Compatibility boundaries

- Claude Desktop stdio and remote OAuth are implemented and protocol-tested; real client/account acceptance is unverified.
- ChatGPT search/fetch and OAuth are implemented. Validate the supported web setup first; actual account and native desktop compatibility are unverified and depend on current client/plan.
- A real assistant prompt may consume normal assistant usage; the archive itself calls no models.
- Stdio tools omit citation URLs because no public document URL is known. Remote results link to the archive UI, which requires browser owner authentication.
- OAuth tokens cannot call owner administration APIs.
- No connection automatically captures subsequent conversations.

## Official references checked 2026-09-22

- [OpenAI MCP servers](https://developers.openai.com/api/docs/mcp): search/fetch, OAuth and dynamic registration.
- [Claude remote connectors](https://support.claude.com/en/articles/11175166-get-started-with-custom-connectors-using-remote-mcp): client availability and remote connection architecture.
- [MCP SDK server guide](https://ts.sdk.modelcontextprotocol.io/server): transports and authorization.

Client labels and availability can change. This server accesses only explicitly imported archive data.

import {test} from 'node:test';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import {Archive} from '../src/store.mjs';
import {startServer} from '../src/server.mjs';
import {parseImport} from '../src/import.mjs';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StreamableHTTPClientTransport} from '@modelcontextprotocol/sdk/client/streamableHttp.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {mkdtempSync,rmSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const ownerKey='test-owner-key-32-characters-minimum-abcdef';
async function boot(t){
 const archive=new Archive(':memory:');
 archive.import(parseImport(readFileSync(new URL('../examples/chatgpt.json',import.meta.url),'utf8')));
 const server=await startServer({archive,ownerKey,port:0}),base=server.url.split('/#')[0];
 t.after(async()=>{await server.close();archive.close();});
 return {archive,server,base};
}
async function authorize(base){
 let r=await fetch(base+'/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({client_name:'Test client',redirect_uris:['http://127.0.0.1:9999/callback'],token_endpoint_auth_method:'none',grant_types:['authorization_code','refresh_token'],response_types:['code']})});
 assert.equal(r.status,201);const client=await r.json(),verifier='test-code-verifier-abcdefghijklmnopqrstuvwxyz0123456789';
 const q=new URLSearchParams({client_id:client.client_id,response_type:'code',redirect_uri:client.redirect_uris[0],scope:'archive:read',code_challenge:createHash('sha256').update(verifier).digest('base64url'),code_challenge_method:'S256',state:'state-example',resource:base+'/mcp'});
 r=await fetch(base+'/authorize?'+q);assert.equal(r.status,200);
 const html=await r.text(),nonce=html.match(/name="nonce" value="([^"]+)"/)?.[1];assert.ok(nonce);assert.ok(!html.includes(ownerKey));
 r=await fetch(base+'/consent',{method:'POST',redirect:'manual',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({nonce,ownerKey})});
 assert.equal(r.status,303);const redirect=new URL(r.headers.get('location'));assert.equal(redirect.searchParams.get('state'),'state-example');
 return {client,verifier,code:redirect.searchParams.get('code')};
}
const exchange=(base,p,extra={})=>fetch(base+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'authorization_code',client_id:p.client.client_id,code:p.code,code_verifier:p.verifier,redirect_uri:p.client.redirect_uris[0],resource:base+'/mcp',...extra})});
test('private API authentication, origin checks and imports',async t=>{
 const {base}=await boot(t);
 assert.equal((await fetch(base+'/api/sessions')).status,401);
 assert.equal((await fetch(base+'/api/sessions',{headers:{Authorization:'Bearer '+ownerKey,Origin:'https://evil.example'}})).status,403);
 const r=await fetch(base+'/api/sessions',{headers:{Authorization:'Bearer '+ownerKey}});assert.equal(r.status,200);assert.equal((await r.json()).sessions.length,1);
 assert.equal((await fetch(base+'/mcp',{method:'POST'})).status,401);
});
test('OAuth PKCE, redirect binding, resource binding, single-use codes, refresh and revocation',async t=>{
 const {base}=await boot(t),p=await authorize(base);
 assert.equal((await exchange(base,p,{code_verifier:'wrong'})).status,400);
 assert.equal((await exchange(base,p,{redirect_uri:'http://127.0.0.1:9999/other'})).status,400);
 assert.equal((await exchange(base,p,{resource:'https://evil.example/mcp'})).status,400);
 const ok=await exchange(base,p);assert.equal(ok.status,200);const tokens=await ok.json();
 assert.equal((await exchange(base,p)).status,400);
 assert.equal((await fetch(base+'/api/sessions',{headers:{Authorization:'Bearer '+tokens.access_token}})).status,401);
 const refresh=await fetch(base+'/token',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({grant_type:'refresh_token',client_id:p.client.client_id,refresh_token:tokens.refresh_token,scope:'archive:read',resource:base+'/mcp'})});
 assert.equal(refresh.status,200);const next=await refresh.json();
 assert.equal((await fetch(base+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+tokens.access_token}})).status,401);
 await fetch(base+'/revoke',{method:'POST',headers:{'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({client_id:p.client.client_id,token:next.access_token})});
 assert.equal((await fetch(base+'/mcp',{method:'POST',headers:{Authorization:'Bearer '+next.access_token}})).status,401);
});
test('real SDK HTTP client discovers and calls read-only tools',async t=>{
 const {base}=await boot(t),p=await authorize(base),r=await exchange(base,p),tokens=await r.json();
 const client=new Client({name:'archive-test',version:'1.0'});
 await client.connect(new StreamableHTTPClientTransport(new URL(base+'/mcp'),{requestInit:{headers:{Authorization:'Bearer '+tokens.access_token}}}));
 t.after(()=>client.close());
 const tools=await client.listTools();assert.equal(tools.tools.length,4);assert.ok(tools.tools.every(x=>x.annotations.readOnlyHint));
 const result=await client.callTool({name:'search',arguments:{query:'garden'}});const sessions=JSON.parse(result.content[0].text).results;assert.equal(sessions.length,1);
 const fetched=await client.callTool({name:'fetch',arguments:{id:sessions[0].id,maxCharacters:1200}});
 assert.ok(JSON.parse(fetched.content[0].text).text.length<=1200);
 const missing=await client.callTool({name:'fetch',arguments:{id:'../../private'}});assert.equal(missing.isError,true);
});
test('OAuth rejects unsafe redirects, unsupported scope and incorrect owner consent',async t=>{
 const {base,server}=await boot(t);
 const r=await fetch(base+'/register',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({redirect_uris:['https://example.com/#fragment'],token_endpoint_auth_method:'none'})});assert.equal(r.status,400);
 assert.throws(()=>server.oauth.checkScopes(['archive:write']),/Only/);
 assert.throws(()=>server.oauth.consent('not-issued',ownerKey),/expired/);
 const client={client_id:'x',redirect_uris:['https://example.com/callback']};
 let html;await server.oauth.authorize(client,{codeChallenge:'abc',redirectUri:client.redirect_uris[0]}, {set(){},type(){return this;},send(v){html=v;}});
 const nonce=html.match(/name="nonce" value="([^"]+)"/)[1];
 assert.throws(()=>server.oauth.consent(nonce,'incorrect'),/Incorrect/);assert.ok(server.oauth.pending.has(nonce));
});
test('stdio connector completes MCP initialize and search without model calls',async t=>{
 const dir=mkdtempSync(join(tmpdir(),'session-archive-stdio-'));
 const a=new Archive(join(dir,'archive.sqlite3'));a.import(parseImport(readFileSync(new URL('../examples/claude.json',import.meta.url),'utf8')));a.close();
 const client=new Client({name:'stdio-test',version:'1.0'});
 const transport=new StdioClientTransport({command:process.execPath,args:['bin/session-archive.mjs','mcp','--data',dir],stderr:'pipe'});
 try{await client.connect(transport);const result=await client.callTool({name:'search',arguments:{query:'drainage'}});assert.equal(JSON.parse(result.content[0].text).results[0].source,'claude');}
 finally{await client.close();rmSync(dir,{recursive:true,force:true});}
});

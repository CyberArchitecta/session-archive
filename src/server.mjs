import express from 'express';
import { fileURLToPath } from 'node:url';
import { mcpAuthRouter } from '@modelcontextprotocol/sdk/server/auth/router.js';
import { requireBearerAuth } from '@modelcontextprotocol/sdk/server/auth/middleware/bearerAuth.js';
import { StreamableHTTPServerTransport } from '@modelcontextprotocol/sdk/server/streamableHttp.js';
import { createMcp } from './mcp.mjs';
import { OwnerOAuth, equal } from './auth.mjs';
import { parseImport } from './import.mjs';

export async function startServer({archive,ownerKey,port=4328,publicUrl,host='127.0.0.1'}) {
  if(!ownerKey || ownerKey.length<32) throw Error('A strong owner key is required.');
  if(host!=='127.0.0.1' && host!=='::1') throw Error('Bind to loopback; use an HTTPS reverse proxy for remote access.');
  if(publicUrl) {
    const u=new URL(publicUrl);
    if(u.protocol!=='https:' || u.username || u.password || u.search || u.hash || u.pathname!=='/')
      throw Error('Public URL must be an HTTPS origin, e.g. https://archive.example.com');
    publicUrl=u.origin;
  }
  const app=express(); app.disable('x-powered-by');
  // Port 0 is used by tests; middleware reads these after listen completes.
  let baseUrl,oauth;
  app.use((req,res,next)=>{
    const hosts=new Set(['127.0.0.1:'+listener.address().port,'localhost:'+listener.address().port]);
    if(publicUrl)hosts.add(new URL(publicUrl).host);
    if(!hosts.has(req.headers.host))return res.status(403).json({error:'Unrecognized Host.'});
    if(req.headers.origin && ![baseUrl,'http://127.0.0.1:'+listener.address().port,'http://localhost:'+listener.address().port].includes(req.headers.origin))
      return res.status(403).json({error:'Unrecognized Origin.'});
    res.set({'X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer','Cache-Control':'no-store',
      'Content-Security-Policy':"default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data:; connect-src 'self'; frame-ancestors 'none'; form-action 'self'; base-uri 'none'"});
    next();
  });
  const listener=await new Promise((resolve,reject)=>{const s=app.listen(port,host,()=>resolve(s));s.on('error',reject);});
  baseUrl=publicUrl ?? 'http://127.0.0.1:'+listener.address().port;
  oauth=new OwnerOAuth(ownerKey,baseUrl);
  app.use(mcpAuthRouter({provider:oauth,issuerUrl:new URL(baseUrl),resourceServerUrl:new URL(baseUrl+'/mcp'),scopesSupported:['archive:read'],resourceName:'Session Archive'}));
  app.post('/consent',express.urlencoded({extended:false,limit:'8kb'}),(req,res)=>{
    try {res.redirect(303,oauth.consent(req.body.nonce,req.body.ownerKey));}
    catch(e){res.status(400).type('text').send(e.message);}
  });
  const bearer=requireBearerAuth({verifier:oauth,requiredScopes:['archive:read'],resourceMetadataUrl:baseUrl+'/.well-known/oauth-protected-resource/mcp'});
  app.all('/mcp',bearer,async(req,res)=>{
    if(req.method!=='POST')return res.status(405).set('Allow','POST').end();
    const server=createMcp(archive,baseUrl);
    const transport=new StreamableHTTPServerTransport({sessionIdGenerator:undefined,enableJsonResponse:true});
    res.on('close',()=>{transport.close().catch(()=>{});server.close().catch(()=>{});});
    try {await server.connect(transport);await transport.handleRequest(req,res);}
    catch {if(!res.headersSent)res.status(500).json({error:'MCP request failed.'});}
  });
  app.use('/api',(req,res,next)=>{
    if(!equal(req.headers.authorization,'Bearer '+ownerKey))return res.status(401).json({error:'Open the private URL printed by the local server.'});
    next();
  },express.json({limit:'52mb'}));
  app.get('/api/sessions',(req,res)=>res.json({sessions:archive.search(req.query.q,req.query.limit,req.query.offset)}));
  app.post('/api/import',(req,res)=>res.json(archive.import(parseImport(req.body.content,req.body.filename))));
  app.get('/api/sessions/:id',(req,res)=>{
    const s=archive.get(req.params.id);
    res.json({...s,messages:undefined,messageCount:s.messages.length,handoff:archive.handoff(s.id),files:archive.files(s.id).map(({id,name,content})=>({id,name,characters:content.length}))});
  });
  app.get('/api/sessions/:id/transcript',(req,res)=>res.json(archive.chunk(req.params.id,req.query.offset,req.query.length)));
  app.get('/api/sessions/:id/handoff',(req,res)=>res.json(archive.handoff(req.params.id,req.query.budget)));
  app.put('/api/sessions/:id/notes',(req,res)=>{archive.setNotes(req.params.id,req.body.notes);res.json({ok:true});});
  app.post('/api/sessions/:id/files',(req,res)=>res.json({id:archive.addFile(req.params.id,req.body.name,req.body.content)}));
  app.get('/api/sessions/:id/files/:fileId',(req,res)=>res.json(archive.chunk(req.params.id,req.query.offset,req.query.length,req.params.fileId)));
  app.delete('/api/sessions/:id',(req,res)=>{archive.remove(req.params.id);res.json({ok:true});});
  app.use(express.static(fileURLToPath(new URL('../public',import.meta.url))));
  app.use((err,req,res,_next)=>{
    const status=err.type==='entity.too.large'?413:err.message?.includes('not found')?404:400;
    res.status(status).json({error:status===413?'File exceeds the upload size limit.':err.message ?? 'Request failed.'});
  });
  return {app,listener,oauth,url:'http://127.0.0.1:'+listener.address().port+'/#token='+ownerKey,
    close:()=>new Promise((resolve,reject)=>{listener.close(e=>e?reject(e):resolve());listener.closeAllConnections();})};
}

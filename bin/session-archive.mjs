#!/usr/bin/env node
import { join,resolve } from 'node:path';
import { homedir } from 'node:os';
import { existsSync,mkdirSync,readFileSync,writeFileSync,statSync } from 'node:fs';
import { Archive } from '../src/store.mjs';
import { parseImport,MAX_IMPORT } from '../src/import.mjs';
import { secret } from '../src/auth.mjs';
const args=process.argv.slice(2),command=args.shift()??'serve';
const take=(flag,fallback)=>{const i=args.indexOf(flag);if(i<0)return fallback;if(!args[i+1]||args[i+1].startsWith('--'))throw Error(flag+' requires a value.');const v=args[i+1];args.splice(i,2);return v;};
try {
  const dir=resolve(take('--data',process.env.SESSION_ARCHIVE_DATA ?? join(homedir(),'.session-archive')));
  if(command==='help'||command==='--help') {
    console.log('session-archive serve [--port 4328] [--public-url https://archive.example.com]\nsession-archive import <conversations.json|file.md|file.txt>\nsession-archive search <words>\nsession-archive handoff <session-id>\nsession-archive mcp\nsession-archive key\nAll commands accept --data <private directory>. No model API calls. Extract ZIP exports before importing.');process.exit(0);
  }
  mkdirSync(dir,{recursive:true,mode:0o700});
  const keyPath=join(dir,'owner.key');
  if(!existsSync(keyPath)){try {writeFileSync(keyPath,secret(),{mode:0o600,flag:'wx'});}catch(e){if(e.code!=='EEXIST')throw e;}}
  const ownerKey=readFileSync(keyPath,'utf8').trim();
  if(command==='key'){console.log(ownerKey);process.exit(0);}
  const archive=new Archive(join(dir,'archive.sqlite3'));
  if(command==='serve'){
    const port=Number(take('--port','4328')),publicUrl=take('--public-url',process.env.SESSION_ARCHIVE_PUBLIC_URL);
    if(!Number.isInteger(port)||port<0||port>65535)throw Error('Invalid port.');
    if(args.length)throw Error('Unknown arguments: '+args.join(' '));
    const {startServer}=await import('../src/server.mjs');
    const server=await startServer({archive,ownerKey,port,publicUrl});
    console.log('Session Archive (private URL; do not share):\n'+server.url);
    if(publicUrl)console.log('Remote MCP: '+publicUrl.replace(/\/$/,'')+'/mcp\nOAuth connections are revoked when this server restarts.');
    for(const signal of ['SIGINT','SIGTERM'])process.on(signal,async()=>{await server.close();archive.close();process.exit(0);});
  } else if(command==='mcp') {
    const {StdioServerTransport}=await import('@modelcontextprotocol/sdk/server/stdio.js');
    const {createMcp}=await import('../src/mcp.mjs');
    await createMcp(archive).connect(new StdioServerTransport());
  } else {
    try {
      if(command==='import'){
        if(args.length!==1)throw Error('Provide one JSON, Markdown, or text file.');
        if(statSync(args[0]).size>MAX_IMPORT)throw Error('Import file exceeds 50 MB.');
        console.log(JSON.stringify(archive.import(parseImport(readFileSync(args[0],'utf8'),args[0])),null,2));
      }else if(command==='search')console.log(JSON.stringify(archive.search(args.join(' ')),null,2));
      else if(command==='handoff'){if(args.length!==1)throw Error('Provide a session ID.');console.log(archive.handoff(args[0]).text);}
      else throw Error('Unknown command. Run session-archive help.');
    } finally {archive.close();}
  }
} catch(e){console.error(e.message);process.exitCode=1;}

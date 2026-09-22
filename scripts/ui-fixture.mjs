import {Archive} from '../src/store.mjs';
import {startServer} from '../src/server.mjs';
const archive=new Archive(':memory:');
const server=await startServer({archive,ownerKey:'fixture-key-only-not-a-real-secret-0123456789',port:0});
console.log(JSON.stringify({url:server.url}));
process.stdin.resume();
process.stdin.on('end',async()=>{await server.close();archive.close();});

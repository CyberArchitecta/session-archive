import {readdirSync} from 'node:fs';
import {join} from 'node:path';
import {spawnSync} from 'node:child_process';
function walk(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(e=>e.isDirectory()?walk(join(dir,e.name)):/\.(mjs|js)$/.test(e.name)?[join(dir,e.name)]:[]);}
for(const f of ['src','bin','public','scripts','test'].flatMap(walk)){
 const result=spawnSync(process.execPath,['--check',f],{stdio:'inherit'});if(result.status!==0)process.exit(result.status??1);
}
console.log('JavaScript syntax checks passed.');

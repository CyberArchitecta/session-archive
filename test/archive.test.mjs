import {test} from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {Archive} from '../src/store.mjs';
import {parseImport} from '../src/import.mjs';
const fixture=n=>readFileSync(new URL('../examples/'+n+'.json',import.meta.url),'utf8');
const setup=t=>{const a=new Archive(':memory:');t.after(()=>a.close());return a;};
test('ChatGPT selected branch, timestamps and missing attachment bytes are preserved',()=>{
 const [s]=parseImport(fixture('chatgpt'));
 assert.equal(s.messages.length,2);assert.match(s.messages[1].text,/timber/);assert.doesNotMatch(JSON.stringify(s.messages),/steel/);
 assert.equal(s.messages[1].attachments[0].available,false);assert.match(s.warnings[0],/branch/);assert.equal(s.updatedAt,'2024-09-22T10:23:20.000Z');
});
test('Claude content blocks import without thinking or tool results',()=>{
 const c=JSON.parse(fixture('claude'));c[0].chat_messages[1].content.push({type:'thinking',text:'private thought'},{type:'tool_result',text:'secret tool'});
 const [s]=parseImport(JSON.stringify(c));assert.match(s.messages[1].text,/slope/);assert.doesNotMatch(s.messages[1].text,/private|secret/);
});
test('malformed exports and cycles fail before insertion',()=>{
 assert.throws(()=>parseImport('['),/valid JSON/);assert.throws(()=>parseImport('[{}]'),/Unrecognized/);assert.throws(()=>parseImport('null'),/Unrecognized/);
 const c=JSON.parse(fixture('chatgpt'));c[0].mapping.u.parent='a';assert.throws(()=>parseImport(JSON.stringify(c)),/cyclic/);
 assert.throws(()=>parseImport('zip','export.zip'),/Extract ZIP/);
});
test('Markdown is stored as a document without invented roles',()=>{
 const [s]=parseImport('# My notes\nDone: paint wall','notes.md');assert.equal(s.source,'document');assert.equal(s.title,'My notes');assert.equal(s.messages[0].role,'document');
});
test('reimports are idempotent and notes survive updates',t=>{
 const a=setup(t),s=parseImport(fixture('chatgpt'));
 assert.equal(a.import(s).added,1);a.setNotes(s[0].id,'Keep this decision.');
 assert.equal(a.import(s).skipped,1);
 s[0].messages.push({role:'user',text:'New turn'});s[0].updatedAt='2025-01-01T00:00:00.000Z';
 assert.equal(a.import(s).updated,1);assert.equal(a.get(s[0].id).notes,'Keep this decision.');
 assert.equal(a.import(parseImport(fixture('chatgpt'))).skipped,1);assert.equal(a.get(s[0].id).messages.length,3);
});
test('same-title sessions remain distinct and FTS handles punctuation safely',t=>{
 const a=setup(t);a.import([...parseImport(fixture('chatgpt')),...parseImport(fixture('claude'))]);
 const results=a.search('garden studio');assert.equal(results.length,2);assert.notEqual(results[0].id,results[1].id);
 assert.equal(a.search('timber " OR *').length,0);assert.equal(a.search('drainage').length,1);
 assert.equal(a.search('"; DROP TABLE sessions;').length,0);assert.equal(a.search('').length,2);
});
test('large handoffs are bounded and transcript chunks reconstruct exact text',t=>{
 const a=setup(t),s=parseImport(fixture('chatgpt'));s[0].messages[1].text='Decision: timber.\n'.repeat(2000);a.import(s);
 a.setNotes(s[0].id,'Next: get a quote');
 const p=a.handoff(s[0].id,1200);assert.ok(p.text.length<=1200);assert.match(p.text,/get a quote/);assert.equal(p.truncated,true);
 let content='',offset=0;do {const c=a.chunk(s[0].id,offset,1999);content+=c.text;offset=c.nextOffset;}while(offset!==null);
 assert.equal(content,a.transcript(s[0].id));
});
test('attachments are explicit, searchable, scoped and removed with session',t=>{
 const a=setup(t),sessions=[...parseImport(fixture('chatgpt')),...parseImport(fixture('claude'))];a.import(sessions);
 const [s,other]=sessions,f=a.addFile(s.id,'quote.txt','Contractor cost: 7300 EUR');
 assert.equal(a.search('7300')[0].id,s.id);assert.match(a.chunk(s.id,0,100,f).text,/7300/);
 assert.throws(()=>a.chunk(other.id,0,100,f),/not found/);
 a.remove(s.id);assert.equal(a.search('7300').length,0);assert.equal(a.files(s.id).length,0);
});
test('import transaction rolls back previous inserts on failure',t=>{
 const a=setup(t),sessions=parseImport(fixture('chatgpt'));sessions.push({...sessions[0],id:undefined});
 assert.throws(()=>a.import(sessions));assert.equal(a.search('').length,0);
});

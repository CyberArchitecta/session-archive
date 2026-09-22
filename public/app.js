const $=id=>document.getElementById(id);
const fragment=new URLSearchParams(location.hash.slice(1));
if(fragment.has('token')){sessionStorage.setItem('archive-owner-key',fragment.get('token'));history.replaceState(null,'',location.pathname+location.search);}
const key=sessionStorage.getItem('archive-owner-key');
let selected=null,epoch=0,listEpoch=0,packetEpoch=0,packet='',nextOffset=null,dirty=false,loaded=0,query='',activeFile=null,fileOffset=null;
const notify=(message,error=false)=>{$('status').textContent=message;$('status').classList.toggle('error',error);};
async function api(path,options={}) {
 const res=await fetch('/api'+path,{...options,headers:{Authorization:'Bearer '+key,'Content-Type':'application/json'},body:options.body===undefined?undefined:JSON.stringify(options.body)});
 const data=await res.json();if(!res.ok)throw Error(data.error??'Request failed.');return data;
}
const run=fn=>async(...args)=>{try{await fn(...args);}catch(e){notify(e.message,true);}};
const stamp=s=>s.updatedAt?new Date(s.updatedAt).toLocaleDateString():'Date unknown';
async function list(append=false){
 const serial=++listEpoch,q=$('search').value;if(!append){loaded=0;query=q;}
 const {sessions}=await api('/sessions?q='+encodeURIComponent(q)+'&offset='+loaded+'&limit=20');
 if(serial!==listEpoch)return;
 if(!append)$('sessions').replaceChildren();
 for(const s of sessions){
  const b=document.createElement('button');b.className='session'+(s.id===selected?' active':'');b.dataset.id=s.id;
  const title=document.createElement('strong');title.textContent=s.title;
  const meta=document.createElement('span');meta.textContent=s.source+' / '+stamp(s);
  b.append(title,meta);b.onclick=run(()=>choose(s.id));$('sessions').append(b);
 }
 loaded+=sessions.length;$('more-sessions').hidden=sessions.length<20;
 if(!loaded){const p=document.createElement('p');p.className='muted';p.textContent=query?'No matching sessions. Try fewer keywords.':'Your imported sessions will appear here.';$('sessions').append(p);}
}
async function refreshPacket(id=selected,version=epoch){
 const request=++packetEpoch;
 const p=await api('/sessions/'+id+'/handoff?budget='+$('budget').value);
 if(selected!==id||epoch!==version||request!==packetEpoch)return;
 packet=p.text;$('packet').textContent=packet;$('packet-size').textContent=p.characters.toLocaleString()+' characters'+(p.truncated?' / excerpt':'');
}
async function choose(id){
 if(dirty&&!confirm('Discard unsaved handoff notes?'))return;
 const version=++epoch;
 const s=await api('/sessions/'+id);if(version!==epoch)return;
 selected=id;dirty=false;nextOffset=0;activeFile=null;fileOffset=null;
 $('welcome').hidden=true;$('detail').hidden=false;$('title').textContent=s.title;$('source').textContent=s.source;$('date').textContent=stamp(s);
 $('metadata').textContent=s.messageCount+' messages / Imported '+new Date(s.importedAt).toLocaleString();
 $('warnings').textContent=s.warnings.join(' ');$('warnings').hidden=!s.warnings.length;$('notes').value=s.notes;
 $('transcript').textContent='';$('transcript-section').open=false;$('more-transcript').hidden=true;
 $('file-preview').hidden=true;$('more-file').hidden=true;$('files').replaceChildren();
 for(const f of s.files){const b=document.createElement('button');b.className='file';b.textContent=f.name+' / '+f.characters.toLocaleString()+' characters';b.onclick=run(()=>loadFile(f.id));$('files').append(b);}
 if(!s.files.length){const p=document.createElement('p');p.className='muted';p.textContent='No text attachments yet.';$('files').append(p);}
 document.querySelectorAll('.session').forEach(b=>b.classList.toggle('active',b.dataset.id===id));
 history.replaceState(null,'','/?session='+encodeURIComponent(id));await refreshPacket(id,version);
}
async function loadTranscript(){
 if(nextOffset===null)return;const id=selected,version=epoch,offset=nextOffset;
 const c=await api('/sessions/'+id+'/transcript?offset='+offset);
 if(id!==selected||version!==epoch||offset!==nextOffset)return;
 $('transcript').textContent+=c.text;nextOffset=c.nextOffset;$('more-transcript').hidden=nextOffset===null;
}
async function loadFile(fileId,append=false){
 const id=selected,version=epoch;
 if(!append){activeFile=fileId;fileOffset=0;$('file-preview').textContent='';}
 const offset=fileOffset,c=await api('/sessions/'+id+'/files/'+fileId+'?offset='+offset);
 if(id!==selected||version!==epoch||activeFile!==fileId||offset!==fileOffset)return;
 $('file-preview').hidden=false;$('file-preview').textContent+=c.text;fileOffset=c.nextOffset;$('more-file').hidden=fileOffset===null;
}
async function importFile(file){
 if(!file)return;if(file.size>50*1024*1024)throw Error('Import files must be at most 50 MB.');
 notify('Importing '+file.name+'...');
 const result=await api('/import',{method:'POST',body:{filename:file.name,content:await file.text()}});
 $('search').value='';await list();notify(result.added+' added, '+result.updated+' updated, '+result.skipped+' unchanged or older.');
}
$('import-button').onclick=$('first-import').onclick=()=>$('import-file').click();
$('import-file').onchange=run(async()=>{try{await importFile($('import-file').files[0]);}finally{$('import-file').value='';}});
let debounce;
$('search').oninput=()=>{++listEpoch;clearTimeout(debounce);debounce=setTimeout(run(()=>list()),160);};
$('more-sessions').onclick=run(()=>list(true));
$('budget').onchange=run(()=>refreshPacket());
$('notes').oninput=()=>{dirty=true;};
$('save-notes').onclick=run(async()=>{
 const id=selected,version=epoch,value=$('notes').value;
 await api('/sessions/'+id+'/notes',{method:'PUT',body:{notes:value}});
 if(id!==selected||version!==epoch)return;
 dirty=$('notes').value!==value;await refreshPacket(id,version);notify('Notes saved.');
});
$('copy').onclick=run(async()=>{await navigator.clipboard.writeText(packet);notify(dirty?'Handoff copied. Unsaved notes are not included.':'Handoff copied. Paste it into your next conversation.');});
$('download').onclick=()=>{const url=URL.createObjectURL(new Blob([packet],{type:'text/markdown'})),a=document.createElement('a');a.href=url;a.download='session-handoff.md';a.click();setTimeout(()=>URL.revokeObjectURL(url),1000);};
$('transcript-section').ontoggle=run(async()=>{if($('transcript-section').open&&nextOffset===0)await loadTranscript();});
$('more-transcript').onclick=run(loadTranscript);
$('more-file').onclick=run(()=>loadFile(activeFile,true));
$('attach-button').onclick=()=>$('attach-file').click();
$('attach-file').onchange=run(async()=>{
 const file=$('attach-file').files[0],id=selected;try {
  if(!file)return;if(file.size>200000)throw Error('Text attachments must be at most 200,000 bytes.');
  if(dirty)throw Error('Save your notes before attaching a file.');
  const content=await file.text();if(content.includes('\u0000'))throw Error('Choose a text file, not a binary file.');
  await api('/sessions/'+id+'/files',{method:'POST',body:{name:file.name,content}});
  if(id===selected)await choose(id);notify('Text attachment imported.');
 }finally{$('attach-file').value='';}
});
$('delete').onclick=run(async()=>{
 const id=selected;if(!confirm('Delete this session, its notes, and imported text attachments from the archive? Original export files are unchanged.'))return;
 await api('/sessions/'+id,{method:'DELETE'});
 if(id===selected){epoch++;selected=null;dirty=false;$('detail').hidden=true;$('welcome').hidden=false;history.replaceState(null,'','/');}
 await list();notify('Session deleted.');
});
$('connection-help').onclick=()=>$('connections').showModal();
window.addEventListener('beforeunload',e=>{if(dirty){e.preventDefault();e.returnValue='';}});
await run(async()=>{await list();const id=new URLSearchParams(location.search).get('session');if(id)await choose(id);})();

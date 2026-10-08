/* Henri - Banque de planifications personnelle.
 * IndexedDB conserve les plans et PDF dans ce navigateur. Aucune IA distante n'est
 * configurée : l'adaptation PDF est une conversion locale, révisable par l'enseignant.
 */
const HENRI_BANK_DB='henri-planning-bank-v1';
let henriBankUseContext='general';
let henriBankCache=[];
let henriBankPreviewId=null;
function henriBankHtml(value){
  return String(value??'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;').replace(/'/g,'&#39;');
}
function henriBankNewId(prefix){
  return prefix+'-'+Date.now()+'-'+Math.random().toString(36).slice(2,10);
}
function henriBankYear(){
  const d=new Date();
  return d.getMonth()>=6?d.getFullYear()+'–'+(d.getFullYear()+1):(d.getFullYear()-1)+'–'+d.getFullYear();
}
function henriBankOpenDb(){
  return new Promise((resolve,reject)=>{
    if(!window.indexedDB){reject(new Error('Ce navigateur ne permet pas le stockage local durable.'));return;}
    const req=indexedDB.open(HENRI_BANK_DB,1);
    req.onupgradeneeded=()=>{const db=req.result;if(!db.objectStoreNames.contains('items'))db.createObjectStore('items',{keyPath:'id'});};
    req.onsuccess=()=>resolve(req.result);
    req.onerror=()=>reject(req.error||new Error('Impossible d’ouvrir la banque.'));
    req.onblocked=()=>reject(new Error('Banque verrouillée dans un autre onglet.'));
  });
}
async function henriBankTransaction(mode,handler){
  const db=await henriBankOpenDb();
  return new Promise((resolve,reject)=>{
    const tx=db.transaction('items',mode);
    const store=tx.objectStore('items');
    let value;
    try{value=handler(store);}catch(e){db.close();reject(e);return;}
    let out;
    value.onsuccess=()=>{out=value.result;};
    value.onerror=()=>{reject(value.error);};
    tx.oncomplete=()=>{db.close();resolve(out);};
    tx.onerror=()=>{db.close();reject(tx.error||new Error('Erreur de stockage.'));};
    tx.onabort=()=>{db.close();reject(tx.error||new Error('Enregistrement annulé.'));};
  });
}
function henriBankGet(id){return henriBankTransaction('readonly',s=>s.get(id));}
function henriBankAll(){return henriBankTransaction('readonly',s=>s.getAll());}
function henriBankPut(item){return henriBankTransaction('readwrite',s=>s.put(item));}
function henriBankClone(sequence){
  const copy=JSON.parse(JSON.stringify(sequence||{}));
  delete copy.groupId;delete copy.groupName;delete copy.annualBlockId;delete copy.bankId;
  delete copy.date;delete copy.startDate;delete copy.endDate;
  return copy;
}
async function henriBankStoreSequence(sequence,mode){
  if(!sequence||!Array.isArray(sequence.sessions)||!sequence.sessions.length)return;
  if(!sequence.bankId)sequence.bankId='sequence:'+String(sequence.id||henriBankNewId('seq'));
  const id=sequence.bankId,old=await henriBankGet(id);
  await henriBankPut({
    id,type:'sequence',title:(sequence.sport||'Séquence')+' · '+(sequence.sessions.length)+' cours',
    sport:sequence.sport||'',comp:sequence.comp||'C2',
    count:sequence.sessions.length,year:old?.year||henriBankYear(),
    mode:old?.mode||mode||sequence.bankCreationMode||'Henri',
    createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),
    sequence:henriBankClone(sequence)
  });
}
async function henriBankStoreSession(session,mode){
  if(!session||!Array.isArray(session.blocks)||!session.blocks.length)return;
  if(!session.bankId)session.bankId='session:'+String(session.id||henriBankNewId('cours'));
  const old=await henriBankGet(session.bankId);
  await henriBankPut({
    id:session.bankId,type:'session',title:session.title||((session.sport||'Séance')+' · séance'),
    sport:session.sport||'',comp:session.comp||'C2',count:1,
    year:old?.year||henriBankYear(),mode:old?.mode||mode||'Manuelle',
    createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),
    sequence:{sport:session.sport||'',comp:session.comp||'C2',
      objective:session.objective||'',duration:session.duration||'70 min',
      sessions:[{title:session.title||'Cours 1',objective:session.objective||'',blocks:JSON.parse(JSON.stringify(session.blocks))}]}
  });
}
async function henriBankStoreAnnual(groupId,plans){
  if(!Array.isArray(plans)||!plans.length)return;
  const key='henriAnnualBankId:'+groupId;
  let id=localStorage.getItem(key);
  if(!id){id=henriBankNewId('annual');localStorage.setItem(key,id);}
  const old=await henriBankGet(id);
  const rows=plans.map(b=>{
    const seq=getSavedSequence(groupId,b.id);
    return {block:JSON.parse(JSON.stringify(b)),sequence:seq?henriBankClone(seq):null};
  });
  const g=groupsData.find(g=>g.id===groupId);
  await henriBankPut({id,type:'annual',title:'Planification annuelle · '+(g?.name||'Groupe'),
    sport:'',comp:'',count:plans.length,year:old?.year||henriBankYear(),
    createdAt:old?.createdAt||new Date().toISOString(),updatedAt:new Date().toISOString(),
    mode:'Annuelle',annual:rows});
}
async function henriBankCaptureExisting(){
  // Déduplication par identifiants stables. Aucune liste nominative d'élèves n'est archivée.
  for(const seq of Object.values(savedSequences||{}))await henriBankStoreSequence(seq,'Créée dans Henri');
  if(activeSequence?.sessions?.length)await henriBankStoreSequence(activeSequence,'Créée dans Henri');
  if(quickSessionData?.blocks?.length)await henriBankStoreSession(quickSessionData,'Manuelle');
  for(const item of individualSessions||[])await henriBankStoreSession(item,'Créée dans Henri');
  for(const [id,plans] of Object.entries(annualPlans||{}))await henriBankStoreAnnual(id,plans);
}
function henriBankWarn(err){
  console.error('Banque Henri :',err);
  const el=document.getElementById('henriBankStatus');
  if(el)el.textContent='Erreur : '+err.message;
  alert('Banque de planifications : '+err.message);
}
async function henriBankInit(){
  try{await henriBankCaptureExisting();await henriBankRefresh();}catch(e){henriBankWarn(e);}
}
function henriBankBack(){
  const from=henriBankUseContext;
  henriBankUseContext='general';
  go(from==='annual'?'sequenceChoice':from==='standalone'?'standaloneSequence':'plan');
}
async function openHenriBank(mode='general'){
  henriBankUseContext=mode;
  const back=document.getElementById('henriBankBackBtn');
  if(back)back.textContent=mode==='annual'?'‹ Retour à la séquence':mode==='standalone'?'‹ Retour à la création':'‹ Retour à Planifier';
  go('henriBank');
  await henriBankRefresh();
}
function openHenriBankForSequence(){return openHenriBank('annual');}
function openHenriBankForStandalone(){return openHenriBank('standalone');}
async function henriBankRefresh(){
  const el=document.getElementById('henriBankList');
  if(!el)return;
  try{
    henriBankCache=(await henriBankAll()).sort((a,b)=>String(b.updatedAt||'').localeCompare(String(a.updatedAt||'')));
    const query=String(document.getElementById('henriBankSearch')?.value||'').toLowerCase().trim();
    const items=henriBankCache.filter(x=>(x.title+' '+x.sport+' '+x.year+' '+x.mode).toLowerCase().includes(query));
    const count=document.getElementById('henriBankCount');
    if(count)count.textContent=henriBankCache.length+' planification'+(henriBankCache.length!==1?'s':'')+' conservée'+(henriBankCache.length!==1?'s':'');
    if(!items.length){el.innerHTML='<div class="placeholder">Aucune planification pour cette recherche. Tes séquences enregistrées apparaîtront ici automatiquement.</div>';return;}
    el.innerHTML=items.map(item=>{
      const type=item.type==='pdf'?'PDF original':item.type==='annual'?'Planification annuelle':item.type==='session'?'Séance':'Séquence';
      const canUse=item.type!=='annual'&&(item.type!=='pdf'||!!item.sequence);
      return '<article class="henriBankCard"><div class="henriBankCardTop"><span class="compBadge">'+henriBankHtml(type)+'</span><small>'+henriBankHtml(item.year||'')+'</small></div>'+
      '<strong>'+henriBankHtml(item.title)+'</strong><span class="henriBankMeta">'+henriBankHtml([item.sport,item.comp,item.count?(item.count+' cours'):'',item.mode].filter(Boolean).join(' · '))+'</span>'+
      '<div class="henriBankActions"><button class="itemBtn" onclick="henriBankView('+JSON.stringify(item.id).replace(/"/g,'&quot;')+')">Consulter</button>'+
      (canUse?'<button class="itemBtn primary" onclick="henriBankUse('+JSON.stringify(item.id).replace(/"/g,'&quot;')+')">Réutiliser</button>':'')+
      (item.type==='pdf'?'<button class="itemBtn" onclick="henriBankPdfOpen('+JSON.stringify(item.id).replace(/"/g,'&quot;')+')">PDF original</button><button class="itemBtn" onclick="henriBankAdaptPdf('+JSON.stringify(item.id).replace(/"/g,'&quot;')+')">Adapter pour Henri</button>':'')+
      (item.type==='annual'?'<button class="itemBtn primary" onclick="henriBankApplyAnnual('+JSON.stringify(item.id).replace(/"/g,'&quot;')+')">Réutiliser l’année</button>':'')+
      '</div></article>';
    }).join('');
  }catch(e){henriBankWarn(e);}
}
async function henriBankView(id){
  const item=await henriBankGet(id);
  if(!item)return;
  const pane=document.getElementById('henriBankDetail');
  henriBankPreviewId=id;
  pane.style.display='block';
  const rows=item.sequence?.sessions||[];
  pane.innerHTML='<div class="henriBankDetailHead"><strong>'+henriBankHtml(item.title)+'</strong><button class="itemBtn" onclick="document.getElementById(\'henriBankDetail\').style.display=\'none\'">Fermer</button></div>'+
  (item.type==='pdf'&&!item.sequence?'<p>Le document PDF original est conservé sans modification. Utilise « Adapter pour Henri » pour obtenir une proposition modifiable.</p>':'')+
  rows.map((ss,i)=>'<div class="henriBankLesson"><strong>'+(i+1)+'. '+henriBankHtml(ss.title||'Cours')+'</strong><small>'+henriBankHtml(ss.objective||'')+'</small>'+
    (ss.blocks||[]).map(b=>'<p><b>'+henriBankHtml(b.type||'Section')+'</b> · '+henriBankHtml(b.title||'')+(b.notes?'<span>'+henriBankHtml(b.notes)+'</span>':'')+'</p>').join('')+'</div>').join('')+
  (item.type==='annual'?'<p>'+item.annual.length+' blocs annuels conservés, y compris leurs séquences enregistrées.</p>':'');
  pane.scrollIntoView({block:'nearest'});
}
async function henriBankUse(id){
  const item=await henriBankGet(id);
  if(!item||!item.sequence?.sessions?.length){alert('Cette planification doit d’abord être adaptée pour être réutilisée.');return;}
  if(!groupsData.length){alert('Importe d’abord tes nouveaux groupes dans les paramètres pour rattacher cette planification à ton horaire.');return;}
  const sequence=henriBankClone(item.sequence);
  sequence.id=henriBankNewId('seq');
  sequence.bankId='sequence:'+sequence.id;
  sequence.bankCreationMode='Réutilisée de la banque';
  if(henriBankUseContext==='annual'){
    const block=(annualPlans[selectedAnnualGroupId]||[]).find(x=>x.id===selectedAnnualBlockId);
    if(!block){alert('Sélectionne d’abord une séquence dans la planification annuelle.');return;}
    if(block.sport!==sequence.sport&&!confirm('La séquence de la banque concerne '+sequence.sport+' plutôt que '+block.sport+'. Remplacer le sport dans le bloc annuel?'))return;
    if(!sequence.sessions.length)return;
    block.sport=sequence.sport||block.sport;block.comp=sequence.comp||block.comp;block.courses=sequence.sessions.length;
    block.objective=sequence.objective||'';
    sequence.annualBlockId=block.id;sequence.groupId=selectedAnnualGroupId;
    sequence.groupName=groupsData.find(g=>g.id===selectedAnnualGroupId)?.name||'';
    activeSequence=sequence;
    setSavedSequence(sequence.groupId,block.id,sequence);
    saveAnnual();
    rebuildPlanningAssignments();
  }else{
    const groupId=document.getElementById('standaloneSeqGroup')?.value||groupsData[0]?.id;
    sequence.groupId=groupId;
    sequence.groupName=groupsData.find(g=>g.id===groupId)?.name||'';
    sequence.annualBlockId=null;
    activeSequence=sequence;
  }
  localStorage.setItem('henriActiveSequence',JSON.stringify(activeSequence));
  await henriBankStoreSequence(activeSequence,'Réutilisée de la banque');
  renderSequenceEditor();go('sequenceEditor');
}
async function henriBankApplyAnnual(id){
  const item=await henriBankGet(id);
  if(!item||!item.annual?.length)return;
  const groupId=document.getElementById('annualGroup')?.value||groupsData[0]?.id;
  if(!groupId){alert('Importe tes groupes de la nouvelle année, puis réutilise cette planification.');return;}
  if((annualPlans[groupId]||[]).length&&!confirm('Remplacer la planification annuelle du groupe par une copie de celle de la banque? Elle reste conservée dans la banque.'))return;
  const rows=item.annual.map(x=>{
    const block=JSON.parse(JSON.stringify(x.block));
    block.id=henriBankNewId('a');
    return {block,sequence:x.sequence?henriBankClone(x.sequence):null};
  });
  annualPlans[groupId]=rows.map(x=>x.block);
  rows.forEach(x=>{
    if(x.sequence){
      const copy=x.sequence;
      copy.id=henriBankNewId('seq');copy.bankId='sequence:'+copy.id;
      copy.annualBlockId=x.block.id;copy.groupId=groupId;copy.groupName=groupsData.find(g=>g.id===groupId)?.name||'';
      savedSequences[sequenceStorageKey(groupId,x.block.id)]=copy;
    }
  });
  saveAnnual();rebuildPlanningAssignments();
  fillPlanGroupSelects();annualGroup.value=groupId;
  renderAnnualPlanner();go('annualPlanner');
}
async function henriBankPdfOpen(id){
  const item=await henriBankGet(id);
  if(!item?.pdf){alert('PDF original introuvable.');return;}
  const url=URL.createObjectURL(item.pdf);
  const win=window.open(url,'_blank','noopener');
  if(!win)alert('Autorise les nouvelles fenêtres pour ouvrir le PDF.');
  setTimeout(()=>URL.revokeObjectURL(url),120000);
}
async function henriBankImportPdf(input){
  const files=[...(input.files||[])];input.value='';
  if(!files.length)return;
  const status=document.getElementById('henriBankStatus');
  for(const file of files){
    try{
      if(!file.name.toLowerCase().endsWith('.pdf'))throw new Error('Importer un fichier PDF.');
      if(file.size>20*1024*1024)throw new Error('PDF supérieur à 20 Mo : importer un fichier plus petit.');
      if(status)status.textContent='Lecture du PDF '+file.name+'…';
      const out=await readSetupFile(file);
      await henriBankPut({id:henriBankNewId('pdf'),type:'pdf',title:file.name.replace(/\.pdf$/i,''),
        sport:'',comp:'',count:0,mode:'Document original',year:henriBankYear(),
        createdAt:new Date().toISOString(),updatedAt:new Date().toISOString(),sourceText:out.text||'',
        pdf:new Blob([file],{type:'application/pdf'}),pdfName:file.name});
    }catch(e){henriBankWarn(e);}
  }
  if(status)status.textContent='PDF conservé tel quel. Adaptation facultative.';
  await henriBankRefresh();
}
function henriBankPdfToSequence(text,title){
  // Conversion locale indicative : aucune génération artificielle de contenu.
  const raw=String(text||'').replace(/\r/g,'\n').trim();
  const lines=raw.split(/\n|(?=\b(?:Cours|Séance)\s*(?:n°\s*)?\d+\b\s*[:.\-–])/i).map(x=>x.trim()).filter(Boolean);
  let chunks=[],current=[];
  for(const line of lines){
    if(/^(?:cours|séance)\s*(?:n°\s*)?\d+\b/i.test(line)&&current.length){
      chunks.push(current.join('\n'));current=[];
    }
    current.push(line);
  }
  if(current.length)chunks.push(current.join('\n'));
  if(!chunks.length)chunks=[raw];
  return {id:henriBankNewId('seq'),sport:title||'À préciser',comp:'C2',
    duration:'70 min',objective:'À personnaliser selon la PDA',
    sessions:chunks.map((chunk,i)=>{
      const matched=chunk.match(/^(?:cours|séance)\s*(?:n°\s*)?\d+[^\n]*/i);
      const header=matched?matched[0]:'Cours '+(i+1);
      const regex=/(échauffement|activation|éducatif\s*1|éducatif\s*2|éducatif\s*\d+|situation de partie|situation de jeu|match|partie|prestation|retour au calme|bilan)\s*[:\-–]?/ig;
      const hits=[...chunk.matchAll(regex)].filter(m=>m.index!==undefined);
      let blocks=[];
      for(let j=0;j<hits.length;j++){
        const match=hits[j],next=hits[j+1];
        const rawName=match[1].toLowerCase();
        const label=/échauffement|activation/.test(rawName)?'Échauffement':
          /éducatif/.test(rawName)?rawName.replace(/^./,c=>c.toUpperCase()):
          /partie|match|jeu/.test(rawName)?'Situation de partie':
          /prestation/.test(rawName)?'Prestation': 'Retour au calme';
        const notes=chunk.slice(match.index+match[0].length,next?next.index:chunk.length).trim();
        blocks.push({type:label,title:notes.slice(0,110)||'À détailler',notes,minutes:label==='Situation de partie'?30:label==='Échauffement'?7:12});
      }
      if(!blocks.length){
        blocks=defaultBlockSet('C2').map(x=>({...x}));
        blocks[0].notes=chunk;
        blocks[0].title='Contenu du PDF original · à répartir';
      }
      return {title:header.slice(0,130),objective:'À personnaliser',blocks};
    })};
}
async function henriBankAdaptPdf(id){
  const item=await henriBankGet(id);
  if(!item||item.type!=='pdf')return;
  if(!item.sourceText?.trim()){alert('Ce PDF ne contient pas de texte extractible. Le document original reste conservé. Une reconnaissance OCR des pages numérisées nécessitera une étape supplémentaire.');return;}
  if(!confirm('Créer une copie structurée au format Henri? Le PDF original sera conservé tel quel. La conversion automatique est indicative et devra être relue.'))return;
  item.sequence=henriBankPdfToSequence(item.sourceText,item.title);
  item.count=item.sequence.sessions.length;item.comp='C2';item.mode='PDF adapté automatiquement · à vérifier';
  item.updatedAt=new Date().toISOString();
  await henriBankPut(item);
  await henriBankRefresh();await henriBankView(id);
}
async function henriBankBlobToBase64(blob){
  const buf=new Uint8Array(await blob.arrayBuffer());
  let binary='';
  for(let i=0;i<buf.length;i+=16384)binary+=String.fromCharCode(...buf.subarray(i,i+16384));
  return btoa(binary);
}
function henriBankSaveDownload(name,body){
  const url=URL.createObjectURL(new Blob([body],{type:'application/json'}));
  const a=document.createElement('a');a.href=url;a.download=name;document.body.appendChild(a);a.click();a.remove();
  setTimeout(()=>URL.revokeObjectURL(url),60000);
}
async function henriBankExport(withSchool=false){
  await henriBankCaptureExisting();
  const items=await henriBankAll(),records=[];
  for(const entry of items){
    const value={...entry};
    if(value.pdf){value.pdfBase64=await henriBankBlobToBase64(value.pdf);delete value.pdf;}
    records.push(value);
  }
  const file={format:'henri-bank-backup-v1',exportedAt:new Date().toISOString(),items:records};
  if(withSchool)file.school={
    annualPlans,savedSequences,individualSessions,groupsData,scheduleEntries,schoolDays,
    importedSetupData,calendarExceptions,activeSequence
  };
  const date=new Date().toISOString().slice(0,10);
  henriBankSaveDownload('henri-sauvegarde-'+date+'.json',JSON.stringify(file));
  return records.length;
}
async function henriBankImportBackup(input){
  const file=input.files?.[0];input.value='';if(!file)return;
  try{
    const parsed=JSON.parse(await file.text());
    if(parsed.format!=='henri-bank-backup-v1'||!Array.isArray(parsed.items))throw new Error('Ce fichier n’est pas une sauvegarde de la banque Henri.');
    if(!confirm('Ajouter '+parsed.items.length+' planifications à ta banque? Les entrées portant le même identifiant seront remplacées.'))return;
    for(const item of parsed.items){
      if(!item.id||!['sequence','session','annual','pdf'].includes(item.type))continue;
      const copy={...item};
      if(item.pdfBase64){
        const bytes=Uint8Array.from(atob(item.pdfBase64),c=>c.charCodeAt(0));
        copy.pdf=new Blob([bytes],{type:'application/pdf'});delete copy.pdfBase64;
      }
      await henriBankPut(copy);
    }
    await henriBankRefresh();
    document.getElementById('henriBankStatus').textContent='Banque importée. Les données de l’année scolaire n’ont pas été remplacées.';
  }catch(e){henriBankWarn(e);}
}
async function henriResetSchoolYear(){
  if(!confirm('Préparer une nouvelle année scolaire? Henri retirera les groupes, les listes d’élèves, l’horaire et le calendrier de l’année courante. Toutes les planifications seront archivées dans Ma banque.'))return;
  const btn=document.getElementById('henriYearResetButton');if(btn)btn.disabled=true;
  try{
    await henriBankCaptureExisting();
    const items=await henriBankAll();
    const expected=Object.values(savedSequences).filter(s=>s?.sessions?.length).length+
      Object.values(annualPlans).filter(x=>x?.length).length;
    if(items.length<expected)throw new Error('Archivage incomplet : réinitialisation annulée.');
    await henriBankExport(true);
    if(!confirm('Une sauvegarde JSON a été préparée pour téléchargement. Vérifie qu’elle est enregistrée, puis confirme la réinitialisation. La banque reste accessible dans ce navigateur.'))return;
    const keys=['henriImportedTeacherSchedule','henriImportedSchoolCalendar','henriImportedGroups',
      'henriGroupsData','henriSchoolDays','henriScheduleEntries','henriSetupComplete','henriDemoSchedule',
      'henriAnnualPlans','henriSequences','henriIndividualSessions','henriActiveSequence',
      'henriCalendarExceptions','henriScheduleConflictIgnores'];
    keys.forEach(k=>localStorage.removeItem(k));
    Object.keys(localStorage).filter(k=>k.startsWith('henriAnnualBankId:')).forEach(k=>localStorage.removeItem(k));
    annualPlans={};savedSequences={};individualSessions=[];activeSequence=null;quickSessionData=null;
    groupsData=[];scheduleEntries={};schoolDays={};calendarExceptions=[];scheduleConflictIgnores={};
    Object.keys(importedSetupData).forEach(k=>{importedSetupData[k]=null;setupFiles[k]=false;
      const state=document.getElementById(k+'State'),card=document.getElementById(k+'Card'),input=document.getElementById(k+'File');
      if(state)state.textContent='Importer';if(card)card.classList.remove('ready');if(input)input.value='';
    });
    if(groupAIReview)groupAIReview.style.display='none';
    if(setupSuccess)setupSuccess.classList.remove('show');
    updateGenerateState();fillPlanGroupSelects();renderGroups();fillExceptionGroupOptions();
    renderCalendarExceptions();fillTeamBuilderGroups();rebuildCalendarEvents();renderMonth();renderWeek();
    document.getElementById('henriYearResetStatus').textContent='Nouvelle année prête · tes planifications sont conservées dans Ma banque.';
    await henriBankRefresh();go('settings');
  }catch(e){henriBankWarn(e);}finally{if(btn)btn.disabled=false;}
}
henriBankInit();

/* Henri — planifications PDF liées aux périodes, sans analyse ni découpage du document.
 * Les métadonnées restent dans une clé dédiée; les PDF sont conservés dans la banque IndexedDB.
 */
(function(){
'use strict';
const KEY='previewHenriSlate:calendarPdfPlans:v1';
function read(){try{const x=JSON.parse(localStorage.getItem(KEY)||'[]');return Array.isArray(x)?x:[];}catch(_){return [];}}
function esc(s){return String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function getSlot(date,index){const entry=scheduleEntries[date]?.[index];if(!entry||!isPlanningEntry(entry))return null;const groupId=getEntryGroupId(entry);return {entry,groupId,key:courseOccurrenceKey(date,entry),date,index};}
function assignment(slot){return read().find(p=>p.groupId===slot.groupId&&p.keys.includes(slot.key));}
function occupied(slot,plans){
 if(plans.some(p=>p.groupId===slot.groupId&&p.keys.includes(slot.key)))return true;
 const e=slot.entry;
 return !!(e.planData||e.annualBlockId||e.sequenceId||e.individualId||e.annualPlan||e.isIndividual);
}
function modal(){
 let el=document.getElementById('henriCalendarPdfModal');
 if(!el){el=document.createElement('div');el.id='henriCalendarPdfModal';el.style.cssText='position:fixed;inset:0;z-index:10000;background:rgba(24,40,54,.42);display:flex;align-items:center;justify-content:center;padding:20px;overflow:auto';el.onclick=e=>{if(e.target===el)el.remove();};document.body.appendChild(el);}
 return el;
}
function shell(title,body){
 const el=modal();el.innerHTML='<div role="dialog" aria-modal="true" aria-label="'+esc(title)+'" style="width:min(560px,100%);max-height:90vh;overflow:auto;background:#fff;border-radius:20px;padding:25px;box-shadow:0 20px 65px #1d34404d;color:#283747"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><h2 style="margin:0;font-size:23px">'+esc(title)+'</h2><button type="button" class="itemBtn" id="henriPdfClose">Fermer</button></div><div style="margin-top:18px">'+body+'</div></div>';
 el.querySelector('#henriPdfClose').onclick=()=>el.remove();return el;
}
function option(label,desc,fn){const b=document.createElement('button');b.type='button';b.className='itemBtn';b.style.cssText='display:block;width:100%;text-align:left;padding:15px;margin:8px 0;white-space:normal';b.innerHTML='<strong>'+esc(label)+'</strong><div style="font-size:13px;opacity:.75;margin-top:5px">'+esc(desc)+'</div>';b.onclick=fn;return b;}
function choose(date,index){
 const slot=getSlot(date,index);if(!slot)return;
 const el=shell('Planifier ce cours','<p>Choisis comment préparer cette activité. Le groupe et la date sont déjà sélectionnés.</p><div id="henriPdfChoices"></div>');
 const box=el.querySelector('#henriPdfChoices');
 box.append(
 option('Créer ma propre planification','Préparer manuellement cette séance.',()=>{el.remove();openQuickSessionForCourse(date,index);}),
 option('Utiliser Henri','Ouvrir la préparation de séance et ses options.',()=>{el.remove();openQuickSessionForCourse(date,index);}),
 option('Importer ma planification PDF','Associer le document complet à plusieurs cours consécutifs.',()=>{el.remove();importForm(date,index);}),
 option('Choisir dans ma banque','Retrouver une planification enregistrée.',()=>{el.remove();if(typeof henriBankOpen==='function')henriBankOpen();else {go('planning');}})
 );
}
function importForm(date,index){
 const slot=getSlot(date,index);if(!slot)return;
 const proposed=slot.entry.annualPlan||slot.entry.activity||'';
 const el=shell('Importer une planification PDF','<p>Le document sera conservé en entier. Henri placera les cours dans les prochaines périodes libres du groupe.</p><label style="display:block;margin:12px 0">Sport ou activité<input id="henriPdfSport" class="planControl" style="width:100%;box-sizing:border-box;margin-top:6px" placeholder="Ex. Poull Ball" value="'+esc(proposed)+'"></label><label style="display:block;margin:12px 0">Nombre de cours<input id="henriPdfCount" class="planControl" type="number" min="1" max="100" value="4" style="width:100%;box-sizing:border-box;margin-top:6px"></label><label style="display:block;margin:12px 0">Planification PDF<input id="henriPdfFile" type="file" accept=".pdf,application/pdf" style="display:block;margin-top:6px;width:100%"></label><p id="henriPdfStatus" role="status" style="font-size:13px"></p><button id="henriPdfSave" class="planPrimary" type="button">Placer automatiquement les cours</button>');
 el.querySelector('#henriPdfSave').onclick=async()=>{
 const sport=el.querySelector('#henriPdfSport').value.trim(),count=Number(el.querySelector('#henriPdfCount').value),file=el.querySelector('#henriPdfFile').files[0],status=el.querySelector('#henriPdfStatus'),button=el.querySelector('#henriPdfSave');
 if(!sport||!Number.isInteger(count)||count<1||count>100||!file||(!file.name.toLowerCase().endsWith('.pdf')&&file.type!=='application/pdf')){status.textContent='Indique le sport, un nombre de cours valide et un fichier PDF.';return;}
 if(file.size>20*1024*1024){status.textContent='Le PDF doit faire 20 Mo ou moins.';return;}
 const plans=read();
 const slots=getGroupCourseOccurrences(slot.groupId),start=slots.findIndex(s=>s.key===slot.key);
 if(start<0||occupied(slot,plans)){status.textContent='Ce cours est déjà planifié. Choisis une période libre.';return;}
 const available=slots.slice(start).filter(s=>!occupied(s,plans));
 if(available.length<count){status.textContent='Seulement '+available.length+' périodes libres sont disponibles à partir de cette date. Aucun changement enregistré.';return;}
 const keys=available.slice(0,count).map(s=>s.key);
 button.disabled=true;status.textContent='Enregistrement du PDF…';
 try{
 const id=henriBankNewId('pdf'),now=new Date().toISOString();
 await henriBankPut({id,type:'pdf',title:sport+' · '+count+' cours',sport,comp:'',count,mode:'Document original',year:henriBankYear(),createdAt:now,updatedAt:now,pdf:new Blob([file],{type:'application/pdf'}),pdfName:file.name,sourceText:''});
 try{localStorage.setItem(KEY,JSON.stringify([...plans,{id,groupId:slot.groupId,sport,count,keys,createdAt:now}]));}
 catch(error){status.textContent='Le PDF est conservé dans la banque, mais le calendrier n’a pas pu être enregistré. Réessaie après avoir libéré du stockage.';button.disabled=false;return;}
 el.remove();openCourseEntry(date,index);
 if(typeof renderWeek==='function')renderWeek();if(typeof renderMonth==='function')renderMonth();
 }catch(error){status.textContent='Import impossible : '+error.message;button.disabled=false;}
 };
}
function renderPdf(slot){
 const plan=assignment(slot);if(!plan)return false;
 const number=plan.keys.indexOf(slot.key)+1;
 const title=document.getElementById('courseDetailTitle'),session=document.getElementById('courseSessionTitle'),body=document.getElementById('coursePlanContent'),meta=document.getElementById('courseDetailMeta');
 if(title)title.textContent=plan.sport;
 if(session)session.textContent='Planification PDF · Cours '+number+'/'+plan.count;
 if(meta)meta.textContent=slot.date+' · '+slot.entry.time+' · Cours '+number+'/'+plan.count;
 if(body)body.innerHTML='<p>Le PDF original accompagne toute la séquence. À toi de retrouver le contenu du cours '+number+'.</p><button class="planPrimary" type="button" id="henriPdfOpenOriginal">Ouvrir la planification complète (PDF)</button>';
 const open=document.getElementById('henriPdfOpenOriginal');if(open)open.onclick=()=>henriBankPdfOpen(plan.id);
 return true;
}
const originalActions=window.renderCoursePlanningActions;
if(typeof originalActions==='function')window.renderCoursePlanningActions=function(entry,date,index){
 originalActions(entry,date,index);
 const slot=getSlot(date,index);if(!slot)return;
 const container=document.getElementById('coursePlanningActions');if(!container)return;
 const plan=assignment(slot);
 if(plan){const b=document.createElement('button');b.className='itemBtn';b.textContent='Ouvrir le PDF complet';b.onclick=()=>henriBankPdfOpen(plan.id);container.prepend(b);return;}
 if(!entry.planData&&!entry.sequenceId&&!entry.individualId){
 const b=document.createElement('button');b.className='itemBtn primary';b.textContent='Choisir comment planifier';b.onclick=()=>choose(date,index);container.prepend(b);
 }
};
const originalOpen=window.openCourseEntry;
if(typeof originalOpen==='function')window.openCourseEntry=function(date,index){
 originalOpen(date,index);
 const slot=getSlot(date,index);if(slot)renderPdf(slot);
};
})();

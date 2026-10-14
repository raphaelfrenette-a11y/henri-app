(function(){
'use strict';
const KEY='previewHenriSlate:evaluations:v1',SCORES='previewHenriSlate:evaluationScores:v1';
const read=k=>{try{return JSON.parse(localStorage.getItem(k)||'{}')}catch{return {}}};
const save=(k,v)=>localStorage.setItem(k,JSON.stringify(v));
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
let current=null,context=null;
const competences={C1:'Agir dans divers contextes de pratique d’activités physiques',C2:'Interagir dans divers contextes de pratique d’activités physiques',C3:'Adopter un mode de vie sain et actif'};
const defaults={
 C1:['Cohérence de la planification','Efficacité de l’exécution','Pertinence du retour réflexif'],
 C2:['Cohérence de la planification collective','Efficacité de l’exécution et de la coopération','Pertinence du retour réflexif'],
 C3:['Cohérence de la planification','Efficacité de la mise en œuvre','Pertinence du retour réflexif']
};
const root=()=>document.getElementById('henriEvalContent');
const groups=()=>typeof groupsData!=='undefined'?groupsData:[];
function open(){go('henriEvaluations');list()}
function list(){
 current=null;context=null;
 const items=Object.values(read(KEY));
 root().innerHTML='<div class="itemActions"><button class="planPrimary" onclick="henriEvalNew(false)">Créer moi-même</button><button class="itemBtn" onclick="henriEvalNew(true)">Créer avec Henri</button></div>'+
 (items.length?items.map(x=>'<div class="placeholder" style="margin-top:12px"><strong>'+esc(x.title)+'</strong><p class="muted">'+esc(x.sport)+' · '+esc(x.comp)+' · '+x.criteria.length+' critères</p><div class="itemActions"><button class="itemBtn" onclick="henriEvalEdit('+esc(JSON.stringify(x.id))+')">Modifier / attribuer</button><button class="itemBtn" onclick="henriEvalOpenResults('+esc(JSON.stringify(x.id))+')">Évaluer</button><button class="itemBtn danger" onclick="henriEvalDelete('+esc(JSON.stringify(x.id))+')">Supprimer</button></div></div>').join(''):'<p class="planHint">Aucune grille créée pour le moment.</p>');
}
function fresh(auto){
 return {id:'eval-'+Date.now(),title:'',sport:'',comp:'C2',auto,groupIds:[],courseNumber:1,lastCourse:true,sequenceTargets:{},criteria:(auto?defaults.C2:['Critère 1']).map((name,i,a)=>({id:'c'+i,name,max:10,weight:i===a.length-1?100-Math.floor(100/a.length)*(a.length-1):Math.floor(100/a.length)}))};
}
function create(auto){current=fresh(auto);editor()}
function edit(id){current=read(KEY)[id];if(current)editor()}
function sportsForSelectedGroups(){
 const selected=current?.groupIds||[];
 const sports=new Set();
 if(typeof annualPlans!=='undefined')for(const gid of selected)for(const block of (annualPlans[gid]||[]))if(block.sport)sports.add(String(block.sport).trim());
 if(typeof savedSequences!=='undefined'){
  const sequences=Array.isArray(savedSequences)?savedSequences:Object.values(savedSequences||{});
  for(const sequence of sequences)if(selected.some(id=>String(sequence.groupId)===id)&&sequence.sport)sports.add(String(sequence.sport).trim());
 }
 return [...sports].filter(Boolean).sort((a,b)=>a.localeCompare(b,'fr'));
}
function sportChoices(e){
 const sports=sportsForSelectedGroups();

 return '<select id="heSport" class="planControl" onchange="henriEvalSportChanged()"'+(!e.groupIds.length?' disabled':'')+'><option value="">'+(!e.groupIds.length?'Sélectionne d’abord un groupe':sports.length?'Choisir un sport':'Aucun sport planifié pour ces groupes')+'</option>'+sports.map(x=>'<option value="'+esc(x)+'"'+(x===e.sport?' selected':'')+'>'+esc(x)+'</option>').join('')+'</select>';
}
function sequenceTargets(groupId,sport){
 const same=value=>String(value||'').trim().toLowerCase()===String(sport||'').trim().toLowerCase();
 const blocks=(annualPlans[groupId]||[]).filter(block=>same(block.sport));
 const annual=blocks.map(block=>({key:'annual:'+block.id,count:Math.min(getSavedSequence(groupId,block.id)?.sessions.length||Number(block.courses)||0,Number(block.courses)||0)}));
 const standalone=Object.values(savedSequences).filter(sequence=>String(sequence.groupId)===String(groupId)&&!sequence.annualBlockId&&same(sequence.sport)).map(sequence=>({key:'sequence:'+sequence.id,count:sequence.sessions.length}));
 return [...annual,...standalone];
}
function selectedTarget(e){
 const gid=e.groupIds[0];if(!gid)return null;
 const targets=sequenceTargets(gid,e.sport);
 const key=e.sequenceTargets?.[gid];
 return targets.find(target=>target.key===key)||(targets.length===1?targets[0]:null);
}
function sequenceChoices(e){
 const gid=e.groupIds[0],targets=gid?sequenceTargets(gid,e.sport):[];
 const selected=selectedTarget(e);
 return '<select id="heSequence" class="planControl" onchange="henriEvalSequenceChanged()"><option value="">Choisir la séquence</option>'+targets.map((target,i)=>'<option value="'+esc(target.key)+'"'+(target.key===selected?.key?' selected':'')+'>Séquence '+(i+1)+' · '+target.count+' cours</option>').join('')+'</select>';
}
function bindTargets(e,key){
 const reference=sequenceTargets(e.groupIds[0],e.sport),index=reference.findIndex(target=>target.key===key);
 e.sequenceTargets={};
 if(index<0)return;
 for(const gid of e.groupIds){const target=sequenceTargets(gid,e.sport)[index];if(target)e.sequenceTargets[gid]=target.key;}
}
function courseChoices(e){
 const max=selectedTarget(e)?.count||0;
 const number=e.lastCourse?max:Number(e.courseNumber);
 return '<select id="heCourse" class="planControl">'+(max?Array.from({length:max},(_,i)=>'<option value="'+(i+1)+'"'+(number===i+1?' selected':'')+'>Cours '+(i+1)+(i+1===max?' · Évaluation finale':'')+'</option>').join(''):'<option value="">Sélectionne une séquence</option>')+'</select>';
}
function sequenceChanged(){collect();current.lastCourse=true;editor()}
function sportChanged(){collect();current.sequenceTargets={};current.lastCourse=true;editor()}
function groupChanged(){collect();if(!sportsForSelectedGroups().some(s=>s.toLowerCase()===current.sport.toLowerCase())){current.sport='';current.sequenceTargets={};}editor()}
function editor(){
 const e=current;if(!e)return;
 root().innerHTML='<div class="planForm"><label>Titre de la grille<input id="heTitle" class="planControl" value="'+esc(e.title)+'" placeholder="Ex. Évaluation handball"></label><strong>Groupes concernés</strong><div>'+groups().map(g=>'<label style="display:block;margin:8px 0"><input type="checkbox" class="heGroup" onchange="henriEvalGroupChanged()" value="'+esc(g.id)+'"'+(e.groupIds.includes(String(g.id))?' checked':'')+'> '+esc(g.name)+'</label>').join('')+'</div><label>Sport de la planification'+sportChoices(e)+'</label><label>Séquence'+sequenceChoices(e)+'</label><label>Cours de la séquence'+courseChoices(e)+'</label><label>Compétence<select id="heComp" class="planControl" onchange="henriEvalChangeComp(this.value)">'+Object.entries(competences).map(([k,v])=>'<option value="'+k+'"'+(e.comp===k?' selected':'')+'>'+k+' — '+esc(v)+'</option>').join('')+'</select></label><p class="planHint">Les propositions Henri sont des exemples alignés sur les grandes dimensions du cadre ministériel. Vérifie leur adaptation à la tâche et aux normes de ton école.</p><strong>Critères · points et pondération</strong><div id="heCriteria">'+e.criteria.map((c,i)=>'<div class="placeholder" style="margin-top:8px"><label>Critère '+(i+1)+'<input class="planControl heName" value="'+esc(c.name)+'"></label><label>Note maximale<input class="planControl heMax" type="number" min="1" value="'+c.max+'"></label><label>Pondération (%)<input class="planControl heWeight" type="number" min="0" value="'+c.weight+'"></label><button class="itemBtn danger" onclick="henriEvalRemoveCriterion('+i+')">Retirer</button></div>').join('')+'</div><div class="itemActions"><button class="itemBtn" onclick="henriEvalAddCriterion()">+ Critère</button><button class="planPrimary" onclick="henriEvalSave()">Enregistrer la grille</button><button class="itemBtn" onclick="henriEvalList()">Annuler</button></div></div>';
}
function collect(){
 if(!current)return;
 current.title=document.getElementById('heTitle').value.trim();
 current.sport=document.getElementById('heSport').value.trim();
 current.courseNumber=Number(document.getElementById('heCourse').value)||1;
 current.comp=document.getElementById('heComp').value;
 current.groupIds=[...document.querySelectorAll('.heGroup:checked')].map(x=>x.value);
 const selected=document.getElementById('heSequence')?.value;
 if(selected)bindTargets(current,selected);
 const target=selectedTarget(current);
 current.lastCourse=!!target&&current.courseNumber===target.count;
 const names=[...document.querySelectorAll('.heName')],maxes=[...document.querySelectorAll('.heMax')],weights=[...document.querySelectorAll('.heWeight')];
 current.criteria=names.map((n,i)=>({id:current.criteria[i]?.id||'c'+Date.now()+i,name:n.value.trim(),max:Number(maxes[i].value),weight:Number(weights[i].value)}));
}
function saveGrid(){
 collect();
 if(!current.title||!current.sport||!current.groupIds.length||!current.criteria.length||current.criteria.some(c=>!c.name||!(c.max>0)||c.weight<0)){alert('Complète le titre, le sport, les groupes et les critères.');return}
 if(!sportsForSelectedGroups().some(s=>s.toLowerCase()===current.sport.toLowerCase())){alert('Choisis un sport déjà présent dans la planification annuelle ou une séquence des groupes sélectionnés.');return}
 if(!current.groupIds.every(gid=>current.sequenceTargets?.[gid])){alert('Choisis une séquence existante pour chacun des groupes sélectionnés.');return;}
 const total=current.criteria.reduce((a,c)=>a+c.weight,0);
 if(Math.abs(total-100)>0.01){alert('Les pondérations doivent totaliser 100 %. Total actuel : '+total+' %.');return}
 const all=read(KEY);all[current.id]=current;save(KEY,all);list();
 renderMonth();renderWeek();window.HenriUX?.refresh();
}
function add(){collect();current.criteria.push({id:'c'+Date.now(),name:'Nouveau critère',max:10,weight:0});editor()}
function remove(i){collect();current.criteria.splice(i,1);editor()}
function changeComp(v){collect();current.comp=v;if(current.auto&&confirm('Remplacer les critères par les propositions Henri pour '+v+' ?'))current.criteria=defaults[v].map((name,i,a)=>({id:'c'+Date.now()+i,name,max:10,weight:i===a.length-1?100-Math.floor(100/a.length)*(a.length-1):Math.floor(100/a.length)}));editor()}
function del(id){if(!confirm('Supprimer cette grille ? Les résultats déjà enregistrés ne seront pas effacés.'))return;const all=read(KEY);delete all[id];save(KEY,all);list();renderMonth();renderWeek()}
function score(id,groupId,date){
 const e=read(KEY)[id],g=groups().find(x=>String(x.id)===String(groupId));
 if(!e||!g)return;
 context={id,groupId:String(groupId),date:date||''};go('henriEvaluations');
 const students=g.students||[];
 root().innerHTML='<h2>'+esc(e.title)+'</h2><p class="planHint">'+esc(g.name)+' · '+esc(date||'Évaluation libre')+'</p><div class="itemActions"><button class="itemBtn" onclick="henriEvalOpenBank()">Retour à mes grilles</button></div><label>Élève<select id="heStudent" class="planControl" onchange="henriEvalRenderStudent()">'+students.map((x,i)=>'<option value="'+esc(x.id??i)+'">'+esc(x.name||[x.firstName,x.lastName].filter(Boolean).join(' ')||String(x))+'</option>').join('')+'</select></label><div id="heStudentScores"></div>';
 renderStudent();
}
function results(id){const e=read(KEY)[id];if(!e)return;root().innerHTML='<h2>'+esc(e.title)+'</h2><p>Choisir un groupe :</p>'+e.groupIds.map(gid=>{const g=groups().find(x=>String(x.id)===gid);return g?'<button class="planMenuCard" onclick="henriEvalScore('+esc(JSON.stringify(id))+','+esc(JSON.stringify(gid))+',null)">'+esc(g.name)+'</button>':''}).join('')+'<button class="itemBtn" onclick="henriEvalList()">Retour</button>'}
function renderStudent(){
 const e=read(KEY)[context.id],student=document.getElementById('heStudent')?.value;if(!e||student==null)return;
 const key=[context.id,context.groupId,context.date,student].join('|'),data=read(SCORES)[key]||{};
 const fields=e.criteria.map(c=>{
  const selected=data[c.id],step=c.max<=20&&Number.isInteger(c.max)?1:c.max<=10?0.5:1;
  const values=[];for(let n=0;n<=c.max+0.00001;n+=step)values.push(Number(n.toFixed(2)));
  if(values.length>31){values.length=0;for(let n=0;n<=10;n++)values.push(Number((c.max*n/10).toFixed(2)))}
  if(!values.some(v=>v===Number(selected))&&selected!=null)values.push(Number(selected));
  values.sort((a,b)=>a-b);
  return '<div class="placeholder" style="margin:12px 0;padding:14px"><div style="display:flex;justify-content:space-between;gap:12px;align-items:center"><strong>'+esc(c.name)+'</strong><strong id="heValue_'+esc(c.id)+'">'+(selected==null?'—':selected)+' / '+c.max+'</strong></div><div class="studentMeta" style="margin:5px 0 12px">Pondération : '+c.weight+' %</div><div style="display:flex;flex-wrap:wrap;gap:7px">'+values.map(n=>'<button type="button" class="itemBtn hePick" data-id="'+esc(c.id)+'" data-value="'+n+'" style="min-width:48px;min-height:46px;touch-action:manipulation;'+(Number(selected)===n&&selected!=null?'background:#254d70;color:white;border-color:#254d70;':'')+'">'+n+'</button>').join('')+'</div><input type="hidden" class="heScore" data-id="'+esc(c.id)+'" value="'+(selected??'')+'"></div>';
 }).join('');
 root().querySelector('#heStudentScores').innerHTML=fields+'<div class="placeholder" style="margin:14px 0;padding:14px"><label for="heRemark"><strong>Remarque pour cet élève</strong></label><textarea id="heRemark" class="planControl" rows="3" style="width:100%;box-sizing:border-box;margin-top:9px" placeholder="Ex. Bonne prise de décision, mais doit améliorer ses déplacements.">'+esc(data.__remark||'')+'</textarea></div><div class="placeholder" style="margin:14px 0"><strong id="heTotal"></strong><div class="studentMeta" id="heProgress"></div></div><button class="planPrimary" onclick="henriEvalSaveScore()">Enregistrer cette évaluation</button>';
 root().querySelectorAll('.hePick').forEach(btn=>btn.addEventListener('click',()=>{
  const id=btn.dataset.id,field=[...root().querySelectorAll('.heScore')].find(x=>x.dataset.id===id);
  if(!field)return;field.value=btn.dataset.value;
  root().querySelectorAll('.hePick').forEach(x=>{if(x.dataset.id!==id)return;const active=x===btn;x.style.background=active?'#254d70':'';x.style.color=active?'white':'';x.style.borderColor=active?'#254d70':'';x.setAttribute('aria-pressed',String(active))});
  const criterion=e.criteria.find(c=>c.id===id);document.getElementById('heValue_'+id).textContent=btn.dataset.value+' / '+criterion.max;
  updateScorePreview();
 }));
 updateScorePreview();
}
function updateScorePreview(){
 const e=read(KEY)[context.id];if(!e)return;
 const fields=[...root().querySelectorAll('.heScore')],values=Object.fromEntries(fields.filter(x=>x.value!=='').map(x=>[x.dataset.id,Number(x.value)]));
 const done=e.criteria.filter(c=>values[c.id]!=null).length;
 const total=e.criteria.reduce((a,c)=>a+(values[c.id]??0)/c.max*c.weight,0);
 const label=document.getElementById('heTotal'),progress=document.getElementById('heProgress');
 if(label)label.textContent=(done===e.criteria.length?'Note finale : ':'Note provisoire : ')+total.toFixed(1)+' %';
 if(progress)progress.textContent=done+' critère'+(done>1?'s':'')+' sur '+e.criteria.length+' rempli'+(done>1?'s':'');
}
function saveScore(){
 const e=read(KEY)[context.id],student=document.getElementById('heStudent').value,key=[context.id,context.groupId,context.date,student].join('|'),values={};
 for(const field of root().querySelectorAll('.heScore')){if(field.value==='')continue;const c=e.criteria.find(x=>x.id===field.dataset.id),n=Number(field.value);if(!c||n<0||n>c.max){alert('Note invalide.');return}values[c.id]=n}
 const remark=root().querySelector('#heRemark')?.value.trim()||'';if(remark)values.__remark=remark;
 const all=read(SCORES);all[key]=values;save(SCORES,all);
 updateScorePreview();
 const progress=document.getElementById('heProgress');if(progress)progress.textContent+=' · Enregistré';
 if(typeof renderStudents==='function'&&document.getElementById('groupProfile')?.classList.contains('active'))renderStudents();
}
function studentResults(groupId,studentId){
 const scores=read(SCORES),grids=read(KEY),prefixes=[String(groupId),String(studentId)];
 const rows=[];
 for(const [key,values] of Object.entries(scores)){
  const parts=key.split('|');if(parts.length<4||parts[1]!==prefixes[0]||parts.slice(3).join('|')!==prefixes[1])continue;
  const grid=grids[parts[0]];if(!grid||!grid.criteria?.length)continue;
  const complete=grid.criteria.every(c=>values[c.id]!=null&&Number.isFinite(Number(values[c.id]))&&Number(values[c.id])>=0&&Number(values[c.id])<=c.max);
  const total=grid.criteria.reduce((sum,c)=>sum+(Number(values[c.id])||0)/c.max*c.weight,0);
  rows.push({grid,date:parts[2],values,complete,total});
 }
 rows.sort((a,b)=>b.date.localeCompare(a.date));
 if(!rows.length)return '<div class="detailRow"><div class="detailLabel">Évaluations</div><p class="studentMeta">Aucune évaluation enregistrée.</p></div>';
 return '<div class="detailRow"><div class="detailLabel">Évaluations</div>'+rows.map(r=>'<div style="padding:9px 0;border-bottom:1px solid var(--line)"><strong>'+esc(r.grid.title)+'</strong><div class="studentMeta">'+esc(r.date||'Sans date')+' · '+esc(r.grid.sport)+' · '+(r.complete?'Note finale : '+r.total.toFixed(1)+' %':'En cours · '+r.total.toFixed(1)+' % provisoire')+'</div>'+(r.values.__remark?'<p class="studentMeta" style="margin:7px 0;white-space:pre-wrap">'+esc(r.values.__remark)+'</p>':'')+'<div class="itemActions"><button type="button" class="itemBtn" onclick="henriEvalScore('+esc(JSON.stringify(r.grid.id))+','+esc(JSON.stringify(String(groupId)))+','+esc(JSON.stringify(r.date))+')">Consulter la grille</button></div></div>').join('')+'</div>';
}
function courseLabel(groupId,sport,number){
 const matches=Object.values(read(KEY)).filter(e=>e.groupIds.includes(String(groupId))&&String(e.sport).trim().toLowerCase()===String(sport).trim().toLowerCase()&&Number(e.courseNumber)===Number(number));
 return matches.map(e=>e.title).join(', ');
}
function forCourse(entry){
 const gid=getEntryGroupId(entry);if(!gid||!isPlanningEntry(entry))return [];
 const sequence=calendarSequenceFor(entry);
 const target=entry.annualBlockId?'annual:'+entry.annualBlockId:sequence?'sequence:'+sequence.id:null;
 if(!target)return [];
 const position=henriCoursePosition('',entry);if(!position)return [];
 const sport=sequence?.sport||entry.annualPlan;
 return Object.values(read(KEY)).filter(e=>{
  if(!e.groupIds?.includes(String(gid))||String(e.sport||'').trim().toLowerCase()!==String(sport||'').trim().toLowerCase())return false;
  const binding=e.sequenceTargets?.[gid];
  if(binding){if(binding!==target)return false;}
  else{
   // Legacy grids can only be inferred when the sport has a single target.
   const candidates=sequenceTargets(gid,sport);if(candidates.length!==1||candidates[0].key!==target)return false;
  }
  return e.lastCourse?henriCourseIsEvaluation(entry):Number(e.courseNumber)===position.number;
 });
}
function openCalendar(date,index){
 const entry=scheduleEntries[date]?.[index];if(!entry||!henriCourseIsEvaluation(entry))return;
 const matches=forCourse(entry);if(!matches.length)return;
 const gid=getEntryGroupId(entry);
 if(matches.length===1){score(matches[0].id,gid,date);return;}
 go('henriEvaluations');root().replaceChildren();
 const title=document.createElement('h2');title.textContent='Choisir l’évaluation planifiée';root().append(title);
 for(const grid of matches){const button=document.createElement('button');button.className='itemBtn';button.textContent=grid.title;button.onclick=()=>score(grid.id,gid,date);root().append(button);}
}
function course(entry,date,index){
 const target=document.getElementById('henriCourseEvaluations');if(!target)return;target.replaceChildren();
 const gid=getEntryGroupId(entry);
 for(const e of forCourse(entry)){const b=document.createElement('button');b.className='itemBtn';b.textContent='Évaluer · '+e.title;b.onclick=()=>score(e.id,gid,date);target.append(b)}
}
Object.assign(window,{henriEvalForCourse:forCourse,henriEvalOpenCalendar:openCalendar,henriEvalSequenceChanged:sequenceChanged,henriEvalOpenBank:open,henriEvalList:list,henriEvalNew:create,henriEvalEdit:edit,henriEvalSave:saveGrid,henriEvalAddCriterion:add,henriEvalRemoveCriterion:remove,henriEvalChangeComp:changeComp,henriEvalDelete:del,henriEvalOpenResults:results,henriEvalScore:score,henriEvalRenderStudent:renderStudent,henriEvalSaveScore:saveScore,henriEvalCourseActions:course,henriEvalStudentResults:studentResults,henriEvalSportChanged:sportChanged,henriEvalGroupChanged:groupChanged,henriEvalCourseLabel:courseLabel});
renderMonth();renderWeek();
})();
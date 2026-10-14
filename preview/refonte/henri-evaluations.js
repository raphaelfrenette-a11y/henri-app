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
 (items.length?items.map(x=>'<div class="placeholder" style="margin-top:12px"><strong>'+esc(x.title)+'</strong><p class="muted">'+esc(x.sport)+' · '+esc(x.comp)+' · '+x.criteria.length+' critères</p><div class="itemActions"><button class="itemBtn" onclick="henriEvalEdit('+JSON.stringify(x.id)+')">Modifier / attribuer</button><button class="itemBtn" onclick="henriEvalOpenResults('+JSON.stringify(x.id)+')">Évaluer</button><button class="itemBtn danger" onclick="henriEvalDelete('+JSON.stringify(x.id)+')">Supprimer</button></div></div>').join(''):'<p class="planHint">Aucune grille créée pour le moment.</p>');
}
function fresh(auto){
 return {id:'eval-'+Date.now(),title:'',sport:'Handball',comp:'C2',auto,groupIds:[],criteria:(auto?defaults.C2:['Critère 1']).map((name,i,a)=>({id:'c'+i,name,max:10,weight:Math.round(100/a.length)}))};
}
function create(auto){current=fresh(auto);editor()}
function edit(id){current=read(KEY)[id];if(current)editor()}
function editor(){
 const e=current;if(!e)return;
 root().innerHTML='<div class="planForm"><label>Titre de la grille<input id="heTitle" class="planControl" value="'+esc(e.title)+'" placeholder="Ex. Évaluation handball"></label><label>Sport<input id="heSport" class="planControl" value="'+esc(e.sport)+'"></label><label>Compétence<select id="heComp" class="planControl" onchange="henriEvalChangeComp(this.value)">'+Object.entries(competences).map(([k,v])=>'<option value="'+k+'"'+(e.comp===k?' selected':'')+'>'+k+' — '+esc(v)+'</option>').join('')+'</select></label><p class="planHint">Les propositions Henri sont des exemples alignés sur les grandes dimensions du cadre ministériel. Vérifie leur adaptation à la tâche et aux normes de ton école.</p><strong>Groupes concernés</strong><div>'+groups().map(g=>'<label style="display:block;margin:8px 0"><input type="checkbox" class="heGroup" value="'+esc(g.id)+'"'+(e.groupIds.includes(String(g.id))?' checked':'')+'> '+esc(g.name)+'</label>').join('')+'</div><strong>Critères · points et pondération</strong><div id="heCriteria">'+e.criteria.map((c,i)=>'<div class="placeholder" style="margin-top:8px"><label>Critère '+(i+1)+'<input class="planControl heName" value="'+esc(c.name)+'"></label><label>Note maximale<input class="planControl heMax" type="number" min="1" value="'+c.max+'"></label><label>Pondération (%)<input class="planControl heWeight" type="number" min="0" value="'+c.weight+'"></label><button class="itemBtn danger" onclick="henriEvalRemoveCriterion('+i+')">Retirer</button></div>').join('')+'</div><div class="itemActions"><button class="itemBtn" onclick="henriEvalAddCriterion()">+ Critère</button><button class="planPrimary" onclick="henriEvalSave()">Enregistrer la grille</button><button class="itemBtn" onclick="henriEvalList()">Annuler</button></div></div>';
}
function collect(){
 if(!current)return;
 current.title=document.getElementById('heTitle').value.trim();
 current.sport=document.getElementById('heSport').value.trim();
 current.comp=document.getElementById('heComp').value;
 current.groupIds=[...document.querySelectorAll('.heGroup:checked')].map(x=>x.value);
 const names=[...document.querySelectorAll('.heName')],maxes=[...document.querySelectorAll('.heMax')],weights=[...document.querySelectorAll('.heWeight')];
 current.criteria=names.map((n,i)=>({id:current.criteria[i]?.id||'c'+Date.now()+i,name:n.value.trim(),max:Number(maxes[i].value),weight:Number(weights[i].value)}));
}
function saveGrid(){
 collect();
 if(!current.title||!current.sport||!current.criteria.length||current.criteria.some(c=>!c.name||!(c.max>0)||c.weight<0)){alert('Complète le titre, le sport et les critères.');return}
 const total=current.criteria.reduce((a,c)=>a+c.weight,0);
 if(Math.abs(total-100)>0.01){alert('Les pondérations doivent totaliser 100 %. Total actuel : '+total+' %.');return}
 const all=read(KEY);all[current.id]=current;save(KEY,all);list();
}
function add(){collect();current.criteria.push({id:'c'+Date.now(),name:'Nouveau critère',max:10,weight:0});editor()}
function remove(i){collect();current.criteria.splice(i,1);editor()}
function changeComp(v){collect();current.comp=v;if(current.auto&&confirm('Remplacer les critères par les propositions Henri pour '+v+' ?'))current.criteria=defaults[v].map((name,i,a)=>({id:'c'+Date.now()+i,name,max:10,weight:i===a.length-1?100-Math.floor(100/a.length)*(a.length-1):Math.floor(100/a.length)}));editor()}
function del(id){if(!confirm('Supprimer cette grille ? Les résultats déjà enregistrés ne seront pas effacés.'))return;const all=read(KEY);delete all[id];save(KEY,all);list()}
function score(id,groupId,date){
 const e=read(KEY)[id],g=groups().find(x=>String(x.id)===String(groupId));
 if(!e||!g)return;
 context={id,groupId:String(groupId),date:date||''};go('henriEvaluations');
 const students=g.students||[];
 root().innerHTML='<h2>'+esc(e.title)+'</h2><p class="planHint">'+esc(g.name)+' · '+esc(date||'Évaluation libre')+'</p><div class="itemActions"><button class="itemBtn" onclick="henriEvalOpenBank()">Retour à mes grilles</button></div><label>Élève<select id="heStudent" class="planControl" onchange="henriEvalRenderStudent()">'+students.map((x,i)=>'<option value="'+esc(x.id??i)+'">'+esc(x.name||[x.firstName,x.lastName].filter(Boolean).join(' ')||String(x))+'</option>').join('')+'</select></label><div id="heStudentScores"></div>';
 renderStudent();
}
function results(id){const e=read(KEY)[id];if(!e)return;root().innerHTML='<h2>'+esc(e.title)+'</h2><p>Choisir un groupe :</p>'+e.groupIds.map(gid=>{const g=groups().find(x=>String(x.id)===gid);return g?'<button class="planMenuCard" onclick="henriEvalScore('+JSON.stringify(id)+','+JSON.stringify(gid)+',null)">'+esc(g.name)+'</button>':''}).join('')+'<button class="itemBtn" onclick="henriEvalList()">Retour</button>'}
function renderStudent(){
 const e=read(KEY)[context.id],student=document.getElementById('heStudent')?.value;if(!e||student==null)return;
 const key=[context.id,context.groupId,context.date,student].join('|'),data=read(SCORES)[key]||{};
 const fields=e.criteria.map(c=>'<label style="display:block;margin:12px 0">'+esc(c.name)+' (/'+c.max+', '+c.weight+' %)<input class="planControl heScore" type="number" min="0" max="'+c.max+'" step="0.5" data-id="'+esc(c.id)+'" value="'+(data[c.id]??'')+'"></label>').join('');
 root().querySelector('#heStudentScores').innerHTML=fields+'<button class="planPrimary" onclick="henriEvalSaveScore()">Enregistrer cette évaluation</button><p id="heTotal" class="planHint"></p>';
}
function saveScore(){
 const e=read(KEY)[context.id],student=document.getElementById('heStudent').value,key=[context.id,context.groupId,context.date,student].join('|'),values={};
 for(const field of document.querySelectorAll('.heScore')){if(field.value==='')continue;const c=e.criteria.find(x=>x.id===field.dataset.id),n=Number(field.value);if(!c||n<0||n>c.max){alert('Note invalide.');return}values[c.id]=n}
 const all=read(SCORES);all[key]=values;save(SCORES,all);
 const complete=e.criteria.every(c=>values[c.id]!=null);
 const total=e.criteria.reduce((a,c)=>a+(values[c.id]??0)/c.max*c.weight,0);
 document.getElementById('heTotal').textContent=(complete?'Note finale : ':'Note provisoire : ')+total.toFixed(1)+' % — Enregistré';
}
function course(entry,date,index){
 const target=document.getElementById('henriCourseEvaluations');if(!target)return;target.replaceChildren();
 const gid=typeof getEntryGroupId==='function'?getEntryGroupId(entry):null;
 const sport=String(entry.annualPlan||'').trim().toLowerCase();
 const matches=Object.values(read(KEY)).filter(e=>e.groupIds.includes(String(gid))&&e.sport.trim().toLowerCase()===sport);
 for(const e of matches){const b=document.createElement('button');b.className='itemBtn';b.textContent='Évaluer · '+e.title;b.onclick=()=>score(e.id,gid,date);target.append(b)}
}
Object.assign(window,{henriEvalOpenBank:open,henriEvalList:list,henriEvalNew:create,henriEvalEdit:edit,henriEvalSave:saveGrid,henriEvalAddCriterion:add,henriEvalRemoveCriterion:remove,henriEvalChangeComp:changeComp,henriEvalDelete:del,henriEvalOpenResults:results,henriEvalScore:score,henriEvalRenderStudent:renderStudent,henriEvalSaveScore:saveScore,henriEvalCourseActions:course});
})();
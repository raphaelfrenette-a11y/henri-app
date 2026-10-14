let calendarCourseContext=null;
let calendarPlanEditing=false;
let calendarIndividualEditing=null;
let quickPrefillCourseKey=null;

function mergeImportedGroups(incoming,existing){
  const result=[];
  for(const group of incoming){
    const candidates=[...new Map([...existing,...result].map(g=>[g.id,g])).values()];
    const previous=HenriImport.matchGroup(group.sourceCodes?.[0]||group.name,candidates);
    const target=result.find(g=>g.id===previous?.id);
    const students=group.students.map(student=>{
      const old=previous?.students.find(s=>normalizeGroupAlias(s.name)===normalizeGroupAlias(student.name));
      return old?{...old,name:student.name}:student;
    });
    if(target){
      target.students=[...target.students,...students.filter(s=>!target.students.some(old=>normalizeGroupAlias(old.name)===normalizeGroupAlias(s.name)))];
      target.aliases=[...new Set([...(target.aliases||[]),...(group.aliases||[])])];
      target.sourceFiles=[...new Set([...(target.sourceFiles||[target.sourceFile]),group.sourceFile])];
    }else result.push({...group,id:previous?.id||group.id,students,sourceFiles:[group.sourceFile]});
  }
  return [...result,...existing.filter(g=>!result.some(x=>x.id===g.id))];
}
function refreshImportedLinks(){
  if(!importedSetupData.teacherSchedule)return;
  importedSetupData.teacherSchedule=HenriImport.relink(importedSetupData.teacherSchedule,importedSetupData.groupSheets||[]);
  localStorage.setItem('previewHenriSlate:henriImportedTeacherSchedule',JSON.stringify(importedSetupData.teacherSchedule));
}
function renderImportLinksReview(){
  const container=document.getElementById('importLinksReview');
  if(!container)return;
  const teacher=importedSetupData.teacherSchedule,calendar=importedSetupData.schoolCalendar,groups=importedSetupData.groupSheets;
  container.hidden=!teacher&&!calendar&&!groups;
  const report=HenriImport.review(teacher,calendar,groups);
  generateScheduleBtn.disabled=!(teacher&&calendar&&groups?.length&&Object.values(setupFiles).every(Boolean));
  container.replaceChildren();
  const title=document.createElement('strong');title.textContent='Liens entre tes documents';container.append(title);
  const summary=document.createElement('p');
  summary.textContent=report.dates.length?'Du '+report.dates[0]+' au '+report.dates.at(-1)+' · '+report.cycleDates.length+' jours de classe · '+report.lessons.filter(l=>l.matchedGroupId).length+'/'+report.lessons.length+' créneaux associés aux listes d’élèves.':'Importe le calendrier, ton horaire et tes listes de groupes, dans l’ordre de ton choix.';
  container.append(summary);
  for(const message of [...report.errors,...report.warnings]){const p=document.createElement('p');p.textContent=message;container.append(p);}
  if(report.ready){const p=document.createElement('p');p.textContent='Les documents sont reliés. Vérifie les cours ci-dessous, puis génère ton année.';container.append(p);}
  for(const [day,lessons] of Object.entries(teacher||{})){
    const details=document.createElement('details'),heading=document.createElement('summary');
    heading.textContent=day+' · '+lessons.filter(isPlanningEntry).length+' cours d’éducation physique'+(lessons.some(HenriImport.isCognitive)?' · intégration cognitive':'');details.append(heading);
    lessons.forEach((lesson,index)=>{
      const row=document.createElement('div');row.className='planField';row.style.padding='8px';
      const label=document.createElement('label');label.textContent=(lesson.groupCode||lesson.group)+' · '+(lesson.time||'Période à préciser')+(lesson.kind==='cognitive'?' · Intervention cognitive':'');row.append(label);
      const select=document.createElement('select');select.className='planControl';select.setAttribute('aria-label',day+' cours '+(index+1)+' : groupe');
      select.add(new Option('Choisir le groupe',''));
      for(const g of groups||[])select.add(new Option(g.name+' · '+g.students.length+' élèves',g.id));
      select.value=lesson.matchedGroupId||'';
      select.onchange=()=>{lesson.matchedGroupId=select.value||null;const group=groups.find(g=>g.id===select.value);if(group)lesson.group=group.name;localStorage.setItem('previewHenriSlate:henriImportedTeacherSchedule',JSON.stringify(teacher));renderImportLinksReview();};
      row.append(select);
      const time=document.createElement('input');time.className='planControl';time.value=lesson.time;time.placeholder='8 h 10 ou Période 1';time.setAttribute('aria-label',day+' cours '+(index+1)+' : heure ou période');
      time.onchange=()=>{if(!/^(?:\d{1,2}\s*h\s*\d{2}|\d{1,2}:\d{2}|Période\s*\d{1,2})$/i.test(time.value)||scheduleTimeMinutes(time.value)>=1440){alert('Indique une heure comme 8 h 10 ou une période comme Période 1.');return}lesson.time=time.value;const period=time.value.match(/Période\s*(\d+)/i);lesson.period=period?Number(period[1]):null;localStorage.setItem('previewHenriSlate:henriImportedTeacherSchedule',JSON.stringify(teacher));renderImportLinksReview();};
      row.append(time);details.append(row);
      const kind=document.createElement('select');kind.className='planControl';kind.setAttribute('aria-label',day+' créneau '+(index+1)+' : type');
      kind.add(new Option('Cours d’éducation physique','course'));kind.add(new Option('Intégration cognitive · devoirs (20 min)','cognitive'));
      kind.value=HenriImport.isCognitive(lesson)?'cognitive':'course';
      kind.onchange=()=>{lesson.kind=kind.value;lesson.activity=kind.value==='cognitive'?'Intégration cognitive':'Éducation physique';if(kind.value==='cognitive'){lesson.period=null;lesson.durationMinutes=20;}localStorage.setItem('previewHenriSlate:henriImportedTeacherSchedule',JSON.stringify(teacher));renderImportLinksReview();};
      row.append(kind);
    });container.append(details);
  }
  if(calendar){
    const details=document.createElement('details'),heading=document.createElement('summary');heading.textContent='Vérifier ou corriger les dates reconnues';details.append(heading);
    const hint=document.createElement('p');hint.textContent='Une date par ligne, par exemple : 2026-11-23 · Jour 1, 2026-12-25 · Congé. Complète les dates manquantes sans modifier les jours de tes documents.';details.append(hint);
    const input=document.createElement('textarea');input.rows=12;input.style.width='100%';input.setAttribute('aria-label','Dates du calendrier scolaire');input.value=report.dates.map(d=>d+' · '+calendar[d]).join('\n');details.append(input);
    const save=document.createElement('button');save.className='itemBtn';save.textContent='Appliquer les corrections';save.onclick=()=>{
      try{const parsed=HenriImport.calendarText(input.value);if(Object.keys(parsed).length!==input.value.split('\n').filter(s=>s.trim()).length)throw new Error('Chaque ligne doit indiquer une date valide et son jour-cycle, congé ou journée pédagogique.');importedSetupData.schoolCalendar=parsed;localStorage.setItem('previewHenriSlate:henriImportedSchoolCalendar',JSON.stringify(parsed));renderImportLinksReview();}catch(e){alert(e.message);}
    };details.append(save);container.append(details);
  }
}

function isPlanningEntry(entry){return !HenriImport.isCognitive(entry);}
function courseOccurrenceKey(date,entry){return date+'|'+(entry.period?'P'+entry.period:entry.time);}
function getGroupCourseOccurrences(groupId){
  return Object.keys(scheduleEntries).sort().flatMap(date=>getVisibleScheduleEntries(date).filter(entry=>isPlanningEntry(entry)&&getEntryGroupId(entry)===groupId).map(entry=>({date,key:courseOccurrenceKey(date,entry),entry,index:scheduleEntries[date].indexOf(entry)})));
}
function individualForOccurrence(groupId,slot){
  return individualSessions.find(x=>x.groupId===groupId&&(x.courseKey?x.courseKey===slot.key:x.date===slot.date&&getGroupCourseOccurrences(groupId).find(s=>s.date===slot.date)?.key===slot.key));
}
function datedSequences(groupId){return Object.values(savedSequences).filter(s=>s.groupId===groupId&&!s.annualBlockId&&s.startCourseKey);}
function getDatedSequenceOccurrences(sequence){
  const raw=Object.keys(scheduleEntries).sort().flatMap(date=>sortScheduleEntries(scheduleEntries[date]).filter(entry=>isPlanningEntry(entry)&&getEntryGroupId(entry)===sequence.groupId).map(entry=>({date,key:courseOccurrenceKey(date,entry),entry,index:scheduleEntries[date].indexOf(entry)})));
  const visible=new Set(getGroupCourseOccurrences(sequence.groupId).map(slot=>slot.key));
  const sequences=[...datedSequences(sequence.groupId).filter(s=>s.id!==sequence.id),sequence].sort((a,b)=>{
    return raw.findIndex(s=>s.key===a.startCourseKey)-raw.findIndex(s=>s.key===b.startCourseKey)||a.id.localeCompare(b.id);
  });
  const reserved=new Set();let result=[];
  for(const current of sequences){
    const start=raw.findIndex(s=>s.key===current.startCourseKey);
    const placed=start<0?[]:raw.slice(start).filter(s=>visible.has(s.key)&&!reserved.has(s.key)&&!individualForOccurrence(sequence.groupId,s)).slice(0,current.sessions.length);
    placed.forEach(s=>reserved.add(s.key));
    if(current.id===sequence.id)result=placed;
  }
  return result;
}
const henriSequenceJumpsKey='previewHenriSlate:sequenceJumps:v1';
function henriReadSequenceJumps(){
  try{return JSON.parse(localStorage.getItem(henriSequenceJumpsKey)||'{}');}
  catch(error){console.warn('Lecture des ajustements de séquence impossible',error);return {};}
}
function henriSequenceJumpId(groupId,slot){return String(groupId)+'|'+slot.key;}
function henriSaveSequenceJump(groupId,slot,target){
  const jumps=henriReadSequenceJumps();
  jumps[henriSequenceJumpId(groupId,slot)]=target;
  localStorage.setItem(henriSequenceJumpsKey,JSON.stringify(jumps));
  rebuildPlanningAssignments();
}
function getGroupAnnualOccurrences(groupId){
  const reserved=new Set(datedSequences(groupId).flatMap(getDatedSequenceOccurrences).map(s=>s.key));
  return getGroupCourseOccurrences(groupId).filter(slot=>{
    const individual=individualForOccurrence(groupId,slot);
    return !reserved.has(slot.key)&&!individual?.independent;
  });
}
function getSequenceOccurrences(sequence){
  if(sequence?.startCourseKey)return getDatedSequenceOccurrences(sequence);
  if(!sequence?.annualBlockId)return [];
  const blocks=annualPlans[sequence.groupId]||[],index=blocks.findIndex(b=>b.id===sequence.annualBlockId);
  if(index<0)return [];
  const offset=blocks.slice(0,index).reduce((sum,b)=>sum+Math.max(0,Number(b.courses)||0),0);
  const slots=getGroupAnnualOccurrences(sequence.groupId).slice(offset,offset+Math.max(0,Number(blocks[index].courses)||0));
  const jumps=henriReadSequenceJumps();let shift=0;
  const result=[];
  slots.forEach((slot,period)=>{
    const jump=jumps[henriSequenceJumpId(sequence.groupId,slot)];
    if(jump?.blockId===sequence.annualBlockId&&Number.isInteger(jump.sessionIndex)&&jump.sessionIndex>period+shift)shift=jump.sessionIndex-period;
    const sessionIndex=period+shift;
    if(sessionIndex<sequence.sessions.length)result[sessionIndex]=slot;
  });
  return result;
}
function rebuildCalendarPlanning(){
  if(typeof groupsData==='undefined')return;
  for(const entry of Object.values(scheduleEntries).flat())Object.assign(entry,{annualPlan:null,sequence:null,session:null,annualBlockId:null,sequenceId:null,sessionIndex:null,sessionId:null,courseIndex:null,courseTotal:null,individualId:null,planData:null,isIndividual:false});
  for(const group of groupsData){
    ensureAnnualPlan(group.id);
    for(const slot of getGroupCourseOccurrences(group.id)){
      const individual=individualForOccurrence(group.id,slot);
      if(individual)Object.assign(slot.entry,{annualPlan:individual.sport,sequence:'Séance individuelle',session:individual.title,isIndividual:true,individualId:individual.id,planData:{title:individual.title,objective:individual.objective,blocks:individual.blocks}});
    }
    for(const sequence of datedSequences(group.id))getDatedSequenceOccurrences(sequence).forEach((slot,index)=>Object.assign(slot.entry,{annualPlan:sequence.sport,sequence:sequence.sport,sequenceId:sequence.id,sessionIndex:index,sessionId:sequence.sessions[index]?.id||null,session:'Séance '+(index+1)+'/'+sequence.sessions.length,planData:sequence.sessions[index]}));
    const queue=[];
    for(const block of annualPlans[group.id]){
      const saved=getSavedSequence(group.id,block.id);
      for(let index=0;index<Math.max(0,Number(block.courses)||0);index++){
        const session=saved?.sessions[index];
        queue.push({annualPlan:block.sport,annualBlockId:block.id,courseIndex:index,courseTotal:Number(block.courses),sequenceId:session?saved.id:null,sequence:session?'Séquence planifiée':'Séquence à planifier',sessionIndex:session?index:null,sessionId:session?.id||null,session:session?'Séance '+(index+1)+'/'+saved.sessions.length:'À planifier',planData:session||null});
      }
    }
    const jumps=henriReadSequenceJumps();
    let blockId=null,lessonOffset=0;
    getGroupAnnualOccurrences(group.id).forEach((slot,index)=>{
      const base=queue[index];if(!base)return;
      if(base.annualBlockId!==blockId){blockId=base.annualBlockId;lessonOffset=0;}
      const jump=jumps[henriSequenceJumpId(group.id,slot)];
      const blockStart=queue.findIndex(item=>item.annualBlockId===blockId);
      const periodIndex=index-blockStart;
      // A standalone session replaces this period without moving later blocks.
      if(slot.entry.isIndividual){Object.assign(slot.entry,{annualBlockId:base.annualBlockId,courseIndex:base.courseIndex,courseTotal:base.courseTotal});return;}
      if(jump?.blockId===blockId&&Number.isInteger(jump.sessionIndex)&&jump.sessionIndex>periodIndex+lessonOffset)lessonOffset=jump.sessionIndex-periodIndex;
      const target=queue[index+lessonOffset];
      if(target?.annualBlockId===blockId)Object.assign(slot.entry,target);
      else Object.assign(slot.entry,{...base,sequenceId:null,sessionId:null,sessionIndex:null,session:'À planifier',planData:null});
    });
  }
  // Calendar content is rebuilt from canonical planning data on every load.
  rebuildCalendarEvents();renderMonth();renderWeek();
}
function renderSequenceDatePlacement(){
  const box=document.getElementById('sequenceDatePlacement'),select=document.getElementById('sequenceStartSlot');
  if(!box)return;box.hidden=!!activeSequence?.annualBlockId;
  if(box.hidden||!activeSequence)return;
  const previous=select.value;select.replaceChildren();
  for(const slot of getGroupCourseOccurrences(activeSequence.groupId))select.add(new Option(formatSequenceDate(slot.date)+' · '+slot.entry.time,slot.key));
  select.value=activeSequence.startCourseKey||previous||select.options[0]?.value||'';
}
function scheduleStandaloneSequence(){
  if(!activeSequence||activeSequence.annualBlockId)return;
  const key=document.getElementById('sequenceStartSlot').value;
  const candidate={...activeSequence,startCourseKey:key};
  const dates=getDatedSequenceOccurrences(candidate);
  if(!key||dates[0]?.key!==key||dates.length!==candidate.sessions.length){alert('Ce cours est occupé ou il ne reste pas assez de périodes pour placer toutes les séances. Choisis un autre cours.');return}
  const occupied=new Set(datedSequences(candidate.groupId).filter(s=>s.id!==candidate.id).flatMap(getDatedSequenceOccurrences).map(s=>s.key));
  if(dates.some(s=>occupied.has(s.key))){alert('Une autre séquence est déjà placée sur ces cours. Choisis une autre période.');return}
  activeSequence.startCourseKey=key;
  savedSequences['dated::'+activeSequence.id]=JSON.parse(JSON.stringify(activeSequence));
  henriPersistSharedState();rebuildPlanningAssignments();renderSequenceEditor();
  alert('Séquence placée dans le calendrier. Tu peux ouvrir chaque séance depuis son cours.');
}
function henriIndividualAtCourse(date,entry){
  const groupId=getEntryGroupId(entry);
  if(!groupId)return null;
  const slot=getGroupCourseOccurrences(groupId).find(s=>s.key===courseOccurrenceKey(date,entry));
  return slot?individualForOccurrence(groupId,slot):null;
}
function henriEditIndividualFromCourse(date,index){
  const entry=scheduleEntries[date]?.[index];
  const individual=entry&&henriIndividualAtCourse(date,entry);
  if(!individual)return;
  const title=prompt('Titre de cette séance individuelle :',individual.title||'');
  if(title===null)return;
  if(!title.trim()){alert('Le titre ne peut pas être vide.');return;}
  individual.title=title.trim();
  individual.sport=title.trim();
  localStorage.setItem('previewHenriSlate:henriIndividualSessions',JSON.stringify(individualSessions));
  rebuildPlanningAssignments();
  openCourseEntry(date,index);
}
function henriDeleteIndividualFromCourse(date,index){
  const entry=scheduleEntries[date]?.[index];
  const individual=entry&&henriIndividualAtCourse(date,entry);
  if(!individual||!confirm('Supprimer cette séance individuelle uniquement pour cette période ? La planification annuelle reprendra sa place.'))return;
  individualSessions=individualSessions.filter(x=>x.id!==individual.id);
  localStorage.setItem('previewHenriSlate:henriIndividualSessions',JSON.stringify(individualSessions));
  rebuildPlanningAssignments();
  openCourseEntry(date,index);
}
function renderCoursePlanningActions(entry,date,index){
  const container=document.getElementById('coursePlanningActions');container.replaceChildren();
  const add=(text,fn)=>{const button=document.createElement('button');button.className='itemBtn';button.textContent=text;button.onclick=fn;container.append(button);};
  const cancelled=getCalendarException(date,getEntryGroupId(entry),entry);
  if(cancelled){if(cancelled.courseKey)add('Rétablir ce cours',()=>henriRestoreCancelledCourse(cancelled.id,date));return;}
  if(isPlanningEntry(entry))add('Annuler ce cours',()=>henriOpenCancellationForm(date,index));
  const individual=isPlanningEntry(entry)?henriIndividualAtCourse(date,entry):null;
  if(individual){
    add('Modifier le titre',()=>henriEditIndividualFromCourse(date,index));
    add('Modifier le contenu',()=>openCalendarSession(date,index));
    add('Supprimer cette séance',()=>henriDeleteIndividualFromCourse(date,index));
  }else{
    if(isPlanningEntry(entry)&&entry.planData)add('Ouvrir la séance',()=>openCalendarSession(date,index));
    else if(isPlanningEntry(entry)){
      if(entry.annualBlockId)add(getSavedSequence(getEntryGroupId(entry),entry.annualBlockId)?'Créer / compléter la séquence':'Créer la séquence',()=>openCalendarSequence(date,index));
      add('Créer une séance seule',()=>openQuickSessionForCourse(date,index));
    }
    if(isPlanningEntry(entry))add('Remplacer cette période',()=>openQuickSessionForCourse(date,index));
    if(isPlanningEntry(entry)&&entry.planData&&entry.annualBlockId)add('Changer de cours dans la séquence',()=>henriChooseSequenceCourse(date,index));
    if(isPlanningEntry(entry)&&entry.planData&&(entry.annualBlockId||entry.sequenceId))add('Ouvrir la séquence',()=>openCalendarSequence(date,index));
  }
}
function henriChooseSequenceCourse(date,index){
  const entry=scheduleEntries[date]?.[index];
  const groupId=entry&&getEntryGroupId(entry);
  const slot=groupId&&getGroupCourseOccurrences(groupId).find(s=>s.key===courseOccurrenceKey(date,entry));
  if(!slot||!entry.annualBlockId)return;
  const block=(annualPlans[groupId]||[]).find(b=>b.id===entry.annualBlockId);
  if(!block)return;
  const current=Number(entry.sessionIndex)||0;
  const count=Math.max(0,Number(block.courses)||0);
  if(count<=current+1){alert('Aucun cours suivant dans cette séquence.');return;}
  const container=document.getElementById('coursePlanningActions');
  container.querySelector('#henriCourseJumpPicker')?.remove();
  const wrapper=document.createElement('div');
  wrapper.id='henriCourseJumpPicker';
  wrapper.className='placeholder';
  wrapper.style.cssText='width:100%;box-sizing:border-box;margin-top:12px;padding:14px';
  const title=document.createElement('strong');title.textContent='Quel cours faire à cette période ?';
  const info=document.createElement('p');info.className='studentMeta';info.textContent='Cours actuel : '+(current+1)+' · '+block.sport+'. Les cours intermédiaires seront sautés dans le calendrier de ce groupe, mais conservés dans ta banque.';
  const select=document.createElement('select');select.className='planControl';select.style.cssText='width:100%;margin:10px 0';
  for(let n=current+2;n<=count;n++){
    const option=document.createElement('option');option.value=String(n);
    const grid=typeof henriEvalCourseLabel==='function'?henriEvalCourseLabel(groupId,block.sport,n):'';
    option.textContent='Cours '+n+(grid?' — Évaluation : '+grid:'');
    select.append(option);
  }
  const actions=document.createElement('div');actions.className='itemActions';
  const apply=document.createElement('button');apply.className='planPrimary';apply.type='button';apply.textContent='Appliquer ce changement';
  apply.onclick=()=>{
    const number=Number(select.value);
    if(!Number.isInteger(number)||number<=current+1||number>count)return;
    if(!confirm('Faire le cours '+number+' à cette période pour ce groupe ? Les cours intermédiaires seront sautés, mais conservés dans la banque.'))return;
    henriSaveSequenceJump(groupId,slot,{blockId:block.id,sessionIndex:number-1});
    openCourseEntry(date,index);
  };
  const cancel=document.createElement('button');cancel.className='itemBtn';cancel.type='button';cancel.textContent='Annuler';cancel.onclick=()=>wrapper.remove();
  actions.append(apply,cancel);wrapper.append(title,info,select,actions);container.append(wrapper);
}
function calendarSequenceFor(entry){
  return entry.annualBlockId?getSavedSequence(getEntryGroupId(entry),entry.annualBlockId):Object.values(savedSequences).find(s=>s.id===entry.sequenceId);
}
function openCalendarSequence(date,index){
  const entry=scheduleEntries[date]?.[index];if(!entry||!isPlanningEntry(entry))return;
  calendarCourseContext={date,index};calendarPlanEditing=true;
  const saved=calendarSequenceFor(entry);
  if(saved){activeSequence=JSON.parse(JSON.stringify(saved));renderSequenceEditor();go('sequenceEditor');}
  else if(entry.annualBlockId)openMacroSequence(getEntryGroupId(entry),entry.annualBlockId,true);
}
function openCalendarSession(date,index){
  const entry=scheduleEntries[date]?.[index];if(!entry||!isPlanningEntry(entry))return;
  calendarCourseContext={date,index};calendarPlanEditing=true;
  const individual=henriIndividualAtCourse(date,entry);
  if(individual){
    calendarIndividualEditing=individual.id;quickSessionData=JSON.parse(JSON.stringify(individual));openSessionEditor(0,'quick');
  }else{
    const saved=calendarSequenceFor(entry);if(!saved)return;
    const sessionIndex=entry.sessionId?saved.sessions.findIndex(session=>session.id===entry.sessionId):entry.sessionIndex;
    if(!Number.isInteger(sessionIndex)||sessionIndex<0||!saved.sessions[sessionIndex])return;
    activeSequence=JSON.parse(JSON.stringify(saved));openSessionEditor(sessionIndex,'sequence');
  }
}
function persistCalendarIndividual(){
  if(!calendarIndividualEditing||!quickSessionData)return;
  const index=individualSessions.findIndex(x=>x.id===calendarIndividualEditing);
  if(index<0)return;
  const updated=JSON.parse(JSON.stringify(quickSessionData));
  updated.sport=updated.title?.trim()||updated.sport;
  individualSessions[index]={...individualSessions[index],...updated};
  localStorage.setItem('previewHenriSlate:henriIndividualSessions',JSON.stringify(individualSessions));
  rebuildPlanningAssignments();
}

// Calendar cards open the exact session; unplanned cards show both creation paths.
function openCalendarCourse(date,index){
  const entry=scheduleEntries[date]?.[index];if(!entry)return;
  if(getCalendarException(date,getEntryGroupId(entry),entry)){openDayPlan(date);return;}
  if(isPlanningEntry(entry)){
    const individual=henriIndividualAtCourse(date,entry);
    const saved=calendarSequenceFor(entry);
    const sessionIndex=entry.sessionId?saved?.sessions.findIndex(session=>session.id===entry.sessionId):entry.sessionIndex;
    if(individual||(Number.isInteger(sessionIndex)&&sessionIndex>=0&&saved?.sessions[sessionIndex])){
      openCalendarSession(date,index);return;
    }
  }
  openCourseEntry(date,index);
}

function henriCourseIsEvaluation(entry){
  if(!isPlanningEntry(entry)||entry.isIndividual||henriIsPoolball(entry.annualPlan))return false;
  const groupId=getEntryGroupId(entry);
  const sequence=calendarSequenceFor(entry);
  const block=(annualPlans[groupId]||[]).find(block=>block.id===entry.annualBlockId);
  const count=String(block?.sport||'').trim().toLowerCase()==='ultimate'&&Number(block.courses)===4?4:sequence?.sessions.length?Math.min(sequence.sessions.length,Number(block?.courses)||sequence.sessions.length):Number(block?.courses)||0;
  const index=Number.isInteger(entry.courseIndex)?entry.courseIndex:entry.sessionIndex;
  return count>0&&index===count-1;
}
function henriCalendarEvaluationButton(date,entry,index){
  if(!henriCourseIsEvaluation(entry))return '';
  const planned=typeof henriEvalForCourse==='function'?henriEvalForCourse(entry):[];
  const label=planned.length?'Ouvrir l’évaluation planifiée':'Évaluation non planifiée';
  return '<button type="button" class="calendarEvaluationButton" data-date="'+date+'" aria-label="'+planningHtml(label)+'" '+(planned.length?'onclick="henriEvalOpenCalendar(&quot;'+date+'&quot;,'+index+')"':'disabled title="Planifie d’abord une évaluation dans Planifier."')+'>Évaluation'+(planned.length?' ›':'')+'</button>';
}

function henriIsPoolball(value){
  const name=String(value||'').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toLowerCase().replace(/[^a-z0-9]/g,'');
  return /^(?:poolball|poull?ball)(?:1|seanceindividuelle|seance1)?$/.test(name);
}
function henriCalendarSportLabel(entry){
  const sport=entry.annualPlan||(henriIsPoolball(entry.activity)?entry.activity:'');
  return henriIsPoolball(sport)?'Poolball 1':sport;
}

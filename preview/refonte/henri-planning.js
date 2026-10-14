/* Planning workflows use the existing group/block/sequence IDs and storage keys. */
let annualBulkSelection=new Set();
let planningActionBusy=false;
function planningHtml(value){return String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));}
function planningId(prefix){return prefix+'-'+(globalThis.crypto?.randomUUID?.()||Date.now()+'-'+Math.random().toString(36).slice(2));}
function planningReport(message,error=false){
  const node=document.getElementById('henriActionStatus');
  if(node){node.hidden=false;node.textContent=message;node.classList.toggle('actionError',error);}
}
function planningError(error){console.error('Planification Henri',error);planningReport('Action non confirmée : '+error.message,true);}
function requirePlanningGroup(id){
  const group=groupsData.find(g=>g.id===id);
  if(!group){planningReport('Importe tes groupes dans Paramètres avant de planifier.',true);return null;}
  return group;
}
function renderAnnualTargets(){
  const list=document.getElementById('annualTargetGroups');if(!list)return;
  const selected=annualTargetIds();list.replaceChildren();
  for(const group of groupsData){
    const label=document.createElement('label'),input=document.createElement('input'),text=document.createElement('span');
    input.type='checkbox';input.value=group.id;input.checked=selected.includes(group.id);
    input.onchange=()=>{annualBulkSelection=new Set(annualTargetIds());input.checked?annualBulkSelection.add(group.id):annualBulkSelection.delete(group.id);renderAnnualTargets();};
    text.textContent=group.name+' · '+getGroupCourseSlots(group.id)+' périodes disponibles';label.append(input,text);list.append(label);
  }
  const summary=document.getElementById('annualTargetSummary');summary.textContent='Choisir les groupes · '+selected.length+' sélectionné'+(selected.length>1?'s':'');
}
function annualTargetIds(){return [...annualBulkSelection].filter(id=>groupsData.some(g=>g.id===id)).length?[...annualBulkSelection].filter(id=>groupsData.some(g=>g.id===id)):[annualGroup.value].filter(Boolean);}
function selectAllAnnualGroups(){annualBulkSelection=new Set(groupsData.filter(g=>getGroupCourseSlots(g.id)>0).map(g=>g.id));renderAnnualTargets();}
function selectSingleAnnualGroup(){annualBulkSelection.clear();renderAnnualTargets();}
function annualGroupChanged(){
  annualSequenceCount.dataset.manual='0';
  renderAnnualTargets();renderAnnualPlanner();setAnnualWorkspaceVisible(!!annualPlans[annualGroup.value]?.length);
}
function openAnnualPlanner(){
  calendarPlanEditing=false;calendarIndividualEditing=null;
  fillPlanGroupSelects();annualBulkSelection.clear();renderAnnualTargets();
  annualManualWrap.classList.remove('show');go('annualPlanner');
  if(!requirePlanningGroup(annualGroup.value)){setAnnualWorkspaceVisible(false);return;}
  renderAnnualPlanner();setAnnualWorkspaceVisible(!!annualPlans[annualGroup.value]?.length);
}
function toggleAnnualManualSetup(force){
  if(!requirePlanningGroup(annualGroup.value))return;
  const show=typeof force==='boolean'?force:!annualManualWrap.classList.contains('show');
  annualManualWrap.classList.toggle('show',show);
  setAnnualWorkspaceVisible(!!annualPlans[annualGroup.value]?.length);
  if(show){annualSequenceCount.dataset.manual='0';updateAnnualRecommendation(false);annualManualWrap.scrollIntoView({block:'nearest'});}
}
function getAnnualCoverageStatus(groupId){
  const courseDates=getGroupCourseDates(groupId),dates=Object.keys(schoolDays||{}).sort();
  const first=dates[0]||null,last=dates.at(-1)||null;
  const spanDays=first&&last?(new Date(last+'T12:00:00')-new Date(first+'T12:00:00'))/86400000:0;
  let missing=false;
  if(first&&last)for(let d=new Date(first+'T12:00:00'),end=new Date(last+'T12:00:00');d<=end;d.setDate(d.getDate()+1)){
    if(d.getDay()>0&&d.getDay()<6&&!schoolDays[dateKey(d.getFullYear(),d.getMonth(),d.getDate())]){missing=true;break;}
  }
  const cycles=dates.filter(d=>/^Jour \d+$/.test(schoolDays[d])).length;
  return {complete:courseDates.length>0&&spanDays>=180&&cycles>=80&&!missing,courseDates,first,last,spanDays};
}
function getAnnualRecommendation(groupId,targetLength){
  const coverage=getAnnualCoverageStatus(groupId),possible=getGroupCourseSlots(groupId),target=Math.max(1,Number(targetLength)||5);
  const recommended=Math.max(1,Math.min(possible,Math.round(possible/target)||1)),profile=getHenriCompetenceProfile(groupId);
  const competenceCounts=HenriPedagogy.counts(recommended,profile.level,allocateCompetenceCounts(recommended,profile.weights));
  return {possible,target,recommended,coverage,profile,competenceCounts};
}
function distributeAnnualCourses(total,count){return HenriPedagogy.distribution(Number(total),Number(count));}
function updateAnnualRecommendation(forceCount=false){
  const group=requirePlanningGroup(annualGroup.value);if(!group)return;
  const rec=getAnnualRecommendation(group.id,annualTargetLength.value),manual=annualManualWrap.classList.contains('show');
  if(forceCount||annualSequenceCount.dataset.manual!=='1')annualSequenceCount.value=rec.recommended;
  const requested=Number(annualSequenceCount.value);
  annualBuildBtn.disabled=rec.possible===0||manual&&(!Number.isInteger(requested)||requested<1||requested>500);
  annualBuildBtn.onclick=()=>applyAnnualStructure(false);annualBuildBtn.textContent='Créer ma répartition';
  annualHenriModeBtn.disabled=!rec.coverage.complete||!rec.possible;
  document.getElementById('annualAvailability').textContent=rec.coverage.complete?rec.possible+' périodes disponibles. Choisis une méthode pour créer une nouvelle répartition.':'Calendrier incomplet : génère ton année dans Paramètres pour activer la recommandation Henri. La création manuelle reste possible si des périodes sont déjà disponibles.';
  annualRecommendation.hidden=false;annualRecommendation.style.display='block';
  if(!rec.coverage.complete){
    annualRecommendation.textContent='Calendrier incomplet : '+rec.possible+' périodes disponibles pour le moment. Tu peux préparer une répartition manuelle; la recommandation annuelle sera disponible après génération de toute l’année.';
    annualDataWarning.innerHTML='<p class="planHint"><button class="itemBtn" onclick="go(\'settings\')">Compléter mes documents</button></p>';
  }else{
    annualDataWarning.replaceChildren();
    const count=manual?Math.max(1,Math.min(rec.possible,Math.floor(Number(annualSequenceCount.value)||rec.recommended))):rec.recommended;
    const counts=HenriPedagogy.counts(count,rec.profile.level,allocateCompetenceCounts(count,rec.profile.weights));
    annualRecommendation.innerHTML='<strong>'+planningHtml(rec.profile.level.label)+' · '+rec.possible+' périodes disponibles</strong><span>'+count+' séquences couvriront ces périodes. '+(manual?'Les blocs de départ seront en C2, puis modifiables.':'Profil Henri : C1 '+counts.C1+' · C2 '+counts.C2+' · C3 '+counts.C3+'.')+'</span><span class="annualRecNote">Profil pédagogique proposé, sans quota ministériel. Au secondaire : priorité à C2, une part de C3 et au plus une séquence C1. À adapter aux apprentissages et à l’évaluation des trois compétences.</span>';
  }
  document.getElementById('annualManualModeBtn').disabled=!rec.possible;
  if(manual&&annualBuildBtn.disabled&&rec.possible)document.getElementById('annualAvailability').textContent='Indique un nombre entier de séquences entre 1 et 500 pour créer ta répartition.';
  if(!rec.possible)planningReport('Aucune période disponible pour ce groupe. Génère ton horaire dans Paramètres.',true);
}
async function archivePlanningSequence(sequence){
  if(!sequence?.sessions?.length)return;
  const copy=JSON.parse(JSON.stringify(sequence));copy.id=planningId('archive');copy.bankId='archive:'+copy.id;
  await henriBankStoreSequence(copy,'Copie avant modification');
}
async function applyAnnualStructure(useRecommended=false){
  if(planningActionBusy)return false;
  const ids=annualTargetIds(),proposed={};
  if(!useRecommended&&(!Number.isInteger(Number(annualSequenceCount.value))||Number(annualSequenceCount.value)<1||Number(annualSequenceCount.value)>500)){planningReport('Indique un nombre entier de séquences entre 1 et 500.',true);return false;}
  if(!ids.length){planningReport('Choisis au moins un groupe.',true);return false;}
  for(const id of ids){
    const group=requirePlanningGroup(id);if(!group)return false;
    const rec=getAnnualRecommendation(id,annualTargetLength.value);
    if(!rec.possible||useRecommended&&!rec.coverage.complete){planningReport(group.name+' : '+(!rec.possible?'aucune période disponible.':'génère toute l’année avant d’utiliser la recommandation Henri.'),true);return false;}
    const count=useRecommended?rec.recommended:Math.min(rec.possible,Math.max(1,Math.floor(Number(annualSequenceCount.value)||1)));
    const courses=distributeAnnualCourses(rec.possible,count),counts=HenriPedagogy.counts(count,rec.profile.level,allocateCompetenceCounts(count,rec.profile.weights));
    const order=useRecommended?buildCompetenceOrder(counts):Array(count).fill('C2');
    proposed[id]=courses.map((n,i)=>({id:planningId('annual'),comp:order[i],sport:useRecommended&&order[i]==='C3'?'Conditionnement physique':'À choisir',courses:n,lockedCourses:false,henriRecommended:useRecommended}));
  }
  const existing=ids.filter(id=>annualPlans[id]?.length);
  if(existing.length&&!confirm('Remplacer la répartition de '+existing.length+' groupe(s) ? Les anciens blocs et séquences seront conservés dans Ma banque.'))return false;
  planningActionBusy=true;annualHenriModeBtn.disabled=true;annualBuildBtn.disabled=true;
  try{
    for(const id of existing){
      await henriBankStoreAnnual(id,annualPlans[id]);
      for(const block of annualPlans[id]){
        const sequence=activeSequence?.groupId===id&&activeSequence.annualBlockId===block.id?activeSequence:getSavedSequence(id,block.id);
        if(sequence)await archivePlanningSequence(sequence);
      }
    }
    const snapshot=JSON.stringify({annualPlans,savedSequences,activeSequence});
    try{
      for(const id of ids){
        annualPlans[id]=proposed[id];delete scheduleConflictIgnores[id];
        if(activeSequence?.groupId===id&&activeSequence.annualBlockId)activeSequence={...activeSequence,annualBlockId:null};
      }
      henriPersistSharedState();
    }catch(error){const before=JSON.parse(snapshot);annualPlans=before.annualPlans;savedSequences=before.savedSequences;activeSequence=before.activeSequence;throw error;}
    for(const id of existing)localStorage.removeItem('previewHenriSlate:henriAnnualBankId:'+id);
    saveConflictIgnores();annualGroup.value=ids[0];rebuildPlanningAssignments();renderAnnualPlanner();renderAnnualTargets();
    annualManualWrap.classList.remove('show');setAnnualWorkspaceVisible(true);
    planningReport('Répartition créée pour '+ids.length+' groupe(s). Chaque groupe utilise ses propres périodes. Les sports peuvent être choisis plus tard.');
    for(const id of ids)henriBankStoreAnnual(id,annualPlans[id]).catch(planningError);
    return true;
  }catch(error){planningError(error);return false;}
  finally{planningActionBusy=false;updateAnnualRecommendation(false);}
}
function organizeAnnualWithHenri(){return applyAnnualStructure(true);}
function useAnnualRecommendation(){return applyAnnualStructure(true);}
function makeSequence({comp,sport,groupId,groupName,count,duration,annualBlockId=null,useHenri=false}){
  count=Math.max(1,Math.min(500,Math.floor(Number(count)||1)));
  const level=inferGroupSchoolLevel(groupId);
  return {id:planningId('seq'),annualBlockId,comp,sport,groupId,groupName,duration,bankCreationMode:useHenri?'Planification Henri':'Création manuelle',objective:useHenri?(getObjectiveSuggestions(sport,comp)[0]||''):'',sessions:Array.from({length:count},(_,index)=>HenriPedagogy.session({sport,comp,index,count,duration,useHenri,level}))};
}
function planningNewSession(sequence,index,count){return HenriPedagogy.session({sport:sequence.sport,comp:sequence.comp,index,count,duration:sequence.duration,useHenri:sequence.bankCreationMode==='Planification Henri',level:inferGroupSchoolLevel(sequence.groupId)});}
function synchronizeAnnualSequences(){
  for(const [groupId,blocks] of Object.entries(annualPlans))for(const block of blocks){
    const saved=getSavedSequence(groupId,block.id);if(!saved)continue;
    saved.comp=block.comp;saved.sport=block.sport;saved.groupId=groupId;saved.groupName=groupsData.find(g=>g.id===groupId)?.name||saved.groupName;
    saved.objective=block.objective??saved.objective;
    if(activeSequence?.groupId===groupId&&activeSequence.annualBlockId===block.id){
      activeSequence.comp=block.comp;activeSequence.sport=block.sport;activeSequence.objective=block.objective??activeSequence.objective;
    }
  }
}
async function updateAnnualBlock(id,patch,groupId=annualGroup.value){
  const block=(annualPlans[groupId]||[]).find(b=>b.id===id);if(!block)return false;
  const saved=getSavedSequence(groupId,id),draft=activeSequence?.groupId===groupId&&activeSequence.annualBlockId===id?activeSequence:saved;
  const courses=patch.courses===undefined?block.courses:Math.max(1,Math.min(500,Math.floor(Number(patch.courses)||1)));
  if(draft&&courses<draft.sessions.length){
    if(!confirm('Réduire cette séquence à '+courses+' séances ? Les dernières séances seront retirées; une copie complète sera conservée dans Ma banque.'))return false;
    try{await archivePlanningSequence(draft);}catch(error){planningError(error);return false;}
  }
  const before=JSON.stringify({annualPlans,savedSequences,activeSequence});
  try{
    const previous={sport:block.sport,comp:block.comp};Object.assign(block,patch,{courses});
    if(patch.comp||patch.sport)updateAnnualObjectiveForSportOrComp(block,previous);
    if(patch.courses!==undefined)block.lockedCourses=true;
    if(draft){
      const sequence=JSON.parse(JSON.stringify(draft));sequence.comp=block.comp;sequence.sport=block.sport;sequence.objective=block.objective??sequence.objective;
      sequence.sessions=sequence.sessions.slice(0,courses);
      while(sequence.sessions.length<courses)sequence.sessions.push(planningNewSession(sequence,sequence.sessions.length,courses));
      savedSequences[sequenceStorageKey(groupId,id)]=sequence;
      if(activeSequence?.groupId===groupId&&activeSequence.annualBlockId===id)activeSequence=JSON.parse(JSON.stringify(sequence));
    }
    saveAnnual();renderAnnualPlanner();
    planningReport('Bloc mis à jour. Les contenus conservés restent modifiables; vérifie leur pertinence si tu changes de sport ou de compétence.');return true;
  }catch(error){const snapshot=JSON.parse(before);annualPlans=snapshot.annualPlans;savedSequences=snapshot.savedSequences;activeSequence=snapshot.activeSequence;planningError(error);renderAnnualPlanner();return false;}
}
function setAnnualBlockComp(id,value){if(['C1','C2','C3'].includes(value))return updateAnnualBlock(id,{comp:value});}
function setAnnualBlockSport(id,value){
  if(!value)return;
  if(value==='__other__'){value=prompt('Sport / moyen d’action','');if(!value?.trim())return;}
  return updateAnnualBlock(id,{sport:value.trim()});
}
function adjustAnnualCourses(id,delta){const b=(annualPlans[annualGroup.value]||[]).find(b=>b.id===id);if(b)return updateAnnualBlock(id,{courses:Number(b.courses)+delta});}
function editAnnualBlock(id){
  const b=(annualPlans[annualGroup.value]||[]).find(b=>b.id===id);if(!b)return;
  const sport=prompt('Sport / moyen d’action (vide = à choisir)',b.sport==='À choisir'?'':b.sport);if(sport===null)return;
  const comp=prompt('Compétence : C1, C2 ou C3',b.comp);if(comp===null)return;
  const courses=prompt('Nombre de séances / périodes',b.courses);if(courses===null)return;
  if(!['C1','C2','C3'].includes(comp.toUpperCase())||!/^\d+$/.test(courses)||Number(courses)<1){planningReport('Indique une compétence C1/C2/C3 et un nombre entier positif.',true);return;}
  return updateAnnualBlock(id,{sport:sport.trim()||'À choisir',comp:comp.toUpperCase(),courses:Number(courses)});
}
async function deleteAnnualBlock(id){
  const groupId=annualGroup.value,block=(annualPlans[groupId]||[]).find(b=>b.id===id);if(!block)return;
  if(!confirm('Supprimer ce bloc annuel ? Sa séquence, si elle existe, sera conservée dans Ma banque.'))return;
  const sequence=activeSequence?.groupId===groupId&&activeSequence.annualBlockId===id?activeSequence:getSavedSequence(groupId,id);
  const before=JSON.stringify({annualPlans,savedSequences,activeSequence});
  try{
    if(sequence)await archivePlanningSequence(sequence);
    annualPlans[groupId]=annualPlans[groupId].filter(b=>b.id!==id);
    // Keep older saved entries recoverable; they no longer occupy calendar periods.
    if(activeSequence?.groupId===groupId&&activeSequence.annualBlockId===id)activeSequence={...activeSequence,annualBlockId:null};
    saveAnnual();renderAnnualPlanner();planningReport('Bloc retiré. Les autres blocs et leurs contenus sont conservés.');
  }catch(error){const snapshot=JSON.parse(before);annualPlans=snapshot.annualPlans;savedSequences=snapshot.savedSequences;activeSequence=snapshot.activeSequence;planningError(error);renderAnnualPlanner();}
}
function saveAnnualAndPlanSequences(){
  const sourceId=annualGroup.value;
  if(!requirePlanningGroup(sourceId))return;
  const source=annualPlans[sourceId];
  if(!source?.length){planningReport('Crée ta répartition avant de l’enregistrer.',true);return;}
  const ids=annualTargetIds();
  if(!ids.length){planningReport('Sélectionne au moins un groupe.',true);return;}
  const snapshot=JSON.stringify({annualPlans,savedSequences,activeSequence});
  try{
    // The edited annual plan is the template for all selected groups.
    // Keep each group's actual number of available teaching periods.
    for(const id of ids){
      if(id===sourceId)continue;
      const available=getGroupCourseSlots(id);
      if(!available)continue;
      const total=source.reduce((sum,b)=>sum+Math.max(0,Number(b.courses)||0),0);
      let allocated=0;
      annualPlans[id]=source.map((block,index)=>{
        const end=total?Math.round(source.slice(0,index+1).reduce((sum,b)=>sum+Math.max(0,Number(b.courses)||0),0)*available/total):0;
        const courses=Math.max(0,end-allocated);allocated=end;
        return {...block,id:planningId('annual'),courses};
      }).filter(b=>b.courses>0);
      // Previously saved sequences refer to the old annual block IDs; leave them
      // in the bank rather than associating them with a different sport.
    }
    henriPersistSharedState();
    rebuildPlanningAssignments();
    renderMonth();renderWeek();
    for(const id of ids)if(annualPlans[id]?.length&&typeof henriBankStoreAnnual==='function')henriBankStoreAnnual(id,annualPlans[id]).catch(planningError);
    go('home');setCalendarView('month');
    planningReport('Planification appliquée au calendrier pour '+ids.length+' groupe(s), selon leurs périodes réelles.');
  }catch(error){
    const before=JSON.parse(snapshot);
    annualPlans=before.annualPlans;savedSequences=before.savedSequences;activeSequence=before.activeSequence;
    planningError(error);
  }
}
function openMacroSequence(groupId,blockId,fromCalendar=false){
  calendarPlanEditing=fromCalendar;calendarIndividualEditing=null;
  const block=(annualPlans[groupId]||[]).find(b=>b.id===blockId),group=requirePlanningGroup(groupId);if(!block||!group)return;
  selectedAnnualGroupId=groupId;selectedAnnualBlockId=blockId;
  const range=getAnnualRanges(groupId,annualPlans[groupId])[annualPlans[groupId].indexOf(block)];
  sequenceChoiceHero.replaceChildren();
  const title=document.createElement('h2');title.textContent=block.sport==='À choisir'?'Préparer cette séquence':block.sport;
  const meta=document.createElement('p');meta.textContent=group.name+' · '+block.comp+' · '+block.courses+' séances · '+(range?.start?formatPlanDate(range.start)+' au '+formatPlanDate(range.end):'Dates à venir');sequenceChoiceHero.append(title,meta);
  macroSport.innerHTML=getAnnualSportOptions(block.comp);
  if(block.sport&&block.sport!=='À choisir'){
    if(![...macroSport.options].some(o=>o.value===block.sport))macroSport.add(new Option(block.sport,block.sport));macroSport.value=block.sport;
  }
  macroCount.value=block.courses;macroCustomSport.value='';macroCustomSport.hidden=true;
  macroDuration.value=getSavedSequence(groupId,blockId)?.duration||'70 min';
  existingSequenceAction.innerHTML=getSavedSequence(groupId,blockId)?'<button class="planPrimary" onclick="continueSavedSequence()">Continuer / modifier ma séquence</button>':'';
  go('sequenceChoice');
}
async function createSequenceFromMacro(useHenri){
  if(planningActionBusy)return;
  const block=(annualPlans[selectedAnnualGroupId]||[]).find(b=>b.id===selectedAnnualBlockId),group=requirePlanningGroup(selectedAnnualGroupId);if(!block||!group)return;
  const sport=macroSport.value==='__other__'?macroCustomSport.value.trim():macroSport.value;
  const count=Number(macroCount.value);
  if(!sport||!Number.isInteger(count)||count<1||count>500){planningReport('Choisis un sport et un nombre entier de séances entre 1 et 500.',true);return;}
  const previous=activeSequence?.groupId===group.id&&activeSequence.annualBlockId===block.id?activeSequence:getSavedSequence(group.id,block.id);
  if(previous&&!confirm('Remplacer la séquence existante par '+(useHenri?'la proposition Henri':'un gabarit vierge')+' ? Une copie complète sera conservée dans Ma banque.'))return;
  planningActionBusy=true;
  const before=JSON.stringify({annualPlans,savedSequences,activeSequence});
  try{
    if(previous)await archivePlanningSequence(previous);
    if(activeSequence&&activeSequence!==previous)await henriBankStoreSequence(activeSequence,activeSequence.bankCreationMode);
    const sequence=makeSequence({comp:block.comp,sport,groupId:group.id,groupName:group.name,count,duration:macroDuration.value,annualBlockId:block.id,useHenri});
    activeSequence=sequence;block.sport=sport;block.courses=count;block.objective=sequence.objective;
    savedSequences[sequenceStorageKey(group.id,block.id)]=JSON.parse(JSON.stringify(sequence));
    henriPersistSharedState();rebuildPlanningAssignments();renderSequenceEditor();go('sequenceEditor');
    planningReport(useHenri?'Proposition Henri créée : activités de départ à adapter au groupe et au matériel.':'Gabarit vierge créé : complète les quatre sections de chaque séance.');
    henriBankStoreSequence(sequence,sequence.bankCreationMode).catch(planningError);
  }catch(error){const snapshot=JSON.parse(before);annualPlans=snapshot.annualPlans;savedSequences=snapshot.savedSequences;activeSequence=snapshot.activeSequence;planningError(error);}finally{planningActionBusy=false;}
}
async function buildStandaloneSequence(useHenri){
  const all=standaloneSeqGroup.value==='__all__';
  const targets=all?[...groupsData]:[requirePlanningGroup(standaloneSeqGroup.value)].filter(Boolean);
  if(!targets.length){planningReport('Importe tes groupes dans Paramètres avant de planifier.',true);return;}
  const count=Number(seqCount.value);if(!Number.isInteger(count)||count<1||count>500){planningReport('Indique un nombre de séances entre 1 et 500.',true);return;}
  if(planningActionBusy)return;
  planningActionBusy=true;
  const previous=activeSequence;
  try{
    if(previous)await henriBankStoreSequence(previous,previous.bankCreationMode);
    const created=targets.map(group=>makeSequence({comp:seqComp.value,sport:seqSport.value,groupId:group.id,groupName:group.name,count,duration:seqDuration.value,useHenri}));
    // Separate per-group copies protect subsequent group-specific edits.
    for(const sequence of created)await henriBankStoreSequence(sequence,sequence.bankCreationMode);
    activeSequence=created[0];
    henriPersistSharedState();renderSequenceEditor();go('sequenceEditor');
    planningReport(all?'Séquence créée pour '+created.length+' groupes. Chaque copie est accessible dans Ma banque et modifiable indépendamment.':'Séquence créée pour '+targets[0].name+'.');
  }catch(error){activeSequence=previous;planningError(error);}finally{planningActionBusy=false;}
}
function addSequenceLesson(){
  if(!activeSequence)return;
  activeSequence.sessions.push(planningNewSession(activeSequence,activeSequence.sessions.length,activeSequence.sessions.length+1));
  henriSyncSequenceToAnnual();henriSyncSharedData({skipSequenceEditor:true});renderSequenceEditor();
}
function henriSyncSequenceToAnnual(){
  if(!activeSequence)return;
  if(activeSequence.startCourseKey){savedSequences['dated::'+activeSequence.id]=JSON.parse(JSON.stringify(activeSequence));return;}
  if(!activeSequence.annualBlockId)return;
  const block=(annualPlans[activeSequence.groupId]||[]).find(b=>b.id===activeSequence.annualBlockId);if(!block)return;
  Object.assign(block,{comp:activeSequence.comp,sport:activeSequence.sport,objective:activeSequence.objective||'',courses:activeSequence.sessions.length});
  savedSequences[sequenceStorageKey(activeSequence.groupId,block.id)]=JSON.parse(JSON.stringify(activeSequence));
}
async function saveSequence(){
  if(!activeSequence)return;
  try{
    henriSyncSequenceToAnnual();henriPersistSharedState();rebuildPlanningAssignments();
    await henriBankStoreSequence(activeSequence,activeSequence.bankCreationMode||'Créée dans Henri');
    const missing=activeSequence.annualBlockId||activeSequence.startCourseKey?Math.max(0,activeSequence.sessions.length-getSequenceDates(activeSequence).length):0;
    planningReport('Séquence enregistrée.'+(missing?' '+missing+' séances restent sans date : ajuste les périodes de l’année.':activeSequence.annualBlockId||activeSequence.startCourseKey?' Calendrier mis à jour.':' Elle est disponible dans Ma banque.'));
  }catch(error){planningError(error);}
}
function editSessionBlock(i){
  const session=currentEditableSession(),block=session?.blocks[i];if(!block)return;
  const title=prompt('Titre de la section',block.title||'');if(title===null)return;
  const notes=prompt('Activité, consignes et notes',block.notes||'');if(notes===null)return;
  const minutes=prompt('Durée en minutes',block.minutes);if(minutes===null)return;
  if(!Number.isFinite(Number(minutes))||Number(minutes)<=0){planningReport('Indique une durée positive.',true);return;}
  Object.assign(block,{title:title.trim(),notes,minutes:Number(minutes)});
  renderSessionBlocks(session);henriSyncSequenceToAnnual();henriPersistSharedState();rebuildPlanningAssignments();
}
async function deleteSessionBlock(i){
  const session=currentEditableSession();if(!session?.blocks[i])return;
  if(!confirm('Supprimer cette section et son contenu ?'))return;
  try{
    if(sessionEditorSource!=='quick')await archivePlanningSequence(activeSequence);
    session.blocks.splice(i,1);renderSessionBlocks(session);henriSyncSequenceToAnnual();henriPersistSharedState();rebuildPlanningAssignments();
  }catch(error){planningError(error);}
}
function addSessionSection(){
  const session=currentEditableSession();if(!session)return;
  const type=prompt('Nom de la section','Éducatif supplémentaire');if(!type?.trim())return;
  session.blocks.push({type:type.trim(),title:'',notes:'',minutes:10});renderSessionBlocks(session);henriSyncSequenceToAnnual();henriPersistSharedState();rebuildPlanningAssignments();
}
async function deleteSequenceLesson(index){
  if(!activeSequence)return;
  if(activeSequence.sessions.length<=1){planningReport('Une séquence doit garder au moins une séance.',true);return;}
  if(!confirm('Supprimer cette séance et ses contenus ? Une copie complète de la séquence sera conservée dans Ma banque.'))return;
  try{await archivePlanningSequence(activeSequence);activeSequence.sessions.splice(index,1);normalizeGenericSequenceTitles();henriSyncSequenceToAnnual();henriSyncSharedData({skipSequenceEditor:true});renderSequenceEditor();}catch(error){planningError(error);}
}
function renderAnnualCompetenceSummary(groupId){
  const container=document.getElementById('annualCompetenceSummary');if(!container)return;
  container.replaceChildren();
  for(const comp of ['C1','C2','C3']){
    const blocks=(annualPlans[groupId]||[]).filter(b=>b.comp===comp),span=document.createElement('span');
    span.textContent=comp+' · '+blocks.length+' séquences · '+blocks.reduce((n,b)=>n+Number(b.courses),0)+' périodes';container.append(span);
  }
}
function fillAnnualRemaining(){
  const groupId=annualGroup.value,capacity=getGroupCourseSlots(groupId),used=(annualPlans[groupId]||[]).reduce((n,b)=>n+Number(b.courses),0),remaining=capacity-used;
  if(remaining<=0){planningReport(remaining<0?'La planification dépasse de '+(-remaining)+' périodes. Réduis un bloc ou retire-le.':'Toutes les périodes sont déjà utilisées.');return;}
  annualComp.value='C2';annualSport.value='À choisir';annualCourses.value=remaining;addAnnualBlock();planningReport('Les '+remaining+' périodes restantes ont été ajoutées dans un bloc C2 modifiable.');
}
window.addEventListener('error',event=>{if(event.error)planningError(event.error);});
window.addEventListener('unhandledrejection',event=>planningError(event.reason instanceof Error?event.reason:new Error(String(event.reason))));
function addAnnualBlock(){
  const groupId=annualGroup.value;if(!requirePlanningGroup(groupId))return;
  const courses=Number(annualCourses.value);
  if(!Number.isInteger(courses)||courses<1||courses>500){planningReport('Indique un nombre entier de périodes entre 1 et 500.',true);return;}
  const before=JSON.stringify({annualPlans,savedSequences,activeSequence});
  try{
  ensureAnnualPlan(groupId);annualPlans[groupId].push({id:planningId('annual'),comp:annualComp.value,sport:annualSport.value||'À choisir',objective:'',courses,lockedCourses:true});
  saveAnnual();renderAnnualPlanner();planningReport('Bloc ajouté. Vérifie le total des périodes et les dates attribuées.');
  }catch(error){const snapshot=JSON.parse(before);annualPlans=snapshot.annualPlans;savedSequences=snapshot.savedSequences;activeSequence=snapshot.activeSequence;planningError(error);renderAnnualPlanner();}
}
async function applyConflictSequenceCount(groupId,blockId){
  const value=Number(document.getElementById('conflict-'+blockId)?.value);
  if(!Number.isInteger(value)||value<1||value>500){planningReport('Indique un nombre entier de séances entre 1 et 500.',true);return;}
  if(!await updateAnnualBlock(blockId,{courses:value},groupId))return;
  const overflow=getScheduleConflict(groupId).overflow;
  const message=overflow?'Ajustement appliqué. '+overflow+' séances restent sans période.':'Ajustement appliqué. Toutes les séances annuelles ont une période.';
  planningReport(message);
  if(document.getElementById('quickSession').classList.contains('active'))renderQuickResult(message);
}
function returnFromSequenceChoice(){
  if(calendarPlanEditing&&calendarCourseContext){calendarPlanEditing=false;openDayPlan(calendarCourseContext.date);}
  else go('sequenceSetup');
}

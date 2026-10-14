/* One-time repair explicitly requested by the teacher: Ultimate is four courses.
 * Preserve every original value before changing existing local data.
 */
(function(root){
  const PREFIX='previewHenriSlate:';
  const MARKER=PREFIX+'ultimateFourCoursesRepair:v1';
  const BACKUP=PREFIX+'backupBeforeUltimateFourCoursesRepair:v1';
  const ultimate=value=>String(value||'').trim().toLowerCase()==='ultimate';
  function repair(storage){
    if(storage.getItem(MARKER))return {changed:false};
    const names=['henriAnnualPlans','henriSequences','henriActiveSequence','evaluations:v1','sequenceJumps:v1'];
    const previous=Object.fromEntries(names.map(name=>[PREFIX+name,storage.getItem(PREFIX+name)]));
    const read=(name,fallback)=>previous[PREFIX+name]?JSON.parse(previous[PREFIX+name]):fallback;
    const plans=read('henriAnnualPlans',{}),sequences=read('henriSequences',{}),active=read('henriActiveSequence',null),grids=read('evaluations:v1',{}),jumps=read('sequenceJumps:v1',{});
    const affected=[];
    for(const [groupId,blocks] of Object.entries(plans))for(const block of blocks){
      if(ultimate(block.sport)&&Number(block.courses)>=4){affected.push({groupId,blockId:block.id,previousCourses:Number(block.courses)});block.courses=4;block.lockedCourses=true;}
    }
    if(!affected.length)return {changed:false};
    const matching=(sequence,key)=>affected.find(item=>(item.blockId===sequence.annualBlockId&&(!sequence.groupId||String(sequence.groupId)===item.groupId))||key===item.groupId+'::'+item.blockId||key===item.blockId);
    let trimmed=0;
    const repairedIds=new Set();
    for(const [key,sequence] of Object.entries(sequences)){
      const target=matching(sequence,key);if(!target)continue;
      repairedIds.add(sequence.id);
      sequence.groupId=target.groupId;sequence.annualBlockId=target.blockId;
      if(sequence.sessions?.length>4){sequence.sessions=sequence.sessions.slice(0,4);trimmed++;}
    }
    if(active&&(matching(active)||active.id&&repairedIds.has(active.id))&&active.sessions?.length>4){active.sessions=active.sessions.slice(0,4);trimmed++;}
    for(const [key,jump] of Object.entries(jumps))if(affected.some(item=>key.startsWith(item.groupId+'|')&&jump.blockId===item.blockId)&&Number(jump.sessionIndex)>=4)delete jumps[key];
    for(const grid of Object.values(grids)){
      if(!ultimate(grid.sport))continue;
      const relevant=(grid.groupIds||[]).filter(gid=>affected.some(item=>item.groupId===String(gid)));
      if(!relevant.length)continue;
      const targets=relevant.filter(gid=>{
        const binding=grid.sequenceTargets?.[gid];
        return !binding||affected.some(item=>item.groupId===String(gid)&&binding==='annual:'+item.blockId);
      });
      if(!targets.length)continue;
      if(Number(grid.courseNumber)>4||grid.lastCourse){grid.courseNumber=4;grid.lastCourse=true;}
      // Infer only an unambiguous existing annual target; never guess between two.
      for(const gid of targets){
        const blocks=(plans[gid]||[]).filter(block=>ultimate(block.sport));
        if(!grid.sequenceTargets?.[gid]&&blocks.length===1){grid.sequenceTargets??={};grid.sequenceTargets[gid]='annual:'+blocks[0].id;}
      }
    }
    const updates={'henriAnnualPlans':plans,'henriSequences':sequences,'henriActiveSequence':active,'evaluations:v1':grids,'sequenceJumps:v1':jumps};
    const report={at:new Date().toISOString(),affected,trimmed};
    // A failed backup prevents all edits. Existing backup is never replaced.
    if(!storage.getItem(BACKUP))storage.setItem(BACKUP,JSON.stringify({...report,values:previous}));
    try{
      for(const [name,value] of Object.entries(updates))storage.setItem(PREFIX+name,JSON.stringify(value));
      storage.setItem(MARKER,JSON.stringify(report));
    }catch(error){
      for(const [key,value] of Object.entries(previous))try{value===null?storage.removeItem(key):storage.setItem(key,value)}catch(_){}
      try{storage.removeItem(MARKER)}catch(_){}
      throw error;
    }
    return {changed:true,...report};
  }
  const api={repair,MARKER,BACKUP};
  if(typeof module!=='undefined')module.exports=api;else root.HenriUltimateRepair=api;
})(typeof globalThis!=='undefined'?globalThis:this);

/* Content identity is independent of group assignment and storage identifiers. */
(function(root){
 const metadata=new Set(['id','bankId','groupId','groupName','annualBlockId','sequenceId','sessionId','date','startDate','endDate','startCourseKey','courseKey','time','createdAt','updatedAt','year','mode','bankCreationMode','lockedCourses','henriRecommended']);
 function canonical(value){
  if(Array.isArray(value))return value.map(canonical);
  if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().filter(key=>!metadata.has(key)&&value[key]!==undefined).map(key=>[key,canonical(value[key])]));
  return typeof value==='string'?value.replace(/\r\n/g,'\n').trim():value;
 }
 function content(item){
  if(item.type==='annual')return {type:'annual',annual:canonical(item.annual||[])};
  if(item.type==='sequence'||item.type==='session')return {type:'planning',sequence:canonical(item.sequence||{})};
  return null; // Original PDFs retain their identity and calendar attachments.
 }
 async function identity(item){
  const payload=content(item);if(!payload)return null;
  const bytes=new TextEncoder().encode(JSON.stringify(payload));
  const digest=await crypto.subtle.digest('SHA-256',bytes);
  return 'content:'+Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
 }
 const api={canonical,content,identity};if(typeof module!=='undefined')module.exports=api;else root.HenriBankContent=api;
})(typeof globalThis!=='undefined'?globalThis:this);

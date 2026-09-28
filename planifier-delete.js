function henriRemoveSection(button){
  const block=button.closest('.block');
  if(!block)return;
  const label=block.querySelector('.type')?.textContent?.trim()||'Section';
  block.style.transition='opacity .16s ease,transform .16s ease';
  block.style.opacity='0';
  block.style.transform='scale(.985)';
  setTimeout(()=>{block.remove();if(typeof note==='function')note(label+' supprimé');},160);
}
function henriInstallDeleteButtons(){
  document.querySelectorAll('#session .block').forEach(block=>{
    if(block.querySelector('.henri-delete'))return;
    const body=block.querySelector('.body');
    if(!body)return;
    let chips=body.querySelector('.chips');
    if(!chips){chips=document.createElement('div');chips.className='chips';body.appendChild(chips);}
    const btn=document.createElement('button');
    btn.type='button';
    btn.className='chip henri-delete';
    btn.textContent='Supprimer';
    btn.style.color='#a13b35';
    btn.style.borderColor='rgba(161,59,53,.22)';
    btn.addEventListener('click',()=>henriRemoveSection(btn));
    chips.appendChild(btn);
  });
}
document.addEventListener('DOMContentLoaded',henriInstallDeleteButtons);

/* The existing router redraws navigation. Restore keyboard focus to its new
   button without touching forms, autosave, permissions or application state. */
(() => {
  document.addEventListener('click', event => {
    const button=event.target.closest('#nav button');
    if(!button)return;
    const step=button.dataset.navStep,menu=button.hasAttribute('data-nav-menu-toggle');
    queueMicrotask(()=>{
      const nav=document.getElementById('nav');
      const current=nav.querySelector('[data-nav-menu-toggle]');
      const visible=element=>element&&element.getClientRects().length>0;
      let target=menu?current:step?nav.querySelector(`[data-nav-step="${step}"]`):nav.querySelector('.nav-btn.active');
      if(!visible(target))target=current;
      if(visible(target))target.focus({preventScroll:true});
    });
  },true);
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape'||document.querySelector('dialog[open]'))return;
    const nav=document.querySelector('#nav.menu-open');
    if(nav){event.preventDefault();nav.querySelector('[data-nav-menu-toggle]')?.click();}
  });
})();

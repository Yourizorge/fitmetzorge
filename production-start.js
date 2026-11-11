/* Production lifecycle only. The existing authenticated client owns every request. */
window.FMZProductionIntegrations=(()=>{
 let owner=null,generation=0,loading=null;
 function lock(){generation++;owner=null;loading=null;window.FMZMembers?.lock();window.FMZCentralBilling?.lock();}
 function sync(force=false){
  if(!onlineReady||!onlineProfile)return;
  window.FMZMembers?.render();
  if(onlineProfile.role!=='trainer')return;
  const id=onlineProfile.id;
  if(owner===id&&!force)return loading;
  owner=id;const gen=++generation;
  loading=(async()=>{
   await window.FMZAccounting?.init();
   if(gen!==generation||onlineProfile?.id!==id||!onlineReady)return;
   if(window.FMZAccounting?.ready)await window.FMZCentralBilling?.refresh();
  })().catch(()=>{/* The corresponding module renders its own retry/error state. */});
  return loading;
 }
 return{sync,lock};
})();
window.FMZProductionIntegrations.sync();

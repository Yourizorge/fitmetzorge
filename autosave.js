/* Field edits are captured synchronously; only transport is debounced. No render on input. */
(()=>{
 const supported='[data-training-log],[data-training-plan],[data-meal-plan],[data-food-note],[data-food-status],[data-food-plan],[data-food-amount],[data-step-index],[data-weight-index],[data-progress],[data-wellbeing],[data-sleep],[data-water-day-input],[data-training-attendance],[data-meal-status],[data-meal-alternative],#nextTrainingNote,#goalForm input,#goalForm textarea,#goalForm select';
 const bindings=new WeakMap();
 function stamp(rebind=false){document.querySelectorAll(supported).forEach(t=>{if(rebind===true||!bindings.has(t))bindings.set(t,{client:client(),week:activeWeekStart()});if(t.type==='number'){t.type='text';t.inputMode='decimal';t.dataset.numeric='true';}});}
 const originalRender=renderAll;renderAll=function(...args){const r=originalRender(...args);stamp(true);goalStatus();return r};
 new MutationObserver(stamp).observe(document.body,{childList:true,subtree:true});stamp();
 function update(event){const t=event.target;if(!t.matches?.(supported)||!onlineReady)return;event.stopImmediatePropagation();
  const b=bindings.get(t)||{client:client(),week:activeWeekStart()},c=b.client,d=t.dataset,raw=t.value,v=(d.numeric||t.inputMode==='decimal')&&/^\d+(?:[.,]\d+)?$/.test(raw)?raw.replace(',','.'):raw;
  if(!state.clients.includes(c))return;
  const list=(key,index,field)=>{c[key]||={};c[key][b.week]||=Array.from({length:7},()=>({}));c[key][b.week][Number(index)]||={};c[key][b.week][Number(index)][field]=v;};
  if(d.trainingLog){const [i,k]=d.trainingLog.split(':');const e=c.trainingPlan[i];e.logsByWeek||={};e.logsByWeek[b.week]||={};e.logsByWeek[b.week][k]=v;}
  if(d.trainingPlan){const [i,k]=d.trainingPlan.split(':');c.trainingPlan[i][k]=v;}
  if(d.mealPlan){const [i,k]=d.mealPlan.split(':');c.nutritionPlan[i][k]=v;}
  if(d.stepIndex!==undefined)list('stepsByWeek',d.stepIndex,'value');
  if(d.weightIndex!==undefined)list('dailyWeightByWeek',d.weightIndex,'value');
  for(const [attr,key] of [['progress','dailyWeightByWeek'],['wellbeing','wellbeingByWeek'],['sleep','sleepByWeek']])if(d[attr]){const [i,k]=d[attr].split(':');list(key,i,k);}
  if(d.waterDayInput!==undefined)list('waterByWeek',d.waterDayInput,'value');
  if(d.trainingAttendance!==undefined)list('trainingAttendanceByWeek',d.trainingAttendance,'status');
  if(d.mealStatus!==undefined||d.mealAlternative!==undefined){const e=c.nutritionPlan[d.mealStatus??d.mealAlternative];e.logsByWeek||={};e.logsByWeek[b.week]||={};e.logsByWeek[b.week][d.mealStatus!==undefined?'status':'alternative']=v;}
  if(d.foodNote||d.foodStatus||d.foodPlan||d.foodAmount){const [date,mealType]=(d.foodNote||d.foodStatus||d.foodPlan||d.foodAmount).split(':');let e=nutritionLogEntry(c,date,mealType);if(!e){e={id:'food-'+date+'-'+mealType,logType:'nutrition-log',date,mealType};c.foodLog.push(e);}const k=d.foodNote?'note':d.foodStatus?'status':d.foodPlan?'planMealId':'amount';e[k]=v;const meal=c.nutritionPlan.find(m=>m.id===e.planMealId)||c.nutritionPlan.find(m=>normalizeMealType(m.mealType||m.meal)===mealType&&m.published!==false);e.planMealId ||= meal?.id||'';e.name=meal?.meal||mealTypeLabel(mealType);e.unit='plan';if(e.amount===undefined)e.amount='1';for(const macro of ['kcal','protein','carbs','fat'])e[macro]=e.status==='Gegeten zoals plan'?number(meal?.[macro])*number(e.amount):0;e.savedAt=new Date().toISOString();}
  if(t.id==='nextTrainingNote'){c.coachNotesByWeek||={};c.coachNotesByWeek[b.week]||={};c.coachNotesByWeek[b.week].nextTraining=v;}
  if(t.form?.id==='goalForm'&&isTrainer()){const k=t.name;if(Object.hasOwn(DEFAULT_GOALS,k))c.goals[k]=v;else if(Object.hasOwn(defaultClientProfileData(),k)){c.profile[k]=v;if(['firstName','lastName'].includes(k))c.name=[c.profile.firstName,c.profile.lastName].filter(Boolean).join(' ');}else if(['goal','planSummary','startDate'].includes(k))c[k]=v;}
  onlineErrorMessage='';saveState();syncStatus('Opslaan…');
  if(event.type==='change'&&(t.tagName==='SELECT'||t.type==='checkbox')){clearTimeout(cloudSaveTimer);saveStateToCloud();}
 }
 document.addEventListener('input',update,true);document.addEventListener('change',update,true);
 // Incomplete numerical text remains in the account's memory draft, never coerced to zero.
 const numericKeys=new Set(['actualWeight','actualSets','sets','targetWeight','kcal','protein','carbs','fat','amount','value','hours','quality','energy','stress','motivation','waist','chest','armLeft','armRight','legLeft','legRight','kcalTraining','kcalRest','carbsTraining','carbsRest','steps','sleep','water','wellbeing','age','height','currentWeight']);
 function invalid(x,key='',previous){if(JSON.stringify(x)===JSON.stringify(previous))return false;if(x&&typeof x==='object')return Object.entries(x).some(([k,v])=>invalid(v,k,previous?.[k]));return numericKeys.has(key)&&typeof x==='string'&&x!==''&&!/^\d+(?:[.,]\d+)?$/.test(x);}
 function goalDirty(){if(!onlineReady||!cloudBaseline)return false;const c=client(),b=cloudBaseline.clients?.find(x=>x.id===c.id);return ['goals','profile','goal','planSummary','startDate','name'].some(k=>!FMZSync.equal(c[k],b?.[k]));}
 function goalStatus(){const f=document.querySelector('#goalForm'),visible=isTrainer()&&onlineReady&&currentView==='clients'&&hasSelectedClient(client());document.body.classList.toggle('goals-editor-active',visible);const s=f?.querySelector('[data-goal-status]');if(!s)return;const dirty=goalDirty();s.textContent=dirty?(onlineErrorMessage?'Opslaan mislukt — opnieuw proberen':document.querySelector('#syncStatus')?.textContent==='Opslaan…'?'Opslaan…':'Niet opgeslagen'):'Opgeslagen';}
 function leaveGoals(){return !(currentView==='clients'&&goalDirty())||confirm('Pakket of doelen zijn nog niet opgeslagen. Op dit tabblad blijft de invoer bewaard. Toch naar het andere scherm?');}
 window.FMZAutosave={incomplete:()=>!!onlineProfile&&invalid(FMZSync.snapshot(state,onlineProfile.role),'',cloudBaseline),goalStatus,leaveGoals};
 document.addEventListener('change',e=>{if(e.target.id==='clientSelect'&&!leaveGoals()){e.target.value=client().id;e.stopImmediatePropagation();}},true);
 const keyboardInset=()=>document.documentElement.style.setProperty('--fmz-keyboard-inset',Math.max(0,innerHeight-(visualViewport?.height||innerHeight)-(visualViewport?.offsetTop||0))+'px');
 window.visualViewport?.addEventListener('resize',keyboardInset);window.visualViewport?.addEventListener('scroll',keyboardInset);
 const formDrafts=new Map(),formBindings=new WeakMap();const forms='#trainingForm,#nutritionPlanForm';const formKey=f=>[onlineProfile?.id,client().id,f.id].join('|');
 document.addEventListener('input',e=>{const f=e.target.form;if(!f?.matches(forms)||!onlineProfile)return;formDrafts.set(formKey(f),Object.fromEntries(new FormData(f)));},true);
 document.addEventListener('reset',e=>{if(e.target.matches?.(forms)&&onlineProfile)formDrafts.delete(formKey(e.target));},true);
 const restoreForms=()=>document.querySelectorAll(forms).forEach(f=>{const k=formKey(f);if(formBindings.get(f)===k)return;formBindings.set(f,k);for(const input of f.elements){if(!input.name||input.type==='hidden')continue;input.value=formDrafts.get(k)?.[input.name]??input.defaultValue??'';}});
 new MutationObserver(restoreForms).observe(document.body,{childList:true,subtree:true});restoreForms();
 window.addEventListener('beforeunload',e=>{if(formDrafts.size){e.preventDefault();e.returnValue='';}});
 // Rapid repeated destructive/add actions must not reinterpret an index after a render.
 let lastAction='';let lastAt=0;
 document.addEventListener('click',e=>{const t=e.target.closest('button');if(!t)return;const keys=['addLibraryExercise','removeTraining','removeMeal','removeFood','addRecipeOption','copyTrainingSchema','copyNutritionSchema'];const k=keys.find(k=>t.dataset[k]!==undefined);if(!k)return;const token=onlineProfile?.id+'|'+client().id+'|'+k+'|'+t.dataset[k];if(token===lastAction&&Date.now()-lastAt<700){e.preventDefault();e.stopImmediatePropagation();return;}lastAction=token;lastAt=Date.now();},true);
 // Photo upload callbacks retain the originating client/week even when navigation changes.
 document.addEventListener('change',async e=>{const t=e.target;if(!t.dataset.progressFile)return;e.stopImmediatePropagation();const c=client(),week=activeWeekStart(),owner=onlineProfile?.id,generation=authGeneration,[day,slot]=t.dataset.progressFile.split(':'),f=t.files?.[0];if(!f)return;if(!/^image\/(jpeg|png|webp|gif)$/.test(f.type)||f.size>4*1024*1024){alert('Kies een JPG, PNG, WebP of GIF van maximaal 4 MB.');return;}const value=await new Promise((resolve,reject)=>{const r=new FileReader();r.onload=()=>resolve(r.result);r.onerror=reject;r.readAsDataURL(f)});if(generation!==authGeneration||onlineProfile?.id!==owner)return;c.dailyWeightByWeek||={};c.dailyWeightByWeek[week]||=Array.from({length:7},()=>({}));c.dailyWeightByWeek[week][day][slot]=value;saveState();if(client()===c&&activeWeekStart()===week){const wrapper=t.closest('.photo-upload-field');let button=wrapper?.querySelector('[data-view-photo]');if(wrapper&&!button){button=document.createElement('button');button.type='button';button.dataset.viewPhoto=day+':'+slot;const image=document.createElement('img');image.className='progress-photo-preview';image.alt='Foto bekijken';button.append(image,document.createTextNode('Bekijken'));wrapper.prepend(button);wrapper.querySelector('.photo-upload-empty')?.remove();}if(button)button.querySelector('img').src=value;}},true);
})();

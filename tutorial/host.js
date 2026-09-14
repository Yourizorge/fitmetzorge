/* Host bridge accepts progress flags only. Never accepts a URL, payload, command or file. */
window.FMZTutorial=(()=>{
 const KEY='fmz-course-progress-v1';let dialog=null,frame=null,listener=null,launcher=null,nonce='',helpDialog=null;
 const fresh=()=>({version:1,current:1,completed:[],last:0,tasks:[]});
 function clean(value){
  const p=fresh();if(!value||typeof value!=='object')return p;
  if(Number.isInteger(value.current)&&value.current>=1&&value.current<=27)p.current=value.current;
  if(Number.isInteger(value.last)&&value.last>=1&&value.last<=27)p.last=value.last;
  if(Array.isArray(value.completed))p.completed=[...new Set(value.completed.filter(n=>Number.isInteger(n)&&n>=1&&n<=27))].sort((a,b)=>a-b);
  if(Array.isArray(value.tasks))p.tasks=[...new Set(value.tasks.filter(s=>typeof s==='string'&&/^(week|month|quarter|year)-(?:[0-9]|1[0-2])$/.test(s)))].slice(0,45);
  return p;
 }
 function read(){try{return clean(JSON.parse(localStorage.getItem(KEY)))}catch{return fresh();}}
 function close(){helpDialog?.close();helpDialog?.remove();helpDialog=null;if(listener)removeEventListener('message',listener);listener=null;frame?.remove();frame=null;if(dialog?.open)dialog.close();dialog?.remove();dialog=null;nonce='';launcher?.focus?.();}
 function source(id){if(!Object.hasOwn(window.FMZCourseContent?.sources||{},id))return;const item=window.FMZCourseContent?.sources[id];if(!item)return;helpDialog?.remove();const d=document.createElement('dialog');helpDialog=d;d.className='fmz-course-help';const h=document.createElement('h2');h.textContent=item[0];const p=document.createElement('p');p.textContent='Officiële bron. Inhoud gecontroleerd op '+FMZCourseContent.checked+'. '+FMZCourseContent.disclaimer;const a=document.createElement('a');a.href=item[1];a.target='_blank';a.rel='noopener noreferrer';a.textContent='Officiële bron openen in nieuw tabblad';const b=document.createElement('button');b.textContent='Terug naar de uitleg';b.onclick=()=>d.close();d.append(h,p,a,b);document.body.append(d);d.addEventListener('close',()=>d.remove());d.showModal();}
 function help(id){if(!Object.hasOwn(window.FMZCourseContent?.help||{},id))return;const h=window.FMZCourseContent?.help[id];if(!h)return;helpDialog?.remove();const d=document.createElement('dialog');helpDialog=d;d.className='fmz-course-help';for(const [tag,text] of [['h2',h.title],['p',h.text],['p','Voorbeeld: '+h.example]]){const el=document.createElement(tag);el.textContent=text;d.append(el);}const lessonButton=document.createElement('button');lessonButton.textContent='Open les '+h.lesson+' in de oefenomgeving';lessonButton.onclick=()=>{d.close();open(h.lesson);};d.append(lessonButton);for(const id of h.refs){const a=document.createElement('a');a.href=FMZCourseContent.sources[id][1];a.textContent=FMZCourseContent.sources[id][0];a.target='_blank';a.rel='noopener noreferrer';d.append(a);}const p=document.createElement('p');p.textContent='Gecontroleerd '+FMZCourseContent.checked+'. '+FMZCourseContent.disclaimer;const b=document.createElement('button');b.textContent='Sluiten';b.onclick=()=>d.close();d.append(p,b);document.body.append(d);d.addEventListener('close',()=>d.remove());d.showModal();}
 function open(lesson=0){
  close();launcher=document.activeElement;nonce=crypto.randomUUID();dialog=document.createElement('dialog');dialog.className='fmz-course-host';dialog.setAttribute('aria-label','APPFMZ uitleg en oefenen');
  const header=document.createElement('header'),title=document.createElement('strong');title.textContent='APPFMZ · Uitleg & oefenen';const button=document.createElement('button');button.type='button';button.textContent='Naar mijn echte administratie';button.addEventListener('click',close);header.append(title,button);
  frame=document.createElement('iframe');frame.title='Beginnerscursus en afgeschermde oefenadministratie';frame.setAttribute('sandbox','allow-scripts allow-downloads');frame.referrerPolicy='no-referrer';frame.src='tutorial/course.html#'+nonce;frame.allow='camera \'none\'; microphone \'none\'; geolocation \'none\'; payment \'none\'; clipboard-write \'none\'';
  listener=e=>{if(e.source!==frame?.contentWindow||e.origin!=='null'||e.data?.channel!=='fmz-course-v1'||e.data.nonce!==nonce)return;
   if(e.data.type==='ready')frame.contentWindow.postMessage({channel:'fmz-course-v1',nonce,type:'init',progress:read(),lesson:Number.isInteger(lesson)&&lesson>=1&&lesson<=27?lesson:0,theme:document.body.classList.contains('light')?'light':'dark'},'*');
   else if(e.data.type==='progress'){try{localStorage.setItem(KEY,JSON.stringify(clean(e.data.progress)));frame.contentWindow.postMessage({channel:'fmz-course-v1',nonce,type:'saved'},'*')}catch{frame.contentWindow.postMessage({channel:'fmz-course-v1',nonce,type:'save-error'},'*')}}
   else if(e.data.type==='source'&&typeof e.data.source==='string')source(e.data.source);
   else if(e.data.type==='manual'){const a=document.createElement('a');a.href='output/pdf/APPFMZ-boekhouden-voor-beginners.pdf';a.download='APPFMZ-boekhouden-voor-beginners.pdf';document.body.append(a);a.click();a.remove();}
   else if(e.data.type==='close')close();
  };
  addEventListener('message',listener);dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.append(header,frame);document.body.append(dialog);dialog.showModal();button.focus();
 }
 if(document.body.hasAttribute('data-tutorial-standalone'))open();
 return {open,close,help};
})();

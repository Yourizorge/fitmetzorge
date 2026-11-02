/* Existing catalog media only. No API access or replacement exercise artwork. */
(()=>{
 const original=window.renderExerciseImage;if(typeof original!=='function')throw Error('Bestaande oefenmedia ontbreken.');
 window.renderExerciseImage=(item,className='exercise-photo')=>original(item,className).replace(/\s+onerror="[^"]*"/g,'').replace(/<img /g,'<img referrerpolicy="no-referrer" decoding="async" ');
 document.addEventListener('error',event=>{const img=event.target;if(!(img instanceof HTMLImageElement)||!img.dataset.fallback||img.dataset.ownerFallback)return;img.dataset.ownerFallback='true';img.src=img.dataset.fallback;img.alt+=' — afbeelding tijdelijk niet beschikbaar';},true);
 const style=document.createElement('style');style.textContent='body.ot-navigation .exercise-photo,body.ot-navigation .exercise-library-photo,body.ot-navigation .training-log-photo{overflow:hidden;min-width:0;flex-shrink:0}body.ot-navigation .exercise-photo img,body.ot-navigation .exercise-library-photo img,body.ot-navigation .training-log-photo img{width:100%;height:100%;max-width:100%;max-height:100%;object-fit:contain}';document.head.append(style);
})();

/* Top-level camera UI for the opaque owner-test iframe. No upload, recording, or persistent storage. */
window.FMZOwnerTestCamera=(()=>{
 'use strict';let current=null;
 function cancel(){current?.cancel();}
 function capture({isCurrent=()=>false}={}){
  if(current||!isCurrent())return Promise.reject(Error('Camera niet beschikbaar voor deze testsessie.'));
  return new Promise((resolve,reject)=>{
   let stream=null,photo=null,photoURL=null,finished=false,requestVersion=0;
   const d=document.createElement('dialog');d.className='fmz-owner-camera';d.setAttribute('aria-label','Foto maken — uitsluitend lokale test');
   d.innerHTML='<style>.fmz-owner-camera{width:min(680px,94vw);max-height:94dvh;overflow:auto;background:#111824;color:#f7f4e8;border:1px solid #d7b668;border-radius:16px;padding:20px}.fmz-owner-camera::backdrop{background:#000c}.fmz-owner-camera video,.fmz-owner-camera img{display:block;width:100%;max-height:55dvh;aspect-ratio:4/3;object-fit:contain;background:#080b10}.fmz-owner-camera [hidden]{display:none!important}.fmz-owner-camera button{min-height:44px;margin:5px;padding:10px 16px;background:#d7b668;color:#13151b;border:0;border-radius:8px;font-weight:bold}.fmz-owner-camera p{line-height:1.5}</style><h2>Foto maken</h2><p>TESTMODUS — richt de camera op een fictief voorbeeld of een voorwerp. Alleen de gekozen foto komt lokaal in deze testbrowser. Er wordt geen video of geluid bewaard.</p><p data-camera-status role="status">Camera staat uit.</p><video autoplay muted playsinline aria-label="Live cameravoorbeeld" hidden></video><img alt="Voorbeeld van de zojuist gemaakte testfoto" hidden><div><button type="button" data-camera-start>Camera inschakelen</button><button type="button" data-camera-take hidden>Foto nemen</button><button type="button" data-camera-retake hidden>Opnieuw maken</button><button type="button" data-camera-use hidden>Foto gebruiken</button><button type="button" data-camera-close>Sluiten</button></div>';
   const q=s=>d.querySelector(s),video=q('video'),img=q('img'),status=q('[data-camera-status]'),start=q('[data-camera-start]'),take=q('[data-camera-take]'),retake=q('[data-camera-retake]'),use=q('[data-camera-use]');
   function stop(){requestVersion++;stream?.getTracks().forEach(t=>t.stop());stream=null;video.srcObject=null;video.hidden=true;}
   function clearPhoto(){if(photoURL)URL.revokeObjectURL(photoURL);photoURL=null;photo=null;img.removeAttribute('src');img.hidden=true;use.hidden=true;retake.hidden=true;}
   function finish(error,result){if(finished)return;finished=true;stop();clearPhoto();document.removeEventListener('visibilitychange',visibility);window.removeEventListener('pagehide',leave);d.close();d.remove();current=null;error?reject(Error(error)):resolve(result);}
   const visibility=()=>{if(document.hidden)finish('Camera gesloten omdat je de app verliet. Kies opnieuw Foto maken.');},leave=()=>finish('Camera gesloten.');
   current={cancel:()=>finish('Foto maken geannuleerd.')};
   async function enable(){
    if(finished||!isCurrent()){finish('Testsessie gewijzigd.');return;}
    stop();clearPhoto();start.disabled=true;start.hidden=false;take.hidden=true;status.textContent='Wacht op cameratoestemming…';const version=requestVersion;
    try{
     if(!window.isSecureContext||!navigator.mediaDevices?.getUserMedia)throw Object.assign(Error(),{name:'NotSupportedError'});
     let acquired;
     try{acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:{ideal:'user'},width:{ideal:1280,max:1920},height:{ideal:960,max:1440}}});}
     catch(e){if(!['NotFoundError','OverconstrainedError'].includes(e.name)||finished||version!==requestVersion)throw e;acquired=await navigator.mediaDevices.getUserMedia({audio:false,video:true});}
     if(finished||version!==requestVersion||!isCurrent()){acquired.getTracks().forEach(t=>t.stop());return;}
     stream=acquired;video.srcObject=stream;video.hidden=false;await video.play();if(finished||version!==requestVersion)return;
     start.hidden=true;take.hidden=false;status.textContent='● Camera aan — live voorbeeld, nog geen foto genomen.';take.focus();
     stream.getVideoTracks().forEach(t=>t.addEventListener('ended',()=>{if(!finished&&stream){stop();take.hidden=true;start.hidden=false;status.textContent='Camera gestopt. Schakel opnieuw in of kies een bestaande foto.';}},{once:true}));
    }catch(e){if(finished||version!==requestVersion)return;stop();start.hidden=false;status.textContent=e.name==='NotAllowedError'?'Cameratoestemming geweigerd. Je kunt toestemming in de browser aanpassen of sluiten en Bestaande foto kiezen.':e.name==='NotFoundError'?'Geen camera gevonden. Sluit dit venster en kies Bestaande foto kiezen.':e.name==='NotReadableError'?'Camera is bezet of niet beschikbaar. Sluit andere camera-apps of kies een bestaande foto.':'Camera wordt hier niet ondersteund. Gebruik Edge of Chrome via HTTPS, of kies een bestaande foto.';}
    finally{start.disabled=false;}
   }
   start.onclick=enable;retake.onclick=async()=>{if(stream?.getVideoTracks().some(t=>t.readyState==='live')){clearPhoto();video.hidden=false;await video.play();take.hidden=false;status.textContent='● Camera aan — live voorbeeld, kies Foto nemen.';take.focus();}else await enable();};
   take.onclick=async()=>{if(!stream||finished||!isCurrent())return;take.disabled=true;try{if(!video.videoWidth||!video.videoHeight)throw Error('Het camerabeeld is nog niet klaar.');const canvas=document.createElement('canvas'),scale=Math.min(1,1600/Math.max(video.videoWidth,video.videoHeight));canvas.width=Math.round(video.videoWidth*scale);canvas.height=Math.round(video.videoHeight*scale);canvas.getContext('2d').drawImage(video,0,0,canvas.width,canvas.height);const blob=await new Promise(r=>canvas.toBlob(r,'image/jpeg',.88));canvas.width=canvas.height=0;if(finished||!isCurrent())return;if(!blob||blob.size>4000000)throw Error('Deze foto kon niet worden verwerkt. Probeer opnieuw.');video.hidden=true;photo=blob;photoURL=URL.createObjectURL(blob);img.src=photoURL;img.hidden=false;take.hidden=true;retake.hidden=false;use.hidden=false;status.textContent='● Camera aan — controleer je foto. Er is nog niets opgeslagen. Foto gebruiken of Sluiten zet de camera uit.';use.focus();}catch(e){status.textContent=e.message;}finally{take.disabled=false;}};
   use.onclick=()=>{if(photo&&isCurrent()){const chosen=photo;finish(null,chosen);}else finish('Testsessie gewijzigd; foto niet bewaard.');};
   q('[data-camera-close]').onclick=()=>finish('Foto maken geannuleerd.');d.addEventListener('cancel',e=>{e.preventDefault();finish('Foto maken geannuleerd.');});
   document.addEventListener('visibilitychange',visibility);window.addEventListener('pagehide',leave);document.body.append(d);d.showModal();start.focus();
  });
 }
 return {capture,cancel};
})();

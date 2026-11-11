/* Approved application palette. No account data, persistence or transport. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.FMZTheme=api;})(typeof window==='undefined'?globalThis:window,()=>{
 'use strict';
 // Keep sampled logo colours as provenance; UI accents use restrained accessible tones.
 // Decorative dividers and interactive control boundaries have separate contrast roles.
 const dark=Object.freeze({gold:'#dfa639','gold-highlight':'#f1bf4b','gold-edge':'#bf8329',background:'#1d2228',surface:'#252b32','surface-raised':'#2e353d',text:'#f1f0eb',muted:'#bec2c7',border:'#3f4852','control-border':'#89929c',accent:'#ddc18c',primary:'#c9ae76','primary-ink':'#1d2228',success:'#9bd7b0',warning:'#e3c590',error:'#ffb0a7',focus:'#ddc18c',ink:'#111008',veil:'#10151b99','logo-dark':'#1d2228',paper:'#ffffff','paper-ink':'#111111'});
 const light=Object.freeze({...dark,background:'#f3f1ec',surface:'#faf9f5','surface-raised':'#eeece6',text:'#252b32',muted:'#59616a',border:'#d8d5ce','control-border':'#7b8188',accent:'#765922',primary:'#765922','primary-ink':'#fffdf8','gold-highlight':'#765922','gold-edge':'#805500',success:'#14643a',warning:'#714a00',error:'#a32620',focus:'#765922',veil:'#18202855'});
 const valid=value=>value==='dark'||value==='light';
 const choose=(preference,systemDark)=>valid(preference)?preference:systemDark?'dark':'light';
 function tokens(value){if(!valid(value))throw Error('Ongeldig testthema.');return value==='light'?light:dark;}
 function css(value){return Object.entries(tokens(value)).map(([key,v])=>'--fmz-'+key+':'+v).join(';');}
 function apply(element,value){for(const[key,v]of Object.entries(tokens(value)))element.style.setProperty('--fmz-'+key,v);element.dataset.fmzTheme=value;element.style.colorScheme=value;}
 return Object.freeze({valid,choose,tokens,css,apply,palettes:Object.freeze({dark,light})});
});

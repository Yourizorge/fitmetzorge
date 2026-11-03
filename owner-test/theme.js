/* Isolated owner-test palettes. This module contains no account or session data. */
(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.OwnerTestTheme=api;})(typeof window==='undefined'?globalThis:window,()=>{
 'use strict';
 const dark=Object.freeze({gold:'#dfa639','gold-highlight':'#f1bf4b','gold-edge':'#bf8329',background:'#080808',surface:'#141414','surface-raised':'#202020',text:'#f7f7f5',muted:'#b7b7b2',border:'#73736b',success:'#9bd7b0',warning:'#f1bf4b',error:'#ffb0a7',focus:'#f1bf4b',ink:'#111008',veil:'#000000bb','logo-dark':'#080808',paper:'#ffffff','paper-ink':'#111111'});
 const light=Object.freeze({...dark,background:'#f3f4f5',surface:'#ffffff','surface-raised':'#e8eaed',text:'#181a1b',muted:'#535b62','gold-highlight':'#79510a','gold-edge':'#805500',success:'#14643a',warning:'#714a00',error:'#a32620',focus:'#805500',veil:'#18202866'});
 const valid=value=>value==='dark'||value==='light';
 const choose=(preference,systemDark)=>valid(preference)?preference:systemDark?'dark':'light';
 function tokens(value){if(!valid(value))throw Error('Ongeldig testthema.');return value==='light'?light:dark;}
 function css(value){return Object.entries(tokens(value)).map(([key,v])=>'--ot-'+key+':'+v).join(';');}
 function apply(element,value){for(const[key,v]of Object.entries(tokens(value)))element.style.setProperty('--ot-'+key,v);element.dataset.ownerTheme=value;element.style.colorScheme=value;}
 return Object.freeze({valid,choose,tokens,css,apply,palettes:Object.freeze({dark,light})});
});

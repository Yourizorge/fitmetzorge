const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto'),{execFileSync}=require('node:child_process');
const C=require('../tutorial/content.js'),M=require('../tutorial/model.js');
fs.mkdirSync('tests/artifacts/tutorial',{recursive:true});
fs.writeFileSync('tests/artifacts/tutorial/handbook-content.json',JSON.stringify({...C,plans:M.plans},null,2));
const python=process.env.FMZ_PYTHON||'C:/Users/Fitme/.cache/codex-runtimes/codex-primary-runtime/dependencies/python/python.exe';
execFileSync(python,[path.join(__dirname,'build-tutorial-handbook.py')],{stdio:'inherit'});
const hash=f=>crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex');
fs.writeFileSync('tutorial/handbook-manifest.json',JSON.stringify({version:C.version,checked:C.checked,sourceHashes:Object.fromEntries(['tutorial/content.js','tutorial/model.js'].map(f=>[f,hash(f)])),pdf:'output/pdf/APPFMZ-boekhouden-voor-beginners.pdf',pdfSHA256:hash('output/pdf/APPFMZ-boekhouden-voor-beginners.pdf'),generatedFromSameContent:true},null,2)+'\n');

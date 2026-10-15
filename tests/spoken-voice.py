"""Offline Dutch narration. Model/runtime stay in ignored tests/artifacts, never deployed."""
import os, sys, json, wave, hashlib, re, io
from pathlib import Path
ROOT = Path(__file__).resolve().parent.parent
sys.path.insert(0, str(ROOT / 'tests/artifacts/voice-tools'))
from piper import PiperVoice, SynthesisConfig
voice = PiperVoice.load(str(ROOT / 'tests/artifacts/voices/nl_NL-ronnie-medium.onnx'))
config = SynthesisConfig(length_scale=1.12, noise_scale=0.5, noise_w_scale=0.65)
out = ROOT / 'tests/artifacts/spoken/audio'
out.mkdir(parents=True, exist_ok=True)
if '--sample' in sys.argv:
    entries=[{'id':'sample','text':'Welkom bij Fit met Zorge. We oefenen met een verzonnen bedrijf. De factuur is driehonderdvijftig euro. Na een betaling van tweehonderd euro blijft honderdvijftig euro open. Kijk rustig naar de datum en de rekening. Er wordt niets in je echte administratie veranderd.'}]
else:
    course=json.loads((ROOT/'tutorial/spoken-course-script.json').read_text(encoding='utf-8'))
    entries=[s for c in course['chapters'] for s in c['scenes']]
results=[]
for scene in entries:
    text=scene.get('speech',scene['text'])
    digest=hashlib.sha256((text+'|ronnie|1.12|0.5|0.65|sentence-alignment-v1').encode()).hexdigest()
    dest=out/(scene['id']+'.wav')
    check=out/(scene['id']+'.sha256')
    timing=out/(scene['id']+'.json')
    if not dest.exists() or not check.exists() or check.read_text()!=digest:
        sentences=re.split(r'(?<=[.!?])\s+',text)
        chunks=[]; cues=[]; position=0
        for sentence in sentences:
            stream=io.BytesIO()
            spoken=sentence.replace('FitMetZorge','Fit met Zorge').replace('APPFMZ','App F M Z')
            with wave.open(stream,'wb') as piece:
                voice.synthesize_wav(spoken,piece,syn_config=config)
            stream.seek(0)
            with wave.open(stream,'rb') as piece:
                rate=piece.getframerate(); frames=piece.readframes(piece.getnframes()); dur=piece.getnframes()/rate
            cues.append({'start':position,'end':position+dur,'text':sentence})
            chunks.extend([frames,b'\0\0'*round(rate*.24)]);position+=dur+.24
        with wave.open(str(dest),'wb') as w:
            w.setnchannels(1);w.setsampwidth(2);w.setframerate(rate);w.writeframes(b''.join(chunks))
        timing.write_text(json.dumps(cues,ensure_ascii=False,indent=2),encoding='utf-8')
        check.write_text(digest)
    with wave.open(str(dest),'rb') as w:
        duration=w.getnframes()/w.getframerate()
        assert w.getnframes()>0
    results.append({'id':scene['id'],'duration':duration,'sourceHash':digest,'wavSha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'cues':json.loads(timing.read_text(encoding='utf-8'))})
    print(scene['id'],round(duration,2),flush=True)
(out/'durations.json').write_text(json.dumps(results,indent=2),encoding='utf-8')

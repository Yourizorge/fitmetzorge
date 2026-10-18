"""Generate public, fictional narration using the existing free Edge voice service.
No account, API key, subscription or real administration data. Cache stays ignored.
Only the reviewed public course script is sent. Use --sample for a short voice check.
"""
import asyncio, hashlib, json, os, subprocess, sys, wave
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
sys.path.insert(0,str(ROOT/'tests/artifacts/natural-voice-tools'))
import edge_tts
FF=Path(os.environ.get('FMZ_FFMPEG',str(ROOT.parent/'appfmz-admin-simple/tests/artifacts/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe')))
VOICE='nl-NL-ColetteNeural';RATE='-4%';OUT=ROOT/'tests/artifacts/spoken/audio'
OUT.mkdir(parents=True,exist_ok=True)
course=json.loads((ROOT/'tutorial/spoken-course-script.json').read_text(encoding='utf-8'))
assert course['synthetic'] and course['company']=='FitMetZorge Oefenbedrijf'
entries=[s for c in course['chapters'] for s in c['scenes']]
if '--sample' in sys.argv:entries=entries[:1]
async def main():
 results=[]
 for scene in entries:
  text=scene.get('speech',scene['text']).replace('FitMetZorge','Fit met Zorge').replace('APPFMZ','App F M Z')
  assert not any(x in text.lower() for x in ['fitmetzorge@outlook','patrick','debora','hgoygcviutmynaihcvpd'])
  digest=hashlib.sha256((text+'|'+VOICE+'|'+RATE+'|edge-tts-7.3.1-sentence-v1').encode()).hexdigest()
  dest=OUT/(scene['id']+'.wav');check=OUT/(scene['id']+'.sha256');timing=OUT/(scene['id']+'.json');mp3=OUT/(scene['id']+'.mp3')
  if not dest.exists() or not timing.exists() or not check.exists() or check.read_text()!=digest:
   cues=[]
   for attempt in range(3):
    try:
     cues=[]
     with mp3.open('wb') as media:
      async for chunk in edge_tts.Communicate(text,VOICE,rate=RATE).stream():
       if chunk['type']=='audio':media.write(chunk['data'])
       elif chunk['type']=='SentenceBoundary':cues.append({'start':chunk['offset']/10000000,'end':(chunk['offset']+chunk['duration'])/10000000,'text':chunk['text']})
     assert cues and mp3.stat().st_size>1000
     break
    except Exception:
     if attempt==2:raise
     await asyncio.sleep(2+attempt*3)
   result=subprocess.run([str(FF),'-hide_banner','-loglevel','error','-y','-i',str(mp3),'-ac','1','-ar','22050','-c:a','pcm_s16le',str(dest)],capture_output=True,text=True)
   if result.returncode:raise RuntimeError(result.stderr)
   timing.write_text(json.dumps(cues,ensure_ascii=False,indent=2),encoding='utf-8');check.write_text(digest)
  with wave.open(str(dest),'rb') as wav:duration=wav.getnframes()/wav.getframerate()
  cues=json.loads(timing.read_text(encoding='utf-8'));assert all(0<=c['start']<c['end']<=duration+.35 for c in cues)
  results.append({'id':scene['id'],'duration':duration,'sourceHash':digest,'wavSha256':hashlib.sha256(dest.read_bytes()).hexdigest(),'cues':cues})
  print(scene['id'],round(duration,2),flush=True)
 if '--sample' not in sys.argv:(OUT/'durations.json').write_text(json.dumps(results,indent=2),encoding='utf-8')
asyncio.run(main())

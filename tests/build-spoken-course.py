"""Encode real synthetic screen captures and locally spoken WAVs into one portable course.
No network, production inputs, or paid services. Real frames are paced and held for narration.
"""
import json, math, wave, subprocess, hashlib, os, shutil
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
FF=Path(os.environ.get('FMZ_FFMPEG',str(ROOT.parent/'appfmz-admin-simple/tests/artifacts/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe')))
TAKE=Path((ROOT/'tests/artifacts/spoken/latest-take.txt').read_text().strip())
CAP=json.loads((TAKE/'capture.json').read_text(encoding='utf-8'))
C=json.loads((ROOT/'tutorial/spoken-course-script.json').read_text(encoding='utf-8'))
AUDIO=ROOT/'tests/artifacts/spoken/audio'
D={r['id']:r for r in json.loads((AUDIO/'durations.json').read_text(encoding='utf-8'))}
OUT=ROOT/'tutorial/media'; OUT.mkdir(exist_ok=True)
TMP=TAKE/'encoded';TMP.mkdir(exist_ok=True)
FPS=12;RATE=22050
def run(args):
    result=subprocess.run([str(FF),'-hide_banner','-loglevel','error','-y',*map(str,args)],capture_output=True,text=True)
    if result.returncode:raise RuntimeError(result.stderr[-4000:])
def quoted(p):return str(p).replace('\\','/').replace("'","'\\''")
def stamp(n):
    ms=round(n*1000);return f'{ms//3600000:02}:{ms//60000%60:02}:{ms//1000%60:02}.{ms%1000:03}'
assert CAP['synthetic'] and not CAP['errors'] and not CAP['external']
capture={r['id']:r for r in CAP['scenes']}
assert set(capture)=={s['id'] for c in C['chapters'] for s in c['scenes']}
data={'version':C['version'],'voice':C['voice'],'chapters':[],'cues':[],'synthetic':True}
proof=[];clips=[];position=0;written=0
with wave.open(str(TMP/'narration.wav'),'wb') as joined:
    joined.setnchannels(1);joined.setsampwidth(2);joined.setframerate(RATE)
    for ch in C['chapters']:
        chapter={**ch,'start':position};data['chapters'].append(chapter)
        for scene in ch['scenes']:
            ident=scene['id'];src=capture[ident];voice=D[ident];assert src['frames'], 'A fast validation run is not a recording'
            duration=math.ceil(max(voice['duration']+3,src['rawDuration']+1)*FPS)/FPS
            # Pace actual clicks across the narration and keep the final state visible.
            action_end=max(src['rawDuration'],voice['duration']*.82)
            scale=action_end/max(src['rawDuration'],.001)
            frames={0:TAKE/src['frames'][0]['file']}
            for frame in src['frames']:
                tick=min(round(frame['at']/1000*scale*FPS),round(duration*FPS)-1)
                frames[tick]=TAKE/frame['file']
            points=sorted(frames);manifest=['ffconcat version 1.0']
            last_hash=None;changes=[]
            for tick in points:
                digest=hashlib.sha256(frames[tick].read_bytes()).hexdigest()
                if digest!=last_hash:changes.append((tick,frames[tick]));last_hash=digest
            for i,(tick,p) in enumerate(changes):
                end=changes[i+1][0] if i+1<len(changes) else round(duration*FPS)
                manifest.extend(["file '"+quoted(p)+"'",f'duration {(end-tick)/FPS:.9f}'])
            manifest.append("file '"+quoted(changes[-1][1])+"'")
            listing=TMP/(ident+'.ffconcat');listing.write_text('\n'.join(manifest)+'\n',encoding='utf-8')
            clip=TMP/(ident+'.mp4');cache=TMP/(ident+'.sha256');digest=hashlib.sha256(listing.read_bytes()).hexdigest()
            if not clip.exists() or not cache.exists() or cache.read_text()!=digest:
                run(['-f','concat','-safe','0','-i',listing,'-vf','fps=12,format=yuv420p','-t',duration,'-an','-c:v','libx264','-preset','medium','-crf','27','-profile:v','high','-level:v','4.0','-r',FPS,'-video_track_timescale','12000',clip]);cache.write_text(digest)
            clips.append(clip)
            with wave.open(str(AUDIO/(ident+'.wav')),'rb') as wav:
                assert wav.getframerate()==RATE and wav.getnchannels()==1 and wav.getsampwidth()==2
                pcm=wav.readframes(wav.getnframes())
            lead=round((position+.5)*RATE)-written;assert lead>=0
            joined.writeframesraw(b'\0\0'*lead+pcm);written+=lead+len(pcm)//2
            for cue in voice['cues']:data['cues'].append({'start':position+.5+cue['start'],'end':position+.5+cue['end'],'text':cue['text'],'scene':ident})
            proof.append({'id':ident,'start':position,'duration':duration,'screenFrames':len(src['frames']),'rawCaptureSeconds':src['rawDuration'],'voiceSeconds':voice['duration'],'sourceHash':voice['sourceHash'],'wavSHA256':voice['wavSha256'],'ledger':src['proof']})
            position+=duration
            padding=round(position*RATE)-written;assert padding>=0;joined.writeframesraw(b'\0\0'*padding);written+=padding
            print(ident,round(position,2),flush=True)
        chapter['end']=position
data['duration']=position
vtt='WEBVTT\n\n'+'\n\n'.join(f'{i+1}\n{stamp(c["start"])} --> {stamp(c["end"])}\n{c["text"]}' for i,c in enumerate(data['cues']))+'\n'
(OUT/'administratie-nl.vtt').write_text(vtt,encoding='utf-8')
(OUT/'administratie-transcript.txt').write_text(C['title']+'\nVernieuwd 15 oktober 2026. Uitsluitend vaste fictieve gegevens.\n\n'+'\n\n'.join(f'{ch["id"]}. {ch["title"]} ({stamp(ch["start"])})\n'+'\n\n'.join(s['text'] for s in ch['scenes']) for ch in data['chapters']),encoding='utf-8')
(TMP/'clips.txt').write_text('\n'.join("file '"+quoted(p)+"'" for p in clips),encoding='utf-8')
meta=[';FFMETADATA1','title=APPFMZ - Nederlandse administratiecursus','artist=FitMetZorge Oefenbedrijf','comment=Uitsluitend synthetische gegevens; lokale kunstmatige Nederlandse stem; geen echte facturen.']
for ch in data['chapters']:meta.extend(['[CHAPTER]','TIMEBASE=1/1000','START='+str(round(ch['start']*1000)),'END='+str(round(ch['end']*1000)),'title='+ch['title'].replace('=','\\=')])
(TMP/'chapters.ffmeta').write_text('\n'.join(meta)+'\n',encoding='utf-8')
run(['-f','concat','-safe','0','-i',TMP/'clips.txt','-c','copy',TMP/'silent-edit.mp4'])
run(['-i',TMP/'silent-edit.mp4','-i',TMP/'narration.wav','-i',OUT/'administratie-nl.vtt','-i',TMP/'chapters.ffmeta','-map','0:v:0','-map','1:a:0','-map','2:s:0','-map_metadata','3','-map_chapters','3','-c:v','copy','-c:a','aac','-ar','48000','-b:a','96k','-af','loudnorm=I=-18:TP=-1.5:LRA=7','-c:s','mov_text','-metadata:s:a:0','language=nld','-metadata:s:s:0','language=nld','-movflags','+faststart','-t',position,OUT/'administratie-rondleiding.mp4'])
run(['-ss','2','-i',OUT/'administratie-rondleiding.mp4','-frames:v','1','-q:v','2',OUT/'administratie-poster.jpg'])
(ROOT/'tutorial/spoken-data.js').write_text('/* Public, synthetic chapter timings and exact spoken transcript. */\nwindow.FMZSpokenCourse='+json.dumps(data,ensure_ascii=False,separators=(',',':'))+';\n',encoding='utf-8')
(OUT/'administratie-chapters.json').write_text(json.dumps([{k:c[k] for k in ['id','title','start','end']} for c in data['chapters']],ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
report={'duration':position,'chapters':len(data['chapters']),'scenes':len(proof),'voice':C['voice'],'voiceLocal':True,'actualSyntheticDOM':True,'screenPacing':'Original screen frames paced across each spoken scene; final frame held for reading','format':'H.264 High/yuv420p + AAC mono/48kHz + Dutch mov_text; MP4 faststart','videoSHA256':hashlib.sha256((OUT/'administratie-rondleiding.mp4').read_bytes()).hexdigest(),'videoBytes':(OUT/'administratie-rondleiding.mp4').stat().st_size,'sceneEvidence':proof}
(ROOT/'docs/examples/spoken-course').mkdir(parents=True,exist_ok=True)
(ROOT/'docs/examples/spoken-course/montage.json').write_text(json.dumps(report,ensure_ascii=False,indent=2)+'\n',encoding='utf-8')
assert report['videoBytes']<100_000_000,'Must fit the existing Git release transport'
print('COMPLETE',round(position/60,2),'minutes;',report['videoBytes'],'bytes',flush=True)

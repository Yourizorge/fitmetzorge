"""Decode supplementary course media and check exact synthetic recording provenance."""
import json, re, subprocess, hashlib, os, sys
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
FF=Path(os.environ.get('FMZ_FFMPEG',str(ROOT.parent/'appfmz-admin-simple/tests/artifacts/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe')))
provisional='--provisional' in sys.argv
for name in ([a for a in sys.argv[1:] if a!='--provisional'] or ['members','planning']):
 assert name in ['members','planning']
 report_dir=ROOT/('docs/examples/'+name+'-20261026')
 proof=json.loads((report_dir/'montage.json').read_text(encoding='utf8'))
 take=Path((ROOT/('tests/artifacts/'+name+'-20261026/latest-take.txt')).read_text().strip())
 capture=json.loads((take/'capture.json').read_text(encoding='utf8'))
 script=json.loads((ROOT/('tutorial/'+name+'-spoken-script.json')).read_text(encoding='utf8'))
 media=ROOT/('tutorial/media/'+name+'-rondleiding.mp4')
 assert capture['synthetic'] and not capture['external'] and not capture['errors']
 assert capture['runtimeAtStart']==capture['runtimeAtEnd']==proof['runtimeAtCapture']
 changed=[file for file,digest in capture['runtimeAtStart'].items() if hashlib.sha256((ROOT/file).read_bytes()).hexdigest()!=digest]
 if not provisional:assert not changed, 'Runtime changed since capture: '+str(changed)
 assert len(script['chapters'])==12
 scripted={s['id']:s for ch in script['chapters'] for s in ch['scenes']}
 assert len(scripted)==len(capture['scenes'])==len(proof['sceneEvidence'])==24
 assert set(scripted)=={s['id'] for s in capture['scenes']}
 assert all(len(s['frames'])>=2 for s in capture['scenes'])
 assert hashlib.sha256(media.read_bytes()).hexdigest()==proof['videoSHA256']
 transcript=(ROOT/('tutorial/media/'+name+'-transcript.txt')).read_text(encoding='utf8')
 for s in scripted.values():assert s['text'] in transcript
 visible='\n'.join(s['text'] for s in capture['scenes'])
 assert not re.search(r'fitmetzorge@outlook|Patrick|Debora|hgoygcviutmynaihcvpd|PRIVATE PASSWORD|PRIVATE ADMIN',visible+'\n'+transcript,re.I)
 assert not re.search(r'\bNL\d{2}[A-Z]{4}\d{10}\b',visible+'\n'+transcript), 'No real bank details in course'
 audio=subprocess.run([str(FF),'-hide_banner','-i',str(media),'-map','0:a:0','-af','volumedetect','-f','null','-'],capture_output=True,text=True)
 assert audio.returncode==0,audio.stderr[-2000:]
 log=audio.stderr
 assert 'Video: h264' in log and 'Audio: aac' in log and '48000 Hz' in log and 'yuv420p' in log
 mean=float(re.search(r'mean_volume: (-?[\d.]+) dB',log).group(1));peak=float(re.search(r'max_volume: (-?[\d.]+) dB',log).group(1))
 assert -30<mean<-8 and -8<peak<0,(mean,peak)
 assert re.search(r'artist\s*:\s*FitMetZorge Oefenbedrijf',log)
 vtt=(ROOT/('tutorial/media/'+name+'-nl.vtt')).read_text(encoding='utf8');assert vtt.startswith('WEBVTT')
 result={'mp4SHA256':proof['videoSHA256'],'bytes':media.stat().st_size,'durationSeconds':proof['duration'],'chapters':12,'scenes':24,'actualAACStreamDecodedInFull':True,'meanVolumeDB':mean,'peakVolumeDB':peak,'video':'H.264 yuv420p','audio':'AAC mono 48000Hz','subtitleCues':vtt.count(' --> '),'runtimeAtCaptureUnchanged':not changed,'changedRuntime':changed,'releaseAdmission':not provisional,'captureExternalRequests':0,'privateContentScanPassed':True,'metadataSynthetic':True,'physicalIPhoneHearing':'Owner still needs to confirm'}
 (report_dir/('provisional-media-verification.json' if provisional else 'media-verification.json')).write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
 print(name,json.dumps(result),flush=True)

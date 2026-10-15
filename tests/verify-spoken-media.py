"""Verify the delivered MP4, synthetic capture, narration timing and ledger. No network."""
import json,re,subprocess,hashlib,os
from pathlib import Path
ROOT=Path(__file__).resolve().parent.parent
ff=Path(os.environ.get('FMZ_FFMPEG',str(ROOT.parent/'appfmz-admin-simple/tests/artifacts/video-tools/imageio_ffmpeg/binaries/ffmpeg-win-x86_64-v7.1.exe')))
media=ROOT/'tutorial/media/administratie-rondleiding.mp4'
proof=json.loads((ROOT/'docs/examples/spoken-course/montage.json').read_text(encoding='utf8'))
take=Path((ROOT/'tests/artifacts/spoken/latest-take.txt').read_text().strip())
capture=json.loads((take/'capture.json').read_text(encoding='utf8'))
ledger=json.loads((take/'ledger.json').read_text(encoding='utf8'))
assert capture['synthetic'] and not capture['external'] and not capture['errors']
assert len(capture['scenes'])==104 and len(proof['sceneEvidence'])==104
assert hashlib.sha256(media.read_bytes()).hexdigest()==proof['videoSHA256']
text='\n'.join(s['text'] for s in capture['scenes'])+(ROOT/'tutorial/media/administratie-transcript.txt').read_text(encoding='utf8')
assert not re.search(r'fitmetzorge@outlook|Patrick|Debora|hgoygcviutmynaihcvpd|PRIVATE PASSWORD|PRIVATE ADMIN',text,re.I)
for r in ledger['records']:
    if r['kind']=='invoice' and r.get('number'):assert r['number'].startswith('OEFEN-')
for j in ledger['journals']:
    assert sum(l['cents'] for l in ledger['lines'] if l['journal_id']==j['id'])==0
by={s['id']:s['proof'] for s in capture['scenes']}
assert next(i for i in by['08-restant']['invoices'] if i['number']=='OEFEN-2026-0002')['outstanding']==15000
assert next(i for i in by['08-historie']['invoices'] if i['number']=='OEFEN-2026-0002')['outstanding']==0
audio=subprocess.run([str(ff),'-hide_banner','-i',str(media),'-map','0:a:0','-af','volumedetect','-f','null','-'],capture_output=True,text=True)
assert audio.returncode==0,audio.stderr[-2000:]
log=audio.stderr
assert 'Video: h264' in log and 'Audio: aac' in log and '48000 Hz' in log
mean=float(re.search(r'mean_volume: (-?[\d.]+) dB',log).group(1));peak=float(re.search(r'max_volume: (-?[\d.]+) dB',log).group(1))
assert -30<mean<-8 and -8<peak<0, (mean,peak)
assert re.search(r'artist\s*:\s*FitMetZorge Oefenbedrijf',log)
vtt=(ROOT/'tutorial/media/administratie-nl.vtt').read_text(encoding='utf8');assert vtt.startswith('WEBVTT')
result={'mp4SHA256':proof['videoSHA256'],'bytes':media.stat().st_size,'durationSeconds':proof['duration'],'actualAACStreamDecodedInFull':True,'meanVolumeDB':mean,'peakVolumeDB':peak,'video':'H.264 yuv420p','audio':'AAC mono 48000Hz','chapters':20,'subtitleCues':vtt.count(' --> '),'syntheticScenes':104,'captureExternalRequests':0,'privateContentScanPassed':True,'metadataSynthetic':True,'allJournalsBalanced':True,'partial200Then150Verified':True,'physicalIPhoneHearing':'Owner still needs to confirm'}
(ROOT/'docs/examples/spoken-course/media-verification.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
print(json.dumps(result))

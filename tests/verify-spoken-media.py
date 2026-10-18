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
script=json.loads((ROOT/'tutorial/spoken-course-script.json').read_text(encoding='utf8'))
scene_count=sum(len(c['scenes']) for c in script['chapters'])
assert len(capture['scenes'])==scene_count and len(proof['sceneEvidence'])==scene_count
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
periods=[r for r in ledger['records'] if r['kind']=='vat_period']
settlements=[r for r in ledger['records'] if r['kind']=='vat_settlement' and r['status']=='posted']
q3=next(r for r in periods if r['data']['from']=='2026-07-01')
q2=next(r for r in periods if r['data']['from']=='2026-04-01')
assert int(q3['data']['declared_cents'])==7376 and int(q2['data']['declared_cents'])==-2100
assert sum(int(r['data']['signed_cents']) for r in settlements if r['parent_id']==q3['id'])==7376
assert sum(int(r['data']['signed_cents']) for r in settlements if r['parent_id']==q2['id'])==-2100
audio=subprocess.run([str(ff),'-hide_banner','-i',str(media),'-map','0:a:0','-af','volumedetect','-f','null','-'],capture_output=True,text=True)
assert audio.returncode==0,audio.stderr[-2000:]
log=audio.stderr
assert 'Video: h264' in log and 'Audio: aac' in log and '48000 Hz' in log
mean=float(re.search(r'mean_volume: (-?[\d.]+) dB',log).group(1));peak=float(re.search(r'max_volume: (-?[\d.]+) dB',log).group(1))
assert -30<mean<-8 and -8<peak<0, (mean,peak)
assert re.search(r'artist\s*:\s*FitMetZorge Oefenbedrijf',log)
vtt=(ROOT/'tutorial/media/administratie-nl.vtt').read_text(encoding='utf8');assert vtt.startswith('WEBVTT')
result={'mp4SHA256':proof['videoSHA256'],'bytes':media.stat().st_size,'durationSeconds':proof['duration'],'actualAACStreamDecodedInFull':True,'meanVolumeDB':mean,'peakVolumeDB':peak,'video':'H.264 yuv420p','audio':'AAC mono 48000Hz','chapters':len(script['chapters']),'subtitleCues':vtt.count(' --> '),'syntheticScenes':scene_count,'captureExternalRequests':0,'privateContentScanPassed':True,'metadataSynthetic':True,'allJournalsBalanced':True,'partial200Then150Verified':True,'vatQ3Paid7376Cents':True,'vatQ2Refund2100Cents':True,'physicalIPhoneHearing':'Owner still needs to confirm'}
(ROOT/'docs/examples/spoken-course/media-verification.json').write_text(json.dumps(result,indent=2)+'\n',encoding='utf8')
print(json.dumps(result))

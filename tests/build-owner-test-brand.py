"""Exact owner-supplied source; only proportional resampling and transparent padding.
No AI, website fetch, shape edit, recolouring, compositing or content crop.
"""
from pathlib import Path
from PIL import Image
import hashlib, json, shutil, sys

root = Path(__file__).resolve().parent.parent
source = Path(sys.argv[1]) if len(sys.argv) > 1 else root / 'owner-test/brand/source-logo-20261102.png'
out = root / 'owner-test/brand'
out.mkdir(parents=True, exist_ok=True)
expected = 'f60fd1fd2d34c02cfae5a7cb833e2cfc32c4c1284e200880cb0f68a0d05b315a'
assert hashlib.sha256(source.read_bytes()).hexdigest() == expected, 'Wrong official source logo'
if source.resolve() != (out / 'source-logo-20261102.png').resolve():
    shutil.copyfile(source, out / 'source-logo-20261102.png')
im = Image.open(source).convert('RGBA')
variants = {}
for name, size in [('horizontal', (960,480)), ('sidebar', (320,160)), ('app-512', (512,512)), ('app-192', (192,192)), ('favicon-64', (64,64)), ('favicon-32', (32,32))]:
    canvas = Image.new('RGBA', size, (0,0,0,0))
    bounds = (int(size[0]*.9), int(size[1]*.9)) if size[0] == size[1] else size
    resized = im.copy()
    resized.thumbnail(bounds, Image.Resampling.LANCZOS)
    offset = ((size[0]-resized.width)//2, (size[1]-resized.height)//2)
    canvas.paste(resized, offset)
    target = out / (name + '.png')
    canvas.save(target)
    variants[name] = {'path':'owner-test/brand/'+target.name, 'width':size[0], 'height':size[1], 'imageBounds':[offset[0],offset[1],resized.width,resized.height], 'operation':'proportional resize of complete source; transparent padding only', 'sha256':hashlib.sha256(target.read_bytes()).hexdigest()}
pixels = list(im.getdata())
gold = {}
for name, rgb in [('primary',(223,166,57)),('highlight',(241,191,75)),('edge',(191,131,41))]:
    index = next(i for i,p in enumerate(pixels) if p[:3] == rgb and p[3] > 240)
    gold[name] = {'hex':'#%02x%02x%02x'%rgb,'sourcePixel':[index%im.width,index//im.width],'sourceRGBA':pixels[index]}
proof = {'sourceFilename':'Logo 02-11-2026.png','sourceSHA256':expected,'sourceOrigin':'Local file explicitly supplied by owner in this task; not retrieved from website','sourceDimensions':list(im.size),'sourceAlphaRange':im.getchannel('A').getextrema(),'sourcePreservedByteIdentical':True,'contentCrop':False,'designModified':False,'goldSamples':gold,'variants':variants,'limits':['Small icon uses full horizontal mark without redesign; tiny lettering is naturally less readable at favicon size.','PWA and favicon are test previews only; no ordinary production manifest/icon changed.','Neutral surfaces and semantic status colours are accessibility choices, not invented colours attributed to the logo.']}
(out/'provenance.json').write_text(json.dumps(proof,indent=2)+'\n',encoding='utf-8',newline='\n')
print(json.dumps({'sourceSHA256':expected,'size':im.size,'goldSamples':gold,'variants':len(variants)}))

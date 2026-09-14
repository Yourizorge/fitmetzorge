"""Inspect rendered invoice text/geometry, using only fixed local synthetic PDFs."""
from pathlib import Path
import json
import pdfplumber
from pypdf import PdfReader
from PIL import Image, ImageDraw

folder=Path(__file__).parent/'artifacts'/'invoice-layout'
expected=json.loads((folder/'expected.json').read_text(encoding='utf-8'))
for name,values in expected.items():
    with pdfplumber.open(folder/f'{name}.pdf') as pdf:
        text='\n'.join(page.extract_text() or '' for page in PdfReader(folder/f'{name}.pdf').pages)
        for key in ('total','net','vat','number'):
            assert values[key] in text,(name,key,values[key])
        assert not any(word in text for word in ['CoManage','undefined','null','NaN']),name
        for n,page in enumerate(pdf.pages,1):
            assert f'{n} / {len(pdf.pages)}' in page.extract_text(),(name,'page count')
            if n==1: assert page.images,(name,'original logo embedded')
            for char in page.chars:
                assert 55<=char['x0']<=char['x1']<=540,(name,'horizontal overflow',char)
                assert 43<=char['top']<char['bottom']<833,(name,'vertical overflow',char)
        if name=='progressie':
            assert '€ -30,00' in text and '€ 350,00' in text
        if name=='optioneel-leeg':
            assert 'IBAN' not in text and 'KVK' not in text and 'Btw-id' not in text
        if name=='lange-omschrijving':
            for n in range(1,51): assert text.count(f'DEEL-{n:03d}')==1,(name,n)
        if name=='credit':
            assert 'CREDITFACTUUR' in text and 'Te crediteren' in text
            assert 'Maak het openstaande bedrag' not in text
    print(f'PASS {name}: {values["pages"]} A4 page(s), complete cents/text, page bounds')

# A visual overview supplements, but does not replace, inspection of full page renders.
images=sorted(folder.glob('*-[0-9].png'))
for offset in range(0,len(images),6):
    sheet=Image.new('RGB',(1050,1060),'#d9dde2');draw=ImageDraw.Draw(sheet)
    for i,path in enumerate(images[offset:offset+6]):
        page=Image.open(path).convert('RGB');page.thumbnail((338,495))
        x=(i%3)*350+6;y=(i//3)*530+25
        draw.text((x,y-18),path.stem,fill='black');sheet.paste(page,(x,y))
    sheet.save(folder/f'contact-{offset//6+1}.png')
page=Image.open(folder/'progressie-1.png')
for name,box in {'bovenkant':(0,0,page.width,495),'tabel':(65,490,820,695),'iban-totalen':(65,696,820,900),'footer':(65,1095,825,1240)}.items():
    page.crop(box).save(folder/f'voorbeeld-{name}.png')

from pathlib import Path
import json
from pypdf import PdfReader
folder=Path(__file__).parent/'artifacts'
expected=json.loads((folder/'hotfix-a4-expected.json').read_text())
def money(cents):
 return f'{cents/100:.2f}'.replace('.',',')
for name,key in [('hotfix-a4-single.pdf','single'),('hotfix-a4-multiple.pdf','multi')]:
 reader=PdfReader(folder/name);text='\n'.join(p.extract_text() for p in reader.pages)
 for amount in ['total','net','vat']:
  assert money(expected[key][amount]) in text,(name,amount)
 for i,p in enumerate(reader.pages):
  assert abs(float(p.mediabox.width)-595.28)<.01
  assert abs(float(p.mediabox.height)-841.89)<.01
  assert f'{i+1} / {len(reader.pages)}' in p.extract_text()
  if key=='multi':assert p.extract_text().count('REGEL-')==p.extract_text().count('aanvullende toelichting voor de klant.'),'Ordinary invoice row split across pages'
 if key=='multi':
  for n in range(1,66):assert text.count(f'REGEL-{n:03d}')==1,n
  assert text.count('aanvullende toelichting voor de klant.')==65
 print(f'PASS {name}: {len(reader.pages)} A4 pages, totals, numbering and complete text')

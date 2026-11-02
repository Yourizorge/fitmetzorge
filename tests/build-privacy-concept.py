"""Review copy only. No production policy, activation or customer information."""
import json, html
from pathlib import Path
from reportlab.platypus import SimpleDocTemplate, Paragraph, Spacer, PageBreak, KeepTogether
from reportlab.lib.styles import getSampleStyleSheet, ParagraphStyle
from reportlab.lib.colors import HexColor
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from pypdf import PdfReader
R=Path(__file__).resolve().parent.parent
D=json.loads((R/'docs/privacy-concept-20261026.json').read_text(encoding='utf-8'))
O=R/'output/pdf';O.mkdir(exist_ok=True,parents=True)
pdfmetrics.registerFont(TTFont('Review','C:/Windows/Fonts/arial.ttf'))
pdfmetrics.registerFont(TTFont('ReviewBold','C:/Windows/Fonts/arialbd.ttf'))
S=getSampleStyleSheet()
S.add(ParagraphStyle('review',fontName='Review',fontSize=10.4,leading=15.8,spaceAfter=10,textColor=HexColor('#20232b')))
S.add(ParagraphStyle('section',fontName='ReviewBold',fontSize=17,leading=21,spaceAfter=13,keepWithNext=True,textColor=HexColor('#302b18')))
S.add(ParagraphStyle('note',parent=S['review'],fontSize=9,leading=13,textColor=HexColor('#795719')))
S.add(ParagraphStyle('coverReview',parent=S['section'],fontSize=29,leading=35,spaceAfter=22))
def p(t,style='review'):return Paragraph(html.escape(t),S[style])
story=[p('FitMetZorge','section'),p(D['title'],'coverReview'),p(D['version'],'note'),p(D['status'],'note'),Spacer(1,14),p(D['intro']),Spacer(1,12),p('Eerst beoordelen','section')]
for i,t in enumerate(D['ownerReview']):story.append(p(str(i+1)+'. '+t))
story.extend([Spacer(1,8),p('Dit concept is gebaseerd op de hieronder genoemde primaire bronnen en de onderzochte APPFMZ-functies. Het is geen verklaring dat de bedrijfsvoering al aan alle vereisten voldoet.','note')])
for n,section in enumerate(D['sections']):
 if n in [0,2,4,6,8]:story.append(PageBreak())
 story.append(p(section['title'],'section'))
 for t in section['paragraphs']:story.append(p(t))
story.extend([Spacer(1,18),p('Bronnen, geraadpleegd 26 oktober 2026','section')])
for title,url in D['sources']:story.append(Paragraph(html.escape(title)+': <link href="'+html.escape(url,quote=True)+'" color="#705920">bron openen</link>',S['review']))
def frame(c,doc):
 c.setFillColor(HexColor('#faf5e6'));c.rect(0,806,595,36,fill=1,stroke=0);c.setFont('ReviewBold',9);c.setFillColor(HexColor('#73511c'));c.drawString(42,820,'CONCEPT TER BEOORDELING - NIET GEPUBLICEERD')
 c.setFont('Review',8);c.setFillColor(HexColor('#626671'));c.drawString(42,25,D['version']);c.drawRightString(553,25,str(doc.page))
out=O/'APPFMZ-privacyconcept-ter-beoordeling.pdf'
SimpleDocTemplate(str(out),pagesize=(595.28,841.89),leftMargin=43,rightMargin=43,topMargin=60,bottomMargin=48,title=D['title'],author='FitMetZorge - concept',subject=D['status']).build(story,onFirstPage=frame,onLaterPages=frame)
reader=PdfReader(out);assert all('CONCEPT TER BEOORDELING' in page.extract_text() for page in reader.pages)
assert all(len(page.extract_text())>300 for page in reader.pages)
parts=['<!doctype html><html lang="nl"><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>'+html.escape(D['title'])+'</title><style>body{font:18px/1.65 system-ui;max-width:800px;margin:32px auto;padding:0 22px;color:#222}h1{line-height:1.2}aside{background:#fff5d7;padding:20px;border-left:4px solid #a87918}h2{margin-top:40px}li{margin-bottom:12px}</style><main><aside><strong>'+html.escape(D['status'])+'</strong><p>'+html.escape(D['intro'])+'</p></aside><h1>'+html.escape(D['title'])+'</h1><p>'+html.escape(D['version'])+'</p><h2>Eerst beoordelen</h2><ol>']
parts += ['<li>'+html.escape(x)+'</li>' for x in D['ownerReview']];parts+=['</ol>']
for section in D['sections']:parts+=['<section><h2>'+html.escape(section['title'])+'</h2>']+['<p>'+html.escape(t)+'</p>' for t in section['paragraphs']]+['</section>']
parts+=['<h2>Primaire bronnen</h2><ul>']+['<li><a href="'+html.escape(url,quote=True)+'">'+html.escape(title)+'</a></li>' for title,url in D['sources']]+['</ul></main></html>']
(R/'docs/APPFMZ_PRIVACY_CONCEPT_20261026.html').write_text('\n'.join(parts),encoding='utf-8')
print('PASS:',len(reader.pages),'pages; every page clearly marked draft;',out.name)

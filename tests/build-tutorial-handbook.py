"""Public course handbook; inputs contain static synthetic course material only."""
import json, html, os
from pathlib import Path
from reportlab.platypus import BaseDocTemplate, PageTemplate, Frame, Paragraph, Spacer, PageBreak, KeepTogether, Image, Table, TableStyle
from reportlab.platypus.tableofcontents import TableOfContents
from reportlab.lib.styles import ParagraphStyle
from reportlab.lib import colors
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.lib.utils import ImageReader
from pypdf import PdfReader

ROOT=Path(__file__).resolve().parent.parent
D=json.loads((ROOT/'tests/artifacts/tutorial/handbook-content.json').read_text(encoding='utf-8'))
OUT=ROOT/'output/pdf'; OUT.mkdir(parents=True,exist_ok=True)
font_regular=os.environ.get('FMZ_FONT_REGULAR', 'C:/Windows/Fonts/arial.ttf' if os.name=='nt' else '/usr/share/fonts/truetype/dejavu/DejaVuSans.ttf')
font_bold=os.environ.get('FMZ_FONT_BOLD', 'C:/Windows/Fonts/arialbd.ttf' if os.name=='nt' else '/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf')
pdfmetrics.registerFont(TTFont('Course',font_regular))
pdfmetrics.registerFont(TTFont('CourseBold',font_bold))
pdfmetrics.registerFontFamily('Course',normal='Course',bold='CourseBold',italic='Course',boldItalic='CourseBold')
ink=colors.HexColor('#192c32');green=colors.HexColor('#246554');muted=colors.HexColor('#526561');soft=colors.HexColor('#e9f0eb');gold=colors.HexColor('#b89a58')
styles={
 'body':ParagraphStyle('body',fontName='Course',fontSize=10.2,leading=15.1,textColor=ink,spaceAfter=9),
 'small':ParagraphStyle('small',fontName='Course',fontSize=8.5,leading=12,textColor=muted,spaceAfter=7),
 'h1':ParagraphStyle('h1',fontName='CourseBold',fontSize=25,leading=30,textColor=ink,spaceAfter=20,keepWithNext=True),
 'h2':ParagraphStyle('h2',fontName='CourseBold',fontSize=13,leading=17,textColor=green,spaceBefore=11,spaceAfter=7,keepWithNext=True),
 'h3':ParagraphStyle('h3',fontName='CourseBold',fontSize=11,leading=15,textColor=ink,spaceBefore=7,spaceAfter=5,keepWithNext=True),
 'cover':ParagraphStyle('cover',fontName='CourseBold',fontSize=37,leading=44,textColor=ink,spaceAfter=25),
 'label':ParagraphStyle('label',fontName='CourseBold',fontSize=10,leading=14,textColor=green,spaceAfter=14),
 'cell':ParagraphStyle('cell',fontName='Course',fontSize=8.7,leading=12,textColor=ink,spaceAfter=0),
}
def esc(s): return html.escape(str(s))
def p(s,style='body'): return Paragraph(esc(s),styles[style])
def link(label,url): return Paragraph('<a href="'+esc(url)+'" color="#246554"><u>'+esc(label)+'</u></a>',styles['small'])
story=[]
class Book(BaseDocTemplate):
 def afterFlowable(self,flowable):
  if isinstance(flowable,Paragraph) and hasattr(flowable,'toc_key'):
   self.canv.bookmarkPage(flowable.toc_key);self.canv.addOutlineEntry(flowable.getPlainText(),flowable.toc_key,0)
   self.notify('TOCEntry',(0,flowable.getPlainText(),self.page,flowable.toc_key))
def heading(text,key):
 h=p(text,'h1');h.toc_key=key;story.append(h)
def page(canvas,doc):
 canvas.saveState();w,h=doc.pagesize
 if doc.page>1:
  canvas.setStrokeColor(gold);canvas.line(48,h-41,w-48,h-41)
  canvas.setFont('CourseBold',8);canvas.setFillColor(green);canvas.drawString(48,h-29,'APPFMZ  /  BOEKHOUDEN VOOR BEGINNERS')
  canvas.setFont('Course',8);canvas.setFillColor(muted);canvas.drawRightString(w-48,h-29,'Handleiding voor de owner')
 canvas.setStrokeColor(colors.HexColor('#d6ded9'));canvas.line(48,43,w-48,43)
 canvas.setFont('Course',7.3);canvas.setFillColor(muted);canvas.drawString(48,29,'Versie '+D['version']+' · inhoudscontrole '+D['checked']+' · algemene uitleg, geen persoonlijk fiscaal advies')
 canvas.setFont('CourseBold',9);canvas.drawRightString(w-48,28,str(doc.page));canvas.restoreState()
doc=Book(str(OUT/'APPFMZ-boekhouden-voor-beginners.pdf'),pagesize=(595.28,841.89),leftMargin=48,rightMargin=48,topMargin=64,bottomMargin=61,title='APPFMZ Boekhouden voor beginners — handleiding voor de owner',author='FitMetZorge',pageCompression=1)
doc.addPageTemplates(PageTemplate(id='book',frames=[Frame(48,61,499.28,716.89,id='body',leftPadding=0,rightPadding=0,topPadding=0,bottomPadding=0)],onPage=page))
story += [Spacer(1,45),p('FITMETZORGE  ·  APPFMZ ACADEMIE','label'),p('Boekhouden<br/>voor beginners'.replace('<br/>','\n'),'cover'),p('Handleiding voor de owner','h1'),p('Een eenvoudige hoofdroute in 12 stappen, 27 verdiepende lessen, 12 nieuwe financiële oefenstappen, een volledige oefenmaand en vaste werklijsten.'),Spacer(1,23)]
box=Table([[p('LEZEN. PROBEREN. CONTROLEREN.','label')],[p('De cursus gebruikt uitsluitend vaste voorbeeldgegevens. Oefenfacturen zijn niet geldig en veranderen je echte administratie niet.')],[p('Lesvoortgang, taakvinkjes en je videopositie worden lokaal onthouden. Oefeninvoer verdwijnt zodra het oefenvenster wordt gesloten.')]],colWidths=[499.28]);box.setStyle(TableStyle([('BACKGROUND',(0,0),(-1,-1),soft),('BOX',(0,0),(-1,-1),.6,gold),('LEFTPADDING',(0,0),(-1,-1),18),('RIGHTPADDING',(0,0),(-1,-1),18),('TOPPADDING',(0,0),(-1,-1),12),('BOTTOMPADDING',(0,0),(-1,-1),6)]));story += [box,Spacer(1,28),p('Versie '+D['version']+' · laatste inhoudscontrole '+D['checked'],'small'),p(D['disclaimer'],'small'),link('Open de interactieve cursus','https://appfmz.nl/tutorial.html'),PageBreak()]
heading('Inhoud','contents');toc=TableOfContents();toc.levelStyles=[ParagraphStyle('toc',fontName='Course',fontSize=10,leading=15,spaceBefore=5,textColor=ink)];story.append(toc);story.append(PageBreak())
heading('Zo gebruik je deze cursus','start')
for s in ['Open in Administratie rechtsboven Uitleg & oefenen. Je kunt de cursus ook rechtstreeks openen via appfmz.nl/tutorial.html.','Kies Beginnerscursus starten of Oefenen met voorbeeldgegevens voor de hoofdroute met 12 stappen. Los onderwerp bekijken geeft toegang tot alle 27 verdiepende lessen.','Iedere stap in de hoofdroute legt uit wat je doet, waarom, waar je tikt, wat het resultaat is en wat je bij een fout doet. De verdiepende lessen hebben elf onderdelen. Informatieknoppen leggen begrippen uit.','Vul alleen de genoemde synthetische voorbeelden in. Klik daarna op de oefenhandeling. Een foutmelding geeft uitleg en laat je invoer staan. Verbeter de invoer en probeer opnieuw.','De hoofdroute toont je voortgang in 12 stappen. Controleer de oefenuitkomst om een stap af te ronden. De 27 verdiepende lessen hebben afzonderlijke voortgang; daar zijn de oefeningen en controlevragen nodig. Overslaan telt niet als voltooid. Eerdere voortgang blijft behouden.','Stoppen onthoudt op dit apparaat je lesvoortgang, taakvinkjes en videopositie. Opnieuw oefenen in de hoofdroute herstelt de tijdelijke voorbeelden en behoudt je voortgang. Alleen de afzonderlijke volledige cursusreset wist ook de lesvoortgang en taken. Echte gegevens blijven altijd buiten de cursus.','De uitleg kiest geen btw-tarief of stelsel voor jou. Waar 21% wordt gebruikt, is dat uitsluitend een vaste fictieve rekensituatie. Controleer echte instellingen met je eigen registraties en officiële bronnen.']:
 story.append(p(s))
story.append(p('Belangrijke knopnamen','h2'));story.append(p('Vorige · Volgende · Opnieuw uitleggen · Oefening opnieuw doen · Stap overslaan · Stoppen en later verdergaan. De knop Naar mijn echte administratie sluit het oefenvenster; er worden nooit oefengegevens gekopieerd.'))
story.append(PageBreak());heading('Herken de hoofdschermen','screens')
for name,caption in [('home-1400-light.png','Start: kies leren, een los onderwerp of zelf oefenen.'),('topics-1400-light.png','Onderwerpen: één les per scherm, met herkenbare voortgang.'),('exercise-390-light.png','Telefoon: grote invoervelden en een afzonderlijke oefenknop.'),('glossary-1400-light.png','Begrippen: zoek een term in gewone taal.'),('tasks-1400-light.png','Taken: vier lokale werklijsten die niets automatisch uitvoeren.')]:
 f=ROOT/'tests/artifacts/tutorial'/name
 if not f.exists(): raise RuntimeError('Required UI screenshot missing: '+name)
 iw,ih=ImageReader(str(f)).getSize();width=215 if iw<500 else 475;height=width*ih/iw
 if height>440:width*=440/height;height=440
 story.append(KeepTogether([p(caption,'h2'),Image(str(f),width=width,height=height),Spacer(1,14)]))
story.append(PageBreak());heading('De nieuwe hoofdroute: 12 stappen','beginner-route')
story.append(p('Start hier. Gebruik dezelfde betaalvelden en controles in de afgeschermde oefenomgeving. Al je eerdere lesvoortgang blijft behouden. Opnieuw oefenen wist alleen tijdelijke voorbeeldgegevens.'))
story.append(link('Bekijk de volledige gesproken rondleiding met Nederlandse ondertitels','https://appfmz.nl/tutorial.html?video=1'))
spoken=json.loads((ROOT/'tutorial/spoken-course-script.json').read_text(encoding='utf-8'))
story.append(PageBreak());heading('De gesproken rondleiding','spoken-tour')
story.append(p('Vernieuwd: 20 hoofdstukken met Nederlandse gesproken uitleg, echte schermopnamen en uitsluitend fictieve gegevens. Je kunt pauzeren, tien seconden terug, de snelheid kiezen, het beeld vergroten, volume kiezen en een hoofdstuk apart afspelen. De speler onthoudt je positie voor deze videoversie op dit apparaat; volledig scherm is beschikbaar waar de browser dit ondersteunt. Het transcript staat bij ieder hoofdstuk en is ook te downloaden. Je bestaande cursusvoortgang blijft behouden.'))
for chapter in spoken['chapters']:
 story.append(link(str(chapter['id'])+'. '+chapter['title'],'https://appfmz.nl/tutorial.html?video=1&chapter='+str(chapter['id'])))
story.append(p('De opname gebruikt een geïsoleerde oefenklok voor april–oktober 2026. Alleen het fictieve bedrijf gebruikt in dit voorbeeld 21% btw en het factuurstelsel. Neem geen instellingen over zonder controle van je eigen situatie. De kunstmatige Nederlandse Colette-stem komt uit de kosteloze Microsoft Edge-voorleesdienst. Alleen het fictieve openbare script is daarvoor gebruikt; geen echte administratie.','small'))
story.append(PageBreak());heading('Een fout herstellen zonder geschiedenis te wissen','bank-repair')
for title,text in [('Foutieve Bank/Kas-invoer','Open de regel en kies Corrigeren / Foutieve invoer herstellen. Beschrijf de fout. Kies Effect bekijken. Controleer de bankstand, gekoppelde facturen en het resterende bedrag. Vink pas daarna de bevestiging aan en bevestig de correctie. De oorspronkelijke regel en reden blijven bewaard.'),('Echte ontvangst, verkeerde koppeling','Kies alleen de factuurkoppeling losmaken. De bankontvangst blijft staan en komt weer beschikbaar. Open de juiste bestaande factuur, kies Betaling registreren en selecteer deze ontvangst. Geen tweede ontvangst of omzet boeken.'),('Foutieve beginstand','Gebruik Beginstand corrigeren. Vervang alleen door een gecontroleerde datum en afschriftsaldo, of zet een onjuiste invoer terug naar onbekend. Onbekend betekent niet nul. Een afgesloten of afgestemde periode kan eerst onderzoek vereisen.'),('Veilig oefenen','Open in de beginnersroute Bank/Kas. Kies Bestaande ontvangst koppelen oefenen of Foutieve Bank/Kas-invoer herstellen oefenen. Iedere knop start een vaste fictieve oefenronde. Je lesvoortgang blijft behouden; echte gegevens worden niet gelezen of veranderd.')]:
 story.extend([p(title,'h2'),p(text)])
story.append(link('Bekijk de volledige herstelvoorbeelden in hoofdstuk 10','https://appfmz.nl/tutorial.html?video=1&chapter=10'))
for step in D['beginner']['steps']:
 story.append(PageBreak());heading('Stap '+str(step['id'])+' — '+step['title'],'beginner-'+str(step['id']))
 for label,key in [('Wat doe ik?','what'),('Waarom doe ik dit?','why'),('Waar tik ik?','tap'),('Wat hoort zichtbaar te zijn?','result'),('Wat doe ik bij een fout?','error')]:
  story.extend([p(label,'h2'),p(step[key])])
 story.append(p('Controleer de uitkomst in de oefening. Oefenfacturen zijn niet geldig. Er worden geen echte nummers, e-mails, bankmutaties of klantgegevens gebruikt.','small'))
 for chapter in step.get('videoChapters',[]):story.append(link('Bijbehorende gesproken uitleg: hoofdstuk '+str(chapter),'https://appfmz.nl/tutorial.html?video=1&chapter='+str(chapter)))
 if step['id']==5:
  f=ROOT/'docs/images/admin-simple/after-payment-laptop.png'
  if f.exists():
   iw,ih=ImageReader(str(f)).getSize();height=min(265,300*ih/iw);width=height*iw/ih
   story.extend([Spacer(1,8),Image(str(f),width=width,height=height),p('Dezelfde betaalvelden in de administratie. Schermbeeld met uitsluitend synthetische gegevens.','small')])
story.append(PageBreak());heading('Vernieuwd: financieel overzicht en btw','finance-route')
story.append(p('Open Uitleg & oefenen → Nieuw: financiële overzichten en btw veilig oefenen. Deze aanvullende route gebruikt dezelfde nieuwe schermen en betaalvensters, met uitsluitend tijdelijk opgeslagen voorbeeldgegevens. Geen productieverbinding. Eerdere cursusvoortgang blijft behouden. De voorbeelden hieronder horen bij deze afzonderlijke oefenronde; de volledige video heeft daarnaast een open oefenfactuur van €75, waardoor daar kwartaal 3 op €73,76 btw uitkomt.'))
for step in D['finance']['steps']:
 story.append(PageBreak());heading('Financiële oefening '+str(step['id'])+' — '+step['title'],'finance-'+str(step['id']))
 for label,key in [('Wat is dit?','what'),('Waarom heb ik dit nodig?','why'),('Wat moet ik nu doen?','action'),('Wat hoort het resultaat te zijn?','result'),('Controle: is het goed gegaan?','check')]:story.extend([p(label,'h2'),p(step[key])])
 story.append(link('Bekijk de uitgebreide financiële uitleg in hoofdstuk 17','https://appfmz.nl/tutorial.html?video=1&chapter=17'))
story.append(PageBreak());heading('Verdieping: bestaande lessen, bijgewerkt','refreshed-lessons')
story.append(p('Alle onderstaande routes zijn aangepast aan Facturen, Bank/Kas, Inkomsten, Uitgaven, Winst, Btw, Overzichten en Meer administratie. De oefening Betaling registreren is de dagelijkse hoofdhandeling. De aanvullende koppeloefeningen leren je een al bestaande ontvangst te beoordelen.'))
story.append(p('Broncontrole op 18 oktober 2026: Belastingdienst over factuureisen, bewaring, privé, btw-stelsels, aangifte, voorbelasting, zakelijke kosten, afschrijving en inkomstenbelasting. De ING-links zijn algemene verwijzingen; de precieze schermbenamingen binnen Mijn ING zijn niet met een banklogin gecontroleerd.','small'))
for lesson in D['lessons']:
 story.append(PageBreak());heading(('Les '+str(lesson['id'])+' — ' if lesson['id']<27 else '')+lesson['title'],'lesson-'+str(lesson['id']))
 control_start=None
 for i,text in enumerate(lesson['sections']):
  if i==9:control_start=len(story)
  story.append(p(str(i+1)+'. '+D['headings'][i],'h2'))
  if i==9:
   for j,q in enumerate(lesson['quiz']):
    story.append(p(str(j+1)+'. '+q['question'],'h3'))
    story.append(p(' / '.join(q['options'])))
    story.append(p('Controleantwoord: '+q['options'][q['correct']]+'. '+q['feedback'],'small'))
  else:story.append(p(text))
  if i==5 and lesson['id']==3:
   for row in D['fieldHelp']:story.extend([p(row[0],'h3'),p('Waar vinden: '+row[1]+'. '+row[2]+' In APPFMZ: '+row[3],'small')])
  if i==5 and lesson['id']==15:
   for j,line in enumerate(D['ingSteps']):story.append(p(str(j+1)+'. '+line))
  if i==6:
   for j,step in enumerate(D['plans'][str(lesson['id'])]):
    story.extend([p('Oefenhandeling '+str(j+1)+' — '+step['title'],'h3'),p(step['guide'],'small')])
    for f in step['fields']:
     answer='Controleren en aanvinken' if f['type']=='checkbox' else str(f['answer'])
     story.append(p(f['label']+': '+answer+'. '+f['hint'],'small'))
    if step.get('preview'):story.append(p('Open eerst de A4-preview. Controleer de getoonde waarden voordat je de oefenhandeling bevestigt.','small'))
    if step.get('csv'):story.append(p('Kies het vaste oefenbestand, bekijk vijf unieke transacties en één duplicaat, bevestig daarna de lokale import.','small'))
    if step.get('pdf') or step.get('downloads'):story.append(p('Open de oefen-PDF, zoom, sluit en download. Iedere pagina is gemarkeerd OEFENFACTUUR — NIET GELDIG.','small'))
    if step.get('downloads'):story.append(p('Download ook de ZIP en controleer de inhoudslijst. Alleen synthetische gegevens; niets wordt verstuurd.','small'))
 if lesson['refs']:
  story.extend([p('Officiële bronnen · gecontroleerd '+D['checked'],'h3'),p(D['disclaimer'],'small')])
  for ref in lesson['refs']:story.append(link(*D['sources'][ref]))
 if control_start is not None:
  tail=story[control_start:];del story[control_start:];story.append(KeepTogether(tail))
story.append(PageBreak());heading('Begrippen in gewone taal','glossary')
for term,definition in sorted(D['glossary'].items(),key=lambda x:x[0].lower()):story.extend([p(term,'h2'),p(definition)])
story.append(PageBreak());heading('Mijn boekhoudtaken','tasks')
story.append(p('Lokale geheugensteun: afvinken voert geen echte taak uit. In de cursus kun je de vinkjes bewaren op dit apparaat. Op papier kun je de vakjes gebruiken.'))
for period,items in D['tasks'].items():
 task_start=len(story)
 story.append(p({'week':'Iedere week of regelmatig','month':'Iedere maand','quarter':'Ieder kwartaal','year':'Ieder jaar'}[period],'h2'))
 for item in items:story.append(p('□  '+item))
 tail=story[task_start:];del story[task_start:];story.append(KeepTogether(tail))
story.append(PageBreak());heading('Officiële bronnen en versie','sources')
story.append(p('Laatste inhoudscontrole: '+D['checked']+'. Versie '+D['version']+'. '+D['disclaimer']))
story.append(p('Deze handleiding en de interactieve cursus komen uit dezelfde inhoudsbestanden. De appbediening is getoetst tegen APPFMZ. ING kan de namen en locaties van knoppen veranderen. Open uitsluitend de officiële bankomgeving en vul nooit een ING-wachtwoord in APPFMZ in.'))
for key,(title,url) in D['sources'].items():
 story.append(p(title,'h2'));story.append(link(url,url))
story.append(p('Wat dit document niet doet','h2'));story.append(p('Geen aangifte indienen, belasting betalen, persoonlijke belastingaanslag voorspellen, boekhoudkoppeling activeren of echte bedrijfsinstellingen aanpassen. De owner blijft verantwoordelijk voor de controle van werkelijke gebeurtenissen, documenten, toegangsbeheer en bewaartermijnen.'))
doc.multiBuild(story)
reader=PdfReader(OUT/'APPFMZ-boekhouden-voor-beginners.pdf');texts=[page.extract_text() for page in reader.pages]
for lesson in D['lessons']:assert lesson['title'] in '\n'.join(texts),lesson['title']
assert all(len(t.strip())>70 for t in texts)
print('Handbook:',len(reader.pages),'A4 pages, all 27 lessons and sources present.')

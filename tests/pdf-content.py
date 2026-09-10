from pathlib import Path
from pypdf import PdfReader

for package, amount in [('pt-basis', '200,00'), ('pt-progressie', '350,00'), ('pt-transformatie', '480,00')]:
    reader = PdfReader(Path('tests/artifacts') / (package + '.pdf'))
    text = '\n'.join(page.extract_text() for page in reader.pages)
    assert len(reader.pages) == 1
    assert 'FACTUUR' in text and 'Factuurnummer: FMZ-' in text
    assert 'Oorspronkelijk bedrag incl. btw' in text and 'Korting' in text and 'Te betalen' in text
    assert amount in text and '\u20ac' in text
    assert 'synthetic@example.test' in text and 'TEST-IBAN' in text
    if package == 'pt-progressie':
        for expected in ['380,00', '30,00', '289,26', '60,74', '350,00', 'Synthetic korting', 'Betaaltermijn: 21 dagen']:
            assert expected in text
    assert abs(float(reader.pages[0].mediabox.width) - 595.28) < 0.01
    assert len(reader.pages[0].images) > 0, 'Missing logo'
    print('PASS PDF content, embedded logo, euro and A4:', package)

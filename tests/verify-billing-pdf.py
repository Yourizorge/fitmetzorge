"""Verify the actual public synthetic PDF examples, not only their source JSON."""
from pathlib import Path
import json
from pypdf import PdfReader

cases = {
    "vier-weken": ["Per 4 weken (28 dagen)", "28-09-2026", "25-10-2026", "350,00", "289,26", "60,74", "30,00"],
    "kalendermaand": ["Per kalendermaand", "01-10-2026", "31-10-2026", "180,00", "148,76", "31,24", "20,00"],
}
result = {}
for name, expected in cases.items():
    file = Path("docs/examples/billing-20260924") / (name + ".pdf")
    assert file.read_bytes().startswith(b"%PDF-")
    reader = PdfReader(file)
    assert len(reader.pages) == 1
    page = reader.pages[0]
    assert abs(float(page.mediabox.width) - 595.28) < 0.1
    assert abs(float(page.mediabox.height) - 841.89) < 0.1
    text = " ".join(page.extract_text().split())
    for value in expected:
        assert value in text, f"{name}: missing {value}"
    result[name] = {"pages": 1, "validA4PDF": True, "periodDiscountNetVATTotalFound": True}
Path("docs/APPFMZ_BILLING_PDF_20260924.json").write_text(json.dumps(result, indent=2) + "\n", encoding="utf-8")
print("PASS both actual A4 PDF contents: cycle, exact dates, discount, net, VAT and total")

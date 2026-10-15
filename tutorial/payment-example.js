/* Fixed synthetic example; no production data. */
(function(r){const s={
 "files": [],
 "lines": [
  {
   "cents": 0,
   "org_id": "OEF-001",
   "line_no": 1,
   "journal_id": "OEF-002",
   "account_code": "11000",
   "reference_id": "OEF-003"
  },
  {
   "cents": 0,
   "org_id": "OEF-001",
   "line_no": 2,
   "journal_id": "OEF-002",
   "account_code": "2000",
   "reference_id": "OEF-003"
  },
  {
   "cents": 0,
   "org_id": "OEF-001",
   "line_no": 1,
   "journal_id": "OEF-004",
   "account_code": "11001",
   "reference_id": "OEF-005"
  },
  {
   "cents": 0,
   "org_id": "OEF-001",
   "line_no": 2,
   "journal_id": "OEF-004",
   "account_code": "2000",
   "reference_id": "OEF-005"
  },
  {
   "cents": 35000,
   "org_id": "OEF-001",
   "line_no": 1,
   "journal_id": "OEF-006",
   "account_code": "1100",
   "reference_id": "OEF-007"
  },
  {
   "cents": -28926,
   "org_id": "OEF-001",
   "line_no": 2,
   "journal_id": "OEF-006",
   "account_code": "4000",
   "reference_id": "OEF-007"
  },
  {
   "cents": -6074,
   "org_id": "OEF-001",
   "line_no": 3,
   "journal_id": "OEF-006",
   "account_code": "1800",
   "reference_id": "OEF-007"
  }
 ],
 "records": [
  {
   "id": "OEF-008",
   "data": {
    "date": "2026-01-01",
    "address": "Voorbeeldstraat 10",
    "country": "Nederland",
    "confirmed": true,
    "vatNumber": "NL000000000B00",
    "postalCity": "1000 AA Voorbeeldstad",
    "vat_method": "invoice",
    "vat_period": "quarter",
    "vat_status": "standard",
    "businessName": "FitMetZorge Oefenbedrijf",
    "chamberNumber": "00000000",
    "kvk_registered": true,
    "vat_basis_points": 2100
   },
   "date": "2026-01-01",
   "kind": "settings",
   "number": null,
   "org_id": "OEF-001",
   "status": "confirmed",
   "version": 1,
   "parent_id": null,
   "created_at": "2026-10-15T12:00:00+00:00",
   "created_by": "OEF-009",
   "source_key": null
  },
  {
   "id": "OEF-010",
   "data": {
    "date": "2026-01-01",
    "cents": 0,
    "account_id": "OEF-003"
   },
   "date": "2026-01-01",
   "kind": "opening",
   "number": null,
   "org_id": "OEF-001",
   "status": "posted",
   "version": 1,
   "parent_id": "OEF-003",
   "created_at": "2026-10-15T12:00:00+00:00",
   "created_by": "OEF-009",
   "source_key": null
  },
  {
   "id": "OEF-011",
   "data": {
    "date": "2026-01-01",
    "cents": 0,
    "account_id": "OEF-005"
   },
   "date": "2026-01-01",
   "kind": "opening",
   "number": null,
   "org_id": "OEF-001",
   "status": "posted",
   "version": 1,
   "parent_id": "OEF-005",
   "created_at": "2026-10-15T12:00:00+00:00",
   "created_by": "OEF-009",
   "source_key": null
  },
  {
   "id": "OEF-007",
   "data": {
    "date": "2026-09-01",
    "customer": {
     "name": "Noor Voorbeeld",
     "address": "Oefenlaan 2",
     "country": "Nederland",
     "postalCity": "1000 BB Voorbeeldstad"
    },
    "document": {
     "date": "2026-09-01",
     "logo": null,
     "lines": null,
     "period": null,
     "dueDate": "2026-09-15",
     "version": 2,
     "creditOf": null,
     "customer": {
      "name": "Noor Voorbeeld",
      "address": "Oefenlaan 2",
      "country": "Nederland",
      "postalCity": "1000 BB Voorbeeldstad"
     },
     "netCents": 28926,
     "quantity": 1,
     "settings": {
      "date": "2026-01-01",
      "address": "Voorbeeldstraat 10",
      "country": "Nederland",
      "confirmed": true,
      "vatNumber": "NL000000000B00",
      "postalCity": "1000 AA Voorbeeldstad",
      "vat_method": "invoice",
      "vat_period": "quarter",
      "vat_status": "standard",
      "businessName": "FitMetZorge Oefenbedrijf",
      "chamberNumber": "00000000",
      "kvk_registered": true,
      "vat_basis_points": 2100,
      "note": "OEFENFACTUUR — NIET GELDIG. Niets betalen."
     },
     "vatCents": 6074,
     "invoiceNo": "OEFEN-2026-001",
     "paidCents": 0,
     "priceMode": "inclusive",
     "reference": null,
     "vatMethod": "invoice",
     "vatStatus": "standard",
     "grossCents": 38000,
     "settingsId": "OEF-008",
     "totalCents": 35000,
     "description": "Progressie — 8 trainingen",
     "serviceDate": "2026-09-01",
     "discountMode": null,
     "discountNote": "Synthetische korting",
     "packageLabel": "",
     "discountCents": 3000,
     "layoutVersion": 3,
     "serviceExtent": "8 trainingen in september",
     "subtotalCents": null,
     "vatBasisPoints": 2100,
     "paymentTermDays": 14,
     "outstandingCents": 35000,
     "discountInputCents": null,
     "discountBasisPoints": null
    },
    "quantity": 1,
    "term_days": 14,
    "description": "Progressie — 8 trainingen",
    "gross_cents": 38000,
    "discountNote": "Synthetische korting",
    "service_date": "2026-09-01",
    "discount_cents": 3000,
    "service_extent": "8 trainingen in september"
   },
   "date": "2026-09-01",
   "kind": "invoice",
   "number": "OEFEN-2026-001",
   "org_id": "OEF-001",
   "status": "posted",
   "version": 2,
   "parent_id": null,
   "created_at": "2026-10-15T12:00:00+00:00",
   "created_by": "OEF-009",
   "source_key": null
  },
  {
   "id": "OEF-012",
   "data": {
    "note": "Historische bron; nog niet als grootboek geboekt",
    "finance": {
     "secret": "PRIVATE FINANCE"
    }
   },
   "date": "2026-10-15",
   "kind": "legacy",
   "number": null,
   "org_id": "OEF-001",
   "status": "unreviewed",
   "version": 1,
   "parent_id": null,
   "created_at": "2026-10-15T12:00:00+00:00",
   "created_by": "OEF-009",
   "source_key": null
  },
  {
   "id": "OEF-013",
   "data": {
    "confirmed": false,
    "vat_method": "unknown",
    "vat_period": "unknown",
    "vat_status": "unknown"
   },
   "date": "2026-10-15",
   "kind": "settings",
   "number": null,
   "org_id": "OEF-001",
   "status": "unconfirmed",
   "version": 1,
   "parent_id": null,
   "created_at": "2026-10-15T12:00:00+00:00",
   "created_by": "OEF-009",
   "source_key": null
  },
  {
   "id": "OEF-003",
   "data": {
    "code": "11000",
    "iban": "OEFENREKENING",
    "name": "Zakelijke oefenbank",
    "type": "bank",
    "opening_date": "2026-01-01",
    "opening_cents": 0
   },
   "date": "2026-10-15",
   "kind": "account",
   "number": null,
   "org_id": "OEF-001",
   "status": "posted",
   "version": 2,
   "parent_id": null,
   "created_at": "2026-10-15T12:00:00+00:00",
   "created_by": "OEF-009",
   "source_key": null
  },
  {
   "id": "OEF-005",
   "data": {
    "code": "11001",
    "name": "Oefenkas",
    "type": "cash",
    "opening_date": "2026-01-01",
    "opening_cents": 0
   },
   "date": "2026-10-15",
   "kind": "account",
   "number": null,
   "org_id": "OEF-001",
   "status": "posted",
   "version": 2,
   "parent_id": null,
   "created_at": "2026-10-15T12:00:00+00:00",
   "created_by": "OEF-009",
   "source_key": null
  }
 ],
 "accounts": [
  {
   "code": "1000",
   "name": "Zakelijke bank",
   "org_id": "OEF-001",
   "category": "asset"
  },
  {
   "code": "1010",
   "name": "Kas",
   "org_id": "OEF-001",
   "category": "asset"
  },
  {
   "code": "1100",
   "name": "Debiteuren",
   "org_id": "OEF-001",
   "category": "asset"
  },
  {
   "code": "11000",
   "name": "Zakelijke oefenbank",
   "org_id": "OEF-001",
   "category": "asset"
  },
  {
   "code": "11001",
   "name": "Oefenkas",
   "org_id": "OEF-001",
   "category": "asset"
  },
  {
   "code": "1200",
   "name": "Voorbelasting",
   "org_id": "OEF-001",
   "category": "asset"
  },
  {
   "code": "1300",
   "name": "Bedrijfsmiddelen",
   "org_id": "OEF-001",
   "category": "asset"
  },
  {
   "code": "1390",
   "name": "Cumulatieve afschrijving",
   "org_id": "OEF-001",
   "category": "asset"
  },
  {
   "code": "1400",
   "name": "Ongekoppelde bankmutaties",
   "org_id": "OEF-001",
   "category": "asset"
  },
  {
   "code": "1600",
   "name": "Crediteuren",
   "org_id": "OEF-001",
   "category": "liability"
  },
  {
   "code": "1700",
   "name": "Leningen en schulden",
   "org_id": "OEF-001",
   "category": "liability"
  },
  {
   "code": "1800",
   "name": "Btw verkopen / verlegd",
   "org_id": "OEF-001",
   "category": "liability"
  },
  {
   "code": "1900",
   "name": "Vooruitbetaald door privé",
   "org_id": "OEF-001",
   "category": "liability"
  },
  {
   "code": "2000",
   "name": "Beginvermogen / correctie eigen vermogen",
   "org_id": "OEF-001",
   "category": "equity"
  },
  {
   "code": "2010",
   "name": "Privéstortingen",
   "org_id": "OEF-001",
   "category": "equity"
  },
  {
   "code": "2020",
   "name": "Privéopnames / privédeel",
   "org_id": "OEF-001",
   "category": "equity"
  },
  {
   "code": "4000",
   "name": "Omzet dienstverlening",
   "org_id": "OEF-001",
   "category": "income"
  },
  {
   "code": "5000",
   "name": "Overige zakelijke kosten",
   "org_id": "OEF-001",
   "category": "expense"
  },
  {
   "code": "5010",
   "name": "Bankkosten",
   "org_id": "OEF-001",
   "category": "expense"
  },
  {
   "code": "5020",
   "name": "Reiskosten",
   "org_id": "OEF-001",
   "category": "expense"
  },
  {
   "code": "5030",
   "name": "Huisvesting",
   "org_id": "OEF-001",
   "category": "expense"
  },
  {
   "code": "5040",
   "name": "Materiaal en apparatuur",
   "org_id": "OEF-001",
   "category": "expense"
  },
  {
   "code": "5800",
   "name": "Afschrijvingskosten",
   "org_id": "OEF-001",
   "category": "expense"
  }
 ],
 "journals": [
  {
   "id": "OEF-002",
   "date": "2026-01-01",
   "org_id": "OEF-001",
   "record_id": "OEF-010",
   "created_at": "2026-10-15T12:00:00+00:00",
   "description": "Beginstand Zakelijke oefenbank"
  },
  {
   "id": "OEF-004",
   "date": "2026-01-01",
   "org_id": "OEF-001",
   "record_id": "OEF-011",
   "created_at": "2026-10-15T12:00:00+00:00",
   "description": "Beginstand Oefenkas"
  },
  {
   "id": "OEF-006",
   "date": "2026-09-01",
   "org_id": "OEF-001",
   "record_id": "OEF-007",
   "created_at": "2026-10-15T12:00:00+00:00",
   "description": "FMZ-2026-0001"
  }
 ],
 "agreements": [],
 "organization": {
  "name": "Afgeschermde oefenadministratie"
 }
};if(typeof module!=='undefined')module.exports=s;else r.FMZPaymentExample=s;})(typeof window==='undefined'?globalThis:window);

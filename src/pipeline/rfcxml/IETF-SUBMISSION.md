# Submitting a Spec-Up-T RFCXML Internet-Draft

Spec-Up-T writes RFCXML v3 (`{output_path}/{docName}.xml`). That XML is the file the IETF toolchain consumes. Spec-Up-T HTML remains the glossary site; do not treat it as an I-D.

## 1. Export

From the spec repository:

```bash
npm run torfcxml
```

Requires an `ietf` block on the spec entry in `specs.json` (`docName`, `category`, `ipr`, `authors`). HTML-only specs omit the block.

Optional validation / official IETF renderings (TXT, HTML, PDF):

```bash
RFCXML_VALIDATE=1 npm run torfcxml
npm run torfc
```

`torfc` uses local `xml2rfc` when it is on `PATH`. Otherwise it calls the [IETF Author Tools API](https://author-tools.ietf.org/doc/). Set `IETF_API_KEY` from your Datatracker account if the service requires it. Set `RFCXML_ALLOW_REMOTE=0` to disable the network fallback.

## 2. Check the draft

- Install [xml2rfc](https://github.com/ietf-tools/xml2rfc) and run `xml2rfc --html draft-….xml`
- Or upload the XML at [https://author-tools.ietf.org/](https://author-tools.ietf.org/)
- Run [idnits](https://author-tools.ietf.org/idnits) on the generated text

IETF I-Ds need an abstract, Security Considerations, IANA Considerations, and a references section. Spec-Up-T inserts stubs when those headings are missing.

## 3. Post to Datatracker

1. Bump `ietf.docName` when you publish a new version (`draft-ssmith-keri-00` → `draft-ssmith-keri-01`).
2. Sign in at [https://datatracker.ietf.org/submit/](https://datatracker.ietf.org/submit/).
3. Upload the XML (preferred) or the generated `.txt`.
4. Confirm `ipr="trust200902"` (BCP 78). Spec-Up-T specs that still use the OWF CLA are **not** in the IETF stream until that IPR change is an explicit project decision.

## 4. One markdown source

Keep authoring in Spec-Up-T markdown (`spec/` + `terms-definitions/`). Do not maintain a parallel kramdown-rfc file such as `draft-ssmith-keri.md`; regenerate RFCXML instead.

## 5. What will not round-trip

Mermaid, KaTeX, charts, and live `[[xref:]]` glossary tooltips have no IETF equivalent. The exporter warns and omits or cites them. RFCXML is not imported back into Spec-Up-T markdown.

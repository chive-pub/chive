# Vendored Leaflet lexicons

Leaflet's published schemas, copied here so `leaflet-backlinks.ts` is written
against what Leaflet actually publishes rather than against a guess.

Fetched from Leaflet's own lexicon repository, which is the authority:

```
did:plc:btxrwcaeyodrap5mnjw2fvmz
com.atproto.lexicon.schema
```

They are also browsable at
<https://lexicon.garden/lexicon/did:plc:btxrwcaeyodrap5mnjw2fvmz>.

The `$type: com.atproto.lexicon.schema` wrapper is stripped; the rest is
verbatim, including `revision`.

## Why these seven

Only the ones on the path from a Leaflet record to a Chive eprint:

- `comment` — `subject` is an at-uri, the most direct reference there is.
- `document` — `pages` is a union of page types.
- `pages/linearDocument` — `blocks[].block` is a union of block types.
- `blocks/website` — `src` is a URL, where a link to chive.pub appears.
- `blocks/text` — carries richtext `facets`.
- `richtext/facet` — `#link.uri` is where an inline link lives.
- `blocks/standardSitePost` — `uri` is an at-uri to a `site.standard`
  document. Chive emits those for eprints, so a Leaflet document embedding one
  is referring to an eprint at one remove.

Not vendored: the remaining thirty-odd block, page and graph lexicons, which
carry no path to an eprint. Add one here when a reader needs it.

## Chive does not serve these

Chive publishes `pub.chive.*` and nothing else. These are read-only reference
copies for a plugin that parses records from other people's repositories, and
they are deliberately outside `lexicons/pub/chive/`.

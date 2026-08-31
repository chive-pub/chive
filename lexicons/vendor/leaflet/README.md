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

## Why `lexicons/vendor/`, and not `lexicons/pub/leaflet/`

Chive publishes `pub.chive.*` and nothing else. These are read-only reference
copies, used by a plugin that parses records out of other people's
repositories.

They sit under `vendor/` because `scripts/generate-lexicons.sh` runs codegen
over everything in `lexicons/`, and generating a client for another app's
schemas is both pointless and broken here: only the seven on the eprint path
are copied, and the generated types would import the thirty-odd that are not.
The script excludes `*/vendor/*` for that reason, alongside the exclusions it
already had for `auth/` and `permission-sets/`.

`lexicons/site/standard/` is vendored _inside_ the codegen path by contrast,
because Chive writes those records and wants the generated types. The rule is
whether Chive emits the schema, not who owns it.

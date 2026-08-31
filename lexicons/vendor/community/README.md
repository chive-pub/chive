# Vendored lexicon.community schemas

Copied from the community lexicon repository, which is the authority:

<https://tangled.org/lexicon.community/lexicons> (`did:plc:g5niz7yav7io2erxaoyef5dn`)

## What is here, and why

- `calendar/event.json` — `community.lexicon.calendar.event`. A talk or
  presentation about an eprint is an event, and the event record links out
  through `uris[]`. That is how "presented at…" becomes something Chive can
  show without anyone typing it in twice.

Only the schemas a Chive reader actually parses are copied. Add one when a
reader needs it.

## Chive does not serve these

Same rule as `lexicons/vendor/leaflet/`: read-only reference copies, kept out
of the code generator by the `*/vendor/*` exclusion in
`scripts/generate-lexicons.sh`. Chive publishes `pub.chive.*` and nothing else.

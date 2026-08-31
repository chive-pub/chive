---
sidebar_position: 6
---

# Resolving external identifiers

Chive answers one question for the rest of the ATProto scholarly ecosystem:
**given a DOI, arXiv ID or ORCID, what is the AT-URI?**

This is `pub.chive.resolve.byExternalId`. It is unauthenticated, cacheable, and
intended for other applications to call. Semble, Margin and Lea all hold
references to works by external identifier; this is how those become AT-URIs
that address a record on the network.

## Endpoint

```text
GET https://api.chive.pub/xrpc/pub.chive.resolve.byExternalId
```

| Parameter    | Required | Description                                                |
| ------------ | -------- | ---------------------------------------------------------- |
| `system`     | yes      | `doi`, `arxiv`, `orcid`, `ror`, `isbn`, `pmid`, `wikidata` |
| `identifier` | yes      | The identifier itself, with no resolver prefix             |

Pass `10.1000/abc`, not `https://doi.org/10.1000/abc`.

## Response

```json
{
  "found": true,
  "entityType": "eprint",
  "uri": "at://did:plc:author/pub.chive.eprint.submission/3k5abc",
  "cid": "bafyrei..."
}
```

`entityType` is `eprint`, `author` or `graphNode`. A knowledge-graph node is
returned when the identifier names a concept, institution or venue rather than
a work — a ROR ID resolves to the institution node, for instance.

When nothing matches:

```json
{ "found": false }
```

**`found: false` means Chive does not index that identifier, not that the work
does not exist.** Chive indexes eprints submitted to it and the authority
records its community has approved. A DOI absent here may be present anywhere
else.

## Examples

```bash
# A DOI
curl -s 'https://api.chive.pub/xrpc/pub.chive.resolve.byExternalId?system=doi&identifier=10.1000/abc'

# An ORCID, resolving to an author
curl -s 'https://api.chive.pub/xrpc/pub.chive.resolve.byExternalId?system=orcid&identifier=0000-0002-1825-0097'
```

Once you hold the AT-URI, read the record from the author's PDS with
`com.atproto.repo.getRecord`, or from Chive's index with
`pub.chive.eprint.getSubmission`. Reading it from the PDS is the more durable
choice: that repository is where the record lives, and Chive is one index of it
among however many come later.

## Notes for callers

- **No authentication.** Anonymous rate limits apply; see
  [Authentication](./authentication.md).
- **Cache the answer.** An identifier's AT-URI changes only if the record is
  deleted and resubmitted, which is rare.
- **One identifier per call.** There is no batch form. If you need one, it is
  worth asking for rather than looping — say so in an issue.

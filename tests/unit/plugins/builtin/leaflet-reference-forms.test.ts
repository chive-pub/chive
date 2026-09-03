/**
 * Every way a Leaflet record can name an eprint must resolve to its AT-URI.
 *
 * @remarks
 * A reference arrives written the way a person writes it. Someone composing an
 * essay pastes `https://chive.pub/eprints/...`; only a machine writes the
 * AT-URI. Recorded as pasted, a backlink is stored under a string no eprint can
 * be looked up by, so it points at nothing and renders nowhere — which is
 * exactly what a website block and a pasted inline link used to produce, with
 * no error to show for it.
 *
 * @packageDocumentation
 */

import { describe, expect, it } from 'vitest';

import { LeafletBacklinksPlugin } from '@/plugins/builtin/leaflet-backlinks.js';

const EPRINT = 'at://did:plc:34mbm5v3umztwvvgnttvcz6e/pub.chive.eprint.submission/3mufmczuces2j';
const WEB = `https://chive.pub/eprints/${encodeURIComponent(EPRINT)}`;

function textBlockWithLink(uri: string): unknown {
  return {
    pages: [
      {
        blocks: [
          {
            block: {
              $type: 'pub.leaflet.blocks.text',
              plaintext: 'see this',
              facets: [
                {
                  index: { byteStart: 0, byteEnd: 3 },
                  features: [{ $type: 'pub.leaflet.richtext.facet#link', uri }],
                },
              ],
            },
          },
        ],
      },
    ],
  };
}

describe('LeafletBacklinksPlugin reference forms', () => {
  const plugin = new LeafletBacklinksPlugin();

  it('resolves an inline link written as an AT-URI', () => {
    expect(plugin.extractEprintRefs(textBlockWithLink(EPRINT))).toEqual([EPRINT]);
  });

  it('resolves an inline link pasted as a chive.pub address', () => {
    // The ordinary case: a person writing an essay pastes the page they were
    // reading, not the record identifier behind it.
    expect(plugin.extractEprintRefs(textBlockWithLink(WEB))).toEqual([EPRINT]);
  });

  it('resolves a website block pasted as a chive.pub address', () => {
    const record = {
      pages: [{ blocks: [{ block: { $type: 'pub.leaflet.blocks.website', src: WEB } }] }],
    };

    expect(plugin.extractEprintRefs(record)).toEqual([EPRINT]);
  });

  it('resolves the subject of a comment', () => {
    expect(plugin.extractEprintRefs({ subject: EPRINT })).toEqual([EPRINT]);
  });

  it('records one reference when a document names the same eprint both ways', () => {
    const record = {
      pages: [
        {
          blocks: [
            { block: { $type: 'pub.leaflet.blocks.website', src: WEB } },
            { block: { $type: 'pub.leaflet.blocks.website', src: EPRINT } },
          ],
        },
      ],
    };

    expect(plugin.extractEprintRefs(record)).toEqual([EPRINT]);
  });

  it('ignores a link to something that is not an eprint', () => {
    const record = {
      pages: [
        {
          blocks: [
            { block: { $type: 'pub.leaflet.blocks.website', src: 'https://example.org/paper' } },
          ],
        },
      ],
    };

    expect(plugin.extractEprintRefs(record)).toEqual([]);
  });

  it('ignores a chive.pub address that names no eprint', () => {
    const record = {
      pages: [
        {
          blocks: [
            { block: { $type: 'pub.leaflet.blocks.website', src: 'https://chive.pub/about' } },
          ],
        },
      ],
    };

    expect(plugin.extractEprintRefs(record)).toEqual([]);
  });
});

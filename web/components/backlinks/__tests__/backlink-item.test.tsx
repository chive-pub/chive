/**
 * Tests for one atmosphere reference.
 *
 * @remarks
 * Two behaviours here were previously wrong on production, so they are the
 * ones pinned hardest: a Leaflet comment must not be presented as a Leaflet
 * document merely because the indexing plugin files both under the same source
 * type, and a Cosmik card must not be linked to a Cosmik collection address
 * that does not resolve.
 *
 * @packageDocumentation
 */

import { render, screen, within } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { BacklinkItem, humanizeLabel } from '../backlink-item';
import type { Backlink } from '@/lib/hooks/use-backlinks';

const DID = 'did:plc:34mbm5v3umztwvvgnttvcz6e';
const TARGET = 'at://did:plc:owner/pub.chive.eprint.submission/paper';

function backlink(overrides: Partial<Backlink> & Pick<Backlink, 'sourceUri' | 'sourceType'>) {
  return {
    id: 1,
    targetUri: TARGET,
    indexedAt: '2026-09-04T12:00:00Z',
    deleted: false,
    ...overrides,
  } as Backlink;
}

describe('BacklinkItem', () => {
  it('leads with what the source record called itself', () => {
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/pub.leaflet.document/3abc`,
          sourceType: 'leaflet.document',
          context: 'Probe essay',
        })}
      />
    );
    expect(screen.getByText('Probe essay')).toBeInTheDocument();
    // Leaflet's own mark stands in for its name.
    expect(screen.queryByText('Leaflet')).toBeNull();
    expect(screen.getByText('Document')).toBeInTheDocument();
  });

  it('tells a Leaflet comment from a Leaflet document, which the source type does not', () => {
    // The plugin assigns `leaflet.document` to both. Only the collection in the
    // URI distinguishes them, and a comment has no leaflet.pub address.
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/pub.leaflet.comment/3abc`,
          sourceType: 'leaflet.document',
          context: 'Probe comment',
        })}
      />
    );
    expect(screen.getByText('Comment')).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: /open in leaflet/i })).toBeNull();
  });

  it('offers no Cosmik address for a Cosmik card', () => {
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/network.cosmik.card/3abc`,
          sourceType: 'cosmik.collection',
        })}
      />
    );
    const links = screen.getAllByRole('link');
    expect(links).toHaveLength(1);
    expect(links[0]).toHaveAttribute(
      'href',
      `https://pdsls.dev/at://${DID}/network.cosmik.card/3abc`
    );
  });

  it('offers the Smoke Signal page for a calendar event, alongside the record', () => {
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/community.lexicon.calendar.event/3xyz`,
          sourceType: 'calendar.event',
          context: 'Probe talk',
        })}
      />
    );
    expect(screen.getByRole('link', { name: /open in smoke signal/i })).toHaveAttribute(
      'href',
      `https://smokesignal.events/${DID}/3xyz`
    );
    expect(screen.getByRole('link', { name: /view record/i })).toBeInTheDocument();
  });

  it('names itself when the source record carried no context', () => {
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/at.margin.note/3abc`,
          sourceType: 'margin.annotation',
        })}
      />
    );
    expect(screen.getByText('Margin note')).toBeInTheDocument();
  });

  it('draws a typed field as a chip, not as the first words of the title', () => {
    // A Margin motivation and a Cosmik relation used to be joined onto the
    // front of the text, so a card read "commenting: The gradable adjective
    // case is…" -- a machine value presented as the opening of a sentence.
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/at.margin.note/3abc`,
          sourceType: 'margin.annotation',
          context: 'The gradable adjective case is the one to read first.',
          contextLabel: 'commenting',
        })}
      />
    );
    const card = screen.getByTestId('backlink-item');
    expect(
      within(card).getByText('The gradable adjective case is the one to read first.')
    ).toBeInTheDocument();
    expect(within(card).getByText('commenting')).toBeInTheDocument();
    // The title must not carry the label.
    expect(within(card).queryByText(/^commenting:/)).toBeNull();
  });

  it('shows no chip when the source record has no typed field', () => {
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/pub.leaflet.document/3abc`,
          sourceType: 'leaflet.document',
          context: 'Probe essay',
        })}
      />
    );
    const card = screen.getByTestId('backlink-item');
    expect(within(card).getByText('Probe essay')).toBeInTheDocument();
    expect(within(card).queryByText('commenting')).toBeNull();
  });

  it('does not print the record URI, which the record link already carries', () => {
    // A line of at:// on every card is noise beside a "View record" link that
    // goes to the same place.
    const uri = `at://${DID}/site.standard.document/3abc`;
    render(
      <BacklinkItem backlink={backlink({ sourceUri: uri, sourceType: 'standard.document' })} />
    );
    expect(screen.queryByText(uri)).toBeNull();
    expect(screen.getByRole('link', { name: /view record/i })).toHaveAttribute(
      'href',
      `https://pdsls.dev/${uri}`
    );
  });

  it("drops the service name when the card carries that service's own mark", () => {
    // The mark says "Semble" faster than the word does, so both is repetition.
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/network.cosmik.card/3abc`,
          sourceType: 'cosmik.collection',
          context: 'Probabilistic dynamic semantics',
        })}
      />
    );
    const card = screen.getByTestId('backlink-item');
    expect(within(card).queryByText('Semble')).toBeNull();
    expect(card.querySelector('svg')).toBeInTheDocument();
  });

  it('keeps the service name where no mark exists', () => {
    // Smoke Signal publishes no vector, so its cards keep a generic glyph --
    // which identifies nothing on its own -- and must still be labelled.
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/community.lexicon.calendar.event/3abc`,
          sourceType: 'calendar.event',
          context: 'Probe talk',
        })}
      />
    );
    expect(
      within(screen.getByTestId('backlink-item')).getByText('Smoke Signal')
    ).toBeInTheDocument();
  });

  it('names the paper at the other end of a connection, and links to it', () => {
    // A connection is an edge. A card carrying only its note said what its
    // author thought about a relationship without naming the other half of it.
    const other = 'at://did:plc:owner/pub.chive.eprint.submission/3other';
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/network.cosmik.connection/3abc`,
          sourceType: 'cosmik.connection',
          context: 'PDS generalises the projection machinery.',
          relatedUri: other,
          relatedTitle: 'Projecting factivity',
        })}
      />
    );
    expect(screen.getByRole('link', { name: /projecting factivity/i })).toHaveAttribute(
      'href',
      `/eprints/${encodeURIComponent(other)}`
    );
  });

  it('shows an end Chive does not hold by its address', () => {
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/network.cosmik.connection/3abc`,
          sourceType: 'cosmik.connection',
          relatedUri: 'https://doi.org/10.1007/3-540-61780-9_66',
        })}
      />
    );
    expect(screen.getByRole('link', { name: 'doi.org/10.1007/3-540-61780-9_66' })).toHaveAttribute(
      'href',
      'https://doi.org/10.1007/3-540-61780-9_66'
    );
  });

  it('adds nothing where the record joined this paper to nothing', () => {
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/pub.leaflet.document/3abc`,
          sourceType: 'leaflet.document',
          context: 'Probe essay',
        })}
      />
    );
    const card = screen.getByTestId('backlink-item');
    // Only "View record" and "Open in Leaflet".
    expect(within(card).getAllByRole('link')).toHaveLength(2);
  });

  it('says whose record it is, by handle rather than by DID', () => {
    // These live in their authors' own repositories. A card that never says
    // whose reads as though Chive had written it.
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/pub.leaflet.document/3abc`,
          sourceType: 'leaflet.document',
          context: 'Probe essay',
          sourceHandle: 'someone.example',
          sourceDisplayName: 'Someone',
          sourceAvatar: 'https://cdn.example/avatar.jpg',
        })}
      />
    );
    const card = screen.getByTestId('backlink-item');
    expect(within(card).getByText('@someone.example')).toBeInTheDocument();
    expect(within(card).getByText('Someone')).toBeInTheDocument();
    expect(card.querySelector('img')).toHaveAttribute('src', 'https://cdn.example/avatar.jpg');
    expect(within(card).queryByText(new RegExp(DID))).toBeNull();
  });

  it('says nothing about the author when the handle did not resolve', () => {
    // Rather than falling back to the DID, which identifies the account
    // without naming it.
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/pub.leaflet.document/3abc`,
          sourceType: 'leaflet.document',
          context: 'Probe essay',
        })}
      />
    );
    expect(screen.getByTestId('backlink-item').querySelector('img')).toBeNull();
  });

  it('offers the Margin page once the handle is known, and not before', () => {
    const margin = (handle?: string) => (
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/at.margin.note/3abc`,
          sourceType: 'margin.annotation',
          context: 'Probe note',
          ...(handle ? { sourceHandle: handle } : {}),
        })}
      />
    );
    const { unmount } = render(margin(undefined));
    expect(screen.queryByRole('link', { name: /open in margin/i })).toBeNull();
    unmount();

    render(margin('someone.example'));
    expect(screen.getByRole('link', { name: /open in margin/i })).toHaveAttribute(
      'href',
      'https://margin.at/someone.example/annotation/3abc'
    );
  });

  it('links a Semble card to the collection it is drawn in', () => {
    // Semble serves no address for a card -- it renders cards only inside a
    // collection -- so the collection is the one page such a card has.
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/network.cosmik.card/3abc`,
          sourceType: 'cosmik.collection',
          context: 'Probabilistic dynamic semantics',
          containerUri: `at://${DID}/network.cosmik.collection/3coll`,
          containerName: 'On attention',
        })}
      />
    );
    expect(screen.getByRole('link', { name: /on attention/i })).toHaveAttribute(
      'href',
      `https://semble.so/profile/${DID}/collections/3coll`
    );
  });

  it('still links the collection when its name was never indexed', () => {
    // The address comes from the URI; only the name needs the index.
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/network.cosmik.card/3abc`,
          sourceType: 'cosmik.collection',
          containerUri: `at://${DID}/network.cosmik.collection/3coll`,
        })}
      />
    );
    expect(screen.getByRole('link', { name: /semble collection/i })).toHaveAttribute(
      'href',
      `https://semble.so/profile/${DID}/collections/3coll`
    );
  });

  it('offers no container link for a service with no page for one', () => {
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/at.margin.note/3abc`,
          sourceType: 'margin.annotation',
          context: 'Probe note',
          containerUri: `at://${DID}/at.margin.collection/3coll`,
          containerName: 'Reading list',
        })}
      />
    );
    expect(screen.queryByRole('link', { name: /reading list/i })).toBeNull();
  });

  it('says when the reference appeared', () => {
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/pub.leaflet.document/3abc`,
          sourceType: 'leaflet.document',
          indexedAt: new Date(Date.now() - 60 * 60 * 1000).toISOString(),
        })}
      />
    );
    expect(screen.getByText(/about 1 hour ago/i)).toBeInTheDocument();
  });

  it('draws a chip in prose casing whatever case the lexicon wrote it in', () => {
    // Cosmik writes RELATED, Margin writes commenting, a Chive relation slug is
    // builds-on. Rendered as written, three chips in one list are in three
    // different cases.
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/network.cosmik.connection/3abc`,
          sourceType: 'cosmik.connection',
          context: 'A note.',
          contextLabel: 'RELATED',
        })}
      />
    );
    expect(within(screen.getByTestId('backlink-item')).getByText('related')).toBeInTheDocument();
  });

  it('renders a record from an application it has never heard of', () => {
    const item = screen.queryByTestId('backlink-item');
    expect(item).toBeNull();
    render(
      <BacklinkItem
        backlink={backlink({
          sourceUri: `at://${DID}/com.example.newthing/3abc`,
          sourceType: 'other',
        })}
      />
    );
    const card = screen.getByTestId('backlink-item');
    expect(within(card).getByText('com.example.newthing')).toBeInTheDocument();
    expect(within(card).getByRole('link', { name: /view record/i })).toBeInTheDocument();
  });
});

describe('humanizeLabel', () => {
  it('folds an all-capitals token', () => {
    expect(humanizeLabel('RELATED')).toBe('related');
  });

  it('leaves a token that is already lowercase', () => {
    expect(humanizeLabel('commenting')).toBe('commenting');
  });

  it('unhyphenates a slug', () => {
    expect(humanizeLabel('builds-on')).toBe('builds on');
    expect(humanizeLabel('SUPPORTED_BY')).toBe('supported by');
  });

  it('leaves a value that capitalises part-way alone', () => {
    // Folding this would give "nlp evaluation", which is not what it says.
    expect(humanizeLabel('NLP evaluation')).toBe('NLP evaluation');
  });
});

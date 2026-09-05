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

import { BacklinkItem } from '../backlink-item';
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
    expect(screen.getByText('Leaflet')).toBeInTheDocument();
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

  it('shows the record URI, so a reader can find it without a web address', () => {
    const uri = `at://${DID}/site.standard.document/3abc`;
    render(
      <BacklinkItem backlink={backlink({ sourceUri: uri, sourceType: 'standard.document' })} />
    );
    expect(screen.getByText(uri)).toBeInTheDocument();
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

/**
 * Renders {@link EntityHeadTag} descriptors into the document head.
 *
 * @remarks
 * Next.js's `Metadata` API covers OpenGraph, Twitter card, and canonical
 * alternates but lacks first-class support for Highwire `citation_*`
 * meta tags, Schema.org JSON-LD, and AT-URI `<link rel="alternate">`. We
 * emit those via a small React component that lives in the page's tree
 * and writes into `<head>` via Next's head-hoisting.
 *
 * @packageDocumentation
 */

import type { EntityHeadTag } from './entity-metadata';

/**
 * Props for {@link EntityHeadTags}.
 *
 * @public
 */
export interface EntityHeadTagsProps {
  tags: EntityHeadTag[];
}

/**
 * Renders a list of {@link EntityHeadTag}s into the document head.
 *
 * @public
 */
export function EntityHeadTags({ tags }: EntityHeadTagsProps) {
  return (
    <>
      {tags.map((tag, i) => {
        if (tag.kind === 'link') {
          return (
            <link
              key={`link-${i}-${tag.href}`}
              rel={tag.rel}
              type={tag.type}
              href={tag.href}
              title={tag.title}
            />
          );
        }
        if (tag.kind === 'meta') {
          return <meta key={`meta-${i}-${tag.name}`} name={tag.name} content={tag.content} />;
        }
        // script (JSON-LD)
        return (
          <script
            key={`ldjson-${i}`}
            type={tag.type}
            // eslint-disable-next-line react/no-danger -- JSON-LD payload is built server-side from trusted sources
            dangerouslySetInnerHTML={{ __html: tag.content }}
          />
        );
      })}
    </>
  );
}

import { render, screen } from '@/tests/test-utils';
import { AnnotationBodyRenderer } from './annotation-body-renderer';
import type { RichAnnotationBody } from '@/lib/api/schema';

// Mock next/link
vi.mock('next/link', () => ({
  default: ({ children, href }: { children: React.ReactNode; href: string }) => (
    <a href={href}>{children}</a>
  ),
}));

describe('AnnotationBodyRenderer', () => {
  describe('empty states', () => {
    it('returns null when body is null', () => {
      const { container } = render(
        <AnnotationBodyRenderer body={null as unknown as RichAnnotationBody} />
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('returns null when body is undefined', () => {
      const { container } = render(
        <AnnotationBodyRenderer body={undefined as unknown as RichAnnotationBody} />
      );

      expect(container).toBeEmptyDOMElement();
    });

    it('returns null when items array is empty', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [],
        format: 'application/x-chive-gloss+json',
      };

      const { container } = render(<AnnotationBodyRenderer body={body} />);

      expect(container).toBeEmptyDOMElement();
    });
  });

  describe('text rendering', () => {
    it('renders plain text items', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'text', content: 'This is plain text content' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      expect(screen.getByTestId('annotation-body')).toBeInTheDocument();
      expect(screen.getByText('This is plain text content')).toBeInTheDocument();
    });

    it('renders multiple text items', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [
          { type: 'text', content: 'First part ' },
          { type: 'text', content: 'second part' },
        ],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      expect(screen.getByText('First part')).toBeInTheDocument();
      expect(screen.getByText('second part')).toBeInTheDocument();
    });
  });

  describe('Wikidata reference chips', () => {
    it('renders Wikidata reference with default URL', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'wikidataRef', qid: 'Q2539', label: 'Machine Learning' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      const link = screen.getByRole('link', { name: /machine learning/i });
      expect(link).toHaveAttribute('href', 'https://www.wikidata.org/wiki/Q2539');
      expect(link).toHaveAttribute('target', '_blank');
      expect(link).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('renders Wikidata reference with custom URL', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [
          {
            type: 'wikidataRef',
            qid: 'Q2539',
            label: 'ML',
            url: 'https://custom.url/ml',
          },
        ],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      const link = screen.getByRole('link', { name: /ml/i });
      expect(link).toHaveAttribute('href', 'https://custom.url/ml');
    });

    it('applies Wikidata chip styling', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'wikidataRef', qid: 'Q2539', label: 'Machine Learning' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      // The label is inside a span, but the Badge classes are on the parent element
      const labelElement = screen.getByText('Machine Learning');
      const badge = labelElement.closest('[class*="bg-blue"]');
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-800');
    });
  });

  describe('node reference chips', () => {
    it('renders node reference with link', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [
          {
            type: 'nodeRef',
            uri: 'at://did:plc:governance/pub.chive.graph.node/auth123',
            label: 'Library of Congress',
          },
        ],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      const link = screen.getByRole('link', { name: /library of congress/i });
      expect(link).toHaveAttribute('href', '/authorities/auth123');
    });

    it('applies node chip styling', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'nodeRef', uri: 'at://auth/123', label: 'Authority' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      const badge = screen.getByText('Authority');
      expect(badge).toHaveClass('bg-purple-100', 'text-purple-800');
    });
  });

  describe('field reference chips', () => {
    it('renders field reference with link', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [
          {
            type: 'fieldRef',
            uri: 'at://did:plc:governance/pub.chive.graph.field/neuroscience',
            label: 'Neuroscience',
          },
        ],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      const link = screen.getByRole('link', { name: /neuroscience/i });
      expect(link).toHaveAttribute('href', '/fields/neuroscience');
    });

    it('applies field chip styling', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'fieldRef', uri: 'at://field/123', label: 'Physics' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      const badge = screen.getByText('Physics');
      expect(badge).toHaveClass('bg-green-100', 'text-green-800');
    });
  });

  describe('facet reference chips', () => {
    it('renders facet reference with browse link', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'facetRef', dimension: 'methodology', value: 'experimental' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      const link = screen.getByRole('link', { name: /methodology: experimental/i });
      expect(link).toHaveAttribute('href', '/browse?methodology=experimental');
    });

    it('applies facet chip styling', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'facetRef', dimension: 'time', value: '2024' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      const badge = screen.getByText('time: 2024');
      expect(badge).toHaveClass('bg-orange-100', 'text-orange-800');
    });
  });

  describe('eprint reference chips', () => {
    it('renders eprint reference with link', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [
          {
            type: 'eprintRef',
            uri: 'at://did:plc:author/pub.chive.eprint.submission/abc123',
            title: 'Novel Findings in ML',
          },
        ],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      const link = screen.getByRole('link', { name: /novel findings in ml/i });
      expect(link).toHaveAttribute(
        'href',
        '/eprints/did%3Aplc%3Aauthor%2Fpub.chive.eprint.submission%2Fabc123'
      );
    });

    it('applies eprint chip styling', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'eprintRef', uri: 'at://eprint/123', title: 'Study Title' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      const badge = screen.getByText('Study Title');
      expect(badge).toHaveClass('bg-slate-100', 'text-slate-800');
    });

    it('truncates long eprint titles', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [
          {
            type: 'eprintRef',
            uri: 'at://eprint/123',
            title: 'A Very Long Eprint Title That Should Be Truncated',
          },
        ],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      const badge = screen.getByText('A Very Long Eprint Title That Should Be Truncated');
      expect(badge).toHaveClass('truncate', 'max-w-[200px]');
      expect(badge).toHaveAttribute('title', 'A Very Long Eprint Title That Should Be Truncated');
    });
  });

  describe('annotation reference chips', () => {
    it('renders annotation reference with excerpt', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [
          {
            type: 'annotationRef',
            uri: 'at://annotation/123',
            excerpt: 'Referenced text here',
          },
        ],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      expect(screen.getByText('^ Referenced text here')).toBeInTheDocument();
    });

    it('applies annotation chip styling', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'annotationRef', uri: 'at://ann/1', excerpt: 'Excerpt' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      const badge = screen.getByText('^ Excerpt');
      expect(badge).toHaveClass('truncate', 'max-w-[150px]', 'cursor-pointer');
    });

    it('shows full excerpt in title attribute', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [
          {
            type: 'annotationRef',
            uri: 'at://ann/1',
            excerpt: 'This is a long excerpt that may be truncated',
          },
        ],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      const badge = screen.getByText(/this is a long excerpt/i);
      expect(badge).toHaveAttribute('title', 'This is a long excerpt that may be truncated');
    });
  });

  describe('author reference chips', () => {
    it('renders author reference with link', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [
          {
            type: 'authorRef',
            did: 'did:plc:author123',
            displayName: 'Dr. Jane Smith',
          },
        ],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      const link = screen.getByRole('link', { name: /@dr\. jane smith/i });
      expect(link).toHaveAttribute('href', '/authors/did%3Aplc%3Aauthor123');
    });

    it('applies author chip styling', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'authorRef', did: 'did:plc:123', displayName: 'Author Name' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      const badge = screen.getByText('@Author Name');
      expect(badge).toHaveClass('bg-pink-100', 'text-pink-800');
    });

    it('prefixes author name with @', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'authorRef', did: 'did:plc:123', displayName: 'Researcher' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      expect(screen.getByText('@Researcher')).toBeInTheDocument();
    });
  });

  describe('mixed content', () => {
    it('renders mixed text and references inline', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [
          { type: 'text', content: 'This study on ' },
          { type: 'wikidataRef', qid: 'Q2539', label: 'Machine Learning' },
          { type: 'text', content: ' by ' },
          { type: 'authorRef', did: 'did:plc:author1', displayName: 'Dr. Smith' },
          { type: 'text', content: ' is groundbreaking.' },
        ],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      expect(screen.getByText('This study on')).toBeInTheDocument();
      expect(screen.getByText('Machine Learning')).toBeInTheDocument();
      expect(screen.getByText('by')).toBeInTheDocument();
      expect(screen.getByText('@Dr. Smith')).toBeInTheDocument();
      expect(screen.getByText('is groundbreaking.')).toBeInTheDocument();
    });

    it('renders multiple reference types', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [
          { type: 'wikidataRef', qid: 'Q1', label: 'Concept A' },
          { type: 'fieldRef', uri: 'at://field/1', label: 'Field B' },
          { type: 'nodeRef', uri: 'at://auth/1', label: 'Authority C' },
        ],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      expect(screen.getByText('Concept A')).toBeInTheDocument();
      expect(screen.getByText('Field B')).toBeInTheDocument();
      expect(screen.getByText('Authority C')).toBeInTheDocument();
    });
  });

  describe('unknown item types', () => {
    it('handles unknown item types gracefully', () => {
      // Testing component behavior with malformed API data
      const unknownItem = { type: 'unknownType', foo: 'bar' };

      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [
          { type: 'text', content: 'Known text ' },
          // @ts-expect-error Testing graceful handling of unknown item types from API
          unknownItem,
          { type: 'text', content: ' more text' },
        ],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} />);

      // Should render known items and skip unknown
      expect(screen.getByText('Known text')).toBeInTheDocument();
      expect(screen.getByText('more text')).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'text', content: 'Content' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} className="custom-class" />);

      expect(screen.getByTestId('annotation-body')).toHaveClass('custom-class');
    });

    it('preserves default styling with custom className', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'text', content: 'Content' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationBodyRenderer body={body} className="custom-class" />);

      const element = screen.getByTestId('annotation-body');
      expect(element).toHaveClass('leading-relaxed');
      expect(element).toHaveClass('custom-class');
    });
  });
});

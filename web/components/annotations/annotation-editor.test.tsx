import { render, screen, waitFor } from '@/tests/test-utils';
import { AnnotationEditor, AnnotationPreview } from './annotation-editor';
import type { RichAnnotationBody } from '@/lib/api/schema';

describe('AnnotationEditor', () => {
  const defaultProps = {
    value: null,
    onChange: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders annotation editor', () => {
      render(<AnnotationEditor {...defaultProps} />);

      expect(screen.getByTestId('annotation-editor')).toBeInTheDocument();
    });

    it('renders contenteditable with role textbox', () => {
      render(<AnnotationEditor {...defaultProps} />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('shows character count', () => {
      const { container } = render(<AnnotationEditor {...defaultProps} maxLength={1000} />);

      const charCount = container.querySelector('#annotation-editor-help');
      expect(charCount).toBeInTheDocument();
      expect(charCount?.textContent).toContain('0');
      expect(charCount?.textContent).toContain('1000');
    });

    it('shows trigger hints in footer', () => {
      render(<AnnotationEditor {...defaultProps} />);

      expect(screen.getByText('entities')).toBeInTheDocument();
      expect(screen.getByText('types')).toBeInTheDocument();
    });
  });

  describe('initial value', () => {
    it('displays initial text value', async () => {
      const value: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'text', content: 'Initial content' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationEditor {...defaultProps} value={value} />);

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor.textContent).toBe('Initial content');
      });
    });

    it('displays node references as chips', async () => {
      const value: RichAnnotationBody = {
        type: 'RichText',
        items: [
          { type: 'text', content: 'See ' },
          {
            type: 'nodeRef',
            uri: 'at://node/123',
            label: 'Test Entity',
            kind: 'object',
            subkind: 'institution',
          },
        ],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationEditor {...defaultProps} value={value} />);

      await waitFor(() => {
        const editor = screen.getByRole('textbox');
        expect(editor.textContent).toContain('See');
        expect(editor.textContent).toContain('Test Entity');
      });
    });
  });

  describe('disabled state', () => {
    it('sets contentEditable to false when disabled', () => {
      render(<AnnotationEditor {...defaultProps} disabled />);

      const editor = screen.getByRole('textbox');
      expect(editor).toHaveAttribute('contenteditable', 'false');
    });

    it('has disabled styling when disabled', () => {
      render(<AnnotationEditor {...defaultProps} disabled />);

      const editor = screen.getByRole('textbox');
      expect(editor).toHaveClass('cursor-not-allowed', 'opacity-50');
    });
  });

  describe('character limit', () => {
    it('shows warning style when over limit', () => {
      const longValue: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'text', content: '123456789' }],
        format: 'application/x-chive-gloss+json',
      };

      const { container } = render(
        <AnnotationEditor {...defaultProps} value={longValue} maxLength={5} />
      );

      const counter = container.querySelector('#annotation-editor-help');
      expect(counter).toHaveClass('text-destructive');
    });

    it('shows warning style on editor when over limit', () => {
      const longValue: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'text', content: '123456789' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationEditor {...defaultProps} value={longValue} maxLength={5} />);

      const editor = screen.getByRole('textbox');
      expect(editor).toHaveClass('border-destructive');
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<AnnotationEditor {...defaultProps} className="custom-class" />);

      expect(screen.getByTestId('annotation-editor')).toHaveClass('custom-class');
    });
  });

  describe('enabled triggers', () => {
    it('shows only enabled trigger hints', () => {
      render(<AnnotationEditor {...defaultProps} enabledTriggers={['@']} />);

      expect(screen.getByText('entities')).toBeInTheDocument();
      expect(screen.queryByText('types')).not.toBeInTheDocument();
    });
  });
});

describe('AnnotationPreview', () => {
  describe('empty state', () => {
    it('shows empty message for null body', () => {
      render(<AnnotationPreview body={null} />);

      expect(screen.getByText('No content')).toBeInTheDocument();
    });

    it('shows empty message for empty items', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationPreview body={body} />);

      expect(screen.getByText('No content')).toBeInTheDocument();
    });
  });

  describe('text rendering', () => {
    it('renders plain text', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'text', content: 'Plain text content' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationPreview body={body} />);

      expect(screen.getByText('Plain text content')).toBeInTheDocument();
    });
  });

  describe('reference rendering', () => {
    it('renders Wikidata reference as badge', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'wikidataRef', qid: 'Q123', label: 'Entity Name' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationPreview body={body} />);

      const badge = screen.getByText('Entity Name');
      expect(badge).toHaveClass('bg-blue-100', 'text-blue-800');
    });

    it('renders node reference as badge', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'nodeRef', uri: 'at://node/123', label: 'Node Name', subkind: 'topic' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationPreview body={body} />);

      const badge = screen.getByText('Node Name');
      expect(badge).toHaveClass('bg-purple-100', 'text-purple-800');
    });

    it('renders field reference as badge', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'fieldRef', uri: 'at://field/123', label: 'Field Name' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationPreview body={body} />);

      const badge = screen.getByText('Field Name');
      expect(badge).toHaveClass('bg-green-100', 'text-green-800');
    });
  });

  describe('mixed content', () => {
    it('renders text and references together', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [
          { type: 'text', content: 'This relates to ' },
          { type: 'wikidataRef', qid: 'Q123', label: 'Concept' },
          { type: 'text', content: ' in the field.' },
        ],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationPreview body={body} />);

      expect(screen.getByText('This relates to')).toBeInTheDocument();
      expect(screen.getByText('Concept')).toBeInTheDocument();
      expect(screen.getByText('in the field.')).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('applies custom className to content', () => {
      const body: RichAnnotationBody = {
        type: 'RichText',
        items: [{ type: 'text', content: 'Content' }],
        format: 'application/x-chive-gloss+json',
      };

      render(<AnnotationPreview body={body} className="custom-class" />);

      expect(screen.getByText('Content').closest('div')).toHaveClass('custom-class');
    });

    it('applies custom className to empty state', () => {
      render(<AnnotationPreview body={null} className="custom-class" />);

      expect(screen.getByText('No content')).toHaveClass('custom-class');
    });
  });
});

import { render, screen } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { Textarea } from './textarea';

describe('Textarea', () => {
  describe('rendering', () => {
    it('renders textarea', () => {
      render(<Textarea />);

      expect(screen.getByRole('textbox')).toBeInTheDocument();
    });

    it('renders with placeholder', () => {
      render(<Textarea placeholder="Enter text..." />);

      expect(screen.getByPlaceholderText('Enter text...')).toBeInTheDocument();
    });

    it('renders with aria-label', () => {
      render(<Textarea aria-label="Description" />);

      expect(screen.getByRole('textbox', { name: 'Description' })).toBeInTheDocument();
    });
  });

  describe('value handling', () => {
    it('displays initial value', () => {
      render(<Textarea defaultValue="Initial content" />);

      expect(screen.getByRole('textbox')).toHaveValue('Initial content');
    });

    it('handles controlled value', () => {
      render(<Textarea value="Controlled value" onChange={() => {}} />);

      expect(screen.getByRole('textbox')).toHaveValue('Controlled value');
    });

    it('calls onChange when typing', async () => {
      const user = userEvent.setup();
      const onChange = vi.fn();

      render(<Textarea onChange={onChange} />);

      await user.type(screen.getByRole('textbox'), 'test');

      expect(onChange).toHaveBeenCalled();
    });

    it('updates value when typing', async () => {
      const user = userEvent.setup();

      render(<Textarea />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'Hello world');

      expect(textarea).toHaveValue('Hello world');
    });
  });

  describe('disabled state', () => {
    it('renders disabled when disabled prop is true', () => {
      render(<Textarea disabled />);

      expect(screen.getByRole('textbox')).toBeDisabled();
    });

    it('has disabled styling', () => {
      render(<Textarea disabled />);

      expect(screen.getByRole('textbox')).toHaveClass('disabled:cursor-not-allowed');
    });

    it('does not allow typing when disabled', async () => {
      const user = userEvent.setup();

      render(<Textarea disabled defaultValue="initial" />);

      const textarea = screen.getByRole('textbox');
      await user.type(textarea, 'new text');

      expect(textarea).toHaveValue('initial');
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<Textarea className="custom-class" />);

      expect(screen.getByRole('textbox')).toHaveClass('custom-class');
    });

    it('preserves default classes with custom className', () => {
      render(<Textarea className="custom-class" />);

      const textarea = screen.getByRole('textbox');
      expect(textarea).toHaveClass('w-full', 'rounded-md', 'custom-class');
    });
  });

  describe('styling', () => {
    it('has minimum height', () => {
      render(<Textarea />);

      expect(screen.getByRole('textbox')).toHaveClass('min-h-[80px]');
    });

    it('has full width', () => {
      render(<Textarea />);

      expect(screen.getByRole('textbox')).toHaveClass('w-full');
    });

    it('has border styling', () => {
      render(<Textarea />);

      expect(screen.getByRole('textbox')).toHaveClass('border', 'border-input');
    });
  });

  describe('rows prop', () => {
    it('accepts rows prop', () => {
      render(<Textarea rows={5} />);

      expect(screen.getByRole('textbox')).toHaveAttribute('rows', '5');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to textarea element', () => {
      const ref = vi.fn();
      render(<Textarea ref={ref} />);

      expect(ref).toHaveBeenCalled();
    });
  });
});

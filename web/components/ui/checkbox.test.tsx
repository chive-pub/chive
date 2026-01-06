import { render, screen } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { Checkbox } from './checkbox';

describe('Checkbox', () => {
  describe('rendering', () => {
    it('renders checkbox', () => {
      render(<Checkbox />);

      expect(screen.getByRole('checkbox')).toBeInTheDocument();
    });

    it('renders with label when aria-label provided', () => {
      render(<Checkbox aria-label="Accept terms" />);

      expect(screen.getByRole('checkbox', { name: 'Accept terms' })).toBeInTheDocument();
    });
  });

  describe('checked state', () => {
    it('renders unchecked by default', () => {
      render(<Checkbox />);

      expect(screen.getByRole('checkbox')).not.toBeChecked();
    });

    it('renders checked when checked prop is true', () => {
      render(<Checkbox checked />);

      expect(screen.getByRole('checkbox')).toBeChecked();
    });

    it('toggles when clicked', async () => {
      const user = userEvent.setup();
      const onCheckedChange = vi.fn();

      render(<Checkbox onCheckedChange={onCheckedChange} />);

      await user.click(screen.getByRole('checkbox'));

      expect(onCheckedChange).toHaveBeenCalledWith(true);
    });
  });

  describe('disabled state', () => {
    it('renders disabled when disabled prop is true', () => {
      render(<Checkbox disabled />);

      expect(screen.getByRole('checkbox')).toBeDisabled();
    });

    it('has disabled styling', () => {
      render(<Checkbox disabled />);

      expect(screen.getByRole('checkbox')).toHaveClass('disabled:cursor-not-allowed');
    });

    it('does not toggle when disabled', async () => {
      const user = userEvent.setup();
      const onCheckedChange = vi.fn();

      render(<Checkbox disabled onCheckedChange={onCheckedChange} />);

      await user.click(screen.getByRole('checkbox'));

      expect(onCheckedChange).not.toHaveBeenCalled();
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<Checkbox className="custom-class" />);

      expect(screen.getByRole('checkbox')).toHaveClass('custom-class');
    });

    it('preserves default classes with custom className', () => {
      render(<Checkbox className="custom-class" />);

      const checkbox = screen.getByRole('checkbox');
      expect(checkbox).toHaveClass('h-4', 'w-4', 'custom-class');
    });
  });

  describe('styling', () => {
    it('has correct size classes', () => {
      render(<Checkbox />);

      expect(screen.getByRole('checkbox')).toHaveClass('h-4', 'w-4');
    });

    it('has checked state styling', () => {
      render(<Checkbox checked />);

      expect(screen.getByRole('checkbox')).toHaveAttribute('data-state', 'checked');
    });

    it('has unchecked state styling', () => {
      render(<Checkbox />);

      expect(screen.getByRole('checkbox')).toHaveAttribute('data-state', 'unchecked');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to checkbox element', () => {
      const ref = vi.fn();
      render(<Checkbox ref={ref} />);

      expect(ref).toHaveBeenCalled();
    });
  });
});

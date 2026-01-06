import { render, screen } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { RadioGroup, RadioGroupItem } from './radio-group';
import { Label } from './label';

describe('RadioGroup', () => {
  const renderRadioGroup = (props?: {
    defaultValue?: string;
    onValueChange?: (value: string) => void;
    disabled?: boolean;
  }) => {
    return render(
      <RadioGroup {...props}>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="option1" id="option1" />
          <Label htmlFor="option1">Option 1</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="option2" id="option2" />
          <Label htmlFor="option2">Option 2</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="option3" id="option3" />
          <Label htmlFor="option3">Option 3</Label>
        </div>
      </RadioGroup>
    );
  };

  describe('rendering', () => {
    it('renders radio group', () => {
      renderRadioGroup();

      expect(screen.getByRole('radiogroup')).toBeInTheDocument();
    });

    it('renders all radio items', () => {
      renderRadioGroup();

      expect(screen.getAllByRole('radio')).toHaveLength(3);
    });

    it('renders labels', () => {
      renderRadioGroup();

      expect(screen.getByText('Option 1')).toBeInTheDocument();
      expect(screen.getByText('Option 2')).toBeInTheDocument();
      expect(screen.getByText('Option 3')).toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('no option selected by default', () => {
      renderRadioGroup();

      const radios = screen.getAllByRole('radio');
      radios.forEach((radio) => {
        expect(radio).not.toBeChecked();
      });
    });

    it('selects default value', () => {
      renderRadioGroup({ defaultValue: 'option2' });

      expect(screen.getByRole('radio', { name: 'Option 2' })).toBeChecked();
    });

    it('selects option when clicked', async () => {
      const user = userEvent.setup();
      renderRadioGroup();

      await user.click(screen.getByRole('radio', { name: 'Option 1' }));

      expect(screen.getByRole('radio', { name: 'Option 1' })).toBeChecked();
    });

    it('calls onValueChange when selection changes', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderRadioGroup({ onValueChange });

      await user.click(screen.getByRole('radio', { name: 'Option 2' }));

      expect(onValueChange).toHaveBeenCalledWith('option2');
    });

    it('only one option can be selected', async () => {
      const user = userEvent.setup();
      renderRadioGroup({ defaultValue: 'option1' });

      await user.click(screen.getByRole('radio', { name: 'Option 3' }));

      expect(screen.getByRole('radio', { name: 'Option 1' })).not.toBeChecked();
      expect(screen.getByRole('radio', { name: 'Option 3' })).toBeChecked();
    });
  });

  describe('disabled state', () => {
    it('disables all options when group is disabled', () => {
      renderRadioGroup({ disabled: true });

      const radios = screen.getAllByRole('radio');
      radios.forEach((radio) => {
        expect(radio).toBeDisabled();
      });
    });

    it('does not change selection when disabled', async () => {
      const user = userEvent.setup();
      const onValueChange = vi.fn();
      renderRadioGroup({ disabled: true, onValueChange });

      await user.click(screen.getByRole('radio', { name: 'Option 1' }));

      expect(onValueChange).not.toHaveBeenCalled();
    });
  });

  describe('className prop', () => {
    it('applies custom className to group', () => {
      render(
        <RadioGroup className="custom-class">
          <RadioGroupItem value="test" />
        </RadioGroup>
      );

      expect(screen.getByRole('radiogroup')).toHaveClass('custom-class');
    });
  });

  describe('styling', () => {
    it('has grid layout by default', () => {
      renderRadioGroup();

      expect(screen.getByRole('radiogroup')).toHaveClass('grid');
    });

    it('has gap between items', () => {
      renderRadioGroup();

      expect(screen.getByRole('radiogroup')).toHaveClass('gap-2');
    });
  });
});

describe('RadioGroupItem', () => {
  describe('rendering', () => {
    it('renders radio button', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="test" />
        </RadioGroup>
      );

      expect(screen.getByRole('radio')).toBeInTheDocument();
    });
  });

  describe('disabled state', () => {
    it('renders disabled item', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="test" disabled />
        </RadioGroup>
      );

      expect(screen.getByRole('radio')).toBeDisabled();
    });

    it('has disabled styling', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="test" disabled />
        </RadioGroup>
      );

      expect(screen.getByRole('radio')).toHaveClass('disabled:cursor-not-allowed');
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="test" className="custom-class" />
        </RadioGroup>
      );

      expect(screen.getByRole('radio')).toHaveClass('custom-class');
    });
  });

  describe('styling', () => {
    it('has circular shape', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="test" />
        </RadioGroup>
      );

      expect(screen.getByRole('radio')).toHaveClass('rounded-full');
    });

    it('has correct size', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="test" />
        </RadioGroup>
      );

      expect(screen.getByRole('radio')).toHaveClass('h-4', 'w-4');
    });

    it('has border styling', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="test" />
        </RadioGroup>
      );

      expect(screen.getByRole('radio')).toHaveClass('border', 'border-primary');
    });
  });

  describe('checked state', () => {
    it('shows indicator when checked', async () => {
      const user = userEvent.setup();

      render(
        <RadioGroup>
          <RadioGroupItem value="test" />
        </RadioGroup>
      );

      await user.click(screen.getByRole('radio'));

      expect(screen.getByRole('radio')).toHaveAttribute('data-state', 'checked');
    });

    it('has unchecked data-state initially', () => {
      render(
        <RadioGroup>
          <RadioGroupItem value="test" />
        </RadioGroup>
      );

      expect(screen.getByRole('radio')).toHaveAttribute('data-state', 'unchecked');
    });
  });

  describe('ref forwarding', () => {
    it('forwards ref to radio element', () => {
      const ref = vi.fn();

      render(
        <RadioGroup>
          <RadioGroupItem value="test" ref={ref} />
        </RadioGroup>
      );

      expect(ref).toHaveBeenCalled();
    });
  });
});

describe('keyboard navigation', () => {
  it('navigates with arrow keys', async () => {
    const user = userEvent.setup();

    render(
      <RadioGroup>
        <RadioGroupItem value="opt1" />
        <RadioGroupItem value="opt2" />
        <RadioGroupItem value="opt3" />
      </RadioGroup>
    );

    // Focus first radio
    await user.click(screen.getAllByRole('radio')[0]);

    // Arrow down should move to next
    await user.keyboard('{ArrowDown}');

    expect(screen.getAllByRole('radio')[1]).toHaveFocus();
  });
});

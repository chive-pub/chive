import { render, screen } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import {
  Command,
  CommandInput,
  CommandList,
  CommandEmpty,
  CommandGroup,
  CommandItem,
  CommandSeparator,
  CommandShortcut,
} from './command';

describe('Command', () => {
  describe('rendering', () => {
    it('renders command container', () => {
      render(<Command>Content</Command>);

      expect(screen.getByText('Content')).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<Command className="custom-class">Content</Command>);

      const command = screen.getByText('Content').closest('[class*="overflow-hidden"]');
      expect(command).toHaveClass('custom-class');
    });
  });

  describe('styling', () => {
    it('has overflow hidden', () => {
      render(<Command>Content</Command>);

      const command = screen.getByText('Content').closest('[class*="overflow-hidden"]');
      expect(command).toHaveClass('overflow-hidden');
    });
  });
});

describe('CommandInput', () => {
  describe('rendering', () => {
    it('renders input', () => {
      render(
        <Command>
          <CommandInput placeholder="Search..." />
        </Command>
      );

      expect(screen.getByPlaceholderText('Search...')).toBeInTheDocument();
    });
  });

  describe('typing', () => {
    it('accepts text input', async () => {
      const user = userEvent.setup();

      render(
        <Command>
          <CommandInput placeholder="Search..." />
        </Command>
      );

      const input = screen.getByPlaceholderText('Search...');
      await user.type(input, 'test query');

      expect(input).toHaveValue('test query');
    });
  });

  describe('disabled state', () => {
    it('renders disabled input', () => {
      render(
        <Command>
          <CommandInput placeholder="Search..." disabled />
        </Command>
      );

      expect(screen.getByPlaceholderText('Search...')).toBeDisabled();
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(
        <Command>
          <CommandInput placeholder="Search..." className="custom-class" />
        </Command>
      );

      expect(screen.getByPlaceholderText('Search...')).toHaveClass('custom-class');
    });
  });
});

describe('CommandList', () => {
  describe('rendering', () => {
    it('renders list container', () => {
      render(
        <Command>
          <CommandList data-testid="command-list">
            <div>List content</div>
          </CommandList>
        </Command>
      );

      expect(screen.getByTestId('command-list')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('has max height for scrolling', () => {
      render(
        <Command>
          <CommandList data-testid="command-list">Content</CommandList>
        </Command>
      );

      expect(screen.getByTestId('command-list')).toHaveClass('max-h-[300px]');
    });

    it('has overflow-y-auto for scrolling', () => {
      render(
        <Command>
          <CommandList data-testid="command-list">Content</CommandList>
        </Command>
      );

      expect(screen.getByTestId('command-list')).toHaveClass('overflow-y-auto');
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(
        <Command>
          <CommandList data-testid="command-list" className="custom-class">
            Content
          </CommandList>
        </Command>
      );

      expect(screen.getByTestId('command-list')).toHaveClass('custom-class');
    });
  });
});

describe('CommandEmpty', () => {
  describe('rendering', () => {
    it('renders empty message', () => {
      render(
        <Command>
          <CommandList>
            <CommandEmpty>No results found</CommandEmpty>
          </CommandList>
        </Command>
      );

      expect(screen.getByText('No results found')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('has centered text', () => {
      render(
        <Command>
          <CommandList>
            <CommandEmpty>No results</CommandEmpty>
          </CommandList>
        </Command>
      );

      expect(screen.getByText('No results')).toHaveClass('text-center');
    });
  });
});

describe('CommandGroup', () => {
  describe('rendering', () => {
    it('renders group with heading', () => {
      render(
        <Command>
          <CommandList>
            <CommandGroup heading="Suggestions">
              <CommandItem>Item 1</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      );

      expect(screen.getByText('Suggestions')).toBeInTheDocument();
    });

    it('renders group items', () => {
      render(
        <Command>
          <CommandList>
            <CommandGroup heading="Options">
              <CommandItem>Option A</CommandItem>
              <CommandItem>Option B</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      );

      expect(screen.getByText('Option A')).toBeInTheDocument();
      expect(screen.getByText('Option B')).toBeInTheDocument();
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(
        <Command>
          <CommandList>
            <CommandGroup heading="Test" className="custom-class">
              <CommandItem>Item</CommandItem>
            </CommandGroup>
          </CommandList>
        </Command>
      );

      const group = screen.getByText('Test').closest('[class*="overflow-hidden"]');
      expect(group).toHaveClass('custom-class');
    });
  });
});

describe('CommandItem', () => {
  describe('rendering', () => {
    it('renders item', () => {
      render(
        <Command>
          <CommandList>
            <CommandItem>Item content</CommandItem>
          </CommandList>
        </Command>
      );

      expect(screen.getByText('Item content')).toBeInTheDocument();
    });
  });

  describe('selection', () => {
    it('calls onSelect when clicked', async () => {
      const user = userEvent.setup();
      const onSelect = vi.fn();

      render(
        <Command>
          <CommandList>
            <CommandItem onSelect={onSelect}>Clickable item</CommandItem>
          </CommandList>
        </Command>
      );

      await user.click(screen.getByText('Clickable item'));

      expect(onSelect).toHaveBeenCalled();
    });
  });

  describe('disabled state', () => {
    it('has disabled styling', () => {
      render(
        <Command>
          <CommandList>
            <CommandItem disabled>Disabled item</CommandItem>
          </CommandList>
        </Command>
      );

      expect(screen.getByText('Disabled item')).toHaveAttribute('data-disabled', 'true');
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(
        <Command>
          <CommandList>
            <CommandItem className="custom-class">Item</CommandItem>
          </CommandList>
        </Command>
      );

      expect(screen.getByText('Item')).toHaveClass('custom-class');
    });
  });
});

describe('CommandSeparator', () => {
  describe('rendering', () => {
    it('renders separator', () => {
      render(
        <Command>
          <CommandList>
            <CommandItem>Item 1</CommandItem>
            <CommandSeparator data-testid="separator" />
            <CommandItem>Item 2</CommandItem>
          </CommandList>
        </Command>
      );

      expect(screen.getByTestId('separator')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('has border styling', () => {
      render(
        <Command>
          <CommandList>
            <CommandSeparator data-testid="separator" />
          </CommandList>
        </Command>
      );

      expect(screen.getByTestId('separator')).toHaveClass('bg-border');
    });
  });
});

describe('CommandShortcut', () => {
  describe('rendering', () => {
    it('renders shortcut text', () => {
      render(<CommandShortcut>Ctrl+K</CommandShortcut>);

      expect(screen.getByText('Ctrl+K')).toBeInTheDocument();
    });
  });

  describe('styling', () => {
    it('has muted color', () => {
      render(<CommandShortcut>Cmd+S</CommandShortcut>);

      expect(screen.getByText('Cmd+S')).toHaveClass('text-muted-foreground');
    });

    it('has small text size', () => {
      render(<CommandShortcut>Esc</CommandShortcut>);

      expect(screen.getByText('Esc')).toHaveClass('text-xs');
    });
  });

  describe('className prop', () => {
    it('applies custom className', () => {
      render(<CommandShortcut className="custom-class">K</CommandShortcut>);

      expect(screen.getByText('K')).toHaveClass('custom-class');
    });
  });
});

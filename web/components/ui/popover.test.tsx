import { render, screen, waitFor } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { Popover, PopoverTrigger, PopoverContent } from './popover';
import { Button } from './button';

describe('Popover', () => {
  const renderPopover = (props?: {
    defaultOpen?: boolean;
    onOpenChange?: (open: boolean) => void;
  }) => {
    return render(
      <Popover {...props}>
        <PopoverTrigger asChild>
          <Button>Open popover</Button>
        </PopoverTrigger>
        <PopoverContent>Popover content here</PopoverContent>
      </Popover>
    );
  };

  describe('rendering', () => {
    it('renders trigger', () => {
      renderPopover();

      expect(screen.getByRole('button', { name: 'Open popover' })).toBeInTheDocument();
    });

    it('does not show content by default', () => {
      renderPopover();

      expect(screen.queryByText('Popover content here')).not.toBeInTheDocument();
    });
  });

  describe('opening', () => {
    it('shows content when trigger clicked', async () => {
      const user = userEvent.setup();
      renderPopover();

      await user.click(screen.getByRole('button', { name: 'Open popover' }));

      await waitFor(() => {
        expect(screen.getByText('Popover content here')).toBeInTheDocument();
      });
    });

    it('shows content when defaultOpen is true', () => {
      renderPopover({ defaultOpen: true });

      expect(screen.getByText('Popover content here')).toBeInTheDocument();
    });

    it('calls onOpenChange when opened', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderPopover({ onOpenChange });

      await user.click(screen.getByRole('button', { name: 'Open popover' }));

      expect(onOpenChange).toHaveBeenCalledWith(true);
    });
  });

  describe('closing', () => {
    it('closes when clicking outside', async () => {
      const user = userEvent.setup();
      renderPopover();

      await user.click(screen.getByRole('button', { name: 'Open popover' }));

      await waitFor(() => {
        expect(screen.getByText('Popover content here')).toBeInTheDocument();
      });

      await user.click(document.body);

      await waitFor(() => {
        expect(screen.queryByText('Popover content here')).not.toBeInTheDocument();
      });
    });

    it('closes when pressing Escape', async () => {
      const user = userEvent.setup();
      renderPopover();

      await user.click(screen.getByRole('button', { name: 'Open popover' }));

      await waitFor(() => {
        expect(screen.getByText('Popover content here')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(screen.queryByText('Popover content here')).not.toBeInTheDocument();
      });
    });

    it('calls onOpenChange when closed', async () => {
      const user = userEvent.setup();
      const onOpenChange = vi.fn();
      renderPopover({ onOpenChange });

      await user.click(screen.getByRole('button', { name: 'Open popover' }));

      await waitFor(() => {
        expect(screen.getByText('Popover content here')).toBeInTheDocument();
      });

      await user.keyboard('{Escape}');

      await waitFor(() => {
        expect(onOpenChange).toHaveBeenCalledWith(false);
      });
    });
  });
});

describe('PopoverContent', () => {
  describe('className prop', () => {
    it('applies custom className', async () => {
      const user = userEvent.setup();

      render(
        <Popover>
          <PopoverTrigger asChild>
            <Button>Trigger</Button>
          </PopoverTrigger>
          <PopoverContent className="custom-class">Content</PopoverContent>
        </Popover>
      );

      await user.click(screen.getByRole('button', { name: 'Trigger' }));

      await waitFor(() => {
        expect(screen.getByText('Content')).toHaveClass('custom-class');
      });
    });
  });

  describe('styling', () => {
    it('has z-index for stacking', async () => {
      const user = userEvent.setup();

      render(
        <Popover>
          <PopoverTrigger asChild>
            <Button>Trigger</Button>
          </PopoverTrigger>
          <PopoverContent>Content</PopoverContent>
        </Popover>
      );

      await user.click(screen.getByRole('button', { name: 'Trigger' }));

      await waitFor(() => {
        expect(screen.getByText('Content')).toHaveClass('z-50');
      });
    });

    it('has border and shadow', async () => {
      const user = userEvent.setup();

      render(
        <Popover>
          <PopoverTrigger asChild>
            <Button>Trigger</Button>
          </PopoverTrigger>
          <PopoverContent>Content</PopoverContent>
        </Popover>
      );

      await user.click(screen.getByRole('button', { name: 'Trigger' }));

      await waitFor(() => {
        const content = screen.getByText('Content');
        expect(content).toHaveClass('border', 'shadow-md');
      });
    });

    it('has default width', async () => {
      const user = userEvent.setup();

      render(
        <Popover>
          <PopoverTrigger asChild>
            <Button>Trigger</Button>
          </PopoverTrigger>
          <PopoverContent>Content</PopoverContent>
        </Popover>
      );

      await user.click(screen.getByRole('button', { name: 'Trigger' }));

      await waitFor(() => {
        expect(screen.getByText('Content')).toHaveClass('w-72');
      });
    });
  });

  describe('alignment', () => {
    it('accepts align prop', async () => {
      const user = userEvent.setup();

      render(
        <Popover>
          <PopoverTrigger asChild>
            <Button>Trigger</Button>
          </PopoverTrigger>
          <PopoverContent align="start">Content</PopoverContent>
        </Popover>
      );

      await user.click(screen.getByRole('button', { name: 'Trigger' }));

      await waitFor(() => {
        expect(screen.getByText('Content')).toBeInTheDocument();
      });
    });
  });

  describe('sideOffset', () => {
    it('accepts sideOffset prop', async () => {
      const user = userEvent.setup();

      render(
        <Popover>
          <PopoverTrigger asChild>
            <Button>Trigger</Button>
          </PopoverTrigger>
          <PopoverContent sideOffset={8}>Content</PopoverContent>
        </Popover>
      );

      await user.click(screen.getByRole('button', { name: 'Trigger' }));

      await waitFor(() => {
        expect(screen.getByText('Content')).toBeInTheDocument();
      });
    });
  });
});

describe('PopoverTrigger', () => {
  describe('asChild', () => {
    it('renders child element as trigger', () => {
      render(
        <Popover>
          <PopoverTrigger asChild>
            <button type="button">Custom trigger</button>
          </PopoverTrigger>
          <PopoverContent>Content</PopoverContent>
        </Popover>
      );

      expect(screen.getByRole('button', { name: 'Custom trigger' })).toBeInTheDocument();
    });
  });

  describe('without asChild', () => {
    it('renders as button by default', () => {
      render(
        <Popover>
          <PopoverTrigger>Default trigger</PopoverTrigger>
          <PopoverContent>Content</PopoverContent>
        </Popover>
      );

      expect(screen.getByRole('button', { name: 'Default trigger' })).toBeInTheDocument();
    });
  });
});

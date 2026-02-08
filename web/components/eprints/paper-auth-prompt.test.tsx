import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PaperAuthPrompt } from './paper-auth-prompt';

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  resolveHandle: vi.fn(),
  authenticatePaperInPopup: vi.fn(),
}));

// Mock the observability logger
vi.mock('@/lib/observability', () => ({
  logger: {
    child: vi.fn(() => ({
      info: vi.fn(),
      error: vi.fn(),
    })),
  },
}));

import { resolveHandle, authenticatePaperInPopup } from '@/lib/auth';

describe('PaperAuthPrompt', () => {
  const defaultProps = {
    paperDid: 'did:plc:paper123',
    onSuccess: vi.fn(),
    onError: vi.fn(),
  };

  const mockResolveHandle = resolveHandle as ReturnType<typeof vi.fn>;
  const mockAuthenticatePaperInPopup = authenticatePaperInPopup as ReturnType<typeof vi.fn>;

  beforeEach(() => {
    vi.clearAllMocks();
    mockResolveHandle.mockResolvedValue({
      did: 'did:plc:paper123',
      pdsEndpoint: 'https://pds.example.com',
    });
    mockAuthenticatePaperInPopup.mockResolvedValue({
      paperDid: 'did:plc:paper123',
      paperHandle: 'paper.example.com',
      pdsEndpoint: 'https://pds.example.com',
    });
  });

  it('renders the component title', () => {
    render(<PaperAuthPrompt {...defaultProps} />);

    expect(screen.getByText(/Paper Account Authentication Required/i)).toBeInTheDocument();
  });

  it('renders the paper DID', () => {
    render(<PaperAuthPrompt {...defaultProps} />);

    expect(screen.getByText('did:plc:paper123')).toBeInTheDocument();
  });

  it('renders Paper DID label', () => {
    render(<PaperAuthPrompt {...defaultProps} />);

    expect(screen.getByText('Paper DID')).toBeInTheDocument();
  });

  it('renders the description text', () => {
    render(<PaperAuthPrompt {...defaultProps} />);

    expect(screen.getByText(/This eprint is stored in a paper account PDS/i)).toBeInTheDocument();
  });

  it('shows authentication button', () => {
    render(<PaperAuthPrompt {...defaultProps} />);

    expect(
      screen.getByRole('button', { name: /authenticate as paper account/i })
    ).toBeInTheDocument();
  });

  it('renders handle input field', () => {
    render(<PaperAuthPrompt {...defaultProps} />);

    expect(screen.getByLabelText(/paper account handle/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText('paper.example.com')).toBeInTheDocument();
  });

  it('disables button when handle is empty', () => {
    render(<PaperAuthPrompt {...defaultProps} />);

    const authButton = screen.getByRole('button', { name: /authenticate as paper account/i });
    expect(authButton).toBeDisabled();
  });

  it('enables button when handle is entered', async () => {
    const user = userEvent.setup();
    render(<PaperAuthPrompt {...defaultProps} />);

    const input = screen.getByLabelText(/paper account handle/i);
    await user.type(input, 'paper.example.com');

    const authButton = screen.getByRole('button', { name: /authenticate as paper account/i });
    expect(authButton).not.toBeDisabled();
  });

  it('shows loading state during authentication', async () => {
    const user = userEvent.setup();
    // Make authentication hang
    mockAuthenticatePaperInPopup.mockImplementation(() => new Promise(() => {}));

    render(<PaperAuthPrompt {...defaultProps} />);

    const input = screen.getByLabelText(/paper account handle/i);
    await user.type(input, 'paper.example.com');

    const authButton = screen.getByRole('button', { name: /authenticate as paper account/i });
    fireEvent.click(authButton);

    await waitFor(() => {
      expect(screen.getByText(/authenticating/i)).toBeInTheDocument();
    });
  });

  it('disables button and input during authentication', async () => {
    const user = userEvent.setup();
    // Make authentication hang
    mockAuthenticatePaperInPopup.mockImplementation(() => new Promise(() => {}));

    render(<PaperAuthPrompt {...defaultProps} />);

    const input = screen.getByLabelText(/paper account handle/i);
    await user.type(input, 'paper.example.com');

    const authButton = screen.getByRole('button', { name: /authenticate as paper account/i });
    fireEvent.click(authButton);

    await waitFor(() => {
      expect(screen.getByRole('button')).toBeDisabled();
      expect(screen.getByLabelText(/paper account handle/i)).toBeDisabled();
    });
  });

  it('calls onSuccess after successful authentication', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<PaperAuthPrompt {...defaultProps} onSuccess={onSuccess} />);

    const input = screen.getByLabelText(/paper account handle/i);
    await user.type(input, 'paper.example.com');

    const authButton = screen.getByRole('button', { name: /authenticate as paper account/i });
    fireEvent.click(authButton);

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('shows error when handle resolves to different DID', async () => {
    const user = userEvent.setup();
    mockResolveHandle.mockResolvedValue({
      did: 'did:plc:different-did',
      pdsEndpoint: 'https://pds.example.com',
    });

    render(<PaperAuthPrompt {...defaultProps} />);

    const input = screen.getByLabelText(/paper account handle/i);
    await user.type(input, 'wrong-paper.example.com');

    const authButton = screen.getByRole('button', { name: /authenticate as paper account/i });
    fireEvent.click(authButton);

    await waitFor(() => {
      expect(screen.getByText(/resolves to a different DID/i)).toBeInTheDocument();
    });
  });

  it('calls onError when authentication fails', async () => {
    const user = userEvent.setup();
    const onError = vi.fn();
    const testError = new Error('Popup was blocked');
    mockAuthenticatePaperInPopup.mockRejectedValue(testError);

    render(<PaperAuthPrompt {...defaultProps} onError={onError} />);

    const input = screen.getByLabelText(/paper account handle/i);
    await user.type(input, 'paper.example.com');

    const authButton = screen.getByRole('button', { name: /authenticate as paper account/i });
    fireEvent.click(authButton);

    await waitFor(() => {
      expect(onError).toHaveBeenCalledWith(testError);
      expect(screen.getByText(/Popup was blocked/i)).toBeInTheDocument();
    });
  });

  it('shows error when authenticated DID does not match expected DID', async () => {
    const user = userEvent.setup();
    mockAuthenticatePaperInPopup.mockResolvedValue({
      paperDid: 'did:plc:unexpected-did',
      paperHandle: 'paper.example.com',
      pdsEndpoint: 'https://pds.example.com',
    });

    render(<PaperAuthPrompt {...defaultProps} />);

    const input = screen.getByLabelText(/paper account handle/i);
    await user.type(input, 'paper.example.com');

    const authButton = screen.getByRole('button', { name: /authenticate as paper account/i });
    fireEvent.click(authButton);

    await waitFor(() => {
      expect(screen.getByText(/does not match the expected paper DID/i)).toBeInTheDocument();
    });
  });

  it('renders with different paper DID values', () => {
    const customDid = 'did:plc:custom-paper-did-xyz';
    render(<PaperAuthPrompt {...defaultProps} paperDid={customDid} />);

    expect(screen.getByText(customDid)).toBeInTheDocument();
  });

  it('displays instruction text about popup', () => {
    render(<PaperAuthPrompt {...defaultProps} />);

    expect(
      screen.getByText(/Enter the ATProto handle for this paper account/i)
    ).toBeInTheDocument();
    expect(screen.getByText(/This will open a popup window/i)).toBeInTheDocument();
  });

  it('renders the key icon in title', () => {
    render(<PaperAuthPrompt {...defaultProps} />);

    // Check that an SVG (icon) is present in the title area
    const titleArea = screen.getByText(/Paper Account Authentication Required/i).closest('div');
    const svg = titleArea?.querySelector('svg');
    expect(svg).toBeInTheDocument();
  });

  it('allows authentication via Enter key', async () => {
    const user = userEvent.setup();
    const onSuccess = vi.fn();
    render(<PaperAuthPrompt {...defaultProps} onSuccess={onSuccess} />);

    const input = screen.getByLabelText(/paper account handle/i);
    await user.type(input, 'paper.example.com');
    await user.keyboard('{Enter}');

    await waitFor(() => {
      expect(onSuccess).toHaveBeenCalledTimes(1);
    });
  });

  it('shows error for empty handle submission', async () => {
    const user = userEvent.setup();
    render(<PaperAuthPrompt {...defaultProps} />);

    // Force enable button by temporarily having text then clearing
    const input = screen.getByLabelText(/paper account handle/i);
    await user.type(input, 'a');
    await user.clear(input);

    // The button should now be disabled, but we can test the validation
    // by checking that handle is required
    expect(screen.getByRole('button', { name: /authenticate as paper account/i })).toBeDisabled();
  });
});

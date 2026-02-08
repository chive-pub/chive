import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi, beforeEach } from 'vitest';

import { PaperAuthGate } from './paper-auth-gate';

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

describe('PaperAuthGate', () => {
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

  it('renders children directly when eprint has no paperDid', () => {
    const eprint = { paperDid: undefined };

    render(
      <PaperAuthGate eprint={eprint}>
        <button>Edit Eprint</button>
      </PaperAuthGate>
    );

    expect(screen.getByRole('button', { name: /edit eprint/i })).toBeInTheDocument();
  });

  it('does not show PaperAuthPrompt when eprint has no paperDid', () => {
    const eprint = { paperDid: undefined };

    render(
      <PaperAuthGate eprint={eprint}>
        <button>Edit Eprint</button>
      </PaperAuthGate>
    );

    expect(screen.queryByText(/Paper Account Authentication Required/i)).not.toBeInTheDocument();
  });

  it('shows PaperAuthPrompt when eprint has paperDid', () => {
    const eprint = { paperDid: 'did:plc:paper123' };

    render(
      <PaperAuthGate eprint={eprint}>
        <button>Edit Eprint</button>
      </PaperAuthGate>
    );

    expect(screen.getByText(/Paper Account Authentication Required/i)).toBeInTheDocument();
  });

  it('does not render children initially when eprint has paperDid', () => {
    const eprint = { paperDid: 'did:plc:paper123' };

    render(
      <PaperAuthGate eprint={eprint}>
        <button>Edit Eprint</button>
      </PaperAuthGate>
    );

    expect(screen.queryByRole('button', { name: /edit eprint/i })).not.toBeInTheDocument();
  });

  it('displays the paper DID in the auth prompt', () => {
    const eprint = { paperDid: 'did:plc:paper123' };

    render(
      <PaperAuthGate eprint={eprint}>
        <button>Edit Eprint</button>
      </PaperAuthGate>
    );

    expect(screen.getByText('did:plc:paper123')).toBeInTheDocument();
  });

  it('renders children after successful authentication', async () => {
    const user = userEvent.setup();
    const eprint = { paperDid: 'did:plc:paper123' };

    render(
      <PaperAuthGate eprint={eprint}>
        <button>Edit Eprint</button>
      </PaperAuthGate>
    );

    // Initially, children should not be visible
    expect(screen.queryByRole('button', { name: /edit eprint/i })).not.toBeInTheDocument();

    // Enter handle and click authenticate button
    const input = screen.getByLabelText(/paper account handle/i);
    await user.type(input, 'paper.example.com');

    const authButton = screen.getByRole('button', { name: /authenticate as paper account/i });
    fireEvent.click(authButton);

    // Wait for authentication to complete
    await waitFor(() => {
      expect(screen.getByRole('button', { name: /edit eprint/i })).toBeInTheDocument();
    });
  });

  it('calls onAuthenticated callback on success', async () => {
    const user = userEvent.setup();
    const onAuthenticated = vi.fn();
    const eprint = { paperDid: 'did:plc:paper123' };

    render(
      <PaperAuthGate eprint={eprint} onAuthenticated={onAuthenticated}>
        <button>Edit Eprint</button>
      </PaperAuthGate>
    );

    // Enter handle and click authenticate button
    const input = screen.getByLabelText(/paper account handle/i);
    await user.type(input, 'paper.example.com');

    const authButton = screen.getByRole('button', { name: /authenticate as paper account/i });
    fireEvent.click(authButton);

    await waitFor(() => {
      expect(onAuthenticated).toHaveBeenCalledTimes(1);
    });
  });

  it('hides PaperAuthPrompt after successful authentication', async () => {
    const user = userEvent.setup();
    const eprint = { paperDid: 'did:plc:paper123' };

    render(
      <PaperAuthGate eprint={eprint}>
        <button>Edit Eprint</button>
      </PaperAuthGate>
    );

    // Enter handle and click authenticate button
    const input = screen.getByLabelText(/paper account handle/i);
    await user.type(input, 'paper.example.com');

    const authButton = screen.getByRole('button', { name: /authenticate as paper account/i });
    fireEvent.click(authButton);

    await waitFor(() => {
      expect(screen.queryByText(/Paper Account Authentication Required/i)).not.toBeInTheDocument();
    });
  });
});

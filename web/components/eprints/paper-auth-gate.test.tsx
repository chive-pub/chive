import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import { PaperAuthGate } from './paper-auth-gate';

describe('PaperAuthGate', () => {
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
    const eprint = { paperDid: 'did:plc:paper123' };

    render(
      <PaperAuthGate eprint={eprint}>
        <button>Edit Eprint</button>
      </PaperAuthGate>
    );

    // Initially, children should not be visible
    expect(screen.queryByRole('button', { name: /edit eprint/i })).not.toBeInTheDocument();

    // Click authenticate button
    const authButton = screen.getByRole('button', { name: /authenticate as paper account/i });
    fireEvent.click(authButton);

    // Wait for authentication to complete (simulated delay in component)
    await waitFor(
      () => {
        expect(screen.getByRole('button', { name: /edit eprint/i })).toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });

  it('calls onAuthenticated callback on success', async () => {
    const onAuthenticated = vi.fn();
    const eprint = { paperDid: 'did:plc:paper123' };

    render(
      <PaperAuthGate eprint={eprint} onAuthenticated={onAuthenticated}>
        <button>Edit Eprint</button>
      </PaperAuthGate>
    );

    const authButton = screen.getByRole('button', { name: /authenticate as paper account/i });
    fireEvent.click(authButton);

    await waitFor(
      () => {
        expect(onAuthenticated).toHaveBeenCalledTimes(1);
      },
      { timeout: 2000 }
    );
  });

  it('hides PaperAuthPrompt after successful authentication', async () => {
    const eprint = { paperDid: 'did:plc:paper123' };

    render(
      <PaperAuthGate eprint={eprint}>
        <button>Edit Eprint</button>
      </PaperAuthGate>
    );

    const authButton = screen.getByRole('button', { name: /authenticate as paper account/i });
    fireEvent.click(authButton);

    await waitFor(
      () => {
        expect(
          screen.queryByText(/Paper Account Authentication Required/i)
        ).not.toBeInTheDocument();
      },
      { timeout: 2000 }
    );
  });
});

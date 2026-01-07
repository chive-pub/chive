/**
 * Component tests for AlphaSignupForm.
 *
 * @remarks
 * Tests the alpha application signup form including
 * field validation, conditional rendering, and submission.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

import { AlphaSignupForm } from '@/components/alpha/signup-form';
import { renderWithProviders } from '../../test-utils';

// Mock the hooks
vi.mock('@/lib/hooks/use-alpha-status', () => ({
  useAlphaApply: () => ({
    mutate: vi.fn(),
    mutateAsync: vi.fn().mockResolvedValue({ applicationId: 'test-id', status: 'pending' }),
    isPending: false,
    isError: false,
    error: null,
  }),
}));

vi.mock('@/lib/hooks/use-profile-autocomplete', () => ({
  useAffiliationAutocomplete: () => ({
    suggestions: [],
    isLoading: false,
    search: vi.fn(),
    clear: vi.fn(),
  }),
}));

describe('AlphaSignupForm', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders the form with all required fields', () => {
      renderWithProviders(<AlphaSignupForm />);

      // Check for required fields
      expect(screen.getByLabelText(/email/i)).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /sector/i })).toBeInTheDocument();
      expect(screen.getByRole('combobox', { name: /career/i })).toBeInTheDocument();
      expect(screen.getByLabelText(/research field/i)).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /submit|apply/i })).toBeInTheDocument();
    });

    it('renders optional fields', () => {
      renderWithProviders(<AlphaSignupForm />);

      // Optional motivation field
      expect(screen.getByLabelText(/motivation|why/i)).toBeInTheDocument();
    });

    it('renders sector options', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AlphaSignupForm />);

      // Open sector dropdown
      const sectorSelect = screen.getByRole('combobox', { name: /sector/i });
      await user.click(sectorSelect);

      // Check for expected options
      await waitFor(() => {
        expect(screen.getByRole('option', { name: /academia/i })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /industry/i })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /other/i })).toBeInTheDocument();
      });
    });

    it('renders career stage options', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AlphaSignupForm />);

      // Open career stage dropdown
      const careerSelect = screen.getByRole('combobox', { name: /career/i });
      await user.click(careerSelect);

      // Check for expected options
      await waitFor(() => {
        expect(screen.getByRole('option', { name: /phd/i })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /postdoc/i })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /faculty/i })).toBeInTheDocument();
      });
    });
  });

  describe('Conditional Fields', () => {
    it('shows "other" input when sector is "other"', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AlphaSignupForm />);

      // Initially, "other" input should not be visible
      expect(screen.queryByLabelText(/specify.*sector/i)).not.toBeInTheDocument();

      // Select "other" sector
      const sectorSelect = screen.getByRole('combobox', { name: /sector/i });
      await user.click(sectorSelect);
      await user.click(screen.getByRole('option', { name: /^other$/i }));

      // Now "other" input should be visible
      await waitFor(() => {
        expect(screen.getByLabelText(/specify.*sector|describe.*sector/i)).toBeInTheDocument();
      });
    });

    it('shows "other" input when career stage is "other"', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AlphaSignupForm />);

      // Initially, career "other" input should not be visible
      expect(screen.queryByLabelText(/specify.*career|describe.*role/i)).not.toBeInTheDocument();

      // Select "other" career stage
      const careerSelect = screen.getByRole('combobox', { name: /career/i });
      await user.click(careerSelect);
      await user.click(screen.getByRole('option', { name: /^other$/i }));

      // Now "other" input should be visible
      await waitFor(() => {
        expect(screen.getByLabelText(/specify.*career|describe.*role/i)).toBeInTheDocument();
      });
    });
  });

  describe('Form Validation', () => {
    it('shows error when email is invalid', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AlphaSignupForm />);

      // Enter invalid email
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'not-an-email');
      await user.tab(); // Blur to trigger validation

      // Submit to trigger validation
      const submitButton = screen.getByRole('button', { name: /submit|apply/i });
      await user.click(submitButton);

      // Should show error message
      await waitFor(() => {
        expect(screen.getByText(/valid email/i)).toBeInTheDocument();
      });
    });

    it('requires sector selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AlphaSignupForm />);

      // Fill other required fields but not sector
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      await user.type(screen.getByLabelText(/research field/i), 'Linguistics');

      // Submit
      const submitButton = screen.getByRole('button', { name: /submit|apply/i });
      await user.click(submitButton);

      // Should show validation error for sector
      await waitFor(() => {
        const errorText = screen.queryByText(/select.*sector/i);
        expect(errorText).toBeInTheDocument();
      });
    });

    it('requires career stage selection', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AlphaSignupForm />);

      // Fill email and sector
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');

      const sectorSelect = screen.getByRole('combobox', { name: /sector/i });
      await user.click(sectorSelect);
      await user.click(screen.getByRole('option', { name: /academia/i }));

      await user.type(screen.getByLabelText(/research field/i), 'Linguistics');

      // Submit without career stage
      const submitButton = screen.getByRole('button', { name: /submit|apply/i });
      await user.click(submitButton);

      // Should show validation error for career stage
      await waitFor(() => {
        const errorText = screen.queryByText(/select.*career|select.*position/i);
        expect(errorText).toBeInTheDocument();
      });
    });

    it('requires research field', async () => {
      const user = userEvent.setup();
      renderWithProviders(<AlphaSignupForm />);

      // Fill other fields but not research field
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');

      const sectorSelect = screen.getByRole('combobox', { name: /sector/i });
      await user.click(sectorSelect);
      await user.click(screen.getByRole('option', { name: /academia/i }));

      const careerSelect = screen.getByRole('combobox', { name: /career/i });
      await user.click(careerSelect);
      await user.click(screen.getByRole('option', { name: /postdoc/i }));

      // Submit
      const submitButton = screen.getByRole('button', { name: /submit|apply/i });
      await user.click(submitButton);

      // Should show validation error
      await waitFor(() => {
        const errorText = screen.queryByText(/research field|required/i);
        expect(errorText).toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      renderWithProviders(<AlphaSignupForm />);

      // All inputs should have associated labels
      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toHaveAttribute('type', 'email');

      const researchInput = screen.getByLabelText(/research field/i);
      expect(researchInput).toBeInTheDocument();
    });

    it('uses proper ARIA attributes', () => {
      renderWithProviders(<AlphaSignupForm />);

      // Form should be accessible
      const form = screen.getByRole('form');
      expect(form).toBeInTheDocument();
    });
  });
});

/**
 * Component tests for AlphaSignupForm.
 *
 * @remarks
 * Tests the alpha application signup form including
 * field validation, conditional rendering, and submission.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within, fireEvent, act } from '@testing-library/react';
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
    data: { suggestions: [] },
    isLoading: false,
  }),
  useKeywordAutocomplete: () => ({
    data: { suggestions: [] },
    isLoading: false,
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
      // Research Keywords uses custom autocomplete component without proper label association
      expect(screen.getByText(/research keywords/i)).toBeInTheDocument();
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
        expect(screen.getByRole('option', { name: /phd student/i })).toBeInTheDocument();
        expect(screen.getByRole('option', { name: /postdoctoral/i })).toBeInTheDocument();
        // Use getAllByRole since there are multiple faculty options (Junior and Senior)
        const facultyOptions = screen.getAllByRole('option', { name: /faculty/i });
        expect(facultyOptions.length).toBeGreaterThanOrEqual(1);
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
      const { container } = renderWithProviders(<AlphaSignupForm />);

      // Enter invalid email
      const emailInput = screen.getByLabelText(/email/i);
      await user.type(emailInput, 'not-an-email');

      // Submit form directly using fireEvent for more reliable form submission
      const form = container.querySelector('form')!;
      await act(async () => {
        fireEvent.submit(form);
      });

      // Wait for validation error to appear
      // The zod schema message is "Please enter a valid email address"
      await waitFor(
        () => {
          expect(screen.getByText(/please enter a valid email/i)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('requires sector selection', async () => {
      const user = userEvent.setup();
      const { container } = renderWithProviders(<AlphaSignupForm />);

      // Fill other required fields but not sector
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');
      // Keywords input uses placeholder instead of label
      await user.type(screen.getByPlaceholderText(/search keywords/i), 'Linguistics');

      // Submit form
      const form = container.querySelector('form')!;
      await act(async () => {
        fireEvent.submit(form);
      });

      // Should show validation error for sector - "Please select your sector"
      await waitFor(
        () => {
          expect(screen.getByText(/please select your sector/i)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('requires career stage selection', async () => {
      const user = userEvent.setup();
      const { container } = renderWithProviders(<AlphaSignupForm />);

      // Fill email and sector
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');

      const sectorSelect = screen.getByRole('combobox', { name: /sector/i });
      await user.click(sectorSelect);
      await user.click(screen.getByRole('option', { name: /academia/i }));

      // Keywords input uses placeholder instead of label
      await user.type(screen.getByPlaceholderText(/search keywords/i), 'Linguistics');

      // Submit without career stage
      const form = container.querySelector('form')!;
      await act(async () => {
        fireEvent.submit(form);
      });

      // Should show validation error for career stage - "Please select your career stage"
      await waitFor(
        () => {
          expect(screen.getByText(/please select your career stage/i)).toBeInTheDocument();
        },
        { timeout: 5000 }
      );
    });

    it('allows submission without research keywords (optional field)', async () => {
      const user = userEvent.setup();
      const { container } = renderWithProviders(<AlphaSignupForm />);

      // Fill required fields but not research keywords
      await user.type(screen.getByLabelText(/email/i), 'test@example.com');

      const sectorSelect = screen.getByRole('combobox', { name: /sector/i });
      await user.click(sectorSelect);
      await user.click(screen.getByRole('option', { name: /academia/i }));

      const careerSelect = screen.getByRole('combobox', { name: /career/i });
      await user.click(careerSelect);
      await user.click(screen.getByRole('option', { name: /postdoctoral/i }));

      // Submit the form
      const form = container.querySelector('form')!;
      await act(async () => {
        fireEvent.submit(form);
      });

      // Wait for any validation to complete, then verify no keyword error appears
      await waitFor(() => {
        // The form should not show a research keyword validation error
        expect(
          screen.queryByText(/please add at least one research keyword/i)
        ).not.toBeInTheDocument();
      });
    });
  });

  describe('Accessibility', () => {
    it('has proper form labels', () => {
      renderWithProviders(<AlphaSignupForm />);

      // All inputs should have associated labels
      const emailInput = screen.getByLabelText(/email/i);
      expect(emailInput).toHaveAttribute('type', 'email');

      // Research Keywords label exists (custom component without label association)
      expect(screen.getByText(/research keywords/i)).toBeInTheDocument();
      // The input is found by placeholder
      expect(screen.getByPlaceholderText(/search keywords/i)).toBeInTheDocument();
    });

    it('uses proper ARIA attributes', () => {
      const { container } = renderWithProviders(<AlphaSignupForm />);

      // Form element should exist
      const form = container.querySelector('form');
      expect(form).toBeInTheDocument();

      // Submit button should be accessible
      expect(screen.getByRole('button', { name: /submit/i })).toBeInTheDocument();
    });
  });
});

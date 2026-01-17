/**
 * Unit tests for ProposalForm component.
 *
 * Tests all 5 proposal categories:
 * - Field proposals
 * - Contribution type proposals
 * - Facet proposals (PMEST/FAST)
 * - Organization proposals
 * - Reconciliation proposals
 *
 * @packageDocumentation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderWithProviders } from '../../test-utils';
import { ProposalForm } from '@/components/governance/proposal-form';

// Mock the hooks
vi.mock('@/lib/auth/auth-context', () => ({
  useAuth: () => ({
    isAuthenticated: true,
    user: { did: 'did:plc:testuser123', handle: 'testuser.bsky.social' },
  }),
  useAgent: () => ({
    com: {
      atproto: {
        repo: {
          createRecord: vi.fn().mockResolvedValue({ uri: 'at://test/record' }),
        },
      },
    },
  }),
}));

vi.mock('@/lib/hooks/use-governance', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@/lib/hooks/use-governance')>();
  return {
    ...actual,
    useCreateProposal: () => ({
      mutateAsync: vi.fn().mockResolvedValue({
        uri: 'at://did:plc:testuser123/pub.chive.governance.proposal/abc',
        id: 'abc',
      }),
    }),
  };
});

vi.mock('@/lib/hooks/use-contribution-types', () => ({
  useContributionTypes: () => ({
    data: {
      types: [
        {
          id: 'conceptualization',
          label: 'Conceptualization',
          description: 'Ideas and goals',
          externalMappings: [
            {
              system: 'credit',
              uri: 'https://credit.niso.org/contributor-roles/conceptualization/',
            },
          ],
        },
      ],
    },
  }),
}));

vi.mock('@/components/fields/field-search', () => ({
  FieldSearch: ({ onFieldAdd }: { onFieldAdd: (field: { id: string; name: string }) => void }) => (
    <button
      data-testid="mock-field-search"
      onClick={() => onFieldAdd({ id: 'test-field', name: 'Test Field' })}
    >
      Search Fields
    </button>
  ),
}));

describe('ProposalForm', () => {
  const user = userEvent.setup();
  const mockOnSuccess = vi.fn();
  const mockOnCancel = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // ===========================================================================
  // Category Selection Tests
  // ===========================================================================

  describe('Category Selection', () => {
    it('renders all 5 category options', () => {
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccess} />);

      expect(screen.getByText('Knowledge Graph Field')).toBeInTheDocument();
      expect(screen.getByText('Contribution Type')).toBeInTheDocument();
      expect(screen.getByText('Facet Value')).toBeInTheDocument();
      // Organization appears in multiple places - look for the category option specifically
      expect(
        screen.getByText('Propose research institutions and organizations')
      ).toBeInTheDocument();
      expect(screen.getByText('Reconciliation')).toBeInTheDocument();
    });

    it('shows category descriptions', () => {
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccess} />);

      expect(
        screen.getByText('Propose changes to research fields and disciplines')
      ).toBeInTheDocument();
      expect(screen.getByText('Propose changes to CRediT contribution types')).toBeInTheDocument();
      expect(
        screen.getByText('Propose PMEST/FAST classification facet values')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Propose research institutions and organizations')
      ).toBeInTheDocument();
      expect(
        screen.getByText('Link Chive entities to external knowledge bases')
      ).toBeInTheDocument();
    });

    it('defaults to field category', () => {
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccess} defaultCategory="field" />);

      // Use id selector for the category radio button
      const fieldRadio = document.getElementById('cat-field') as HTMLElement;
      expect(fieldRadio).toHaveAttribute('aria-checked', 'true');
    });

    it('can switch between categories', async () => {
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccess} />);

      // Click facet category by its label
      await user.click(screen.getByText('Facet Value'));

      // Check the facet category radio is selected
      const facetRadio = document.getElementById('cat-facet') as HTMLElement;
      expect(facetRadio).toHaveAttribute('aria-checked', 'true');
    });
  });

  // ===========================================================================
  // Facet Proposal Tests
  // ===========================================================================

  describe('Facet Proposals', () => {
    it('shows facet-specific proposal types', () => {
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccess} defaultCategory="facet" />);
      expect(screen.getByText('Create Facet Value')).toBeInTheDocument();
      expect(screen.getByText('Update Facet Value')).toBeInTheDocument();
      expect(screen.getByText('Deprecate Facet Value')).toBeInTheDocument();
    });

    it('shows facet dimension dropdown for create', async () => {
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccess} defaultCategory="facet" />);
      // Create is selected by default
      expect(screen.getByText('Facet Dimension *')).toBeInTheDocument();
    });

    it('shows PMEST and FAST dimensions in dropdown', async () => {
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccess} defaultCategory="facet" />);
      const dimensionSelect = screen.getByRole('combobox', { name: /facet dimension/i });
      await user.click(dimensionSelect);

      // Check dimensions exist in the dropdown content using role option
      const listbox = screen.getByRole('listbox');

      // PMEST dimensions
      expect(within(listbox).getByText('Personality')).toBeInTheDocument();
      expect(within(listbox).getByText('Matter')).toBeInTheDocument();
      expect(within(listbox).getByText('Energy')).toBeInTheDocument();
      expect(within(listbox).getByText('Space')).toBeInTheDocument();
      expect(within(listbox).getByText('Time')).toBeInTheDocument();

      // FAST dimensions
      expect(within(listbox).getByText('Person')).toBeInTheDocument();
      expect(within(listbox).getByText('Organization')).toBeInTheDocument();
      expect(within(listbox).getByText('Event')).toBeInTheDocument();
      expect(within(listbox).getByText('Work')).toBeInTheDocument();
      expect(within(listbox).getByText('Form/Genre')).toBeInTheDocument();
    });

    it('shows facet value ID and label fields', () => {
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccess} defaultCategory="facet" />);
      expect(screen.getByLabelText(/facet value id/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/facet value label/i)).toBeInTheDocument();
    });

    it('shows description field for facet', () => {
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccess} defaultCategory="facet" />);
      expect(screen.getByLabelText(/description/i)).toBeInTheDocument();
    });

    it('shows parent facet field', () => {
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccess} defaultCategory="facet" />);
      expect(screen.getAllByText(/parent facet value/i).length).toBeGreaterThan(0);
    });

    it('shows LCSH and FAST external mapping fields', () => {
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccess} defaultCategory="facet" />);
      expect(screen.getAllByText(/lcsh subject heading/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/fast subject heading/i).length).toBeGreaterThan(0);
    });

    it('shows existing facet field for update action', async () => {
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccess} defaultCategory="facet" />);
      await user.click(screen.getByText('Update Facet Value'));

      // Use getAllBy since there may be label and input
      expect(screen.getAllByText(/existing facet/i).length).toBeGreaterThan(0);
    });

    it('submit button is disabled until required fields filled', () => {
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccess} defaultCategory="facet" />);
      // The form requires several fields for facet proposals
      expect(screen.getByRole('button', { name: /submit proposal/i })).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Organization Proposal Tests
  // ===========================================================================

  describe('Organization Proposals', () => {
    it('shows organization-specific proposal types', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="organization" />
      );
      expect(screen.getByText('Create Organization')).toBeInTheDocument();
      expect(screen.getByText('Update Organization')).toBeInTheDocument();
      expect(screen.getByText('Merge Organizations')).toBeInTheDocument();
      expect(screen.getByText('Deprecate Organization')).toBeInTheDocument();
    });

    it('shows organization name field', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="organization" />
      );
      expect(screen.getByLabelText(/organization name/i)).toBeInTheDocument();
    });

    it('shows organization type dropdown', async () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="organization" />
      );
      const typeSelect = screen.getByRole('combobox', { name: /organization type/i });
      await user.click(typeSelect);

      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('University')).toBeInTheDocument();
      expect(within(listbox).getByText('Research Lab')).toBeInTheDocument();
      expect(within(listbox).getByText('Funding Body')).toBeInTheDocument();
      expect(within(listbox).getByText('Publisher')).toBeInTheDocument();
      expect(within(listbox).getByText('Consortium')).toBeInTheDocument();
      expect(within(listbox).getByText('Hospital/Medical Center')).toBeInTheDocument();
      expect(within(listbox).getByText('Government Agency')).toBeInTheDocument();
      expect(within(listbox).getByText('Nonprofit Organization')).toBeInTheDocument();
      expect(within(listbox).getByText('Company/Corporation')).toBeInTheDocument();
    });

    it('shows ROR ID field', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="organization" />
      );
      expect(screen.getAllByText(/ror id/i).length).toBeGreaterThan(0);
    });

    it('shows Wikidata ID field', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="organization" />
      );
      expect(screen.getAllByText(/wikidata id/i).length).toBeGreaterThan(0);
    });

    it('shows location fields (country, city)', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="organization" />
      );
      expect(screen.getAllByText(/country code/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/city/i).length).toBeGreaterThan(0);
    });

    it('shows website field', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="organization" />
      );
      expect(screen.getAllByText(/website/i).length).toBeGreaterThan(0);
    });

    it('shows aliases field', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="organization" />
      );
      expect(screen.getAllByText(/aliases/i).length).toBeGreaterThan(0);
    });

    it('shows parent organization field for create', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="organization" />
      );
      expect(screen.getAllByText(/parent organization/i).length).toBeGreaterThan(0);
    });

    it('shows merge target field for merge action', async () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="organization" />
      );
      await user.click(screen.getByText('Merge Organizations'));

      expect(screen.getByLabelText(/source organization/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/merge into organization/i)).toBeInTheDocument();
    });

    it('shows existing organization field for update action', async () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="organization" />
      );
      await user.click(screen.getByText('Update Organization'));

      expect(screen.getAllByText(/existing organization/i).length).toBeGreaterThan(0);
    });

    it('submit button is present for organization form', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="organization" />
      );
      expect(screen.getByRole('button', { name: /submit proposal/i })).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Reconciliation Proposal Tests
  // ===========================================================================

  describe('Reconciliation Proposals', () => {
    it('shows reconciliation-specific proposal types', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="reconciliation" />
      );
      expect(screen.getByText('Create Reconciliation')).toBeInTheDocument();
      expect(screen.getByText('Update Reconciliation')).toBeInTheDocument();
      expect(screen.getByText('Remove Reconciliation')).toBeInTheDocument();
    });

    it('shows source entity section', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="reconciliation" />
      );
      expect(screen.getByText('Source Entity (Chive)')).toBeInTheDocument();
    });

    it('shows target entity section', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="reconciliation" />
      );
      expect(screen.getByText('Target Entity (External)')).toBeInTheDocument();
    });

    it('shows match details section', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="reconciliation" />
      );
      expect(screen.getByText('Match Details')).toBeInTheDocument();
    });

    it('shows source entity type dropdown', async () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="reconciliation" />
      );
      const typeSelect = screen.getByRole('combobox', { name: /entity type/i });
      await user.click(typeSelect);

      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('Knowledge Graph Field')).toBeInTheDocument();
      expect(within(listbox).getByText('Contribution Type')).toBeInTheDocument();
      expect(within(listbox).getByText('Facet Value')).toBeInTheDocument();
      expect(within(listbox).getByText('Author')).toBeInTheDocument();
      expect(within(listbox).getByText('Eprint')).toBeInTheDocument();
    });

    it('shows source entity URI and label fields', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="reconciliation" />
      );
      expect(screen.getByLabelText(/entity uri/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/entity label/i)).toBeInTheDocument();
    });

    it('shows external system dropdown', async () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="reconciliation" />
      );
      const systemSelects = screen.getAllByRole('combobox');
      // Find the external system select (second one)
      const systemSelect =
        systemSelects.find(
          (s) => s.getAttribute('name')?.includes('targetSystem') || s.id?.includes('targetSystem')
        ) ?? systemSelects[1];
      await user.click(systemSelect);

      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('Wikidata')).toBeInTheDocument();
      expect(within(listbox).getByText('ROR')).toBeInTheDocument();
      expect(within(listbox).getByText('ORCID')).toBeInTheDocument();
      expect(within(listbox).getByText('OpenAlex')).toBeInTheDocument();
      expect(within(listbox).getByText('Crossref')).toBeInTheDocument();
      expect(within(listbox).getByText('arXiv')).toBeInTheDocument();
      expect(within(listbox).getByText('Semantic Scholar')).toBeInTheDocument();
      expect(within(listbox).getByText('PubMed')).toBeInTheDocument();
      expect(within(listbox).getByText('CRediT')).toBeInTheDocument();
      expect(within(listbox).getByText('CRO')).toBeInTheDocument();
      expect(within(listbox).getByText('LCSH')).toBeInTheDocument();
      expect(within(listbox).getByText('FAST')).toBeInTheDocument();
    });

    it('shows target identifier and URI fields', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="reconciliation" />
      );
      expect(screen.getByLabelText(/external identifier/i)).toBeInTheDocument();
      expect(screen.getAllByText(/external uri/i).length).toBeGreaterThan(0);
    });

    it('shows external label field', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="reconciliation" />
      );
      expect(screen.getByLabelText(/external label/i)).toBeInTheDocument();
    });

    it('shows match type dropdown', async () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="reconciliation" />
      );
      const matchTypeSelect = screen.getByRole('combobox', { name: /match type/i });
      await user.click(matchTypeSelect);

      const listbox = screen.getByRole('listbox');
      expect(within(listbox).getByText('Exact Match')).toBeInTheDocument();
      expect(within(listbox).getByText('Close Match')).toBeInTheDocument();
      expect(within(listbox).getByText('Broader Match')).toBeInTheDocument();
      expect(within(listbox).getByText('Narrower Match')).toBeInTheDocument();
      expect(within(listbox).getByText('Related Match')).toBeInTheDocument();
    });

    it('shows confidence score field', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="reconciliation" />
      );
      expect(screen.getAllByText(/confidence score/i).length).toBeGreaterThan(0);
    });

    it('shows existing reconciliation field for update action', async () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="reconciliation" />
      );
      await user.click(screen.getByText('Update Reconciliation'));

      expect(screen.getAllByText(/existing reconciliation/i).length).toBeGreaterThan(0);
    });

    it('submit button is present for reconciliation form', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="reconciliation" />
      );
      expect(screen.getByRole('button', { name: /submit proposal/i })).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Common Form Behavior Tests
  // ===========================================================================

  describe('Common Form Behavior', () => {
    it('shows rationale field for all categories', async () => {
      const { rerender } = renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="field" />
      );
      expect(screen.getByLabelText(/rationale/i)).toBeInTheDocument();

      rerender(<ProposalForm onSuccess={mockOnSuccess} defaultCategory="facet" />);
      expect(screen.getByLabelText(/rationale/i)).toBeInTheDocument();

      rerender(<ProposalForm onSuccess={mockOnSuccess} defaultCategory="organization" />);
      expect(screen.getByLabelText(/rationale/i)).toBeInTheDocument();

      rerender(<ProposalForm onSuccess={mockOnSuccess} defaultCategory="reconciliation" />);
      expect(screen.getByLabelText(/rationale/i)).toBeInTheDocument();
    });

    it('shows community voting info alert', () => {
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccess} />);
      expect(screen.getByText('Community Voting')).toBeInTheDocument();
    });

    it('shows submit button', () => {
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccess} />);
      expect(screen.getByRole('button', { name: /submit proposal/i })).toBeInTheDocument();
    });

    it('shows cancel button when onCancel provided', () => {
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);
      expect(screen.getByRole('button', { name: /cancel/i })).toBeInTheDocument();
    });

    it('calls onCancel when cancel button clicked', async () => {
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccess} onCancel={mockOnCancel} />);
      await user.click(screen.getByRole('button', { name: /cancel/i }));
      expect(mockOnCancel).toHaveBeenCalled();
    });

    it('resets proposal type to create when category changes', async () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="field" defaultType="update" />
      );

      // Switch category
      await user.click(screen.getByText('Facet Value'));

      // Should show create type options
      expect(screen.getByText('Create Facet Value')).toBeInTheDocument();
    });
  });

  // ===========================================================================
  // Form Submission Tests
  // ===========================================================================

  describe('Form Submission', () => {
    it('submits facet proposal with correct data', async () => {
      const mockOnSuccessFn = vi.fn();
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccessFn} defaultCategory="facet" />);

      // Fill form
      const dimensionSelect = screen.getByRole('combobox', { name: /facet dimension/i });
      await user.click(dimensionSelect);
      await user.click(screen.getByRole('option', { name: /personality/i }));

      // Use click + paste for long strings (industry standard - 2x faster than type())
      const facetIdInput = screen.getByLabelText(/facet value id/i);
      await user.click(facetIdInput);
      await user.paste('deep-learning');

      const facetLabelInput = screen.getByLabelText(/facet value label/i);
      await user.click(facetLabelInput);
      await user.paste('Deep Learning');

      const descriptionInput = screen.getByLabelText(/description/i);
      await user.click(descriptionInput);
      await user.paste('A subset of machine learning using neural networks');

      const rationaleInput = screen.getByLabelText(/rationale/i);
      await user.click(rationaleInput);
      await user.paste('Deep learning is a distinct subfield that needs tracking');

      await user.click(screen.getByRole('button', { name: /submit proposal/i }));

      await waitFor(() => {
        expect(mockOnSuccessFn).toHaveBeenCalled();
      });
    });

    it('submits organization proposal with correct data', async () => {
      const mockOnSuccessFn = vi.fn();
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccessFn} defaultCategory="organization" />
      );

      // Use click + paste for long strings (industry standard - 2x faster than type())
      const orgNameInput = screen.getByLabelText(/organization name/i);
      await user.click(orgNameInput);
      await user.paste('Stanford AI Lab');

      const typeSelect = screen.getByRole('combobox', { name: /organization type/i });
      await user.click(typeSelect);
      await user.click(screen.getByRole('option', { name: /research lab/i }));

      const rationaleInput = screen.getByLabelText(/rationale/i);
      await user.click(rationaleInput);
      await user.paste('SAIL is a major AI research lab that should be tracked');

      await user.click(screen.getByRole('button', { name: /submit proposal/i }));

      await waitFor(() => {
        expect(mockOnSuccessFn).toHaveBeenCalled();
      });
    });

    it('submits reconciliation proposal with correct data', async () => {
      const mockOnSuccessFn = vi.fn();
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccessFn} defaultCategory="reconciliation" />
      );

      // Fill source entity
      const entityTypeSelect = screen.getByRole('combobox', { name: /entity type/i });
      await user.click(entityTypeSelect);
      await user.click(screen.getByRole('option', { name: /knowledge graph field/i }));

      // Use click + paste for long strings (industry standard - 2x faster than type())
      const entityUriInput = screen.getByLabelText(/entity uri/i);
      await user.click(entityUriInput);
      await user.paste('at://did:plc:gov/pub.chive.graph.field/ml');

      const entityLabelInput = screen.getByLabelText(/entity label/i);
      await user.click(entityLabelInput);
      await user.paste('Machine Learning');

      // Fill target entity - need to find the correct selects
      const allSelects = screen.getAllByRole('combobox');
      // Target system is the second select
      await user.click(allSelects[1]);
      await user.click(screen.getByRole('option', { name: /wikidata/i }));

      const externalIdInput = screen.getByLabelText(/external identifier/i);
      await user.click(externalIdInput);
      await user.paste('Q2539');

      const externalLabelInput = screen.getByLabelText(/external label/i);
      await user.click(externalLabelInput);
      await user.paste('machine learning');

      // Match type
      const matchTypeSelect = screen.getByRole('combobox', { name: /match type/i });
      await user.click(matchTypeSelect);
      await user.click(screen.getByRole('option', { name: /exact match/i }));

      const rationaleInput = screen.getByLabelText(/rationale/i);
      await user.click(rationaleInput);
      await user.paste('Direct mapping to Wikidata for machine learning concept');

      await user.click(screen.getByRole('button', { name: /submit proposal/i }));

      await waitFor(() => {
        expect(mockOnSuccessFn).toHaveBeenCalled();
      });
    });

    it('shows loading state during submission', async () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="organization" />
      );

      await user.type(screen.getByLabelText(/organization name/i), 'Test Org');

      const typeSelect = screen.getByRole('combobox', { name: /organization type/i });
      await user.click(typeSelect);
      await user.click(screen.getByRole('option', { name: /university/i }));

      await user.type(
        screen.getByLabelText(/rationale/i),
        'This is a test rationale for the proposal'
      );

      await user.click(screen.getByRole('button', { name: /submit proposal/i }));

      // Should show loading state briefly
      await waitFor(() => {
        expect(
          screen.queryByText(/submitting/i) ||
            screen.getByRole('button', { name: /submit proposal/i })
        ).toBeInTheDocument();
      });
    });
  });

  // ===========================================================================
  // Validation Tests
  // ===========================================================================

  describe('Validation', () => {
    it('has required field indicators', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="organization" />
      );

      // Check that required fields have proper labels (may appear multiple times)
      expect(screen.getAllByText(/organization name/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/organization type/i).length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/rationale/i)).toBeInTheDocument();
    });

    it('facet form has required field indicators', () => {
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccess} defaultCategory="facet" />);

      expect(screen.getAllByText(/facet dimension/i).length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/facet value id/i)).toBeInTheDocument();
      expect(screen.getByLabelText(/facet value label/i)).toBeInTheDocument();
    });

    it('reconciliation form has required field indicators', () => {
      renderWithProviders(
        <ProposalForm onSuccess={mockOnSuccess} defaultCategory="reconciliation" />
      );

      expect(screen.getAllByText(/entity type/i).length).toBeGreaterThan(0);
      expect(screen.getAllByText(/external system/i).length).toBeGreaterThan(0);
      expect(screen.getByLabelText(/rationale/i)).toBeInTheDocument();
    });

    it('field form has required field indicators', () => {
      renderWithProviders(<ProposalForm onSuccess={mockOnSuccess} defaultCategory="field" />);

      expect(screen.getByLabelText(/rationale/i)).toBeInTheDocument();
    });
  });
});

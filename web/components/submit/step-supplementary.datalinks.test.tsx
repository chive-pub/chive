/**
 * Tests for the linked-datasets section of StepSupplementary.
 *
 * @remarks
 * Covers only the Layers data link controls. The supplementary file handling
 * in the same step is unchanged and tested elsewhere.
 */

import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { useForm, FormProvider } from 'react-hook-form';

import { StepSupplementary } from './step-supplementary';
import type { EprintFormValues } from './submission-wizard';

// NodeAutocomplete talks to the knowledge graph on focus. The fallback
// vocabulary is what this section must work without, so the graph is stubbed.
vi.mock('@/components/forms', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return {
    ...actual,
    NodeAutocomplete: ({ placeholder }: { placeholder?: string }) => (
      <div data-testid="node-autocomplete">{placeholder}</div>
    ),
  };
});

let latestValues: EprintFormValues | undefined;

function renderStep() {
  const TestComponent = () => {
    const form = useForm<EprintFormValues>({
      defaultValues: {
        title: '',
        abstract: '',
        licenseSlug: 'CC-BY-4.0',
        authors: [],
        fieldNodes: [],
        supplementaryMaterials: [],
        dataLinks: [],
      } as EprintFormValues,
    });
    latestValues = form.watch();

    return (
      <FormProvider {...form}>
        <StepSupplementary form={form} />
      </FormProvider>
    );
  };

  return render(<TestComponent />);
}

describe('StepSupplementary linked datasets', () => {
  it('offers the section even when no datasets have been added', () => {
    renderStep();

    expect(screen.getByText('Linked datasets')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Add a dataset link/i })).toBeInTheDocument();
  });

  it('adds a row with a sensible default kind', async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByRole('button', { name: /Add a dataset link/i }));

    expect(latestValues?.dataLinks).toEqual([{ dataKind: 'corpus' }]);
  });

  it('offers the whole fallback vocabulary when no graph node is chosen', async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByRole('button', { name: /Add a dataset link/i }));

    const select = screen.getByLabelText('Kind of data');
    expect(select).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Annotation layer' })).toBeInTheDocument();
    expect(screen.getByRole('option', { name: 'Replication data' })).toBeInTheDocument();
  });

  it('records the paper section a reader needs to find the data', async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByRole('button', { name: /Add a dataset link/i }));
    await user.type(screen.getByPlaceholderText(/Table 3, Section 4.2/), 'Table 3');

    expect(latestValues?.dataLinks?.[0]?.paperSection).toBe('Table 3');
  });

  it('removes a row without disturbing the others', async () => {
    const user = userEvent.setup();
    renderStep();

    const add = screen.getByRole('button', { name: /Add a dataset link/i });
    await user.click(add);
    await user.click(add);
    expect(latestValues?.dataLinks).toHaveLength(2);

    await user.click(screen.getAllByRole('button', { name: 'Remove dataset link' })[0]);

    expect(latestValues?.dataLinks).toHaveLength(1);
  });

  it('changes the kind of an existing row', async () => {
    const user = userEvent.setup();
    renderStep();

    await user.click(screen.getByRole('button', { name: /Add a dataset link/i }));
    await user.selectOptions(screen.getByLabelText('Kind of data'), 'model-output');

    expect(latestValues?.dataLinks?.[0]?.dataKind).toBe('model-output');
  });
});

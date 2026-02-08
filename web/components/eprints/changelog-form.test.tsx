import { render, screen, fireEvent } from '@testing-library/react';
import { describe, it, expect, vi } from 'vitest';

import {
  ChangelogForm,
  type ChangelogFormData,
  CHANGELOG_CATEGORIES,
  CHANGE_TYPES,
} from './changelog-form';

describe('ChangelogForm', () => {
  const emptyValue: ChangelogFormData = {
    sections: [],
  };

  const createDefaultProps = (
    overrides?: Partial<{ value: ChangelogFormData; onChange: () => void }>
  ) => ({
    value: emptyValue,
    onChange: vi.fn(),
    ...overrides,
  });

  describe('empty state', () => {
    it('renders empty state message when no sections exist', () => {
      render(<ChangelogForm {...createDefaultProps()} />);

      expect(screen.getByText('No changes documented yet.')).toBeInTheDocument();
      expect(
        screen.getByText(/Use the "Add Section" button to add change categories/)
      ).toBeInTheDocument();
    });

    it('renders summary input', () => {
      render(<ChangelogForm {...createDefaultProps()} />);

      expect(screen.getByLabelText('Summary')).toBeInTheDocument();
      expect(screen.getByPlaceholderText(/One-line summary/)).toBeInTheDocument();
    });

    it('renders add section button', () => {
      render(<ChangelogForm {...createDefaultProps()} />);

      expect(screen.getByTestId('add-section-trigger')).toBeInTheDocument();
    });

    it('renders reviewer response toggle', () => {
      render(<ChangelogForm {...createDefaultProps()} />);

      expect(screen.getByText('Response to Peer Review')).toBeInTheDocument();
    });
  });

  describe('summary input', () => {
    it('calls onChange when summary is edited', () => {
      const onChange = vi.fn();
      render(<ChangelogForm {...createDefaultProps({ onChange })} />);

      const summaryInput = screen.getByLabelText('Summary');
      fireEvent.change(summaryInput, { target: { value: 'Updated methodology' } });

      expect(onChange).toHaveBeenCalledWith({
        sections: [],
        summary: 'Updated methodology',
      });
    });

    it('displays existing summary value', () => {
      const value: ChangelogFormData = {
        summary: 'Existing summary',
        sections: [],
      };
      render(<ChangelogForm {...createDefaultProps({ value })} />);

      expect(screen.getByDisplayValue('Existing summary')).toBeInTheDocument();
    });

    it('clears summary when emptied', () => {
      const onChange = vi.fn();
      const value: ChangelogFormData = {
        summary: 'Existing summary',
        sections: [],
      };
      render(<ChangelogForm {...createDefaultProps({ value, onChange })} />);

      const summaryInput = screen.getByLabelText('Summary');
      fireEvent.change(summaryInput, { target: { value: '' } });

      expect(onChange).toHaveBeenCalledWith({
        sections: [],
        summary: undefined,
      });
    });
  });

  describe('adding sections', () => {
    it('opens category selector when add section is clicked', async () => {
      render(<ChangelogForm {...createDefaultProps()} />);

      const addSectionTrigger = screen.getByTestId('add-section-trigger');
      fireEvent.click(addSectionTrigger);

      // Check that category options appear
      expect(await screen.findByText('Methodology')).toBeInTheDocument();
      expect(screen.getByText('Results')).toBeInTheDocument();
      expect(screen.getByText('Analysis')).toBeInTheDocument();
    });

    it('calls onChange with new section when category is selected', async () => {
      const onChange = vi.fn();
      render(<ChangelogForm {...createDefaultProps({ onChange })} />);

      const addSectionTrigger = screen.getByTestId('add-section-trigger');
      fireEvent.click(addSectionTrigger);

      const methodologyOption = await screen.findByText('Methodology');
      fireEvent.click(methodologyOption);

      expect(onChange).toHaveBeenCalledWith({
        sections: [
          {
            category: 'methodology',
            items: [{ description: '' }],
          },
        ],
      });
    });

    it('does not show already-used categories in selector', async () => {
      const value: ChangelogFormData = {
        sections: [{ category: 'methodology', items: [{ description: 'test' }] }],
      };
      render(<ChangelogForm {...createDefaultProps({ value })} />);

      const addSectionTrigger = screen.getByTestId('add-section-trigger');
      fireEvent.click(addSectionTrigger);

      // Methodology should not be in the list
      const options = await screen.findAllByRole('option');
      const optionTexts = options.map((opt) => opt.textContent);
      expect(optionTexts).not.toContain('Methodology');
      expect(optionTexts).toContain('Results');
    });
  });

  describe('removing sections', () => {
    it('renders remove section button for each section', () => {
      const value: ChangelogFormData = {
        sections: [{ category: 'methodology', items: [{ description: 'test' }] }],
      };
      render(<ChangelogForm {...createDefaultProps({ value })} />);

      expect(screen.getByText('Remove Section')).toBeInTheDocument();
    });

    it('calls onChange without the section when remove is clicked', () => {
      const onChange = vi.fn();
      const value: ChangelogFormData = {
        sections: [
          { category: 'methodology', items: [{ description: 'test' }] },
          { category: 'results', items: [{ description: 'other' }] },
        ],
      };
      render(<ChangelogForm {...createDefaultProps({ value, onChange })} />);

      const removeSectionButtons = screen.getAllByText('Remove Section');
      fireEvent.click(removeSectionButtons[0]);

      expect(onChange).toHaveBeenCalledWith({
        sections: [{ category: 'results', items: [{ description: 'other' }] }],
      });
    });
  });

  describe('adding items', () => {
    it('renders add item button in each section', () => {
      const value: ChangelogFormData = {
        sections: [{ category: 'methodology', items: [{ description: 'test' }] }],
      };
      render(<ChangelogForm {...createDefaultProps({ value })} />);

      expect(screen.getByText('Add Item')).toBeInTheDocument();
    });

    it('calls onChange with new item when add item is clicked', () => {
      const onChange = vi.fn();
      const value: ChangelogFormData = {
        sections: [{ category: 'methodology', items: [{ description: 'first change' }] }],
      };
      render(<ChangelogForm {...createDefaultProps({ value, onChange })} />);

      const addItemButton = screen.getByText('Add Item');
      fireEvent.click(addItemButton);

      expect(onChange).toHaveBeenCalledWith({
        sections: [
          {
            category: 'methodology',
            items: [{ description: 'first change' }, { description: '' }],
          },
        ],
      });
    });
  });

  describe('removing items', () => {
    it('renders remove button for each item', () => {
      const value: ChangelogFormData = {
        sections: [
          {
            category: 'methodology',
            items: [{ description: 'first' }, { description: 'second' }],
          },
        ],
      };
      render(<ChangelogForm {...createDefaultProps({ value })} />);

      const removeButtons = screen.getAllByLabelText('Remove item');
      expect(removeButtons).toHaveLength(2);
    });

    it('calls onChange without the item when remove is clicked', () => {
      const onChange = vi.fn();
      const value: ChangelogFormData = {
        sections: [
          {
            category: 'methodology',
            items: [{ description: 'first' }, { description: 'second' }],
          },
        ],
      };
      render(<ChangelogForm {...createDefaultProps({ value, onChange })} />);

      const removeButtons = screen.getAllByLabelText('Remove item');
      fireEvent.click(removeButtons[0]);

      expect(onChange).toHaveBeenCalledWith({
        sections: [
          {
            category: 'methodology',
            items: [{ description: 'second' }],
          },
        ],
      });
    });

    it('removes entire section when last item is removed', () => {
      const onChange = vi.fn();
      const value: ChangelogFormData = {
        sections: [{ category: 'methodology', items: [{ description: 'only item' }] }],
      };
      render(<ChangelogForm {...createDefaultProps({ value, onChange })} />);

      const removeButton = screen.getByLabelText('Remove item');
      fireEvent.click(removeButton);

      expect(onChange).toHaveBeenCalledWith({
        sections: [],
      });
    });
  });

  describe('editing item fields', () => {
    it('renders description textarea for each item', () => {
      const value: ChangelogFormData = {
        sections: [{ category: 'methodology', items: [{ description: '' }] }],
      };
      render(<ChangelogForm {...createDefaultProps({ value })} />);

      expect(screen.getByPlaceholderText('Describe the change...')).toBeInTheDocument();
    });

    it('calls onChange when description is edited', () => {
      const onChange = vi.fn();
      const value: ChangelogFormData = {
        sections: [{ category: 'methodology', items: [{ description: '' }] }],
      };
      render(<ChangelogForm {...createDefaultProps({ value, onChange })} />);

      const descriptionInput = screen.getByPlaceholderText('Describe the change...');
      fireEvent.change(descriptionInput, { target: { value: 'New description' } });

      expect(onChange).toHaveBeenCalledWith({
        sections: [
          {
            category: 'methodology',
            items: [{ description: 'New description' }],
          },
        ],
      });
    });

    it('renders change type select for each item', () => {
      const value: ChangelogFormData = {
        sections: [{ category: 'methodology', items: [{ description: 'test' }] }],
      };
      render(<ChangelogForm {...createDefaultProps({ value })} />);

      expect(screen.getByLabelText('Change Type')).toBeInTheDocument();
    });

    it('calls onChange when change type is selected', async () => {
      const onChange = vi.fn();
      const value: ChangelogFormData = {
        sections: [{ category: 'methodology', items: [{ description: 'test' }] }],
      };
      render(<ChangelogForm {...createDefaultProps({ value, onChange })} />);

      const changeTypeSelect = screen.getByTestId('item-0-0-type');
      fireEvent.click(changeTypeSelect);

      const addedOption = await screen.findByText('Added');
      fireEvent.click(addedOption);

      expect(onChange).toHaveBeenCalledWith({
        sections: [
          {
            category: 'methodology',
            items: [{ description: 'test', changeType: 'added' }],
          },
        ],
      });
    });

    it('renders location input for each item', () => {
      const value: ChangelogFormData = {
        sections: [{ category: 'methodology', items: [{ description: 'test' }] }],
      };
      render(<ChangelogForm {...createDefaultProps({ value })} />);

      expect(screen.getByPlaceholderText('e.g., Section 3.2')).toBeInTheDocument();
    });

    it('calls onChange when location is edited', () => {
      const onChange = vi.fn();
      const value: ChangelogFormData = {
        sections: [{ category: 'methodology', items: [{ description: 'test' }] }],
      };
      render(<ChangelogForm {...createDefaultProps({ value, onChange })} />);

      const locationInput = screen.getByPlaceholderText('e.g., Section 3.2');
      fireEvent.change(locationInput, { target: { value: 'Section 4.1' } });

      expect(onChange).toHaveBeenCalledWith({
        sections: [
          {
            category: 'methodology',
            items: [{ description: 'test', location: 'Section 4.1' }],
          },
        ],
      });
    });
  });

  describe('review reference field', () => {
    it('does not show review reference field by default', () => {
      const value: ChangelogFormData = {
        sections: [{ category: 'methodology', items: [{ description: 'test' }] }],
      };
      render(<ChangelogForm {...createDefaultProps({ value })} />);

      expect(screen.queryByPlaceholderText(/Reviewer 1/)).not.toBeInTheDocument();
    });

    it('shows review reference field when showReviewFields is true', () => {
      const value: ChangelogFormData = {
        sections: [{ category: 'methodology', items: [{ description: 'test' }] }],
      };
      render(<ChangelogForm {...createDefaultProps({ value })} showReviewFields={true} />);

      expect(screen.getByPlaceholderText('e.g., Reviewer 1, Comment 3')).toBeInTheDocument();
    });

    it('calls onChange when review reference is edited', () => {
      const onChange = vi.fn();
      const value: ChangelogFormData = {
        sections: [{ category: 'methodology', items: [{ description: 'test' }] }],
      };
      render(
        <ChangelogForm {...createDefaultProps({ value, onChange })} showReviewFields={true} />
      );

      const reviewInput = screen.getByPlaceholderText('e.g., Reviewer 1, Comment 3');
      fireEvent.change(reviewInput, { target: { value: 'Reviewer 2, Comment 5' } });

      expect(onChange).toHaveBeenCalledWith({
        sections: [
          {
            category: 'methodology',
            items: [{ description: 'test', reviewReference: 'Reviewer 2, Comment 5' }],
          },
        ],
      });
    });
  });

  describe('reviewer response', () => {
    it('renders reviewer response toggle collapsed by default', () => {
      render(<ChangelogForm {...createDefaultProps()} />);

      expect(screen.getByText('Response to Peer Review')).toBeInTheDocument();
      // Textarea should not be visible initially
      expect(screen.queryByPlaceholderText(/Provide a general response/)).not.toBeInTheDocument();
    });

    it('expands reviewer response section when toggle is clicked', () => {
      render(<ChangelogForm {...createDefaultProps()} />);

      const toggle = screen.getByText('Response to Peer Review');
      fireEvent.click(toggle);

      expect(screen.getByPlaceholderText(/Provide a general response/)).toBeInTheDocument();
    });

    it('calls onChange when reviewer response is edited', () => {
      const onChange = vi.fn();
      render(<ChangelogForm {...createDefaultProps({ onChange })} />);

      const toggle = screen.getByText('Response to Peer Review');
      fireEvent.click(toggle);

      const textarea = screen.getByPlaceholderText(/Provide a general response/);
      fireEvent.change(textarea, { target: { value: 'Thank you for the feedback.' } });

      expect(onChange).toHaveBeenCalledWith({
        sections: [],
        reviewerResponse: 'Thank you for the feedback.',
      });
    });

    it('shows reviewer response section expanded when value exists', () => {
      const value: ChangelogFormData = {
        sections: [],
        reviewerResponse: 'Existing response',
      };
      render(<ChangelogForm {...createDefaultProps({ value })} />);

      expect(screen.getByDisplayValue('Existing response')).toBeInTheDocument();
    });

    it('clears reviewer response when emptied', () => {
      const onChange = vi.fn();
      const value: ChangelogFormData = {
        sections: [],
        reviewerResponse: 'Existing response',
      };
      render(<ChangelogForm {...createDefaultProps({ value, onChange })} />);

      const textarea = screen.getByDisplayValue('Existing response');
      fireEvent.change(textarea, { target: { value: '' } });

      expect(onChange).toHaveBeenCalledWith({
        sections: [],
        reviewerResponse: undefined,
      });
    });
  });

  describe('disabled state', () => {
    it('disables summary input when disabled', () => {
      render(<ChangelogForm {...createDefaultProps()} disabled={true} />);

      expect(screen.getByLabelText('Summary')).toBeDisabled();
    });

    it('disables add section button when disabled', () => {
      render(<ChangelogForm {...createDefaultProps()} disabled={true} />);

      expect(screen.getByTestId('add-section-trigger')).toBeDisabled();
    });

    it('disables all item inputs when disabled', () => {
      const value: ChangelogFormData = {
        sections: [{ category: 'methodology', items: [{ description: 'test' }] }],
      };
      render(<ChangelogForm {...createDefaultProps({ value })} disabled={true} />);

      expect(screen.getByPlaceholderText('Describe the change...')).toBeDisabled();
      expect(screen.getByPlaceholderText('e.g., Section 3.2')).toBeDisabled();
    });
  });

  describe('section display', () => {
    it('displays section with item count', () => {
      const value: ChangelogFormData = {
        sections: [
          {
            category: 'methodology',
            items: [{ description: 'first' }, { description: 'second' }],
          },
        ],
      };
      render(<ChangelogForm {...createDefaultProps({ value })} />);

      expect(screen.getByText('Methodology')).toBeInTheDocument();
      expect(screen.getByText('(2 items)')).toBeInTheDocument();
    });

    it('displays singular item count when section has one item', () => {
      const value: ChangelogFormData = {
        sections: [{ category: 'methodology', items: [{ description: 'only one' }] }],
      };
      render(<ChangelogForm {...createDefaultProps({ value })} />);

      expect(screen.getByText('(1 item)')).toBeInTheDocument();
    });

    it('displays multiple sections', () => {
      const value: ChangelogFormData = {
        sections: [
          { category: 'methodology', items: [{ description: 'test' }] },
          { category: 'results', items: [{ description: 'other' }] },
          { category: 'figures', items: [{ description: 'fig' }] },
        ],
      };
      render(<ChangelogForm {...createDefaultProps({ value })} />);

      expect(screen.getByText('Methodology')).toBeInTheDocument();
      expect(screen.getByText('Results')).toBeInTheDocument();
      expect(screen.getByText('Figures')).toBeInTheDocument();
    });
  });

  describe('category labels', () => {
    it('displays human-readable labels for all categories', async () => {
      render(<ChangelogForm {...createDefaultProps()} />);

      const addSectionTrigger = screen.getByTestId('add-section-trigger');
      fireEvent.click(addSectionTrigger);

      // Check a few key label transformations
      expect(await screen.findByText('Supplementary Materials')).toBeInTheDocument();
      expect(screen.getByText('Language Editing')).toBeInTheDocument();
      expect(screen.getByText('Acknowledgments')).toBeInTheDocument();
    });
  });

  describe('change type options', () => {
    it('renders all change type options', async () => {
      const value: ChangelogFormData = {
        sections: [{ category: 'methodology', items: [{ description: 'test' }] }],
      };
      render(<ChangelogForm {...createDefaultProps({ value })} />);

      const changeTypeSelect = screen.getByTestId('item-0-0-type');
      fireEvent.click(changeTypeSelect);

      expect(await screen.findByText('Added')).toBeInTheDocument();
      expect(screen.getByText('Changed')).toBeInTheDocument();
      expect(screen.getByText('Removed')).toBeInTheDocument();
      expect(screen.getByText('Fixed')).toBeInTheDocument();
      expect(screen.getByText('Deprecated')).toBeInTheDocument();
    });
  });

  describe('exported constants', () => {
    it('exports CHANGELOG_CATEGORIES with all expected values', () => {
      expect(CHANGELOG_CATEGORIES).toContain('methodology');
      expect(CHANGELOG_CATEGORIES).toContain('results');
      expect(CHANGELOG_CATEGORIES).toContain('supplementary-materials');
      expect(CHANGELOG_CATEGORIES).toContain('language-editing');
      expect(CHANGELOG_CATEGORIES).toHaveLength(16);
    });

    it('exports CHANGE_TYPES with all expected values', () => {
      expect(CHANGE_TYPES).toContain('added');
      expect(CHANGE_TYPES).toContain('changed');
      expect(CHANGE_TYPES).toContain('removed');
      expect(CHANGE_TYPES).toContain('fixed');
      expect(CHANGE_TYPES).toContain('deprecated');
      expect(CHANGE_TYPES).toHaveLength(5);
    });
  });
});

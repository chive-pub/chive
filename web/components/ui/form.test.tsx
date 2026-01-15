/**
 * Unit tests for Form components.
 *
 * @remarks
 * Tests the FormMessage component to ensure it handles
 * edge cases correctly, particularly around error message rendering.
 */

import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect } from 'vitest';
import { useForm, useFormState } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import * as React from 'react';

import { Form, FormField, FormItem, FormLabel, FormControl, FormMessage } from './form';
import { Input } from './input';

/**
 * Helper component that exposes form error state for test assertions.
 */
function ErrorStateIndicator({ name }: { name: string }) {
  const { errors } = useFormState();
  const error = errors[name];
  return (
    <div data-testid="error-state">
      <span data-testid="has-error">{error ? 'true' : 'false'}</span>
      <span data-testid="error-message-defined">
        {error?.message !== undefined ? 'true' : 'false'}
      </span>
    </div>
  );
}

describe('Form Components', () => {
  describe('FormMessage', () => {
    it('renders error message when validation fails', async () => {
      const schema = z.object({
        email: z.string().email('Please enter a valid email'),
      });

      function TestForm() {
        const form = useForm({
          resolver: zodResolver(schema),
          defaultValues: { email: '' },
          mode: 'onSubmit',
        });

        return (
          <Form {...form}>
            <form onSubmit={form.handleSubmit(() => {})}>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="email input" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <button type="submit">Submit</button>
            </form>
          </Form>
        );
      }

      const user = userEvent.setup();
      render(<TestForm />);

      // Type invalid email and submit
      await user.type(screen.getByPlaceholderText('email input'), 'invalid');
      await user.click(screen.getByRole('button', { name: /submit/i }));

      await waitFor(() => {
        expect(screen.getByText('Please enter a valid email')).toBeInTheDocument();
      });
    });

    it('does not render "undefined" when error exists but message is undefined', async () => {
      function TestForm() {
        const form = useForm({
          defaultValues: { items: [] as string[] },
          mode: 'onSubmit',
        });

        React.useEffect(() => {
          // Set an error WITHOUT a message - this is the edge case
          form.setError('items', { type: 'manual' });
        }, [form]);

        return (
          <Form {...form}>
            <form>
              <FormField
                control={form.control}
                name="items"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Items</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={Array.isArray(field.value) ? field.value.join(',') : ''}
                        placeholder="items input"
                      />
                    </FormControl>
                    <FormMessage data-testid="form-message" />
                  </FormItem>
                )}
              />
              <ErrorStateIndicator name="items" />
            </form>
          </Form>
        );
      }

      render(<TestForm />);

      // FIRST: Verify the error state IS set (positive assertion)
      await waitFor(() => {
        expect(screen.getByTestId('has-error')).toHaveTextContent('true');
      });

      // SECOND: Verify the error message is undefined (positive assertion about the edge case)
      expect(screen.getByTestId('error-message-defined')).toHaveTextContent('false');

      // THIRD: Verify FormMessage does NOT render (returns null when no message)
      expect(screen.queryByTestId('form-message')).not.toBeInTheDocument();

      // FOURTH: Verify "undefined" text never appears anywhere in the document
      expect(screen.queryByText('undefined')).not.toBeInTheDocument();
    });

    it('does not render "undefined" for array field with root error without message', async () => {
      function TestForm() {
        const form = useForm({
          defaultValues: { keywords: [] as string[] },
          mode: 'onSubmit',
        });

        React.useEffect(() => {
          // Set error with type but no message
          form.setError('keywords', { type: 'custom' });
        }, [form]);

        return (
          <Form {...form}>
            <form>
              <FormField
                control={form.control}
                name="keywords"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Keywords</FormLabel>
                    <FormControl>
                      <Input
                        {...field}
                        value={Array.isArray(field.value) ? field.value.join(', ') : ''}
                        placeholder="keywords input"
                      />
                    </FormControl>
                    <FormMessage data-testid="keywords-message" />
                  </FormItem>
                )}
              />
              <ErrorStateIndicator name="keywords" />
            </form>
          </Form>
        );
      }

      render(<TestForm />);

      // Verify error exists
      await waitFor(() => {
        expect(screen.getByTestId('has-error')).toHaveTextContent('true');
      });

      // Verify message is undefined
      expect(screen.getByTestId('error-message-defined')).toHaveTextContent('false');

      // Verify FormMessage doesn't render
      expect(screen.queryByTestId('keywords-message')).not.toBeInTheDocument();

      // Verify no "undefined" text
      expect(screen.queryByText('undefined')).not.toBeInTheDocument();
    });

    it('renders children as fallback when error has no message', async () => {
      function TestForm() {
        const form = useForm({
          defaultValues: { field: '' },
        });

        React.useEffect(() => {
          // Set error without message
          form.setError('field', { type: 'manual' });
        }, [form]);

        return (
          <Form {...form}>
            <form>
              <FormField
                control={form.control}
                name="field"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Field</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage>Fallback helper text</FormMessage>
                  </FormItem>
                )}
              />
              <ErrorStateIndicator name="field" />
            </form>
          </Form>
        );
      }

      render(<TestForm />);

      // Verify error exists but has no message
      await waitFor(() => {
        expect(screen.getByTestId('has-error')).toHaveTextContent('true');
      });
      expect(screen.getByTestId('error-message-defined')).toHaveTextContent('false');

      // Verify fallback children are shown (not "undefined")
      expect(screen.getByText('Fallback helper text')).toBeInTheDocument();
      expect(screen.queryByText('undefined')).not.toBeInTheDocument();
    });

    it('renders children when no error exists', () => {
      function TestForm() {
        const form = useForm({
          defaultValues: { name: '' },
        });

        return (
          <Form {...form}>
            <form>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage>Default helper text</FormMessage>
                  </FormItem>
                )}
              />
              <ErrorStateIndicator name="name" />
            </form>
          </Form>
        );
      }

      render(<TestForm />);

      // Verify no error exists
      expect(screen.getByTestId('has-error')).toHaveTextContent('false');

      // Verify children are rendered
      expect(screen.getByText('Default helper text')).toBeInTheDocument();
    });

    it('renders nothing when no error and no children', () => {
      function TestForm() {
        const form = useForm({
          defaultValues: { name: '' },
        });

        return (
          <Form {...form}>
            <form>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Name</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage data-testid="form-message" />
                  </FormItem>
                )}
              />
              <ErrorStateIndicator name="name" />
            </form>
          </Form>
        );
      }

      render(<TestForm />);

      // Verify no error
      expect(screen.getByTestId('has-error')).toHaveTextContent('false');

      // FormMessage should not render anything (returns null)
      expect(screen.queryByTestId('form-message')).not.toBeInTheDocument();
    });

    it('prefers error message over children when both exist', async () => {
      function TestForm() {
        const form = useForm({
          defaultValues: { email: '' },
        });

        React.useEffect(() => {
          form.setError('email', { type: 'manual', message: 'Error takes priority' });
        }, [form]);

        return (
          <Form {...form}>
            <form>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage>This should not show</FormMessage>
                  </FormItem>
                )}
              />
              <ErrorStateIndicator name="email" />
            </form>
          </Form>
        );
      }

      render(<TestForm />);

      // Verify error exists with message
      await waitFor(() => {
        expect(screen.getByTestId('has-error')).toHaveTextContent('true');
      });
      expect(screen.getByTestId('error-message-defined')).toHaveTextContent('true');

      // Verify error message is shown, not children
      expect(screen.getByText('Error takes priority')).toBeInTheDocument();
      expect(screen.queryByText('This should not show')).not.toBeInTheDocument();
    });

    it('applies destructive styling to error messages', async () => {
      function TestForm() {
        const form = useForm({
          defaultValues: { email: '' },
        });

        React.useEffect(() => {
          form.setError('email', { type: 'manual', message: 'Styled error' });
        }, [form]);

        return (
          <Form {...form}>
            <form>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </form>
          </Form>
        );
      }

      render(<TestForm />);

      await waitFor(() => {
        const errorMessage = screen.getByText('Styled error');
        expect(errorMessage).toHaveClass('text-destructive');
      });
    });
  });

  describe('FormLabel', () => {
    it('renders label text', () => {
      function TestForm() {
        const form = useForm({
          defaultValues: { name: '' },
        });

        return (
          <Form {...form}>
            <form>
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Test Label</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                  </FormItem>
                )}
              />
            </form>
          </Form>
        );
      }

      render(<TestForm />);

      expect(screen.getByText('Test Label')).toBeInTheDocument();
    });

    it('applies destructive styling when field has error', async () => {
      function TestForm() {
        const form = useForm({
          defaultValues: { email: '' },
        });

        React.useEffect(() => {
          form.setError('email', { type: 'manual', message: 'Invalid' });
        }, [form]);

        return (
          <Form {...form}>
            <form>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email Label</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <ErrorStateIndicator name="email" />
            </form>
          </Form>
        );
      }

      render(<TestForm />);

      // Verify error is set
      await waitFor(() => {
        expect(screen.getByTestId('has-error')).toHaveTextContent('true');
      });

      const label = screen.getByText('Email Label');
      expect(label).toHaveClass('text-destructive');
    });
  });

  describe('FormControl', () => {
    it('sets aria-invalid when field has error', async () => {
      function TestForm() {
        const form = useForm({
          defaultValues: { email: '' },
        });

        React.useEffect(() => {
          form.setError('email', { type: 'manual', message: 'Invalid email' });
        }, [form]);

        return (
          <Form {...form}>
            <form>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="test input" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <ErrorStateIndicator name="email" />
            </form>
          </Form>
        );
      }

      render(<TestForm />);

      // Verify error is set
      await waitFor(() => {
        expect(screen.getByTestId('has-error')).toHaveTextContent('true');
      });

      const input = screen.getByPlaceholderText('test input');
      expect(input).toHaveAttribute('aria-invalid', 'true');
    });

    it('does not set aria-invalid when no error', () => {
      function TestForm() {
        const form = useForm({
          defaultValues: { email: '' },
        });

        return (
          <Form {...form}>
            <form>
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input {...field} placeholder="valid input" />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <ErrorStateIndicator name="email" />
            </form>
          </Form>
        );
      }

      render(<TestForm />);

      // Verify no error
      expect(screen.getByTestId('has-error')).toHaveTextContent('false');

      const input = screen.getByPlaceholderText('valid input');
      expect(input).toHaveAttribute('aria-invalid', 'false');
    });
  });
});

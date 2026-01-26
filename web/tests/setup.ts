import { cleanup } from '@testing-library/react';
import { afterEach, vi, expect } from 'vitest';
import * as matchers from '@testing-library/jest-dom/matchers';

// Extend Vitest's expect with jest-dom matchers
expect.extend(matchers);

// Cleanup after each test
afterEach(() => {
  cleanup();
});

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
  }),
  usePathname: () => '/',
  useSearchParams: () => new URLSearchParams(),
  useParams: () => ({}),
}));

// Mock next-themes
vi.mock('next-themes', () => ({
  useTheme: () => ({
    theme: 'light',
    setTheme: vi.fn(),
    systemTheme: 'light',
    themes: ['light', 'dark', 'system'],
    resolvedTheme: 'light',
  }),
  ThemeProvider: ({ children }: { children: React.ReactNode }) => children,
}));

// Mock window.matchMedia
Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation((query) => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Mock ResizeObserver
global.ResizeObserver = vi.fn().mockImplementation(() => ({
  observe: vi.fn(),
  unobserve: vi.fn(),
  disconnect: vi.fn(),
}));

// Mock pointer capture APIs for Radix UI components (Select, Popover, Command, etc.)
// These APIs are not available in jsdom but are used by Radix UI for pointer interactions
Element.prototype.hasPointerCapture = vi.fn().mockReturnValue(false);
Element.prototype.setPointerCapture = vi.fn();
Element.prototype.releasePointerCapture = vi.fn();

// Mock scrollIntoView for Radix UI components
Element.prototype.scrollIntoView = vi.fn();

// Mock getAnimations for Radix UI presence component
// This prevents infinite loops in animation state detection
Element.prototype.getAnimations = vi.fn().mockReturnValue([]);

// Mock Animation API for Radix presence
global.Animation = vi.fn().mockImplementation(() => ({
  finished: Promise.resolve(),
  cancel: vi.fn(),
  play: vi.fn(),
  pause: vi.fn(),
  effect: null,
  startTime: null,
  currentTime: null,
  playbackRate: 1,
  playState: 'finished',
  pending: false,
  ready: Promise.resolve(),
  onfinish: null,
  oncancel: null,
  onremove: null,
  addEventListener: vi.fn(),
  removeEventListener: vi.fn(),
  dispatchEvent: vi.fn(),
})) as unknown as typeof Animation;

// Mock getComputedStyle to return empty animation properties
// This helps prevent Radix UI presence from detecting animations
const originalGetComputedStyle = window.getComputedStyle;
window.getComputedStyle = vi.fn((element: Element, pseudoElt?: string | null) => {
  const style = originalGetComputedStyle(element, pseudoElt);
  return {
    ...style,
    animationName: 'none',
    animationDuration: '0s',
    animationDelay: '0s',
    animationIterationCount: '1',
    animationDirection: 'normal',
    animationFillMode: 'none',
    animationPlayState: 'running',
    getPropertyValue: (prop: string) => {
      if (prop.startsWith('animation')) {
        return prop === 'animation-name' ? 'none' : '0s';
      }
      return style.getPropertyValue(prop);
    },
  } as CSSStyleDeclaration;
});

// Mock @radix-ui/react-checkbox to avoid animation detection issues
// This is necessary because Radix's Presence component causes infinite loops in jsdom
// when detecting animations on checkbox state changes
vi.mock('@radix-ui/react-checkbox', async () => {
  const React = await import('react');

  interface CheckboxProps {
    checked?: boolean;
    defaultChecked?: boolean;
    onCheckedChange?: (checked: boolean) => void;
    disabled?: boolean;
    required?: boolean;
    name?: string;
    value?: string;
    id?: string;
    'aria-label'?: string;
    className?: string;
    children?: React.ReactNode;
  }

  const Checkbox: React.FC<CheckboxProps & { onClick?: (e: React.MouseEvent) => void }> & {
    displayName?: string;
  } = React.forwardRef<HTMLButtonElement, CheckboxProps>(
    (
      {
        checked,
        defaultChecked,
        onCheckedChange,
        disabled,
        id,
        'aria-label': ariaLabel,
        className,
        children,
        onClick: externalOnClick,
        ...props
      }: CheckboxProps & { onClick?: (e: React.MouseEvent) => void },
      ref: React.ForwardedRef<HTMLButtonElement>
    ) => {
      const [internalChecked, setInternalChecked] = React.useState(defaultChecked ?? false);
      const isChecked = checked !== undefined ? checked : internalChecked;

      return React.createElement(
        'button',
        {
          ref,
          type: 'button',
          role: 'checkbox',
          'aria-checked': isChecked,
          'aria-label': ariaLabel,
          'data-state': isChecked ? 'checked' : 'unchecked',
          disabled,
          id,
          className,
          onClick: (e: React.MouseEvent) => {
            // Call external onClick first (for stopPropagation etc.)
            externalOnClick?.(e);
            // Then handle the checkbox state change (mimics Radix behavior)
            const newChecked = !isChecked;
            if (checked === undefined) {
              setInternalChecked(newChecked);
            }
            onCheckedChange?.(newChecked);
          },
          ...props,
        },
        isChecked ? children : null
      );
    }
  );
  Checkbox.displayName = 'MockCheckbox';

  interface CheckboxIndicatorProps {
    className?: string;
    children?: React.ReactNode;
  }

  const CheckboxIndicator: React.FC<CheckboxIndicatorProps> & {
    displayName?: string;
  } = React.forwardRef<HTMLSpanElement, CheckboxIndicatorProps>(
    (
      { className, children, ...props }: CheckboxIndicatorProps,
      ref: React.ForwardedRef<HTMLSpanElement>
    ) => {
      return React.createElement(
        'span',
        { ref, className, 'data-state': 'checked', ...props },
        children
      );
    }
  );
  CheckboxIndicator.displayName = 'MockCheckboxIndicator';

  return {
    Root: Checkbox,
    Indicator: CheckboxIndicator,
  };
});

// Mock TipTap for JSDOM testing
// TipTap/ProseMirror requires browser APIs (elementFromPoint, etc.) not available in JSDOM
// Industry standard: mock the editor with a simple textarea for unit tests
// @see https://tiptap.dev/docs/guides/testing
vi.mock('@tiptap/react', async () => {
  const React = await import('react');

  // Shared state registry for editor instances (allows EditorContent to sync with useEditor)
  const editorRegistry = new Map<
    string,
    {
      value: string;
      setValue: (v: string) => void;
      onUpdate?: (props: { editor: { getText: () => string } }) => void;
    }
  >();

  interface MockEditor {
    getText: () => string;
    getHTML: () => string;
    commands: {
      setContent: (content: string) => void;
      clearContent: () => void;
      focus: () => MockEditor['commands'];
      toggleBold: () => MockEditor['commands'];
      toggleItalic: () => MockEditor['commands'];
      toggleStrike: () => MockEditor['commands'];
      toggleCode: () => MockEditor['commands'];
      toggleHeading: (attrs: { level: number }) => MockEditor['commands'];
      toggleBulletList: () => MockEditor['commands'];
      toggleOrderedList: () => MockEditor['commands'];
      toggleBlockquote: () => MockEditor['commands'];
      setLink: (attrs: { href: string }) => MockEditor['commands'];
      unsetLink: () => MockEditor['commands'];
      extendMarkRange: (mark: string) => MockEditor['commands'];
      insertContent: (content: unknown) => MockEditor['commands'];
    };
    chain: () => MockEditor['commands'];
    isActive: (type: string, attrs?: unknown) => boolean;
    getAttributes: (type: string) => Record<string, unknown>;
    state: {
      doc: {
        descendants: (callback: (node: unknown, pos: number) => boolean) => void;
      };
      selection: {
        from: number;
        to: number;
      };
    };
    on: ReturnType<typeof vi.fn>;
    off: ReturnType<typeof vi.fn>;
    destroy: () => void;
    isDestroyed: boolean;
    options: {
      editorProps?: {
        attributes?: Record<string, string>;
      };
    };
    _editorId: string;
  }

  interface EditorContentProps {
    editor: MockEditor | null;
    className?: string;
  }

  // Simple textarea-based mock for EditorContent
  function MockEditorContent({ editor, className }: EditorContentProps) {
    const [localValue, setLocalValue] = React.useState('');

    // Sync with editor registry
    React.useEffect(() => {
      if (editor && editor._editorId) {
        const registration = editorRegistry.get(editor._editorId);
        if (registration) {
          registration.setValue = (v: string) => {
            setLocalValue(v);
            // Update getText to return the new value
            editor.getText = () => v;
            editor.getHTML = () => `<p>${v}</p>`;
            // Trigger onUpdate callback with full mock editor
            registration.onUpdate?.({
              editor: {
                getText: () => v,
                getHTML: () => `<p>${v}</p>`,
                state: {
                  doc: { descendants: () => {} },
                  selection: { from: 0, to: 0 },
                },
              } as unknown as { getText: () => string },
            });
          };
        }
      }
    }, [editor]);

    // Sync editor.getText with localValue
    React.useEffect(() => {
      if (editor) {
        editor.getText = () => localValue;
        editor.getHTML = () => `<p>${localValue}</p>`;
        editor.commands.clearContent = () => {
          setLocalValue('');
          const registration = editor._editorId ? editorRegistry.get(editor._editorId) : null;
          registration?.onUpdate?.({
            editor: {
              getText: () => '',
              getHTML: () => '<p></p>',
              state: {
                doc: { descendants: () => {} },
                selection: { from: 0, to: 0 },
              },
            } as unknown as { getText: () => string },
          });
        };
      }
    }, [editor, localValue]);

    if (!editor) return null;

    const ariaLabel = editor.options?.editorProps?.attributes?.['aria-label'] || 'Editor';
    const placeholder =
      editor.options?.editorProps?.attributes?.['data-placeholder'] || "What's on your mind?";
    const styleString = editor.options?.editorProps?.attributes?.style || '';

    return React.createElement('textarea', {
      className,
      'aria-label': ariaLabel,
      placeholder,
      value: localValue,
      onChange: (e: React.ChangeEvent<HTMLTextAreaElement>) => {
        const newValue = e.target.value;
        setLocalValue(newValue);
        // Update editor.getText synchronously
        editor.getText = () => newValue;
        // Trigger onUpdate callback
        const registration = editor._editorId ? editorRegistry.get(editor._editorId) : null;
        registration?.onUpdate?.({ editor: { getText: () => newValue } });
      },
      // Parse style string into object or use defaults
      style: styleString
        ? Object.fromEntries(
            styleString.split(';').map((s: string) => {
              const [key, value] = s.split(':').map((p: string) => p.trim());
              // Convert kebab-case to camelCase
              const camelKey = key.replace(/-([a-z])/g, (_: string, c: string) => c.toUpperCase());
              return [camelKey, value];
            })
          )
        : { minHeight: '100px', width: '100%', padding: '12px', resize: 'none' },
    });
  }

  // Mock useEditor hook
  function useEditor(options: {
    content?: string;
    extensions?: unknown[];
    editorProps?: { attributes?: Record<string, string> };
    onUpdate?: (props: { editor: { getText: () => string } }) => void;
    immediatelyRender?: boolean;
    editable?: boolean;
  }) {
    // Generate unique ID for this editor instance
    const editorIdRef = React.useRef(`editor-${Math.random().toString(36).slice(2)}`);
    const [content, setContent] = React.useState(options.content || '');

    // Register this editor instance
    React.useEffect(() => {
      const editorId = editorIdRef.current;
      editorRegistry.set(editorId, {
        value: content,
        setValue: setContent,
        onUpdate: options.onUpdate,
      });
      return () => {
        editorRegistry.delete(editorId);
      };
    }, [content, options.onUpdate]);

    // Update onUpdate callback when it changes
    React.useEffect(() => {
      const registration = editorRegistry.get(editorIdRef.current);
      if (registration) {
        registration.onUpdate = options.onUpdate;
      }
    }, [options.onUpdate]);

    const editor: MockEditor = React.useMemo(
      () => {
        // Create commands object that returns itself for chaining
        const createCommands = (): MockEditor['commands'] => {
          const commands: MockEditor['commands'] = {
            setContent: (newContent: string) => {
              setContent(newContent);
              options.onUpdate?.({
                editor: {
                  getText: () => newContent,
                  getHTML: () => `<p>${newContent}</p>`,
                  state: {
                    doc: { descendants: () => {} },
                    selection: { from: 0, to: 0 },
                  },
                } as unknown as MockEditor,
              });
              return commands;
            },
            clearContent: () => {
              setContent('');
              options.onUpdate?.({
                editor: {
                  getText: () => '',
                  getHTML: () => '<p></p>',
                  state: {
                    doc: { descendants: () => {} },
                    selection: { from: 0, to: 0 },
                  },
                } as unknown as MockEditor,
              });
              return commands;
            },
            focus: () => commands,
            toggleBold: () => commands,
            toggleItalic: () => commands,
            toggleStrike: () => commands,
            toggleCode: () => commands,
            toggleHeading: () => commands,
            toggleBulletList: () => commands,
            toggleOrderedList: () => commands,
            toggleBlockquote: () => commands,
            setLink: () => commands,
            unsetLink: () => commands,
            extendMarkRange: () => commands,
            insertContent: () => commands,
          };
          return commands;
        };

        const commands = createCommands();

        return {
          getText: () => content,
          getHTML: () => `<p>${content}</p>`,
          commands,
          chain: () => commands,
          isActive: () => false,
          getAttributes: () => ({}),
          state: {
            doc: {
              descendants: () => {},
            },
            selection: {
              from: 0,
              to: 0,
            },
          },
          on: vi.fn(),
          off: vi.fn(),
          destroy: vi.fn(),
          isDestroyed: false,
          options: {
            editorProps: options.editorProps,
          },
          _editorId: editorIdRef.current,
        };
      },
      // Only recreate when editorProps changes, not content
      // eslint-disable-next-line react-hooks/exhaustive-deps
      [options.editorProps]
    );

    return editor;
  }

  return {
    useEditor,
    EditorContent: MockEditorContent,
    Editor: vi.fn(),
  };
});

// Mock TipTap extensions
vi.mock('@tiptap/starter-kit', () => ({
  default: { configure: vi.fn(() => ({})) },
}));

vi.mock('@tiptap/extension-placeholder', () => ({
  default: { configure: vi.fn(() => ({})) },
}));

vi.mock('@tiptap/extension-mention', () => ({
  default: { configure: vi.fn(() => ({})) },
}));

vi.mock('@tiptap/extension-link', () => ({
  default: { configure: vi.fn(() => ({})) },
}));

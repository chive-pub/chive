import { render, screen, waitFor } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { SchemaMigrationBanner, SchemaMigrationBannerSkeleton } from './schema-migration-banner';

// Mock the useSchemaMigration hook
const mockMutate = vi.fn();
const mockReset = vi.fn();

vi.mock('@/lib/hooks/use-schema-migration', () => ({
  useSchemaMigration: () => ({
    mutate: mockMutate,
    isPending: false,
    isSuccess: false,
    error: null,
    reset: mockReset,
  }),
  canUserMigrateRecord: vi.fn(
    (recordUri: string, ownerDid: string, currentUserDid: string | undefined) => {
      if (!currentUserDid) return false;
      const recordDid = recordUri.match(/^at:\/\/(did:[^/]+)\//)?.[1];
      return recordDid === currentUserDid || ownerDid === currentUserDid;
    }
  ),
}));

describe('SchemaMigrationBanner', () => {
  const defaultEprint = {
    uri: 'at://did:plc:owner123/pub.chive.eprint.submission/abc123',
    submittedBy: 'did:plc:owner123',
  };

  const defaultSchemaHints = {
    migrationAvailable: true,
    schemaVersion: '0.1.0',
    deprecatedFields: ['abstract'] as const,
    migrationUrl: 'https://docs.chive.pub/migration',
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders banner when migration is available and user can migrate', () => {
      render(
        <SchemaMigrationBanner
          schemaHints={defaultSchemaHints}
          eprint={defaultEprint}
          currentUserDid="did:plc:owner123"
        />
      );

      expect(screen.getByText('Format Update Available')).toBeInTheDocument();
      expect(screen.getByText(/Your record uses an older format/i)).toBeInTheDocument();
    });

    it('does not render when migrationAvailable is false', () => {
      render(
        <SchemaMigrationBanner
          schemaHints={{ migrationAvailable: false }}
          eprint={defaultEprint}
          currentUserDid="did:plc:owner123"
        />
      );

      expect(screen.queryByText('Format Update Available')).not.toBeInTheDocument();
    });

    it('does not render when schemaHints is undefined', () => {
      render(
        <SchemaMigrationBanner
          schemaHints={undefined}
          eprint={defaultEprint}
          currentUserDid="did:plc:owner123"
        />
      );

      expect(screen.queryByText('Format Update Available')).not.toBeInTheDocument();
    });

    it('does not render when user is not authenticated', () => {
      render(
        <SchemaMigrationBanner
          schemaHints={defaultSchemaHints}
          eprint={defaultEprint}
          currentUserDid={undefined}
        />
      );

      expect(screen.queryByText('Format Update Available')).not.toBeInTheDocument();
    });

    it('does not render when user is not the record owner', () => {
      render(
        <SchemaMigrationBanner
          schemaHints={defaultSchemaHints}
          eprint={defaultEprint}
          currentUserDid="did:plc:different-user"
        />
      );

      expect(screen.queryByText('Format Update Available')).not.toBeInTheDocument();
    });

    it('renders with paperDid for paper-centric records', () => {
      const eprintWithPaperDid = {
        ...defaultEprint,
        uri: 'at://did:plc:paper456/pub.chive.eprint.submission/abc123',
        paperDid: 'did:plc:paper456',
      };

      render(
        <SchemaMigrationBanner
          schemaHints={defaultSchemaHints}
          eprint={eprintWithPaperDid}
          currentUserDid="did:plc:paper456"
        />
      );

      expect(screen.getByText('Format Update Available')).toBeInTheDocument();
    });

    it('shows deprecated fields when provided', () => {
      render(
        <SchemaMigrationBanner
          schemaHints={defaultSchemaHints}
          eprint={defaultEprint}
          currentUserDid="did:plc:owner123"
        />
      );

      expect(screen.getByText(/Fields to update:/)).toBeInTheDocument();
      expect(screen.getByText(/Abstract format/)).toBeInTheDocument();
    });

    it('shows Learn More link when migrationUrl is provided', () => {
      render(
        <SchemaMigrationBanner
          schemaHints={defaultSchemaHints}
          eprint={defaultEprint}
          currentUserDid="did:plc:owner123"
        />
      );

      const learnMoreLink = screen.getByRole('link', { name: /Learn More/i });
      expect(learnMoreLink).toBeInTheDocument();
      expect(learnMoreLink).toHaveAttribute('href', 'https://docs.chive.pub/migration');
      expect(learnMoreLink).toHaveAttribute('target', '_blank');
      expect(learnMoreLink).toHaveAttribute('rel', 'noopener noreferrer');
    });

    it('does not show Learn More link when migrationUrl is not provided', () => {
      render(
        <SchemaMigrationBanner
          schemaHints={{ migrationAvailable: true }}
          eprint={defaultEprint}
          currentUserDid="did:plc:owner123"
        />
      );

      expect(screen.queryByRole('link', { name: /Learn More/i })).not.toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(
        <SchemaMigrationBanner
          schemaHints={defaultSchemaHints}
          eprint={defaultEprint}
          currentUserDid="did:plc:owner123"
          className="custom-class"
        />
      );

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('custom-class');
    });
  });

  describe('migration action', () => {
    it('calls mutate with uri when Update Now is clicked', async () => {
      const user = userEvent.setup();
      render(
        <SchemaMigrationBanner
          schemaHints={defaultSchemaHints}
          eprint={defaultEprint}
          currentUserDid="did:plc:owner123"
        />
      );

      await user.click(screen.getByRole('button', { name: /Update Now/i }));

      expect(mockMutate).toHaveBeenCalledWith(
        { uri: 'at://did:plc:owner123/pub.chive.eprint.submission/abc123' },
        expect.objectContaining({
          onSuccess: expect.any(Function),
        })
      );
    });

    it('calls onMigrationComplete callback on success', async () => {
      const onMigrationComplete = vi.fn();
      const user = userEvent.setup();

      // Set up mockMutate to call onSuccess immediately
      mockMutate.mockImplementation((params, options) => {
        if (options?.onSuccess) {
          options.onSuccess();
        }
      });

      render(
        <SchemaMigrationBanner
          schemaHints={defaultSchemaHints}
          eprint={defaultEprint}
          currentUserDid="did:plc:owner123"
          onMigrationComplete={onMigrationComplete}
        />
      );

      await user.click(screen.getByRole('button', { name: /Update Now/i }));

      expect(onMigrationComplete).toHaveBeenCalledTimes(1);
    });
  });

  describe('dismiss action', () => {
    it('hides banner when dismiss is clicked', async () => {
      const user = userEvent.setup();
      render(
        <SchemaMigrationBanner
          schemaHints={defaultSchemaHints}
          eprint={defaultEprint}
          currentUserDid="did:plc:owner123"
        />
      );

      expect(screen.getByText('Format Update Available')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Dismiss/i }));

      expect(screen.queryByText('Format Update Available')).not.toBeInTheDocument();
    });

    it('calls reset when dismiss is clicked', async () => {
      const user = userEvent.setup();
      render(
        <SchemaMigrationBanner
          schemaHints={defaultSchemaHints}
          eprint={defaultEprint}
          currentUserDid="did:plc:owner123"
        />
      );

      await user.click(screen.getByRole('button', { name: /Dismiss/i }));

      expect(mockReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('deprecated fields display', () => {
    it('displays abstract format label', () => {
      render(
        <SchemaMigrationBanner
          schemaHints={{
            migrationAvailable: true,
            deprecatedFields: ['abstract'] as const,
          }}
          eprint={defaultEprint}
          currentUserDid="did:plc:owner123"
        />
      );

      expect(screen.getByText(/Abstract format/)).toBeInTheDocument();
    });

    it('displays license reference label', () => {
      render(
        <SchemaMigrationBanner
          schemaHints={{
            migrationAvailable: true,
            deprecatedFields: ['license'] as const,
          }}
          eprint={defaultEprint}
          currentUserDid="did:plc:owner123"
        />
      );

      expect(screen.getByText(/License reference/)).toBeInTheDocument();
    });

    it('displays multiple fields', () => {
      render(
        <SchemaMigrationBanner
          schemaHints={{
            migrationAvailable: true,
            deprecatedFields: ['abstract', 'license'] as const,
          }}
          eprint={defaultEprint}
          currentUserDid="did:plc:owner123"
        />
      );

      expect(screen.getByText(/Abstract format, License reference/)).toBeInTheDocument();
    });

    it('displays unknown fields as-is', () => {
      render(
        <SchemaMigrationBanner
          schemaHints={{
            migrationAvailable: true,
            deprecatedFields: ['unknownField'] as const,
          }}
          eprint={defaultEprint}
          currentUserDid="did:plc:owner123"
        />
      );

      expect(screen.getByText(/unknownField/)).toBeInTheDocument();
    });

    it('does not show fields section when deprecatedFields is empty', () => {
      render(
        <SchemaMigrationBanner
          schemaHints={{
            migrationAvailable: true,
            deprecatedFields: [] as const,
          }}
          eprint={defaultEprint}
          currentUserDid="did:plc:owner123"
        />
      );

      expect(screen.queryByText(/Fields to update:/)).not.toBeInTheDocument();
    });

    it('does not show fields section when deprecatedFields is undefined', () => {
      render(
        <SchemaMigrationBanner
          schemaHints={{
            migrationAvailable: true,
          }}
          eprint={defaultEprint}
          currentUserDid="did:plc:owner123"
        />
      );

      expect(screen.queryByText(/Fields to update:/)).not.toBeInTheDocument();
    });
  });
});

describe('SchemaMigrationBannerSkeleton', () => {
  it('renders skeleton with animation', () => {
    render(<SchemaMigrationBannerSkeleton />);

    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<SchemaMigrationBannerSkeleton className="custom-skeleton-class" />);

    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toHaveClass('custom-skeleton-class');
  });
});

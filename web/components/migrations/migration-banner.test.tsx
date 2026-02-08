import { render, screen, waitFor } from '@/tests/test-utils';
import userEvent from '@testing-library/user-event';
import { MigrationBanner, MigrationBannerSkeleton } from './migration-banner';
import type { MigrationDetectionResult, MigrationResult } from '@/lib/migrations/types';

describe('MigrationBanner', () => {
  const defaultRecord = {
    uri: 'at://did:plc:owner123/pub.chive.eprint.submission/abc123',
    ownerDid: 'did:plc:owner123',
  };

  const defaultDetection: MigrationDetectionResult = {
    needsMigration: true,
    migrations: [
      {
        migration: {
          id: 'test-migration',
          fromVersion: '0.1.0',
          toVersion: '0.2.0',
          collection: 'pub.chive.eprint.submission',
          description: 'Test migration description',
          needsMigration: () => true,
          migrate: (x) => x,
        },
        affectedFields: ['abstract'],
        changeLabel: 'Abstract format',
      },
    ],
    affectedFields: ['abstract'],
    currentVersion: '0.1.0',
    targetVersion: '0.2.0',
  };

  const noMigrationDetection: MigrationDetectionResult = {
    needsMigration: false,
    migrations: [],
    affectedFields: [],
  };

  const mockOnMigrate = vi.fn().mockResolvedValue({
    success: true,
    record: {},
    steps: [],
    migrationsApplied: 1,
  } as MigrationResult);

  const mockOnReset = vi.fn();

  const defaultProps = {
    detection: defaultDetection,
    record: defaultRecord,
    currentUserDid: 'did:plc:owner123',
    canMigrate: true,
    onMigrate: mockOnMigrate,
    isPending: false,
    isSuccess: false,
    error: null,
    onReset: mockOnReset,
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('rendering', () => {
    it('renders banner when migration is needed and user can migrate', () => {
      render(<MigrationBanner {...defaultProps} />);

      expect(screen.getByText('Format Update Available')).toBeInTheDocument();
      expect(screen.getByText(/Your record uses an older format/)).toBeInTheDocument();
    });

    it('does not render when no migration is needed', () => {
      render(<MigrationBanner {...defaultProps} detection={noMigrationDetection} />);

      expect(screen.queryByText('Format Update Available')).not.toBeInTheDocument();
    });

    it('does not render when user cannot migrate', () => {
      render(<MigrationBanner {...defaultProps} canMigrate={false} />);

      expect(screen.queryByText('Format Update Available')).not.toBeInTheDocument();
    });

    it('shows affected fields', () => {
      render(<MigrationBanner {...defaultProps} />);

      expect(screen.getByText(/Fields to update:/)).toBeInTheDocument();
      expect(screen.getByText(/Abstract format/)).toBeInTheDocument();
    });

    it('shows multiple affected fields', () => {
      const multiFieldDetection: MigrationDetectionResult = {
        ...defaultDetection,
        migrations: [
          {
            migration: {
              id: 'migration-1',
              fromVersion: '0.1.0',
              toVersion: '0.2.0',
              collection: 'pub.chive.eprint.submission',
              description: 'Migration 1',
              needsMigration: () => true,
              migrate: (x) => x,
            },
            affectedFields: ['abstract'],
            changeLabel: 'Abstract format',
          },
          {
            migration: {
              id: 'migration-2',
              fromVersion: '0.1.0',
              toVersion: '0.2.0',
              collection: 'pub.chive.eprint.submission',
              description: 'Migration 2',
              needsMigration: () => true,
              migrate: (x) => x,
            },
            affectedFields: ['license'],
            changeLabel: 'License reference',
          },
        ],
      };

      render(<MigrationBanner {...defaultProps} detection={multiFieldDetection} />);

      expect(screen.getByText(/Abstract format/)).toBeInTheDocument();
      expect(screen.getByText(/License reference/)).toBeInTheDocument();
    });

    it('applies custom className', () => {
      render(<MigrationBanner {...defaultProps} className="custom-class" />);

      const alert = screen.getByRole('alert');
      expect(alert).toHaveClass('custom-class');
    });
  });

  describe('details expansion', () => {
    it('shows details when expanded', async () => {
      const user = userEvent.setup();
      render(<MigrationBanner {...defaultProps} />);

      // Initially details are hidden
      expect(screen.queryByText('Test migration description')).not.toBeInTheDocument();

      // Click to show details
      await user.click(screen.getByText('Show details'));

      expect(screen.getByText('Test migration description')).toBeInTheDocument();
    });

    it('hides details when collapsed', async () => {
      const user = userEvent.setup();
      render(<MigrationBanner {...defaultProps} />);

      // Expand details
      await user.click(screen.getByText('Show details'));
      expect(screen.getByText('Test migration description')).toBeInTheDocument();

      // Collapse details
      await user.click(screen.getByText('Hide details'));
      expect(screen.queryByText('Test migration description')).not.toBeInTheDocument();
    });
  });

  describe('migration action', () => {
    it('calls onMigrate when Update Now is clicked', async () => {
      const user = userEvent.setup();
      render(<MigrationBanner {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Update Now/i }));

      expect(mockOnMigrate).toHaveBeenCalledTimes(1);
    });

    it('calls onMigrationComplete callback on success', async () => {
      const onMigrationComplete = vi.fn();
      const user = userEvent.setup();

      render(<MigrationBanner {...defaultProps} onMigrationComplete={onMigrationComplete} />);

      await user.click(screen.getByRole('button', { name: /Update Now/i }));

      await waitFor(() => {
        expect(onMigrationComplete).toHaveBeenCalledTimes(1);
      });
    });

    it('shows loading state when isPending', () => {
      render(<MigrationBanner {...defaultProps} isPending={true} />);

      expect(screen.getByText('Updating...')).toBeInTheDocument();
      expect(screen.getByRole('button', { name: /Updating/i })).toBeDisabled();
    });
  });

  describe('success state', () => {
    it('shows success message when isSuccess', () => {
      render(<MigrationBanner {...defaultProps} isSuccess={true} />);

      expect(screen.getByText('Record Updated')).toBeInTheDocument();
      expect(
        screen.getByText(/Your record has been updated to the latest format/)
      ).toBeInTheDocument();
    });

    it('can dismiss success state', async () => {
      const user = userEvent.setup();
      render(<MigrationBanner {...defaultProps} isSuccess={true} />);

      await user.click(screen.getByRole('button', { name: /Dismiss/i }));

      expect(screen.queryByText('Record Updated')).not.toBeInTheDocument();
    });
  });

  describe('error state', () => {
    it('shows error message when error is set', () => {
      const error = new Error('Migration failed: Network error');
      render(<MigrationBanner {...defaultProps} error={error} />);

      expect(screen.getByText('Update Failed')).toBeInTheDocument();
      expect(screen.getByText('Migration failed: Network error')).toBeInTheDocument();
    });

    it('shows retry button in error state', () => {
      const error = new Error('Migration failed');
      render(<MigrationBanner {...defaultProps} error={error} />);

      expect(screen.getByRole('button', { name: /Try Again/i })).toBeInTheDocument();
    });

    it('calls onReset and onMigrate when retry is clicked', async () => {
      const error = new Error('Migration failed');
      const user = userEvent.setup();

      render(<MigrationBanner {...defaultProps} error={error} />);

      await user.click(screen.getByRole('button', { name: /Try Again/i }));

      expect(mockOnReset).toHaveBeenCalledTimes(1);
      expect(mockOnMigrate).toHaveBeenCalledTimes(1);
    });

    it('can dismiss error state', async () => {
      const error = new Error('Migration failed');
      const user = userEvent.setup();

      render(<MigrationBanner {...defaultProps} error={error} />);

      await user.click(screen.getByRole('button', { name: /Dismiss/i }));

      expect(screen.queryByText('Update Failed')).not.toBeInTheDocument();
      expect(mockOnReset).toHaveBeenCalledTimes(1);
    });
  });

  describe('dismiss action', () => {
    it('hides banner when dismiss is clicked', async () => {
      const user = userEvent.setup();
      render(<MigrationBanner {...defaultProps} />);

      expect(screen.getByText('Format Update Available')).toBeInTheDocument();

      await user.click(screen.getByRole('button', { name: /Dismiss/i }));

      expect(screen.queryByText('Format Update Available')).not.toBeInTheDocument();
    });

    it('calls onReset when dismiss is clicked', async () => {
      const user = userEvent.setup();
      render(<MigrationBanner {...defaultProps} />);

      await user.click(screen.getByRole('button', { name: /Dismiss/i }));

      expect(mockOnReset).toHaveBeenCalledTimes(1);
    });
  });
});

describe('MigrationBannerSkeleton', () => {
  it('renders skeleton with animation', () => {
    render(<MigrationBannerSkeleton />);

    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toBeInTheDocument();
  });

  it('applies custom className', () => {
    render(<MigrationBannerSkeleton className="custom-skeleton-class" />);

    const skeleton = document.querySelector('.animate-pulse');
    expect(skeleton).toHaveClass('custom-skeleton-class');
  });
});

#!/usr/bin/env npx tsx
/**
 * Alpha Tester Approval CLI
 *
 * Approves alpha applications and sends email notifications with Zulip invite link.
 *
 * Usage:
 *   pnpm tsx scripts/approve-alpha.ts <DID>
 *   pnpm tsx scripts/approve-alpha.ts --dry-run <DID>
 *   pnpm tsx scripts/approve-alpha.ts --skip-email <DID>
 *   pnpm tsx scripts/approve-alpha.ts --list
 *
 * Environment Variables:
 *   DATABASE_URL - PostgreSQL connection string (required)
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM - Email config
 *   ZULIP_INVITE_URL - Reusable Zulip invite link (for email)
 */

import pg from 'pg';

import {
  AlphaApplicationService,
  type AlphaApplication,
} from '../src/services/alpha/alpha-application-service.js';
import { EmailService, createEmailServiceFromEnv } from '../src/services/email/email-service.js';
import { renderAlphaApprovalEmail } from '../src/services/email/templates/alpha-approval.js';
import type { ILogger } from '../src/types/interfaces/logger.interface.js';

// Simple console logger
const logger: ILogger = {
  info: (message: string, context?: object) => {
    console.log(`[INFO] ${message}`, context ? JSON.stringify(context) : '');
  },
  warn: (message: string, context?: object) => {
    console.log(`[WARN] ${message}`, context ? JSON.stringify(context) : '');
  },
  error: (message: string, error?: Error) => {
    console.error(`[ERROR] ${message}`, error?.message ?? '');
    if (error?.stack) {
      console.error(error.stack);
    }
  },
  debug: (message: string, context?: object) => {
    if (process.env.DEBUG) {
      console.log(`[DEBUG] ${message}`, context ? JSON.stringify(context) : '');
    }
  },
  child: () => logger,
};

// Parse command line arguments
interface Args {
  dryRun: boolean;
  skipEmail: boolean;
  list: boolean;
  dids: string[];
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let dryRun = false;
  let skipEmail = false;
  let list = false;
  const dids: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--skip-email') {
      skipEmail = true;
    } else if (arg === '--list') {
      list = true;
    } else if (arg === '--help' || arg === '-h') {
      printUsage();
      process.exit(0);
    } else if (arg.startsWith('did:')) {
      dids.push(arg);
    } else if (!arg.startsWith('--')) {
      console.error(`Unknown argument: ${arg}`);
      printUsage();
      process.exit(1);
    }
  }

  if (!list && dids.length === 0) {
    printUsage();
    process.exit(1);
  }

  return { dryRun, skipEmail, list, dids };
}

function printUsage(): void {
  console.log(`
Alpha Tester Approval CLI

Usage:
  pnpm tsx scripts/approve-alpha.ts <DID> [<DID>...]
  pnpm tsx scripts/approve-alpha.ts --list

Options:
  --dry-run      Preview changes without making them
  --skip-email   Skip sending email notification
  --list         List all pending applications
  --help, -h     Show this help message

Examples:
  pnpm tsx scripts/approve-alpha.ts did:plc:abc123
  pnpm tsx scripts/approve-alpha.ts --dry-run did:plc:abc123
  pnpm tsx scripts/approve-alpha.ts --list
  pnpm tsx scripts/approve-alpha.ts did:plc:abc123 did:plc:def456

Environment Variables:
  DATABASE_URL                 PostgreSQL connection string (required)
  SMTP_HOST, SMTP_PORT,
  SMTP_USER, SMTP_PASSWORD,
  EMAIL_FROM                   Email configuration (optional)
  ZULIP_INVITE_URL             Reusable Zulip invite link (optional)
`);
}

function formatApplication(app: AlphaApplication): string {
  const lines = [
    `  DID:      ${app.did}`,
    `  Handle:   ${app.handle ?? '(none)'}`,
    `  Email:    ${app.email}`,
    `  Sector:   ${app.sector}${app.sectorOther ? ` (${app.sectorOther})` : ''}`,
    `  Career:   ${app.careerStage}${app.careerStageOther ? ` (${app.careerStageOther})` : ''}`,
    `  Field:    ${app.researchField}`,
    `  Applied:  ${app.createdAt.toISOString()}`,
  ];

  if (app.affiliation) {
    lines.push(
      `  Affiliation: ${app.affiliation.name}${app.affiliation.rorId ? ` (${app.affiliation.rorId})` : ''}`
    );
  }

  if (app.motivation) {
    lines.push(
      `  Motivation: ${app.motivation.substring(0, 100)}${app.motivation.length > 100 ? '...' : ''}`
    );
  }

  return lines.join('\n');
}

async function approveApplication(
  app: AlphaApplication,
  alphaService: AlphaApplicationService,
  emailService: EmailService | null,
  zulipInviteUrl: string | null,
  args: Args
): Promise<{ success: boolean; errors: string[] }> {
  const errors: string[] = [];

  console.log(`\nProcessing: ${app.did}`);
  console.log(formatApplication(app));

  if (args.dryRun) {
    console.log('  [DRY RUN] Would approve application');
    if (!args.skipEmail && emailService) {
      console.log(`  [DRY RUN] Would send approval email to ${app.email}`);
    }
    return { success: true, errors: [] };
  }

  // Step 1: Approve in database
  try {
    await alphaService.approve(app.did as `did:${string}`);
    console.log('  ✓ Application approved in database');
  } catch (error) {
    const msg = error instanceof Error ? error.message : String(error);
    errors.push(`Database: ${msg}`);
    console.error(`  ✗ Database error: ${msg}`);
    return { success: false, errors };
  }

  // Step 2: Send email notification (if enabled)
  if (!args.skipEmail) {
    if (emailService && zulipInviteUrl) {
      try {
        const emailContent = renderAlphaApprovalEmail({
          handle: app.handle,
          email: app.email,
          zulipInviteUrl,
        });
        await emailService.sendEmail({
          to: app.email,
          subject: emailContent.subject,
          html: emailContent.html,
          text: emailContent.text,
        });
        console.log(`  ✓ Approval email sent to ${app.email}`);
      } catch (error) {
        const msg = error instanceof Error ? error.message : String(error);
        errors.push(`Email: ${msg}`);
        console.error(`  ✗ Email error: ${msg}`);
      }
    } else if (!emailService) {
      console.log('  ⚠ Email not configured, skipping');
    } else if (!zulipInviteUrl) {
      console.log('  ⚠ ZULIP_INVITE_URL not configured, skipping email');
    }
  } else {
    console.log('  - Skipping email (--skip-email)');
  }

  return { success: errors.length === 0, errors };
}

async function main(): Promise<void> {
  const args = parseArgs();

  // Check for DATABASE_URL
  const databaseUrl = process.env.DATABASE_URL;
  if (!databaseUrl) {
    console.error('Error: DATABASE_URL environment variable is required');
    process.exit(1);
  }

  // Initialize database connection
  const pool = new pg.Pool({ connectionString: databaseUrl });

  try {
    // Test connection
    await pool.query('SELECT 1');
    console.log('Connected to database');
  } catch (error) {
    console.error('Failed to connect to database:', error);
    process.exit(1);
  }

  // Initialize services
  const alphaService = new AlphaApplicationService({ pool, logger });
  const emailService = createEmailServiceFromEnv(logger);
  const zulipInviteUrl = process.env.ZULIP_INVITE_URL ?? null;

  if (!zulipInviteUrl) {
    console.warn('Warning: ZULIP_INVITE_URL not set, emails will not include Zulip invite link');
  }

  // Verify email connection if configured
  if (emailService && !args.dryRun) {
    const emailOk = await emailService.verify();
    if (!emailOk) {
      console.warn('Warning: Email SMTP verification failed');
    }
  }

  try {
    // List mode
    if (args.list) {
      const pending = await alphaService.listPending();
      console.log(`\nPending Applications (${pending.length}):\n`);

      if (pending.length === 0) {
        console.log('No pending applications.');
      } else {
        for (const app of pending) {
          console.log(`${app.did}`);
          console.log(formatApplication(app));
          console.log('');
        }
      }
      return;
    }

    // Approval mode
    console.log(`\nApproving ${args.dids.length} application(s)...`);
    if (args.dryRun) {
      console.log('(DRY RUN - no changes will be made)\n');
    }

    let successCount = 0;
    let failCount = 0;
    const allErrors: { did: string; errors: string[] }[] = [];

    for (const did of args.dids) {
      const app = await alphaService.getByDid(did as `did:${string}`);

      if (!app) {
        console.error(`\n✗ Application not found: ${did}`);
        failCount++;
        allErrors.push({ did, errors: ['Application not found'] });
        continue;
      }

      if (app.status !== 'pending') {
        console.error(`\n✗ Application is not pending (status: ${app.status}): ${did}`);
        failCount++;
        allErrors.push({ did, errors: [`Application is ${app.status}`] });
        continue;
      }

      const result = await approveApplication(
        app,
        alphaService,
        emailService,
        zulipInviteUrl,
        args
      );

      if (result.success) {
        successCount++;
      } else {
        failCount++;
        allErrors.push({ did, errors: result.errors });
      }
    }

    // Summary
    console.log('\n' + '='.repeat(50));
    console.log('SUMMARY');
    console.log('='.repeat(50));
    console.log(`  Successful: ${successCount}`);
    console.log(`  Failed:     ${failCount}`);

    if (allErrors.length > 0) {
      console.log('\nErrors:');
      for (const { did, errors } of allErrors) {
        console.log(`  ${did}:`);
        for (const err of errors) {
          console.log(`    - ${err}`);
        }
      }
    }

    if (failCount > 0) {
      process.exit(1);
    }
  } finally {
    await pool.end();
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

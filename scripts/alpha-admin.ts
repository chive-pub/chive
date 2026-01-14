#!/usr/bin/env npx tsx
/**
 * Alpha Application Administration CLI
 *
 * Unified script for managing alpha tester applications.
 * Combines database operations with email notifications.
 *
 * Usage:
 *   pnpm tsx scripts/alpha-admin.ts <command> [options]
 *
 * Setup for local use (requires SSH tunnel):
 *   # Terminal 1: Start SSH tunnel (replace <SERVER_IP> and <SSH_KEY> with actual values)
 *   ssh -L 5432:localhost:5432 -L 6379:localhost:6379 -i ~/.ssh/<SSH_KEY> ubuntu@<SERVER_IP>
 *
 *   # Terminal 2: Run script
 *   DATABASE_URL="postgresql://chive:PASSWORD@localhost:5432/chive" \
 *   REDIS_URL="redis://localhost:6379" \
 *   pnpm tsx scripts/alpha-admin.ts list
 */

import fs from 'fs';
import pg from 'pg';
import { createClient, type RedisClientType } from 'redis';

import { AlphaApplicationService } from '../src/services/alpha/alpha-application-service.js';
import {
  createEmailServiceFromEnv,
  type EmailService,
} from '../src/services/email/email-service.js';
import { renderAlphaApprovalEmail } from '../src/services/email/templates/alpha-approval.js';
import type { ILogger } from '../src/types/interfaces/logger.interface.js';

// =============================================================================
// Types
// =============================================================================

interface AlphaApplication {
  id: number;
  did: string;
  handle: string | null;
  email: string;
  status: 'pending' | 'approved' | 'rejected' | 'revoked';
  sector: string;
  sectorOther: string | null;
  careerStage: string;
  careerStageOther: string | null;
  affiliation: { name: string; rorId?: string } | null;
  researchField: string;
  motivation: string | null;
  zulipInvited: boolean;
  reviewedAt: Date | null;
  reviewedBy: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// =============================================================================
// Logger
// =============================================================================

const logger: ILogger = {
  info: (message: string, context?: object) => {
    console.log(`[INFO] ${message}`, context ? JSON.stringify(context) : '');
  },
  warn: (message: string, context?: object) => {
    console.log(`[WARN] ${message}`, context ? JSON.stringify(context) : '');
  },
  error: (message: string, error?: Error) => {
    console.error(`[ERROR] ${message}`, error?.message ?? '');
  },
  debug: (message: string, context?: object) => {
    if (process.env.DEBUG) {
      console.log(`[DEBUG] ${message}`, context ? JSON.stringify(context) : '');
    }
  },
  child: () => logger,
};

// =============================================================================
// Colors
// =============================================================================

const colors = {
  red: (s: string) => `\x1b[31m${s}\x1b[0m`,
  green: (s: string) => `\x1b[32m${s}\x1b[0m`,
  yellow: (s: string) => `\x1b[33m${s}\x1b[0m`,
  blue: (s: string) => `\x1b[34m${s}\x1b[0m`,
  dim: (s: string) => `\x1b[2m${s}\x1b[0m`,
};

// =============================================================================
// Database Helpers
// =============================================================================

async function getApplication(pool: pg.Pool, did: string): Promise<AlphaApplication | null> {
  const result = await pool.query(
    `SELECT
      id, did, handle, email, status,
      sector, sector_other as "sectorOther",
      career_stage as "careerStage", career_stage_other as "careerStageOther",
      affiliation_name, affiliation_ror_id,
      research_field as "researchField", motivation,
      zulip_invited as "zulipInvited",
      reviewed_at as "reviewedAt", reviewed_by as "reviewedBy",
      created_at as "createdAt", updated_at as "updatedAt"
    FROM alpha_applications WHERE did = $1`,
    [did]
  );

  if (result.rows.length === 0) return null;

  const row = result.rows[0];
  return {
    ...row,
    affiliation: row.affiliation_name
      ? { name: row.affiliation_name, rorId: row.affiliation_ror_id }
      : null,
  };
}

async function listApplications(
  pool: pg.Pool,
  status?: string,
  limit = 50
): Promise<AlphaApplication[]> {
  const whereClause = status ? 'WHERE status = $1' : '';
  const params = status ? [status] : [];

  const result = await pool.query(
    `SELECT
      id, did, handle, email, status,
      sector, sector_other as "sectorOther",
      career_stage as "careerStage", career_stage_other as "careerStageOther",
      affiliation_name, affiliation_ror_id,
      research_field as "researchField", motivation,
      zulip_invited as "zulipInvited",
      reviewed_at as "reviewedAt", reviewed_by as "reviewedBy",
      created_at as "createdAt", updated_at as "updatedAt"
    FROM alpha_applications
    ${whereClause}
    ORDER BY created_at DESC
    LIMIT ${limit}`,
    params
  );

  return result.rows.map((row) => ({
    ...row,
    affiliation: row.affiliation_name
      ? { name: row.affiliation_name, rorId: row.affiliation_ror_id }
      : null,
  }));
}

async function updateStatus(
  pool: pg.Pool,
  did: string,
  status: string,
  reviewer: string
): Promise<void> {
  await pool.query(
    `UPDATE alpha_applications
     SET status = $1, reviewed_at = now(), reviewed_by = $2, updated_at = now()
     WHERE did = $3`,
    [status, reviewer, did]
  );
}

async function getStats(pool: pg.Pool): Promise<{
  byStatus: Record<string, number>;
  bySector: Record<string, number>;
  byCareerStage: Record<string, number>;
  recentByDay: { date: string; count: number }[];
}> {
  const [statusResult, sectorResult, careerResult, recentResult] = await Promise.all([
    pool.query(`SELECT status, COUNT(*)::int as count FROM alpha_applications GROUP BY status`),
    pool.query(
      `SELECT sector, COUNT(*)::int as count FROM alpha_applications GROUP BY sector ORDER BY count DESC`
    ),
    pool.query(
      `SELECT career_stage, COUNT(*)::int as count FROM alpha_applications GROUP BY career_stage ORDER BY count DESC`
    ),
    pool.query(`
      SELECT created_at::date as date, COUNT(*)::int as count
      FROM alpha_applications
      WHERE created_at > now() - interval '7 days'
      GROUP BY created_at::date
      ORDER BY date DESC
    `),
  ]);

  return {
    byStatus: Object.fromEntries(statusResult.rows.map((r) => [r.status, r.count])),
    bySector: Object.fromEntries(sectorResult.rows.map((r) => [r.sector, r.count])),
    byCareerStage: Object.fromEntries(careerResult.rows.map((r) => [r.career_stage, r.count])),
    recentByDay: recentResult.rows.map((r) => ({
      date: r.date.toISOString().split('T')[0],
      count: r.count,
    })),
  };
}

// =============================================================================
// Redis Helpers
// =============================================================================

async function addAlphaRole(redis: RedisClientType, did: string): Promise<void> {
  await redis.sAdd(`chive:authz:roles:${did}`, 'alpha-tester');
}

async function removeAlphaRole(redis: RedisClientType, did: string): Promise<void> {
  await redis.sRem(`chive:authz:roles:${did}`, 'alpha-tester');
}

// =============================================================================
// Formatters
// =============================================================================

function formatApplication(app: AlphaApplication, detailed = false): string {
  const lines = [
    `  ${colors.dim('DID:')}      ${app.did}`,
    `  ${colors.dim('Handle:')}   ${app.handle ?? '(none)'}`,
    `  ${colors.dim('Email:')}    ${app.email}`,
    `  ${colors.dim('Status:')}   ${formatStatus(app.status)}`,
    `  ${colors.dim('Sector:')}   ${app.sector}${app.sectorOther ? ` (${app.sectorOther})` : ''}`,
    `  ${colors.dim('Career:')}   ${app.careerStage}${app.careerStageOther ? ` (${app.careerStageOther})` : ''}`,
    `  ${colors.dim('Field:')}    ${app.researchField}`,
    `  ${colors.dim('Applied:')}  ${app.createdAt.toISOString().split('T')[0]}`,
  ];

  if (app.affiliation) {
    lines.push(
      `  ${colors.dim('Affiliation:')} ${app.affiliation.name}${app.affiliation.rorId ? ` (${app.affiliation.rorId})` : ''}`
    );
  }

  if (detailed) {
    if (app.motivation) {
      lines.push(`  ${colors.dim('Motivation:')} ${app.motivation}`);
    }
    if (app.reviewedAt) {
      lines.push(
        `  ${colors.dim('Reviewed:')}  ${app.reviewedAt.toISOString().split('T')[0]} by ${app.reviewedBy}`
      );
    }
    lines.push(`  ${colors.dim('Zulip:')}    ${app.zulipInvited ? 'Yes' : 'No'}`);
  } else if (app.motivation) {
    lines.push(
      `  ${colors.dim('Motivation:')} ${app.motivation.substring(0, 80)}${app.motivation.length > 80 ? '...' : ''}`
    );
  }

  return lines.join('\n');
}

function formatStatus(status: string): string {
  switch (status) {
    case 'pending':
      return colors.yellow(status);
    case 'approved':
      return colors.green(status);
    case 'rejected':
    case 'revoked':
      return colors.red(status);
    default:
      return status;
  }
}

// =============================================================================
// Commands
// =============================================================================

async function cmdList(pool: pg.Pool, status?: string): Promise<void> {
  const filterStatus = status || 'pending';
  const apps = await listApplications(pool, filterStatus);

  console.log(colors.blue(`\n=== Alpha Applications (${filterStatus}) ===\n`));

  if (apps.length === 0) {
    console.log('No applications found.\n');
    return;
  }

  for (const app of apps) {
    console.log(colors.blue(`${app.did}`));
    console.log(formatApplication(app));
    console.log('');
  }

  console.log(colors.dim(`Showing ${apps.length} application(s)\n`));
}

async function cmdShow(pool: pg.Pool, did: string): Promise<void> {
  const app = await getApplication(pool, did);

  if (!app) {
    console.error(colors.red(`\nApplication not found: ${did}\n`));
    process.exit(1);
  }

  console.log(colors.blue(`\n=== Application Details ===\n`));
  console.log(formatApplication(app, true));
  console.log('');
}

async function cmdApprove(
  pool: pg.Pool,
  redis: RedisClientType,
  emailService: EmailService | null,
  did: string,
  options: { dryRun: boolean; skipEmail: boolean; reviewer: string }
): Promise<void> {
  const app = await getApplication(pool, did);

  if (!app) {
    console.error(colors.red(`\nApplication not found: ${did}\n`));
    process.exit(1);
  }

  console.log(colors.blue(`\n=== Approving Application ===\n`));
  console.log(formatApplication(app));
  console.log('');

  if (app.status !== 'pending') {
    console.log(colors.yellow(`Warning: Application status is '${app.status}', not 'pending'\n`));
  }

  if (options.dryRun) {
    console.log(colors.yellow('[DRY RUN] Would approve application'));
    console.log(colors.yellow('[DRY RUN] Would add alpha-tester role to Redis'));
    if (!options.skipEmail && emailService) {
      console.log(colors.yellow(`[DRY RUN] Would send approval email to ${app.email}`));
    }
    console.log('');
    return;
  }

  // Update database
  await updateStatus(pool, did, 'approved', options.reviewer);
  console.log(colors.green('✓ Database updated'));

  // Add Redis role
  await addAlphaRole(redis, did);
  console.log(colors.green('✓ Redis role added'));

  // Send email
  if (!options.skipEmail) {
    const zulipInviteUrl = process.env.ZULIP_INVITE_URL;
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
        console.log(colors.green(`✓ Approval email sent to ${app.email}`));
      } catch (error) {
        console.error(
          colors.red(`✗ Email failed: ${error instanceof Error ? error.message : error}`)
        );
      }
    } else if (!emailService) {
      console.log(colors.yellow('⚠ Email not configured, skipping'));
    } else {
      console.log(colors.yellow('⚠ ZULIP_INVITE_URL not set, skipping email'));
    }
  } else {
    console.log(colors.dim('- Email skipped (--skip-email)'));
  }

  console.log('');
}

async function cmdReject(
  pool: pg.Pool,
  redis: RedisClientType,
  did: string,
  options: { dryRun: boolean; reviewer: string }
): Promise<void> {
  const app = await getApplication(pool, did);

  if (!app) {
    console.error(colors.red(`\nApplication not found: ${did}\n`));
    process.exit(1);
  }

  console.log(colors.blue(`\n=== Rejecting Application ===\n`));
  console.log(formatApplication(app));
  console.log('');

  if (options.dryRun) {
    console.log(colors.yellow('[DRY RUN] Would reject application'));
    console.log('');
    return;
  }

  await updateStatus(pool, did, 'rejected', options.reviewer);
  console.log(colors.green('✓ Database updated'));

  await removeAlphaRole(redis, did);
  console.log(colors.green('✓ Redis role removed (if existed)'));
  console.log('');
}

async function cmdRevoke(
  pool: pg.Pool,
  redis: RedisClientType,
  did: string,
  options: { dryRun: boolean; reviewer: string }
): Promise<void> {
  const app = await getApplication(pool, did);

  if (!app) {
    console.error(colors.red(`\nApplication not found: ${did}\n`));
    process.exit(1);
  }

  console.log(colors.blue(`\n=== Revoking Access ===\n`));
  console.log(formatApplication(app));
  console.log('');

  if (options.dryRun) {
    console.log(colors.yellow('[DRY RUN] Would revoke access'));
    console.log('');
    return;
  }

  await updateStatus(pool, did, 'revoked', options.reviewer);
  console.log(colors.green('✓ Database updated'));

  await removeAlphaRole(redis, did);
  console.log(colors.green('✓ Redis role removed'));
  console.log('');
}

async function cmdStats(pool: pg.Pool): Promise<void> {
  const stats = await getStats(pool);

  console.log(colors.blue(`\n=== Alpha Application Statistics ===\n`));

  console.log('Status breakdown:');
  for (const [status, count] of Object.entries(stats.byStatus)) {
    console.log(`  ${formatStatus(status)}: ${count}`);
  }

  console.log('\nBy sector:');
  for (const [sector, count] of Object.entries(stats.bySector)) {
    console.log(`  ${sector}: ${count}`);
  }

  console.log('\nBy career stage:');
  for (const [stage, count] of Object.entries(stats.byCareerStage)) {
    console.log(`  ${stage}: ${count}`);
  }

  if (stats.recentByDay.length > 0) {
    console.log('\nLast 7 days:');
    for (const { date, count } of stats.recentByDay) {
      console.log(`  ${date}: ${count}`);
    }
  }

  console.log('');
}

async function cmdExport(pool: pg.Pool, filename: string): Promise<void> {
  const apps = await listApplications(pool, undefined, 10000);

  const headers = [
    'id',
    'did',
    'handle',
    'email',
    'status',
    'sector',
    'sector_other',
    'career_stage',
    'career_stage_other',
    'affiliation_name',
    'affiliation_ror_id',
    'research_field',
    'motivation',
    'zulip_invited',
    'reviewed_at',
    'reviewed_by',
    'created_at',
    'updated_at',
  ];

  const rows = apps.map((app) => [
    app.id,
    app.did,
    app.handle ?? '',
    app.email,
    app.status,
    app.sector,
    app.sectorOther ?? '',
    app.careerStage,
    app.careerStageOther ?? '',
    app.affiliation?.name ?? '',
    app.affiliation?.rorId ?? '',
    app.researchField,
    app.motivation ?? '',
    app.zulipInvited,
    app.reviewedAt?.toISOString() ?? '',
    app.reviewedBy ?? '',
    app.createdAt.toISOString(),
    app.updatedAt.toISOString(),
  ]);

  const csvContent = [
    headers.join(','),
    ...rows.map((row) =>
      row
        .map((cell) =>
          typeof cell === 'string' &&
          (cell.includes(',') || cell.includes('"') || cell.includes('\n'))
            ? `"${cell.replace(/"/g, '""')}"`
            : cell
        )
        .join(',')
    ),
  ].join('\n');

  fs.writeFileSync(filename, csvContent);
  console.log(colors.green(`\n✓ Exported ${apps.length} applications to ${filename}\n`));
}

// =============================================================================
// Main
// =============================================================================

function printUsage(): void {
  console.log(`
${colors.blue('Alpha Application Administration CLI')}

${colors.dim('Usage:')}
  pnpm tsx scripts/alpha-admin.ts <command> [options]

${colors.dim('Commands:')}
  list [status]           List applications (default: pending)
  show <DID>              Show detailed application info
  approve <DID>           Approve application and send email
  reject <DID>            Reject application
  revoke <DID>            Revoke previously approved access
  stats                   Show application statistics
  export [filename]       Export to CSV (default: alpha_applications.csv)

${colors.dim('Options:')}
  --dry-run               Preview changes without applying
  --skip-email            Skip sending approval email
  --reviewer <name>       Set reviewer name (default: admin)

${colors.dim('Environment Variables:')}
  DATABASE_URL            PostgreSQL connection (required)
  REDIS_URL               Redis connection (required)
  SMTP_HOST, SMTP_PORT,
  SMTP_USER, SMTP_PASSWORD,
  EMAIL_FROM              Email configuration (for approval emails)
  ZULIP_INVITE_URL        Zulip invite link (for approval emails)

${colors.dim('Local Setup (requires SSH tunnel):')}
  # Terminal 1: Start tunnel (replace <SERVER_IP> and <SSH_KEY>)
  ssh -L 5432:localhost:5432 -L 6379:localhost:6379 \\
      -i ~/.ssh/<SSH_KEY> ubuntu@<SERVER_IP>

  # Terminal 2: Run commands
  DATABASE_URL="postgresql://chive:PASSWORD@localhost:5432/chive" \\
  REDIS_URL="redis://localhost:6379" \\
  pnpm tsx scripts/alpha-admin.ts list

${colors.dim('Examples:')}
  pnpm tsx scripts/alpha-admin.ts list
  pnpm tsx scripts/alpha-admin.ts list approved
  pnpm tsx scripts/alpha-admin.ts show did:plc:abc123
  pnpm tsx scripts/alpha-admin.ts approve did:plc:abc123
  pnpm tsx scripts/alpha-admin.ts approve --dry-run did:plc:abc123
  pnpm tsx scripts/alpha-admin.ts approve --skip-email did:plc:abc123
  pnpm tsx scripts/alpha-admin.ts stats
  pnpm tsx scripts/alpha-admin.ts export applications.csv
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  if (args.length === 0 || args[0] === '--help' || args[0] === '-h') {
    printUsage();
    process.exit(0);
  }

  // Parse options
  let dryRun = false;
  let skipEmail = false;
  let reviewer = 'admin';
  const positional: string[] = [];

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--skip-email') {
      skipEmail = true;
    } else if (arg === '--reviewer' && args[i + 1]) {
      reviewer = args[++i];
    } else if (!arg.startsWith('--')) {
      positional.push(arg);
    }
  }

  const command = positional[0];
  const commandArg = positional[1];

  // Check required env vars
  const databaseUrl = process.env.DATABASE_URL;
  const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';

  if (!databaseUrl) {
    console.error(colors.red('\nError: DATABASE_URL environment variable is required\n'));
    process.exit(1);
  }

  // Connect to databases
  const pool = new pg.Pool({ connectionString: databaseUrl });
  let redis: RedisClientType | null = null;

  try {
    await pool.query('SELECT 1');
    console.log(colors.dim('Connected to PostgreSQL'));
  } catch (error) {
    console.error(colors.red(`\nFailed to connect to PostgreSQL: ${error}\n`));
    process.exit(1);
  }

  // Commands that need Redis
  const needsRedis = ['approve', 'reject', 'revoke'].includes(command);
  if (needsRedis) {
    try {
      redis = createClient({ url: redisUrl });
      await redis.connect();
      console.log(colors.dim('Connected to Redis'));
    } catch (error) {
      console.error(colors.red(`\nFailed to connect to Redis: ${error}\n`));
      process.exit(1);
    }
  }

  // Initialize email service for approve command
  const emailService = command === 'approve' ? createEmailServiceFromEnv(logger) : null;

  try {
    switch (command) {
      case 'list':
        await cmdList(pool, commandArg);
        break;

      case 'show':
        if (!commandArg) {
          console.error(colors.red('\nError: DID required\n'));
          console.log('Usage: alpha-admin.ts show <DID>\n');
          process.exit(1);
        }
        await cmdShow(pool, commandArg);
        break;

      case 'approve':
        if (!commandArg) {
          console.error(colors.red('\nError: DID required\n'));
          console.log('Usage: alpha-admin.ts approve <DID>\n');
          process.exit(1);
        }
        await cmdApprove(pool, redis!, emailService, commandArg, { dryRun, skipEmail, reviewer });
        break;

      case 'reject':
        if (!commandArg) {
          console.error(colors.red('\nError: DID required\n'));
          console.log('Usage: alpha-admin.ts reject <DID>\n');
          process.exit(1);
        }
        await cmdReject(pool, redis!, commandArg, { dryRun, reviewer });
        break;

      case 'revoke':
        if (!commandArg) {
          console.error(colors.red('\nError: DID required\n'));
          console.log('Usage: alpha-admin.ts revoke <DID>\n');
          process.exit(1);
        }
        await cmdRevoke(pool, redis!, commandArg, { dryRun, reviewer });
        break;

      case 'stats':
        await cmdStats(pool);
        break;

      case 'export':
        await cmdExport(pool, commandArg || 'alpha_applications.csv');
        break;

      default:
        console.error(colors.red(`\nUnknown command: ${command}\n`));
        printUsage();
        process.exit(1);
    }
  } finally {
    await pool.end();
    if (redis) {
      await redis.quit();
    }
  }
}

main().catch((error) => {
  console.error(colors.red(`\nFatal error: ${error}\n`));
  process.exit(1);
});

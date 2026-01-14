#!/usr/bin/env npx tsx
/**
 * Test Email and Zulip Services
 *
 * Usage:
 *   pnpm tsx scripts/test-services.ts --email    # Test email only
 *   pnpm tsx scripts/test-services.ts --zulip    # Test Zulip only
 *   pnpm tsx scripts/test-services.ts --all      # Test both
 *
 * Environment Variables:
 *   SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM
 *   ZULIP_SERVER_URL, ZULIP_BOT_EMAIL, ZULIP_BOT_API_KEY
 *   TEST_EMAIL - Email address to send test email to
 */

import { createEmailServiceFromEnv } from '../src/services/email/email-service.js';
import { createZulipServiceFromEnv } from '../src/services/zulip/zulip-service.js';
import type { ILogger } from '../src/types/interfaces/logger.interface.js';

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
  debug: () => {},
  child: () => logger,
};

async function testEmail(): Promise<boolean> {
  console.log('\n=== Testing Email Service ===\n');

  const emailService = createEmailServiceFromEnv(logger);
  if (!emailService) {
    console.error('Email service not configured. Missing environment variables:');
    console.error('  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM');
    return false;
  }

  console.log('Email service created. Verifying SMTP connection...');

  const verified = await emailService.verify();
  if (!verified) {
    console.error('SMTP verification failed. Check credentials.');
    return false;
  }

  console.log('✓ SMTP connection verified!\n');

  const testEmail = process.env.TEST_EMAIL;
  if (testEmail) {
    console.log(`Sending test email to ${testEmail}...`);
    try {
      await emailService.sendEmail({
        to: testEmail,
        subject: 'Chive Email Test',
        html: `
          <h1>Email Test Successful!</h1>
          <p>This is a test email from the Chive alpha tester approval system.</p>
          <p>Sent at: ${new Date().toISOString()}</p>
        `,
        text: 'Email Test Successful! This is a test email from the Chive alpha tester approval system.',
      });
      console.log('✓ Test email sent successfully!');
      return true;
    } catch (error) {
      console.error('Failed to send test email:', error);
      return false;
    }
  } else {
    console.log('Set TEST_EMAIL env var to send a test email.');
    console.log('SMTP connection verified but no test email sent.');
    return true;
  }
}

async function testZulip(): Promise<boolean> {
  console.log('\n=== Testing Zulip Service ===\n');

  const zulipService = createZulipServiceFromEnv(logger);
  if (!zulipService) {
    console.error('Zulip service not configured. Missing environment variables:');
    console.error('  ZULIP_SERVER_URL, ZULIP_BOT_EMAIL, ZULIP_BOT_API_KEY');
    return false;
  }

  console.log('Zulip service created. Testing API connection...');
  console.log(`Server: ${process.env.ZULIP_SERVER_URL}`);
  console.log(`Bot: ${process.env.ZULIP_BOT_EMAIL}`);

  // Try to get info about a non-existent user to test API auth
  try {
    const exists = await zulipService.userExists('test-nonexistent-user@example.com');
    console.log(`✓ API connection successful! (test user exists: ${exists})`);
    return true;
  } catch (error) {
    console.error('Failed to connect to Zulip API:', error);
    return false;
  }
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  const testEmailFlag = args.includes('--email') || args.includes('--all');
  const testZulipFlag = args.includes('--zulip') || args.includes('--all');

  if (!testEmailFlag && !testZulipFlag) {
    console.log('Usage:');
    console.log('  pnpm tsx scripts/test-services.ts --email    # Test email only');
    console.log('  pnpm tsx scripts/test-services.ts --zulip    # Test Zulip only');
    console.log('  pnpm tsx scripts/test-services.ts --all      # Test both');
    console.log('');
    console.log('Environment variables:');
    console.log('  SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASSWORD, EMAIL_FROM');
    console.log('  ZULIP_SERVER_URL, ZULIP_BOT_EMAIL, ZULIP_BOT_API_KEY');
    console.log('  TEST_EMAIL - (optional) Email to send test message to');
    process.exit(1);
  }

  let success = true;

  if (testZulipFlag) {
    const zulipOk = await testZulip();
    if (!zulipOk) success = false;
  }

  if (testEmailFlag) {
    const emailOk = await testEmail();
    if (!emailOk) success = false;
  }

  console.log('\n' + '='.repeat(40));
  if (success) {
    console.log('All tests passed!');
  } else {
    console.log('Some tests failed. Check output above.');
    process.exit(1);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

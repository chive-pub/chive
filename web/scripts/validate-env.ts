/**
 * Build-time environment validation script.
 *
 * @remarks
 * Validates that required environment variables are set at build time.
 * This prevents deployment of builds with missing configuration.
 *
 * Usage:
 *   npx tsx web/scripts/validate-env.ts
 *
 * @packageDocumentation
 */

/**
 * Required environment variables that must be set at build time.
 * The build will fail if any of these are missing.
 */
const REQUIRED_VARS = ['NEXT_PUBLIC_API_URL'] as const;

/**
 * Optional environment variables that enhance functionality.
 * Warnings are logged if these are missing, but the build continues.
 */
const OPTIONAL_VARS = ['NEXT_PUBLIC_SENTRY_DSN', 'NEXT_PUBLIC_OTEL_ENDPOINT'] as const;

/**
 * Validates that required environment variables are set.
 * Exits with code 1 if any required variables are missing.
 */
function validateEnvironment(): void {
  const missing: string[] = [];

  for (const varName of REQUIRED_VARS) {
    if (!process.env[varName]) {
      missing.push(varName);
    }
  }

  if (missing.length > 0) {
    console.error('\n========================================');
    console.error('ERROR: Missing required environment variables');
    console.error('========================================\n');
    for (const varName of missing) {
      console.error(`  - ${varName}`);
    }
    console.error('\nThese variables must be set at build time.');
    console.error(
      'Example: docker build --build-arg NEXT_PUBLIC_API_URL=https://example.com/api\n'
    );
    process.exit(1);
  }

  // Log warnings for missing optional vars
  for (const varName of OPTIONAL_VARS) {
    if (!process.env[varName]) {
      console.warn(`[WARN] Optional environment variable ${varName} not set`);
    }
  }

  console.log('\n========================================');
  console.log('Environment validation passed');
  console.log('========================================\n');
  console.log(`  NEXT_PUBLIC_API_URL: ${process.env.NEXT_PUBLIC_API_URL}`);
  console.log('');
}

validateEnvironment();

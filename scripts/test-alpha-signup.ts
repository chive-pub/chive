#!/usr/bin/env npx tsx
/**
 * Standalone script to test alpha signup form with Playwright.
 *
 * Usage: pnpm tsx scripts/test-alpha-signup.ts
 */

import { chromium } from '@playwright/test';

const USER = {
  did: 'did:plc:34mbm5v3umztwvvgnttvcz6e',
  handle: 'aaronstevenwhite.io',
  displayName: 'Aaron Steven White',
  email: 'aaron.white@rochester.edu',
  sector: 'academia',
  careerStage: 'senior-faculty',
  researchField: 'Linguistics / Computational Semantics',
  affiliation: 'University of Rochester',
  motivation: 'Testing the alpha signup flow with Playwright.',
};

async function main() {
  console.log('Launching browser...');
  const browser = await chromium.launch({ headless: false, slowMo: 500 });
  const context = await browser.newContext();
  const page = await context.newPage();

  try {
    // Go to landing page
    console.log('Navigating to http://localhost:3000...');
    await page.goto('http://localhost:3000');
    await page.waitForLoadState('domcontentloaded');

    // Set up authentication
    console.log('Setting up authentication...');
    const sessionMetadata = {
      did: USER.did,
      handle: USER.handle,
      displayName: USER.displayName,
      avatar: null,
      pdsEndpoint: 'https://bsky.social',
      createdAt: Date.now(),
      lastActivity: Date.now(),
    };

    await page.evaluate((metadata) => {
      localStorage.setItem('chive_session_metadata', JSON.stringify(metadata));
      localStorage.setItem('chive_e2e_skip_oauth', 'true');
    }, sessionMetadata);

    await context.addCookies([
      {
        name: 'chive_auth_state',
        value: 'authenticated',
        domain: 'localhost',
        path: '/',
        httpOnly: false,
        secure: false,
        sameSite: 'Lax',
      },
    ]);

    // Reload and go to apply page
    console.log('Going to /apply...');
    await page.goto('http://localhost:3000/apply');
    await page.waitForLoadState('networkidle');

    // Check current URL
    const url = page.url();
    console.log(`Current URL: ${url}`);

    if (url.includes('/pending')) {
      console.log('User already has a pending application!');
      await page.waitForTimeout(3000);
      await browser.close();
      return;
    }

    if (url.includes('/dashboard')) {
      console.log('User is already approved!');
      await page.waitForTimeout(3000);
      await browser.close();
      return;
    }

    // Fill the form
    console.log('Filling form...');

    // Email
    const emailInput = page.getByRole('textbox', { name: /email/i });
    await emailInput.fill(USER.email);
    console.log('  - Email filled');

    // Sector
    const sectorSelect = page.getByRole('combobox', { name: /sector/i });
    await sectorSelect.click();
    await page.getByRole('option', { name: /academia/i }).click();
    console.log('  - Sector selected');

    // Career stage
    const careerSelect = page.getByRole('combobox', { name: /career/i });
    await careerSelect.click();
    await page.getByRole('option', { name: /senior.*faculty/i }).click();
    console.log('  - Career stage selected');

    // Research field
    const fieldInput = page.getByRole('textbox', { name: /research.*field/i });
    await fieldInput.fill(USER.researchField);
    console.log('  - Research field filled');

    // Affiliation (optional)
    const affiliationInput = page.getByRole('textbox', { name: /affiliation/i });
    if (await affiliationInput.isVisible()) {
      await affiliationInput.fill(USER.affiliation);
      console.log('  - Affiliation filled');
    }

    // Motivation (optional)
    const motivationInput = page.getByRole('textbox', { name: /motivation/i });
    if (await motivationInput.isVisible()) {
      await motivationInput.fill(USER.motivation);
      console.log('  - Motivation filled');
    }

    console.log('Form filled! Submitting...');

    // Submit
    const submitButton = page.getByRole('button', { name: /submit|apply/i });
    await submitButton.click();

    // Wait for navigation
    await page.waitForURL(/\/(pending|apply|dashboard)/, { timeout: 10000 });

    const finalUrl = page.url();
    console.log(`Final URL: ${finalUrl}`);

    if (finalUrl.includes('/pending')) {
      console.log('✓ Application submitted successfully!');
    } else {
      console.log('Submission may have failed. Check the page.');
    }

    // Keep browser open for inspection
    console.log('Keeping browser open for 10 seconds...');
    await page.waitForTimeout(10000);
  } catch (error) {
    console.error('Error:', error);
    await page.screenshot({ path: 'error-screenshot.png' });
    console.log('Screenshot saved to error-screenshot.png');
    await page.waitForTimeout(5000);
  } finally {
    await browser.close();
  }
}

main().catch(console.error);

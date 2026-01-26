#!/usr/bin/env npx tsx
/**
 * Bluesky Thread Posting CLI
 *
 * Posts thread files to the @chive.pub Bluesky account.
 *
 * Usage:
 *   pnpm tsx scripts/bluesky-post.ts notes/bluesky-threads/thread1-features.txt
 *   pnpm tsx scripts/bluesky-post.ts --dry-run notes/bluesky-threads/thread1-features.txt
 *   pnpm tsx scripts/bluesky-post.ts --delay 5 notes/bluesky-threads/thread1-features.txt
 *   pnpm tsx scripts/bluesky-post.ts --quote at://did:plc:.../app.bsky.feed.post/xyz notes/bluesky-threads/deep-dive-01.txt
 *
 * Environment Variables:
 *   CHIVE_PDS_URL - PDS URL (default: https://bsky.social)
 *   CHIVE_HANDLE - Bluesky handle (required)
 *   CHIVE_APP_PASSWORD - App password for authentication (required)
 */

import { AtpAgent, RichText, AppBskyFeedPost } from '@atproto/api';
import * as fs from 'fs';
import * as path from 'path';

// Parse command line arguments
interface Args {
  dryRun: boolean;
  delay: number;
  quoteUri?: string;
  threadFile: string;
}

function parseArgs(): Args {
  const args = process.argv.slice(2);
  let dryRun = false;
  let delay = 2; // Default 2 second delay between posts
  let quoteUri: string | undefined;
  let threadFile = '';

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (!arg) continue;
    if (arg === '--dry-run') {
      dryRun = true;
    } else if (arg === '--delay') {
      const delayArg = args[++i];
      delay = parseInt(delayArg ?? '', 10);
      if (isNaN(delay) || delay < 0) {
        console.error('Error: --delay must be a non-negative number');
        process.exit(1);
      }
    } else if (arg === '--quote') {
      quoteUri = args[++i];
      if (!quoteUri || !quoteUri.startsWith('at://')) {
        console.error('Error: --quote must be followed by an AT-URI (at://...)');
        process.exit(1);
      }
    } else if (!arg.startsWith('--')) {
      threadFile = arg;
    }
  }

  if (!threadFile) {
    console.error('Usage: pnpm tsx scripts/bluesky-post.ts [options] <thread-file>');
    console.error('Options:');
    console.error('  --dry-run         Preview posts without sending');
    console.error('  --delay <seconds> Delay between posts (default: 2)');
    console.error('  --quote <at-uri>  Quote-repost this URI in the first post');
    process.exit(1);
  }

  return { dryRun, delay, quoteUri, threadFile };
}

// Parse thread file into individual posts
interface ThreadPost {
  number: number;
  total: number;
  title?: string;
  text: string;
}

function parseThreadFile(filePath: string): ThreadPost[] {
  const content = fs.readFileSync(filePath, 'utf-8');
  const lines = content.split('\n');
  const posts: ThreadPost[] = [];

  let currentPost: ThreadPost | null = null;
  let currentLines: string[] = [];

  // Skip the thread title line (e.g., "THREAD 1: HIGH-LEVEL FEATURES")
  let startParsing = false;

  for (const line of lines) {
    // Match post headers like "1/14:" or "1/14: Title"
    const headerMatch = line.match(/^(\d+)\/(\d+):(.*)$/);

    if (headerMatch) {
      // Save previous post if exists
      if (currentPost !== null) {
        currentPost.text = currentLines.join('\n').trim();
        if (currentPost.text) {
          posts.push(currentPost);
        }
      }

      const num = headerMatch[1];
      const total = headerMatch[2];
      const titlePart = headerMatch[3];
      if (!num || !total) continue;
      currentPost = {
        number: parseInt(num, 10),
        total: parseInt(total, 10),
        title: titlePart?.trim() || undefined,
        text: '',
      };
      currentLines = [];
      startParsing = true;
    } else if (startParsing && currentPost !== null) {
      currentLines.push(line);
    }
  }

  // Save last post
  if (currentPost !== null) {
    currentPost.text = currentLines.join('\n').trim();
    if (currentPost.text) {
      posts.push(currentPost);
    }
  }

  return posts;
}

// Sleep helper
function sleep(seconds: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, seconds * 1000));
}

// Create a single post
async function createPost(
  agent: AtpAgent,
  text: string,
  replyTo?: { uri: string; cid: string },
  quoteEmbed?: { uri: string; cid: string }
): Promise<{ uri: string; cid: string }> {
  const rt = new RichText({ text });
  await rt.detectFacets(agent);

  const record: AppBskyFeedPost.Record = {
    $type: 'app.bsky.feed.post',
    text: rt.text,
    facets: rt.facets,
    createdAt: new Date().toISOString(),
  };

  // Add reply reference if this is part of a thread
  if (replyTo) {
    record.reply = {
      root: replyTo, // For threads, root is the first post
      parent: replyTo, // Parent is the post we're replying to
    };
  }

  // Add quote embed if provided
  if (quoteEmbed) {
    record.embed = {
      $type: 'app.bsky.embed.record',
      record: quoteEmbed,
    };
  }

  const response = await agent.com.atproto.repo.createRecord({
    repo: agent.session!.did,
    collection: 'app.bsky.feed.post',
    record,
  });

  return {
    uri: response.data.uri,
    cid: response.data.cid,
  };
}

// Fetch CID for a quote URI
async function getCidForUri(agent: AtpAgent, uri: string): Promise<string> {
  // Parse AT-URI: at://did:plc:xxx/app.bsky.feed.post/rkey
  const match = uri.match(/^at:\/\/([^/]+)\/([^/]+)\/([^/]+)$/);
  if (!match) {
    throw new Error(`Invalid AT-URI: ${uri}`);
  }

  const repo = match[1];
  const collection = match[2];
  const rkey = match[3];
  if (!repo || !collection || !rkey) {
    throw new Error(`Invalid AT-URI format: ${uri}`);
  }

  const response = await agent.com.atproto.repo.getRecord({
    repo,
    collection,
    rkey,
  });

  if (!response.data.cid) {
    throw new Error(`Record has no CID: ${uri}`);
  }

  return response.data.cid;
}

// Main
async function main() {
  const args = parseArgs();

  // Load environment variables
  const pdsUrl = process.env.CHIVE_PDS_URL || 'https://bsky.social';
  const handle = process.env.CHIVE_HANDLE;
  const appPassword = process.env.CHIVE_APP_PASSWORD;

  if (!args.dryRun && (!handle || !appPassword)) {
    console.error('Error: CHIVE_HANDLE and CHIVE_APP_PASSWORD environment variables are required');
    console.error('Set them in your environment or .env file');
    process.exit(1);
  }

  // Resolve thread file path
  const threadFilePath = path.isAbsolute(args.threadFile)
    ? args.threadFile
    : path.join(process.cwd(), args.threadFile);

  if (!fs.existsSync(threadFilePath)) {
    console.error(`Error: Thread file not found: ${threadFilePath}`);
    process.exit(1);
  }

  // Parse thread
  console.log(`Parsing thread file: ${args.threadFile}`);
  const posts = parseThreadFile(threadFilePath);

  if (posts.length === 0) {
    console.error('Error: No posts found in thread file');
    process.exit(1);
  }

  console.log(`Found ${posts.length} posts\n`);

  // Dry run - just show what would be posted
  if (args.dryRun) {
    console.log('=== DRY RUN MODE ===\n');
    for (const post of posts) {
      console.log(`--- Post ${post.number}/${post.total} ---`);
      if (post.title) {
        console.log(`Title: ${post.title}`);
      }
      console.log(post.text);
      console.log(`\nCharacters: ${post.text.length}`);
      if (post.text.length > 300) {
        console.log(`WARNING: Post exceeds 300 character limit!`);
      }
      console.log('');
    }

    if (args.quoteUri) {
      console.log(`Quote URI: ${args.quoteUri} (would be embedded in first post)`);
    }

    console.log('=== END DRY RUN ===');
    return;
  }

  // Authenticate - handle and appPassword are validated above for non-dry-run
  console.log(`Connecting to PDS: ${pdsUrl}`);
  const agent = new AtpAgent({ service: pdsUrl });

  if (!handle || !appPassword) {
    throw new Error('CHIVE_HANDLE and CHIVE_APP_PASSWORD are required');
  }

  try {
    await agent.login({
      identifier: handle,
      password: appPassword,
    });
    if (!agent.session) {
      throw new Error('Login succeeded but no session was created');
    }
    console.log(`Authenticated as: ${agent.session.handle} (${agent.session.did})\n`);
  } catch (error) {
    console.error('Authentication failed:', error);
    process.exit(1);
  }

  // Resolve quote CID if needed
  let quoteEmbed: { uri: string; cid: string } | undefined;
  if (args.quoteUri) {
    console.log(`Resolving quote URI: ${args.quoteUri}`);
    try {
      const cid = await getCidForUri(agent, args.quoteUri);
      quoteEmbed = { uri: args.quoteUri, cid };
      console.log(`Quote CID: ${cid}\n`);
    } catch (error) {
      console.error('Failed to resolve quote URI:', error);
      process.exit(1);
    }
  }

  // Post thread
  const postedUris: { uri: string; cid: string }[] = [];
  let rootPost: { uri: string; cid: string } | undefined;
  const session = agent.session;
  if (!session) {
    throw new Error('No session available');
  }

  for (let i = 0; i < posts.length; i++) {
    const post = posts[i];
    if (!post) continue;
    const isFirst = i === 0;
    const replyTo = isFirst ? undefined : postedUris[i - 1];

    // First post gets quote embed if specified
    const embedForThisPost = isFirst ? quoteEmbed : undefined;

    console.log(`Posting ${post.number}/${post.total}...`);

    try {
      const result = await createPost(
        agent,
        post.text,
        replyTo && rootPost ? { ...replyTo, ...rootPost } : undefined,
        embedForThisPost
      );

      // For threading, we need to track root and parent separately
      if (isFirst) {
        rootPost = result;
      }

      postedUris.push(result);

      const rkey = result.uri.split('/').pop();
      const postUrl = `https://bsky.app/profile/${session.handle}/post/${rkey}`;
      console.log(`  Posted: ${postUrl}`);

      // Delay before next post (except for last one)
      if (i < posts.length - 1 && args.delay > 0) {
        console.log(`  Waiting ${args.delay}s...`);
        await sleep(args.delay);
      }
    } catch (error) {
      console.error(`  Failed to post ${post.number}/${post.total}:`, error);
      console.error('\nPosted URIs so far:');
      for (const p of postedUris) {
        console.error(`  ${p.uri}`);
      }
      process.exit(1);
    }
  }

  console.log('\n=== Thread Posted Successfully ===');
  if (rootPost) {
    console.log(
      `\nThread URL: https://bsky.app/profile/${session.handle}/post/${rootPost.uri.split('/').pop()}`
    );
  }
  console.log('\nAll post URIs:');
  for (const [i, postedUri] of postedUris.entries()) {
    console.log(`  ${i + 1}. ${postedUri.uri}`);
  }
}

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});

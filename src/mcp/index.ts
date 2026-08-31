#!/usr/bin/env node
/**
 * Executable entry point for the Chive MCP server.
 *
 * @packageDocumentation
 */

import { main } from './server.js';

main().catch((error: unknown) => {
  // stderr, not stdout: stdout carries the MCP protocol, and writing anything
  // else there corrupts the stream the client is parsing.
  process.stderr.write(`chive-mcp failed to start: ${String(error)}\n`);
  process.exit(1);
});

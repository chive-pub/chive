'use client';

/**
 * Error log component for debug panel.
 *
 * @packageDocumentation
 */

import { useState } from 'react';
import { ChevronRight, ChevronDown } from 'lucide-react';

import type { LogEntry } from '@/lib/observability';

interface ErrorLogProps {
  logs: LogEntry[];
}

/**
 * Displays error and warning logs.
 */
export function ErrorLog({ logs }: ErrorLogProps) {
  // Filter to only error/warn logs
  const errorLogs = logs.filter((log) => log.level === 'error' || log.level === 'warn');

  if (errorLogs.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">No errors yet</p>;
  }

  return (
    <div className="space-y-1">
      {errorLogs
        .slice()
        .reverse()
        .map((log, index) => (
          <ErrorRow key={index} log={log} />
        ))}
    </div>
  );
}

function ErrorRow({ log }: { log: LogEntry }) {
  const [expanded, setExpanded] = useState(false);

  const time = log.time.split('T')[1]?.slice(0, 12) ?? log.time;
  const isError = log.level === 'error';
  const errorDetails = log.err as { type?: string; message?: string; stack?: string } | undefined;

  return (
    <div
      className={`rounded text-xs ${
        isError ? 'bg-red-50 dark:bg-red-950/20' : 'bg-yellow-50 dark:bg-yellow-950/20'
      }`}
    >
      <button
        onClick={() => setExpanded(!expanded)}
        className="flex w-full items-center gap-2 px-2 py-1.5 text-left"
      >
        {expanded ? (
          <ChevronDown className="h-3 w-3 text-muted-foreground" />
        ) : (
          <ChevronRight className="h-3 w-3 text-muted-foreground" />
        )}
        <span className="text-muted-foreground">{time}</span>
        <span className={`font-medium uppercase ${isError ? 'text-red-600' : 'text-yellow-600'}`}>
          {log.level}
        </span>
        <span className="flex-1 truncate">{log.msg}</span>
      </button>

      {expanded && (
        <div className="border-t border-dashed px-2 py-2">
          {errorDetails && (
            <div className="space-y-1">
              {errorDetails.type && (
                <p>
                  <span className="text-muted-foreground">Type:</span>{' '}
                  <span className="font-mono">{errorDetails.type}</span>
                </p>
              )}
              {errorDetails.message && (
                <p>
                  <span className="text-muted-foreground">Message:</span>{' '}
                  <span>{errorDetails.message}</span>
                </p>
              )}
              {errorDetails.stack && (
                <pre className="mt-2 max-h-32 overflow-auto rounded bg-muted p-2 text-[10px]">
                  {errorDetails.stack}
                </pre>
              )}
            </div>
          )}
          {!errorDetails && (
            <pre className="max-h-32 overflow-auto rounded bg-muted p-2 text-[10px]">
              {JSON.stringify(log, null, 2)}
            </pre>
          )}
        </div>
      )}
    </div>
  );
}

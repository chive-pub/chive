'use client';

/**
 * Request log component for debug panel.
 *
 * @packageDocumentation
 */

import type { LogEntry } from '@/lib/observability';

interface RequestLogProps {
  logs: LogEntry[];
}

/**
 * Displays API request logs.
 */
export function RequestLog({ logs }: RequestLogProps) {
  // Filter to only request-related logs
  const requestLogs = logs.filter(
    (log) =>
      typeof log.msg === 'string' &&
      (log.msg.includes('API request') || log.msg.includes('request'))
  );

  if (requestLogs.length === 0) {
    return <p className="py-4 text-center text-xs text-muted-foreground">No requests yet</p>;
  }

  return (
    <div className="space-y-1">
      {requestLogs
        .slice()
        .reverse()
        .map((log, index) => (
          <RequestRow key={index} log={log} />
        ))}
    </div>
  );
}

function RequestRow({ log }: { log: LogEntry }) {
  const time = log.time.split('T')[1]?.slice(0, 12) ?? log.time;
  const endpoint = (log.endpoint as string) ?? 'unknown';
  const method = (log.method as string) ?? 'GET';
  const status = log.status as number | undefined;
  const durationMs = log.durationMs as number | undefined;

  const isError = log.level === 'error' || log.level === 'warn';
  const isCompleted = log.msg?.toString().includes('completed');

  const statusColor = status
    ? status >= 500
      ? 'text-red-600'
      : status >= 400
        ? 'text-yellow-600'
        : 'text-green-600'
    : '';

  return (
    <div
      className={`flex items-center gap-2 rounded px-2 py-1.5 text-xs ${
        isError ? 'bg-red-50 dark:bg-red-950/20' : 'hover:bg-muted/50'
      }`}
    >
      <span className="text-muted-foreground">{time}</span>
      <span className="w-10 font-mono text-muted-foreground">{method}</span>
      <span className="flex-1 truncate font-mono">{endpoint}</span>
      {status && <span className={`font-medium ${statusColor}`}>{status}</span>}
      {durationMs !== undefined && <span className="text-muted-foreground">{durationMs}ms</span>}
      {!isCompleted && !isError && <span className="animate-pulse text-muted-foreground">...</span>}
    </div>
  );
}

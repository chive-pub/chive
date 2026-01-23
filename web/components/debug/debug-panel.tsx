'use client';

/**
 * Development-only debug panel.
 *
 * @remarks
 * Floating panel that shows recent API requests, errors, and logs.
 * Only rendered in development mode.
 *
 * @packageDocumentation
 */

import { useState, useEffect } from 'react';
import { Bug, X, ChevronUp, ChevronDown, Trash2 } from 'lucide-react';

import { Button } from '@/components/ui/button';
import { getLogBuffer, clearLogBuffer, type LogEntry } from '@/lib/observability';

import { RequestLog } from './request-log';
import { ErrorLog } from './error-log';

/**
 * Debug panel tabs.
 */
type DebugTab = 'requests' | 'errors' | 'all';

/**
 * Development debug panel component.
 *
 * @remarks
 * Shows recent API activity and errors for debugging.
 * Only visible in development mode.
 */
export function DebugPanel() {
  const [isOpen, setIsOpen] = useState(false);
  const [isMinimized, setIsMinimized] = useState(false);
  const [activeTab, setActiveTab] = useState<DebugTab>('requests');
  const [logs, setLogs] = useState<LogEntry[]>([]);

  // Refresh logs periodically when panel is open
  useEffect(() => {
    // Only run in development
    if (process.env.NODE_ENV !== 'development') return;
    if (!isOpen) return;

    const updateLogs = () => {
      setLogs([...getLogBuffer()]);
    };

    updateLogs();
    const interval = setInterval(updateLogs, 1000);

    return () => clearInterval(interval);
  }, [isOpen]);

  // Only render in development
  if (process.env.NODE_ENV !== 'development') {
    return null;
  }

  const handleClear = () => {
    clearLogBuffer();
    setLogs([]);
  };

  // Filter logs by tab
  const filteredLogs = logs.filter((log) => {
    if (activeTab === 'all') return true;
    if (activeTab === 'errors') return log.level === 'error' || log.level === 'warn';
    if (activeTab === 'requests') {
      return (
        typeof log.msg === 'string' &&
        (log.msg.includes('API request') || log.msg.includes('request'))
      );
    }
    return true;
  });

  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className="fixed bottom-4 right-4 z-50 flex h-10 w-10 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-lg transition-transform hover:scale-105"
        title="Open debug panel"
      >
        <Bug className="h-5 w-5" />
      </button>
    );
  }

  return (
    <div
      className={`fixed bottom-4 right-4 z-50 flex flex-col rounded-lg border bg-background shadow-xl transition-all ${
        isMinimized ? 'h-12 w-64' : 'h-96 w-[32rem]'
      }`}
    >
      {/* Header */}
      <div className="flex items-center justify-between border-b px-3 py-2">
        <div className="flex items-center gap-2">
          <Bug className="h-4 w-4 text-primary" />
          <span className="text-sm font-medium">Debug Panel</span>
          <span className="rounded bg-muted px-1.5 py-0.5 text-xs text-muted-foreground">
            {logs.length}
          </span>
        </div>
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={handleClear}
            title="Clear logs"
          >
            <Trash2 className="h-3.5 w-3.5" />
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsMinimized(!isMinimized)}
            title={isMinimized ? 'Expand' : 'Minimize'}
          >
            {isMinimized ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </Button>
          <Button
            variant="ghost"
            size="icon"
            className="h-7 w-7"
            onClick={() => setIsOpen(false)}
            title="Close"
          >
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      </div>

      {!isMinimized && (
        <>
          {/* Tabs */}
          <div className="flex border-b">
            {(['requests', 'errors', 'all'] as const).map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-3 py-1.5 text-xs font-medium transition-colors ${
                  activeTab === tab
                    ? 'border-b-2 border-primary text-primary'
                    : 'text-muted-foreground hover:text-foreground'
                }`}
              >
                {tab.charAt(0).toUpperCase() + tab.slice(1)}
              </button>
            ))}
          </div>

          {/* Content */}
          <div className="flex-1 overflow-auto p-2">
            {activeTab === 'requests' && <RequestLog logs={filteredLogs} />}
            {activeTab === 'errors' && <ErrorLog logs={filteredLogs} />}
            {activeTab === 'all' && (
              <div className="space-y-1">
                {filteredLogs
                  .slice()
                  .reverse()
                  .map((log, index) => (
                    <LogEntryRow key={index} log={log} />
                  ))}
                {filteredLogs.length === 0 && (
                  <p className="py-4 text-center text-xs text-muted-foreground">No logs yet</p>
                )}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/**
 * Single log entry row for the "All" tab.
 */
function LogEntryRow({ log }: { log: LogEntry }) {
  const levelColors: Record<string, string> = {
    debug: 'text-muted-foreground',
    info: 'text-blue-600',
    warn: 'text-yellow-600',
    error: 'text-red-600',
  };

  const time = log.time.split('T')[1]?.slice(0, 12) ?? log.time;

  return (
    <div className="flex items-start gap-2 rounded px-2 py-1 text-xs hover:bg-muted/50">
      <span className="text-muted-foreground">{time}</span>
      <span className={`font-medium uppercase ${levelColors[log.level] ?? ''}`}>
        {log.level.slice(0, 4)}
      </span>
      <span className="flex-1 truncate">{log.msg}</span>
    </div>
  );
}

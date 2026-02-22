"use client";

import { useEffect, useRef, useMemo } from "react";
import { X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { formatScriptName } from "@/lib/utils/format";
import type { ProgressEvent } from "@/hooks/use-container-progress";

interface LogViewerProps {
  logs: ProgressEvent[];
  /** When set, only show logs from this script */
  selectedScript?: string | null;
  /** Callback to clear the script filter */
  onClearFilter?: () => void;
}

export function LogViewer({
  logs,
  selectedScript,
  onClearFilter,
}: LogViewerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const shouldAutoScroll = useRef(true);

  // Filter logs by script name when a filter is active
  const filteredLogs = useMemo(() => {
    if (!selectedScript) return logs;
    return logs.filter((log) => log.scriptName === selectedScript);
  }, [logs, selectedScript]);

  // Track if user is scrolled to bottom
  function handleScroll() {
    const el = containerRef.current;
    if (!el) return;
    // Auto-scroll if within 40px of the bottom
    shouldAutoScroll.current =
      el.scrollHeight - el.scrollTop - el.clientHeight < 40;
  }

  // Auto-scroll on new logs
  useEffect(() => {
    const el = containerRef.current;
    if (el && shouldAutoScroll.current) {
      el.scrollTop = el.scrollHeight;
    }
  }, [filteredLogs.length]);

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium">Logs</h3>
        {selectedScript && (
          <div className="flex items-center gap-2">
            <Badge variant="secondary" className="text-xs font-normal">
              Filtered: {formatScriptName(selectedScript)}
            </Badge>
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={onClearFilter}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" />
              <span className="sr-only">Clear filter</span>
            </Button>
          </div>
        )}
      </div>
      <div
        ref={containerRef}
        onScroll={handleScroll}
        className="max-h-[400px] min-h-[200px] overflow-y-auto rounded-lg border bg-zinc-950 p-4 font-mono text-xs leading-relaxed"
      >
        {filteredLogs.length === 0 ? (
          <p className="text-zinc-500 italic">
            {selectedScript
              ? "No logs for this script yet..."
              : "Waiting for logs..."}
          </p>
        ) : (
          filteredLogs.map((log, index) => (
            <div key={index} className="flex gap-2">
              <span className="shrink-0 select-none text-zinc-600">
                {formatTimestamp(log.timestamp)}
              </span>
              <span className="text-zinc-300">{log.message}</span>
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function formatTimestamp(iso: string): string {
  try {
    const date = new Date(iso);
    return date.toLocaleTimeString(undefined, {
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
  } catch {
    return "";
  }
}

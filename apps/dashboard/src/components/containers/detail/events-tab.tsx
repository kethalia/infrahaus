"use client";

import { useState } from "react";
import {
  CheckCircle2,
  XCircle,
  Play,
  Square,
  AlertTriangle,
  Cog,
  Clock,
  History,
  ChevronDown,
  ChevronRight,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";

// ============================================================================
// Types
// ============================================================================

interface EventInfo {
  id: string;
  type: string;
  message: string;
  metadata: string | null;
  createdAt: Date;
}

interface EventsTabProps {
  events: EventInfo[];
}

// ============================================================================
// Event type config
// ============================================================================

const eventTypeConfig: Record<
  string,
  {
    icon: React.ElementType;
    color: string;
    label: string;
  }
> = {
  created: {
    icon: CheckCircle2,
    color: "text-blue-500",
    label: "Created",
  },
  started: {
    icon: Play,
    color: "text-emerald-500",
    label: "Started",
  },
  stopped: {
    icon: Square,
    color: "text-gray-500",
    label: "Stopped",
  },
  error: {
    icon: XCircle,
    color: "text-red-500",
    label: "Error",
  },
  service_ready: {
    icon: Cog,
    color: "text-purple-500",
    label: "Service Ready",
  },
  script_completed: {
    icon: CheckCircle2,
    color: "text-teal-500",
    label: "Script Done",
  },
};

const defaultEventConfig = {
  icon: AlertTriangle,
  color: "text-yellow-500",
  label: "Event",
};

// ============================================================================
// Events Tab
// ============================================================================

export function EventsTab({ events }: EventsTabProps) {
  const [filter, setFilter] = useState<string | null>(null);

  // Get unique event types
  const eventTypes = Array.from(new Set(events.map((e) => e.type)));

  // Filter events
  const filteredEvents = filter
    ? events.filter((e) => e.type === filter)
    : events;

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2 text-lg">
              <History className="size-4" />
              Events
            </CardTitle>
            <CardDescription>
              {events.length > 0
                ? `${events.length} event${events.length !== 1 ? "s" : ""} recorded`
                : "No events recorded yet"}
            </CardDescription>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {events.length === 0 ? (
          <div className="text-muted-foreground flex flex-col items-center justify-center py-12 text-center">
            <History className="mb-3 size-8 opacity-30" />
            <p className="text-sm">No events yet</p>
            <p className="mt-1 text-xs">
              Events will appear as the container lifecycle progresses.
            </p>
          </div>
        ) : (
          <>
            {/* Filter buttons */}
            {eventTypes.length > 1 && (
              <div className="mb-4 flex flex-wrap gap-1.5">
                <Button
                  variant={filter === null ? "default" : "outline"}
                  size="sm"
                  onClick={() => setFilter(null)}
                >
                  All ({events.length})
                </Button>
                {eventTypes.map((type) => {
                  const conf = eventTypeConfig[type] ?? defaultEventConfig;
                  const count = events.filter((e) => e.type === type).length;
                  return (
                    <Button
                      key={type}
                      variant={filter === type ? "default" : "outline"}
                      size="sm"
                      onClick={() => setFilter(filter === type ? null : type)}
                    >
                      {conf.label} ({count})
                    </Button>
                  );
                })}
              </div>
            )}

            {/* Timeline */}
            <div className="relative space-y-0">
              {/* Vertical line */}
              <div className="border-muted absolute top-2 bottom-2 left-3 border-l-2" />

              {filteredEvents.map((event) => (
                <EventRow key={event.id} event={event} />
              ))}
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

// ============================================================================
// EventRow Sub-component
// ============================================================================

function EventRow({ event }: { event: EventInfo }) {
  const [expanded, setExpanded] = useState(false);
  const conf = eventTypeConfig[event.type] ?? defaultEventConfig;
  const Icon = conf.icon;

  const hasMetadata = event.metadata !== null;

  // Format relative timestamp
  const timeAgo = formatRelativeTime(event.createdAt);

  // Parse metadata
  let metadata: Record<string, unknown> | null = null;
  if (hasMetadata) {
    try {
      metadata = JSON.parse(event.metadata!) as Record<string, unknown>;
    } catch {
      metadata = null;
    }
  }

  return (
    <div className="relative flex gap-3 py-2 pl-1">
      {/* Icon */}
      <div
        className={`bg-background z-10 flex size-6 shrink-0 items-center justify-center rounded-full ${conf.color}`}
      >
        <Icon className="size-3.5" />
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <p className="text-sm">{event.message}</p>
            <div className="mt-0.5 flex items-center gap-2">
              <Badge variant="outline" className="text-xs">
                {conf.label}
              </Badge>
              <span className="text-muted-foreground flex items-center gap-1 text-xs">
                <Clock className="size-3" />
                {timeAgo}
              </span>
            </div>
          </div>

          {/* Expand metadata */}
          {metadata && (
            <Button
              variant="ghost"
              size="icon-xs"
              onClick={() => setExpanded(!expanded)}
            >
              {expanded ? (
                <ChevronDown className="size-3.5" />
              ) : (
                <ChevronRight className="size-3.5" />
              )}
            </Button>
          )}
        </div>

        {/* Expanded metadata */}
        {expanded && metadata && (
          <div className="mt-2 rounded-md bg-zinc-950 p-3 font-mono text-xs">
            <pre className="overflow-x-auto text-zinc-300">
              {JSON.stringify(metadata, null, 2)}
            </pre>
          </div>
        )}
      </div>
    </div>
  );
}

// ============================================================================
// Helpers
// ============================================================================

function formatRelativeTime(date: Date): string {
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffSec = Math.floor(diffMs / 1000);

  if (diffSec < 60) return "just now";
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHour = Math.floor(diffMin / 60);
  if (diffHour < 24) return `${diffHour}h ago`;
  const diffDay = Math.floor(diffHour / 24);
  if (diffDay < 30) return `${diffDay}d ago`;
  return date.toLocaleDateString();
}

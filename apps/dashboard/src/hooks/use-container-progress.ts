"use client";

import { useState, useEffect, useCallback, useRef, useMemo } from "react";

// ============================================================================
// Types
// ============================================================================

export type ConnectionStatus =
  | "connecting"
  | "connected"
  | "disconnected"
  | "error";

export type StepName =
  | "creating"
  | "starting"
  | "deploying"
  | "syncing"
  | "finalizing";

export type EventType = "step" | "log" | "complete" | "error";

export interface ProgressEvent {
  type: EventType;
  step?: StepName;
  percent?: number;
  message: string;
  timestamp: string;

  // Script-tracking fields (Phase 4 only)
  scriptName?: string;
  scriptIndex?: number;
  scriptTotal?: number;
  scriptNames?: string[];
}

export interface StepInfo {
  name: StepName;
  label: string;
  status: "pending" | "active" | "completed" | "error";
}

export interface ScriptInfo {
  name: string;
  index: number;
  status: "pending" | "running" | "completed" | "error";
}

const PIPELINE_STEPS: { name: StepName; label: string }[] = [
  { name: "creating", label: "Creating Container" },
  { name: "starting", label: "Starting Container" },
  { name: "deploying", label: "Deploying Config" },
  { name: "syncing", label: "Running Scripts" },
  { name: "finalizing", label: "Finalizing" },
];

// ============================================================================
// Hook
// ============================================================================

export function useContainerProgress(containerId: string) {
  const [events, setEvents] = useState<ProgressEvent[]>([]);
  const [status, setStatus] = useState<ConnectionStatus>("connecting");
  const [currentStep, setCurrentStep] = useState<StepName | null>(null);
  const [percent, setPercent] = useState(0);
  const [isComplete, setIsComplete] = useState(false);
  const [isError, setIsError] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [seenSteps, setSeenSteps] = useState<Set<StepName>>(new Set());
  const eventSourceRef = useRef<EventSource | null>(null);

  // Script tracking state
  const [scriptNames, setScriptNames] = useState<string[]>([]);
  const [activeScript, setActiveScript] = useState<string | null>(null);
  const [completedScripts, setCompletedScripts] = useState<Set<string>>(
    new Set(),
  );

  const processEvent = useCallback((event: ProgressEvent) => {
    setEvents((prev) => [...prev, event]);

    switch (event.type) {
      case "step":
        if (event.step) {
          setCurrentStep(event.step);
          setSeenSteps((prev) => new Set(prev).add(event.step!));
        }
        if (event.percent != null) setPercent(event.percent);

        // Script tracking: Phase 4 start event carries all script names
        if (event.scriptNames && event.scriptNames.length > 0) {
          setScriptNames(event.scriptNames);
        }

        // Script tracking: script completion
        if (event.scriptName && event.step === "syncing") {
          setCompletedScripts((prev) => new Set(prev).add(event.scriptName!));
          // Clear active script if it was the one that just completed
          setActiveScript((prev) => (prev === event.scriptName ? null : prev));
        }
        break;

      case "log":
        // Script tracking: first log for a script = it's now running
        if (event.scriptName) {
          setActiveScript(event.scriptName);
        }
        break;

      case "complete":
        setIsComplete(true);
        setPercent(100);
        setSeenSteps(new Set(PIPELINE_STEPS.map((s) => s.name)));
        setActiveScript(null);
        break;

      case "error":
        setIsError(true);
        setErrorMessage(event.message);
        break;
    }
  }, []);

  useEffect(() => {
    const url = `/api/containers/${containerId}/progress`;
    const eventSource = new EventSource(url);
    eventSourceRef.current = eventSource;

    eventSource.addEventListener("open", () => {
      setStatus("connected");
    });

    // Snapshot event — server sends a single state summary from persisted events
    eventSource.addEventListener("snapshot", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as {
          step: StepName | null;
          percent: number;
          seenSteps: StepName[];
          isComplete: boolean;
          isError: boolean;
          errorMessage: string | null;
          // Script snapshot fields
          scriptNames?: string[];
          completedScripts?: string[];
          activeScript?: string | null;
          scriptTotal?: number;
        };
        if (data.step) setCurrentStep(data.step);
        setPercent(data.percent);
        setSeenSteps(new Set(data.seenSteps));
        if (data.isComplete) setIsComplete(true);
        if (data.isError) {
          setIsError(true);
          setErrorMessage(data.errorMessage);
        }

        // Hydrate script state from snapshot
        if (data.scriptNames && data.scriptNames.length > 0) {
          setScriptNames(data.scriptNames);
        }
        if (data.completedScripts && data.completedScripts.length > 0) {
          setCompletedScripts(new Set(data.completedScripts));
        }
        if (data.activeScript) {
          setActiveScript(data.activeScript);
        }
      } catch {
        // Ignore invalid JSON
      }
    });

    eventSource.addEventListener("progress", (e: MessageEvent) => {
      try {
        const data = JSON.parse(e.data) as ProgressEvent;
        processEvent(data);
      } catch {
        // Ignore invalid JSON
      }
    });

    eventSource.addEventListener("done", () => {
      setStatus("disconnected");
      eventSource.close();
    });

    eventSource.addEventListener("heartbeat", () => {
      // Keep-alive, nothing to do
    });

    eventSource.addEventListener("error", () => {
      // EventSource auto-reconnects, but if it fails repeatedly
      // we mark as error. The browser handles retry automatically.
      if (eventSource.readyState === EventSource.CLOSED) {
        setStatus("error");
      }
    });

    return () => {
      eventSource.close();
      eventSourceRef.current = null;
    };
  }, [containerId, processEvent]);

  // Derive step statuses from explicitly seen steps
  const steps: StepInfo[] = PIPELINE_STEPS.map((step) => {
    let stepStatus: StepInfo["status"] = "pending";

    if (isError && step.name === currentStep) {
      stepStatus = "error";
    } else if (step.name === currentStep && !isComplete) {
      stepStatus = "active";
    } else if (seenSteps.has(step.name)) {
      // Only mark as completed if we've actually received an event for this step
      stepStatus =
        step.name === currentStep && !isComplete ? "active" : "completed";
    }

    return {
      name: step.name,
      label: step.label,
      status: stepStatus,
    };
  });

  // Derive per-script state from script tracking
  const scripts: ScriptInfo[] = useMemo(() => {
    return scriptNames.map((name, index) => {
      let scriptStatus: ScriptInfo["status"] = "pending";

      if (completedScripts.has(name)) {
        scriptStatus = "completed";
      } else if (activeScript === name) {
        scriptStatus = isError ? "error" : "running";
      }

      return { name, index, status: scriptStatus };
    });
  }, [scriptNames, completedScripts, activeScript, isError]);

  // Filter logs (type === "log") for the log viewer
  const logs = events.filter((e) => e.type === "log");

  return {
    events,
    status,
    currentStep,
    percent,
    isComplete,
    isError,
    errorMessage,
    steps,
    logs,
    // Script tracking
    scripts,
    activeScript,
  };
}

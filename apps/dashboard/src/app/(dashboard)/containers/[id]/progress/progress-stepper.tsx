"use client";

import { CheckCircle2, Circle, Loader2, XCircle } from "lucide-react";
import { cn } from "@/lib/utils";
import { formatScriptName } from "@/lib/utils/format";
import type { StepInfo, ScriptInfo } from "@/hooks/use-container-progress";

interface ProgressStepperProps {
  steps: StepInfo[];
  percent: number;
  scripts: ScriptInfo[];
  onScriptClick?: (scriptName: string | null) => void;
  selectedScript?: string | null;
}

export function ProgressStepper({
  steps,
  percent,
  scripts,
  onScriptClick,
  selectedScript,
}: ProgressStepperProps) {
  const completedCount = scripts.filter((s) => s.status === "completed").length;
  const showScripts = scripts.length > 0;

  return (
    <div className="space-y-4">
      {/* Overall progress bar */}
      <div className="space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">Overall Progress</span>
          <span className="font-medium">{percent}%</span>
        </div>
        <div className="bg-secondary h-2 w-full overflow-hidden rounded-full">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500 ease-out",
              percent === 100 ? "bg-green-500" : "bg-primary",
            )}
            style={{ width: `${percent}%` }}
          />
        </div>
      </div>

      {/* Phase steps */}
      <nav aria-label="Creation progress">
        <ol className="space-y-2">
          {steps.map((step, index) => {
            const isLast = index === steps.length - 1;
            const isSyncing = step.name === "syncing";
            const showScriptList =
              isSyncing &&
              showScripts &&
              (step.status === "active" ||
                step.status === "completed" ||
                step.status === "error");

            return (
              <li key={step.name}>
                <div className="flex items-start gap-3">
                  {/* Step icon */}
                  <div className="flex flex-col items-center">
                    <StepIcon status={step.status} />
                    {!isLast && !showScriptList && (
                      <div
                        className={cn(
                          "mt-1 h-4 w-0.5",
                          step.status === "completed"
                            ? "bg-green-500"
                            : step.status === "error"
                              ? "bg-destructive"
                              : "bg-muted-foreground/20",
                        )}
                      />
                    )}
                  </div>

                  {/* Step label */}
                  <span
                    className={cn(
                      "text-sm font-medium",
                      step.status === "active" && "text-primary",
                      step.status === "completed" &&
                        "text-green-600 dark:text-green-400",
                      step.status === "error" && "text-destructive",
                      step.status === "pending" && "text-muted-foreground",
                    )}
                  >
                    {step.label}
                    {isSyncing && showScripts && (
                      <span className="text-muted-foreground ml-2 text-xs font-normal">
                        ({completedCount}/{scripts.length})
                      </span>
                    )}
                    {step.status === "active" && !isSyncing && (
                      <span className="text-muted-foreground ml-2 text-xs">
                        In progress...
                      </span>
                    )}
                  </span>
                </div>

                {/* Inline script sub-list */}
                {showScriptList && (
                  <div className="ml-2.5 mt-1 mb-1">
                    <div
                      className={cn(
                        "border-l-2 pl-5 space-y-0.5",
                        step.status === "completed"
                          ? "border-green-500"
                          : step.status === "error"
                            ? "border-destructive"
                            : "border-muted-foreground/20",
                      )}
                    >
                      {scripts.map((script) => (
                        <button
                          key={script.name}
                          type="button"
                          onClick={() =>
                            onScriptClick?.(
                              selectedScript === script.name
                                ? null
                                : script.name,
                            )
                          }
                          className={cn(
                            "flex w-full items-center gap-2 rounded-sm px-1.5 py-0.5 text-left text-xs transition-colors",
                            "hover:bg-accent/50",
                            selectedScript === script.name && "bg-accent",
                          )}
                        >
                          <ScriptIcon status={script.status} />
                          <span
                            className={cn(
                              "truncate",
                              script.status === "completed" &&
                                "text-green-600 dark:text-green-400",
                              script.status === "running" &&
                                "text-primary font-medium",
                              script.status === "error" && "text-destructive",
                              script.status === "pending" &&
                                "text-muted-foreground",
                            )}
                          >
                            {formatScriptName(script.name)}
                          </span>
                        </button>
                      ))}
                    </div>
                    {/* Connector to next step */}
                    {!isLast && (
                      <div className="flex justify-start pl-0">
                        <div
                          className={cn(
                            "mt-1 h-4 w-0.5",
                            step.status === "completed"
                              ? "bg-green-500"
                              : step.status === "error"
                                ? "bg-destructive"
                                : "bg-muted-foreground/20",
                          )}
                        />
                      </div>
                    )}
                  </div>
                )}
              </li>
            );
          })}
        </ol>
      </nav>
    </div>
  );
}

function StepIcon({ status }: { status: StepInfo["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="size-5 text-green-500" />;
    case "active":
      return <Loader2 className="text-primary size-5 animate-spin" />;
    case "error":
      return <XCircle className="text-destructive size-5" />;
    case "pending":
    default:
      return <Circle className="text-muted-foreground/30 size-5" />;
  }
}

function ScriptIcon({ status }: { status: ScriptInfo["status"] }) {
  switch (status) {
    case "completed":
      return <CheckCircle2 className="size-3.5 shrink-0 text-green-500" />;
    case "running":
      return (
        <Loader2 className="text-primary size-3.5 shrink-0 animate-spin" />
      );
    case "error":
      return <XCircle className="text-destructive size-3.5 shrink-0" />;
    case "pending":
    default:
      return <Circle className="text-muted-foreground/30 size-3.5 shrink-0" />;
  }
}

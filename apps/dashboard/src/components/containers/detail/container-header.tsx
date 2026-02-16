"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  Play,
  Square,
  Power,
  RotateCcw,
  Trash2,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";
import Link from "next/link";
import { useAction } from "next-safe-action/hooks";

import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { StatusBadge } from "@/components/containers/status-badge";
import type { ContainerStatus } from "@/lib/containers/data";
import {
  startContainerAction,
  stopContainerAction,
  shutdownContainerAction,
  restartContainerAction,
  deleteContainerAction,
} from "@/lib/containers/actions";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface ContainerHeaderProps {
  containerId: string;
  hostname: string | null;
  vmid: number;
  status: ContainerStatus;
  proxmoxReachable: boolean;
}

export function ContainerHeader({
  containerId,
  hostname,
  vmid,
  status,
  proxmoxReachable,
}: ContainerHeaderProps) {
  const router = useRouter();
  const [confirmDialog, setConfirmDialog] = useState<
    "start" | "shutdown" | "stop" | "delete" | null
  >(null);

  const displayName = hostname ?? `CT ${vmid}`;
  const isProxmoxUnreachable = !proxmoxReachable;

  const { execute: executeStart, isPending: isStarting } = useAction(
    startContainerAction,
    {
      onSuccess: () => {
        toast.success(`${displayName} started`);
      },
      onError: ({ error }) => {
        toast.error(`Failed to start ${displayName}`, {
          description: error.serverError ?? "An unexpected error occurred",
        });
      },
    },
  );

  const { execute: executeStop, isPending: isStopping } = useAction(
    stopContainerAction,
    {
      onSuccess: () => {
        toast.success(`${displayName} stopped`);
      },
      onError: ({ error }) => {
        toast.error(`Failed to stop ${displayName}`, {
          description: error.serverError ?? "An unexpected error occurred",
        });
      },
    },
  );

  const { execute: executeShutdown, isPending: isShuttingDown } = useAction(
    shutdownContainerAction,
    {
      onSuccess: () => {
        toast.success(`${displayName} shut down`);
      },
      onError: ({ error }) => {
        toast.error(`Failed to shut down ${displayName}`, {
          description: error.serverError ?? "An unexpected error occurred",
        });
      },
    },
  );

  const { execute: executeRestart, isPending: isRestarting } = useAction(
    restartContainerAction,
    {
      onSuccess: () => {
        toast.success(`${displayName} restarted`);
      },
      onError: ({ error }) => {
        toast.error(`Failed to restart ${displayName}`, {
          description: error.serverError ?? "An unexpected error occurred",
        });
      },
    },
  );

  const { execute: executeDelete, isPending: isDeleting } = useAction(
    deleteContainerAction,
    {
      onSuccess: () => {
        toast.success(`${displayName} deleted`);
        router.push("/");
      },
      onError: ({ error }) => {
        toast.error(`Failed to delete ${displayName}`, {
          description: error.serverError ?? "An unexpected error occurred",
        });
      },
    },
  );

  const isPending =
    isStarting || isStopping || isShuttingDown || isRestarting || isDeleting;

  function handleStart() {
    setConfirmDialog(null);
    executeStart({ containerId });
  }

  function handleStop() {
    setConfirmDialog(null);
    executeStop({ containerId });
  }

  function handleShutdown() {
    setConfirmDialog(null);
    executeShutdown({ containerId });
  }

  function handleRestart() {
    executeRestart({ containerId });
  }

  function handleDelete() {
    setConfirmDialog(null);
    executeDelete({ containerId });
  }

  return (
    <>
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        {/* Left: Back link + title */}
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" asChild>
            <Link href="/">
              <ArrowLeft className="size-4" />
              <span className="sr-only">Back to dashboard</span>
            </Link>
          </Button>
          <div className="flex items-center gap-3">
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-2xl font-bold">{displayName}</h1>
                <StatusBadge status={status} />
              </div>
              <p className="text-muted-foreground text-sm">VMID {vmid}</p>
            </div>
          </div>
        </div>

        {/* Right: Action buttons */}
        <TooltipProvider>
          <div className="flex items-center gap-2">
            {isPending && (
              <Loader2 className="text-muted-foreground size-4 animate-spin" />
            )}

            {/* Start Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    size="sm"
                    onClick={() => setConfirmDialog("start")}
                    disabled={
                      isPending || status !== "stopped" || isProxmoxUnreachable
                    }
                  >
                    <Play className="size-4" />
                    Start
                  </Button>
                </span>
              </TooltipTrigger>
              {isProxmoxUnreachable && (
                <TooltipContent>
                  <p>Proxmox API unreachable. Cannot start container.</p>
                </TooltipContent>
              )}
            </Tooltip>

            {/* Shutdown Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDialog("shutdown")}
                    disabled={
                      isPending || status !== "running" || isProxmoxUnreachable
                    }
                  >
                    <Power className="size-4" />
                    Shutdown
                  </Button>
                </span>
              </TooltipTrigger>
              {isProxmoxUnreachable && (
                <TooltipContent>
                  <p>Proxmox API unreachable. Cannot shutdown container.</p>
                </TooltipContent>
              )}
            </Tooltip>

            {/* Stop Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => setConfirmDialog("stop")}
                    disabled={
                      isPending || status !== "running" || isProxmoxUnreachable
                    }
                  >
                    <Square className="size-4" />
                    Stop
                  </Button>
                </span>
              </TooltipTrigger>
              {isProxmoxUnreachable && (
                <TooltipContent>
                  <p>Proxmox API unreachable. Cannot stop container.</p>
                </TooltipContent>
              )}
            </Tooltip>

            {/* Restart Button */}
            <Tooltip>
              <TooltipTrigger asChild>
                <span>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleRestart}
                    disabled={
                      isPending || status !== "running" || isProxmoxUnreachable
                    }
                  >
                    <RotateCcw className="size-4" />
                    Restart
                  </Button>
                </span>
              </TooltipTrigger>
              {isProxmoxUnreachable && (
                <TooltipContent>
                  <p>Proxmox API unreachable. Cannot restart container.</p>
                </TooltipContent>
              )}
            </Tooltip>

            {/* Delete Button - special handling: allowed when unreachable */}
            <Tooltip>
              <TooltipTrigger asChild>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => setConfirmDialog("delete")}
                  disabled={isPending}
                >
                  <Trash2 className="size-4" />
                  Delete
                </Button>
              </TooltipTrigger>
              {isProxmoxUnreachable && (
                <TooltipContent>
                  <p>
                    Will remove from database. Proxmox cleanup may fail if API
                    remains unreachable.
                  </p>
                </TooltipContent>
              )}
            </Tooltip>
          </div>
        </TooltipProvider>
      </div>

      {/* Stop Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog === "stop"}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Stop Container?</AlertDialogTitle>
            <AlertDialogDescription>
              This will forcefully stop{" "}
              <span className="font-semibold">{displayName}</span> (VMID {vmid}
              ). Any unsaved data may be lost.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStop} disabled={isPending}>
              Stop Container
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Delete Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog === "delete"}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete Container?</AlertDialogTitle>
            <AlertDialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold">{displayName}</span> (VMID {vmid})
              from both Proxmox and the database. This action cannot be undone.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              disabled={isPending}
              className="bg-destructive text-white hover:bg-destructive/90"
            >
              Delete Container
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Start Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog === "start"}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Start Container?</AlertDialogTitle>
            <AlertDialogDescription>
              This will start <strong>{displayName}</strong> and boot all
              configured services. The container will consume resources until
              stopped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isStarting}>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleStart}
              disabled={isStarting}
              className="bg-green-600 hover:bg-green-700"
            >
              {isStarting ? "Starting..." : "Start Container"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Shutdown Confirmation Dialog */}
      <AlertDialog
        open={confirmDialog === "shutdown"}
        onOpenChange={(open) => !open && setConfirmDialog(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Shutdown Container?</AlertDialogTitle>
            <AlertDialogDescription>
              This will gracefully shut down <strong>{displayName}</strong> by
              sending a shutdown signal to the init process. The container will
              have 30 seconds to clean up before being forcefully stopped.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isShuttingDown}>
              Cancel
            </AlertDialogCancel>
            <AlertDialogAction
              onClick={handleShutdown}
              disabled={isShuttingDown}
              className="bg-yellow-600 hover:bg-yellow-700"
            >
              {isShuttingDown ? "Shutting down..." : "Shutdown Container"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

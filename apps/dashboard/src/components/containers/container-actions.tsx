"use client";

import { useState, useEffect } from "react";
import { MoreHorizontal, Play, Square, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { useAction } from "next-safe-action/hooks";

import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import type { ContainerStatus } from "@/lib/containers/data";
import {
  startContainerAction,
  stopContainerAction,
  restartContainerAction,
  deleteContainerAction,
} from "@/lib/containers/actions";

interface ContainerActionsProps {
  containerId: string;
  hostname: string | null;
  vmid: number;
  status: ContainerStatus;
  onPendingChange?: (containerId: string, isPending: boolean) => void;
}

export function ContainerActions({
  containerId,
  hostname,
  vmid,
  status,
  onPendingChange,
}: ContainerActionsProps) {
  const [confirmDialog, setConfirmDialog] = useState<"stop" | "delete" | null>(
    null,
  );

  const displayName = hostname ?? `CT ${vmid}`;
  const isActionable = status === "running" || status === "stopped";

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
      },
      onError: ({ error }) => {
        toast.error(`Failed to delete ${displayName}`, {
          description: error.serverError ?? "An unexpected error occurred",
        });
      },
    },
  );

  const isPending = isStarting || isStopping || isRestarting || isDeleting;

  useEffect(() => {
    onPendingChange?.(containerId, isPending);
  }, [containerId, isPending, onPendingChange]);

  function handleStart() {
    executeStart({ containerId });
  }

  function handleStop() {
    setConfirmDialog(null);
    executeStop({ containerId });
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
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button
            variant="ghost"
            size="icon-xs"
            disabled={isPending || !isActionable}
          >
            <MoreHorizontal className="size-4" />
            <span className="sr-only">Container actions</span>
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          {status === "stopped" && (
            <DropdownMenuItem onClick={handleStart}>
              <Play className="size-4" />
              Start
            </DropdownMenuItem>
          )}
          {status === "running" && (
            <>
              <DropdownMenuItem onClick={() => setConfirmDialog("stop")}>
                <Square className="size-4" />
                Stop
              </DropdownMenuItem>
              <DropdownMenuItem onClick={handleRestart}>
                <RotateCcw className="size-4" />
                Restart
              </DropdownMenuItem>
            </>
          )}
          <DropdownMenuSeparator />
          <DropdownMenuItem
            variant="destructive"
            onClick={() => setConfirmDialog("delete")}
          >
            <Trash2 className="size-4" />
            Delete
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

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
    </>
  );
}

"use client";

import { useState, useTransition } from "react";
import { MoreHorizontal, Play, Square, RotateCcw, Trash2 } from "lucide-react";
import { toast } from "sonner";

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
}

export function ContainerActions({
  containerId,
  hostname,
  vmid,
  status,
}: ContainerActionsProps) {
  const [isPending, startTransition] = useTransition();
  const [confirmDialog, setConfirmDialog] = useState<"stop" | "delete" | null>(
    null,
  );

  const displayName = hostname ?? `CT ${vmid}`;
  const isActionable = status === "running" || status === "stopped";

  function handleStart() {
    startTransition(async () => {
      const result = await startContainerAction({ containerId });
      if (result?.serverError) {
        toast.error(`Failed to start ${displayName}`, {
          description: result.serverError,
        });
      } else if (result?.validationErrors) {
        toast.error(`Failed to start ${displayName}`, {
          description: "Invalid request",
        });
      } else {
        toast.success(`${displayName} started`);
      }
    });
  }

  function handleStop() {
    setConfirmDialog(null);
    startTransition(async () => {
      const result = await stopContainerAction({ containerId });
      if (result?.serverError) {
        toast.error(`Failed to stop ${displayName}`, {
          description: result.serverError,
        });
      } else if (result?.validationErrors) {
        toast.error(`Failed to stop ${displayName}`, {
          description: "Invalid request",
        });
      } else {
        toast.success(`${displayName} stopped`);
      }
    });
  }

  function handleRestart() {
    startTransition(async () => {
      const result = await restartContainerAction({ containerId });
      if (result?.serverError) {
        toast.error(`Failed to restart ${displayName}`, {
          description: result.serverError,
        });
      } else if (result?.validationErrors) {
        toast.error(`Failed to restart ${displayName}`, {
          description: "Invalid request",
        });
      } else {
        toast.success(`${displayName} restarted`);
      }
    });
  }

  function handleDelete() {
    setConfirmDialog(null);
    startTransition(async () => {
      const result = await deleteContainerAction({ containerId });
      if (result?.serverError) {
        toast.error(`Failed to delete ${displayName}`, {
          description: result.serverError,
        });
      } else if (result?.validationErrors) {
        toast.error(`Failed to delete ${displayName}`, {
          description: "Invalid request",
        });
      } else {
        toast.success(`${displayName} deleted`);
      }
    });
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleStop}>
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
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
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

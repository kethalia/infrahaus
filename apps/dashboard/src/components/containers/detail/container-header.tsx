"use client";

import { useState, useTransition } from "react";
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

interface ContainerHeaderProps {
  containerId: string;
  hostname: string | null;
  vmid: number;
  status: ContainerStatus;
}

export function ContainerHeader({
  containerId,
  hostname,
  vmid,
  status,
}: ContainerHeaderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [confirmDialog, setConfirmDialog] = useState<"stop" | "delete" | null>(
    null,
  );

  const displayName = hostname ?? `CT ${vmid}`;
  const isActionable = status === "running" || status === "stopped";

  function handleAction(
    action: (input: { containerId: string }) => Promise<unknown>,
    successMsg: string,
    failMsg: string,
  ) {
    startTransition(async () => {
      const result = (await action({ containerId })) as
        | {
            serverError?: string;
            validationErrors?: unknown;
          }
        | undefined;
      if (result?.serverError) {
        toast.error(failMsg, { description: result.serverError });
      } else if (result?.validationErrors) {
        toast.error(failMsg, { description: "Invalid request" });
      } else {
        toast.success(successMsg);
      }
    });
  }

  function handleStart() {
    handleAction(
      startContainerAction,
      `${displayName} started`,
      `Failed to start ${displayName}`,
    );
  }

  function handleStop() {
    setConfirmDialog(null);
    handleAction(
      stopContainerAction,
      `${displayName} stopped`,
      `Failed to stop ${displayName}`,
    );
  }

  function handleShutdown() {
    setConfirmDialog(null);
    handleAction(
      shutdownContainerAction,
      `${displayName} shut down`,
      `Failed to shut down ${displayName}`,
    );
  }

  function handleRestart() {
    handleAction(
      restartContainerAction,
      `${displayName} restarted`,
      `Failed to restart ${displayName}`,
    );
  }

  function handleDelete() {
    setConfirmDialog(null);
    startTransition(async () => {
      const result = (await deleteContainerAction({ containerId })) as
        | {
            serverError?: string;
            validationErrors?: unknown;
          }
        | undefined;
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
        router.push("/");
      }
    });
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
        <div className="flex items-center gap-2">
          {isPending && (
            <Loader2 className="text-muted-foreground size-4 animate-spin" />
          )}

          {status === "stopped" && (
            <Button
              size="sm"
              onClick={handleStart}
              disabled={isPending || !isActionable}
            >
              <Play className="size-4" />
              Start
            </Button>
          )}

          {status === "running" && (
            <>
              <Button
                variant="outline"
                size="sm"
                onClick={handleShutdown}
                disabled={isPending || !isActionable}
              >
                <Power className="size-4" />
                Shutdown
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => setConfirmDialog("stop")}
                disabled={isPending || !isActionable}
              >
                <Square className="size-4" />
                Stop
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={handleRestart}
                disabled={isPending || !isActionable}
              >
                <RotateCcw className="size-4" />
                Restart
              </Button>
            </>
          )}

          <Button
            variant="destructive"
            size="sm"
            onClick={() => setConfirmDialog("delete")}
            disabled={isPending || !isActionable}
          >
            <Trash2 className="size-4" />
            Delete
          </Button>
        </div>
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

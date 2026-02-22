"use client";

import { Pencil, Trash2, Star, Loader2, WifiOff } from "lucide-react";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import type { ProxmoxNode } from "@/generated/prisma/client";
import { deleteNodeAction, setDefaultNodeAction } from "@/lib/nodes/actions";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
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
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { NodeFormDialog } from "./node-form-dialog";

interface NodeCardProps {
  node: ProxmoxNode;
  /** Live container count from Proxmox. undefined = not loaded yet, -1 = error */
  containerCount?: number;
  /** Whether container count is still loading */
  containerCountLoading?: boolean;
}

export function NodeCard({
  node,
  containerCount,
  containerCountLoading,
}: NodeCardProps) {
  const { execute: executeDelete, isPending: isDeleting } = useAction(
    deleteNodeAction,
    {
      onSuccess: () => {
        toast.success("Node deleted");
      },
      onError: ({ error }) => {
        toast.error(error.serverError ?? "Failed to delete node");
      },
    },
  );

  const { execute: executeSetDefault, isPending: isSettingDefault } = useAction(
    setDefaultNodeAction,
    {
      onSuccess: () => {
        toast.success("Default node updated");
      },
      onError: ({ error }) => {
        toast.error(error.serverError ?? "Failed to set default node");
      },
    },
  );

  const isPending = isDeleting || isSettingDefault;

  return (
    <Card className={isPending ? "opacity-50" : ""}>
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <CardTitle className="text-lg">{node.name}</CardTitle>
              {node.isDefault && <Badge>Default</Badge>}
            </div>
            <p className="text-sm text-muted-foreground">
              {node.host}:{node.port}
            </p>
          </div>
          <Badge variant="outline">
            {containerCountLoading ? (
              <Loader2 className="size-3 animate-spin" />
            ) : containerCount === undefined ? (
              <Loader2 className="size-3 animate-spin" />
            ) : containerCount === -1 ? (
              <span className="flex items-center gap-1">
                <WifiOff className="size-3" />
                Unreachable
              </span>
            ) : (
              <>
                {containerCount} container
                {containerCount !== 1 ? "s" : ""}
              </>
            )}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">API Token</span>
            <span className="text-xs">
              {node.tokenId ? "Configured" : "Not set"}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">SSH Password</span>
            <span className="text-xs">
              {node.sshPassword ? "Configured" : "Not set"}
            </span>
          </div>
        </div>
      </CardContent>
      <CardFooter className="gap-2">
        <NodeFormDialog
          mode="edit"
          node={node}
          trigger={
            <Button variant="outline" size="sm">
              <Pencil className="size-3.5" />
              Edit
            </Button>
          }
        />

        {!node.isDefault && (
          <Button
            variant="outline"
            size="sm"
            disabled={isPending}
            onClick={() => executeSetDefault({ id: node.id })}
          >
            <Star className="size-3.5" />
            Set as Default
          </Button>
        )}

        <AlertDialog>
          <AlertDialogTrigger asChild>
            <Button variant="outline" size="sm" disabled={isPending}>
              <Trash2 className="size-3.5" />
              Delete
            </Button>
          </AlertDialogTrigger>
          <AlertDialogContent>
            <AlertDialogHeader>
              <AlertDialogTitle>Delete node</AlertDialogTitle>
              <AlertDialogDescription>
                Delete node &ldquo;{node.name}&rdquo; ({node.host}:{node.port})?
                {containerCount !== undefined && containerCount > 0 && (
                  <>
                    {" "}
                    This node has {containerCount} container
                    {containerCount !== 1 ? "s" : ""}. Remove them first.
                  </>
                )}
                {(containerCount === undefined || containerCount <= 0) &&
                  " This cannot be undone."}
              </AlertDialogDescription>
            </AlertDialogHeader>
            <AlertDialogFooter>
              <AlertDialogCancel>Cancel</AlertDialogCancel>
              <AlertDialogAction
                onClick={() => executeDelete({ id: node.id })}
                className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
              >
                Delete
              </AlertDialogAction>
            </AlertDialogFooter>
          </AlertDialogContent>
        </AlertDialog>
      </CardFooter>
    </Card>
  );
}

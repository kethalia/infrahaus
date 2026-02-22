"use client";

import { Pencil, Trash2, Star } from "lucide-react";
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
  node: ProxmoxNode & { _count: { containers: number } };
}

export function NodeCard({ node }: NodeCardProps) {
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

  // Mask the token ID to show just the format hint
  const maskedTokenId =
    node.tokenId.length > 10 ? `${node.tokenId.slice(0, 10)}...` : node.tokenId;

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
            {node._count.containers} container
            {node._count.containers !== 1 ? "s" : ""}
          </Badge>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-1 text-sm">
          <div className="flex justify-between">
            <span className="text-muted-foreground">Token ID</span>
            <span className="font-mono text-xs">{maskedTokenId}</span>
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
                {node._count.containers > 0 && (
                  <>
                    {" "}
                    This node has {node._count.containers} container
                    {node._count.containers !== 1 ? "s" : ""}. Remove them
                    first.
                  </>
                )}
                {node._count.containers === 0 && " This cannot be undone."}
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

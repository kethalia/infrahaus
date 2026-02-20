"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAction } from "next-safe-action/hooks";
import { toast } from "sonner";

import type { ProxmoxNode } from "@/generated/prisma/client";
import {
  editNodeFormSchema,
  type EditNodeFormInput,
  type UpdateNodeInput,
} from "@/lib/nodes/schemas";
import { createNodeAction, updateNodeAction } from "@/lib/nodes/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface NodeFormDialogProps {
  mode: "create" | "edit";
  node?: ProxmoxNode;
  trigger: React.ReactNode;
}

/**
 * Dialog form for creating and editing Proxmox nodes.
 * Uses editNodeFormSchema (tokenSecret optional) for the form,
 * with manual validation in create mode to require tokenSecret.
 */
export function NodeFormDialog({ mode, node, trigger }: NodeFormDialogProps) {
  const [open, setOpen] = useState(false);

  // Use editNodeFormSchema for both modes — tokenSecret optional in form
  // Manual validation in onSubmit enforces tokenSecret required for create
  const form = useForm<EditNodeFormInput>({
    resolver: zodResolver(editNodeFormSchema),
    defaultValues: {
      name: node?.name ?? "",
      host: node?.host ?? "",
      port: node?.port ?? 8006,
      tokenId: node?.tokenId ?? "",
      tokenSecret: "",
      sshPassword: "",
    },
  });

  const { execute: executeCreate, isPending: isCreating } = useAction(
    createNodeAction,
    {
      onSuccess: () => {
        setOpen(false);
        form.reset();
        toast.success("Node added successfully");
      },
      onError: ({ error }) => {
        toast.error(error.serverError ?? "Failed to add node");
      },
    },
  );

  const { execute: executeUpdate, isPending: isUpdating } = useAction(
    updateNodeAction,
    {
      onSuccess: () => {
        setOpen(false);
        form.reset();
        toast.success("Node updated successfully");
      },
      onError: ({ error }) => {
        toast.error(error.serverError ?? "Failed to update node");
      },
    },
  );

  const isPending = isCreating || isUpdating;

  const onSubmit = (values: EditNodeFormInput) => {
    if (mode === "create") {
      // Manual validation: tokenSecret is required for create
      if (!values.tokenSecret) {
        form.setError("tokenSecret", {
          message: "API Token Secret is required",
        });
        return;
      }

      executeCreate({
        name: values.name,
        host: values.host,
        port: values.port,
        tokenId: values.tokenId,
        tokenSecret: values.tokenSecret,
        sshPassword: values.sshPassword,
      });
    } else if (node) {
      // Build update payload — omit empty secrets to keep existing values
      const updatePayload: UpdateNodeInput = {
        id: node.id,
        name: values.name,
        host: values.host,
        port: values.port,
        tokenId: values.tokenId,
      };

      // Only include tokenSecret if user typed a new one
      if (values.tokenSecret) {
        updatePayload.tokenSecret = values.tokenSecret;
      }

      // Only include sshPassword if user typed a new one
      if (values.sshPassword) {
        updatePayload.sshPassword = values.sshPassword;
      }

      executeUpdate(updatePayload);
    }
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Add Proxmox Node" : "Edit Node"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Connect a Proxmox VE host. Connection will be tested before saving."
              : "Update node settings. Connection will be re-tested on save."}
          </DialogDescription>
        </DialogHeader>
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
            <FormField
              control={form.control}
              name="name"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Name</FormLabel>
                  <FormControl>
                    <Input placeholder="e.g. pve-main" {...field} />
                  </FormControl>
                  <FormDescription>
                    A friendly name for this node
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <div className="grid grid-cols-3 gap-3">
              <FormField
                control={form.control}
                name="host"
                render={({ field }) => (
                  <FormItem className="col-span-2">
                    <FormLabel>Host</FormLabel>
                    <FormControl>
                      <Input placeholder="192.168.1.100" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="port"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Port</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={65535}
                        {...field}
                        onChange={(e) => field.onChange(Number(e.target.value))}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="tokenId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Token ID</FormLabel>
                  <FormControl>
                    <Input placeholder="root@pam!dashboard" {...field} />
                  </FormControl>
                  <FormDescription>
                    Format: user@realm!tokenname
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="tokenSecret"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>API Token Secret</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={
                        mode === "edit"
                          ? "Leave empty to keep current"
                          : "xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="sshPassword"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>SSH Password (optional)</FormLabel>
                  <FormControl>
                    <Input
                      type="password"
                      placeholder={
                        mode === "edit"
                          ? "Leave empty to keep current"
                          : "Root password for pct exec access"
                      }
                      {...field}
                    />
                  </FormControl>
                  <FormDescription>
                    Used for monitoring services inside containers via pct exec
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter>
              <Button type="submit" disabled={isPending}>
                {isPending
                  ? mode === "create"
                    ? "Testing connection..."
                    : "Saving..."
                  : mode === "create"
                    ? "Add Node"
                    : "Save Changes"}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}

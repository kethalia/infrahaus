"use client";

import { useState, useTransition } from "react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import type { BucketWithPackages } from "@/lib/db";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { createBucketAction, updateBucketAction } from "@/lib/packages/actions";

export function BucketFormDialog({
  mode,
  bucket,
  trigger,
}: {
  mode: "create" | "edit";
  bucket?: BucketWithPackages;
  trigger: React.ReactNode;
}) {
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleSubmit = (formData: FormData) => {
    setError(null);
    startTransition(async () => {
      const action =
        mode === "create" ? createBucketAction : updateBucketAction;
      const result = await action({ success: false }, formData);
      if (result.success) {
        setOpen(false);
        toast.success(mode === "create" ? "Bucket created" : "Bucket updated");
        router.refresh();
      } else {
        setError(result.error ?? "An error occurred");
      }
    });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>
            {mode === "create" ? "Create Package Bucket" : "Edit Bucket"}
          </DialogTitle>
          <DialogDescription>
            {mode === "create"
              ? "Create a reusable group of packages for your templates."
              : "Update the bucket name and description."}
          </DialogDescription>
        </DialogHeader>
        <form action={handleSubmit} className="space-y-4">
          {mode === "edit" && bucket && (
            <input type="hidden" name="id" value={bucket.id} />
          )}
          <div className="space-y-2">
            <Label htmlFor="bucket-name">Name</Label>
            <Input
              id="bucket-name"
              name="name"
              placeholder="e.g. base, development, monitoring"
              defaultValue={bucket?.name ?? ""}
              required
              maxLength={50}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="bucket-description">Description</Label>
            <Textarea
              id="bucket-description"
              name="description"
              placeholder="Optional description of this package group"
              defaultValue={bucket?.description ?? ""}
              maxLength={200}
              className="min-h-16"
            />
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
          <DialogFooter>
            <Button type="submit" disabled={isPending}>
              {isPending
                ? mode === "create"
                  ? "Creating..."
                  : "Saving..."
                : mode === "create"
                  ? "Create Bucket"
                  : "Save Changes"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

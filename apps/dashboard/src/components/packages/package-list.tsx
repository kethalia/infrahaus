"use client";

import { useState, useTransition } from "react";
import { X, Plus, Upload } from "lucide-react";
import { toast } from "sonner";
import { useRouter } from "next/navigation";

import type { Package, PackageManager } from "@/generated/prisma/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  addPackageAction,
  removePackageAction,
  bulkImportAction,
} from "@/lib/packages/actions";

export function PackageList({
  bucketId,
  packages,
}: {
  bucketId: string;
  packages: Package[];
  manager?: PackageManager;
}) {
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [manager, setManager] = useState<string>("apt");
  const [addPending, startAddTransition] = useTransition();
  const [bulkPending, startBulkTransition] = useTransition();
  const router = useRouter();

  const handleAdd = (formData: FormData) => {
    startAddTransition(async () => {
      const result = await addPackageAction({ success: false }, formData);
      if (result.success && result.message) {
        toast.success(result.message);
        router.refresh();
      } else if (!result.success && result.error) {
        toast.error(result.error);
      }
    });
  };

  const handleBulkImport = (formData: FormData) => {
    startBulkTransition(async () => {
      const result = await bulkImportAction({ success: false }, formData);
      if (result.success && result.message) {
        toast.success(result.message);
        setShowBulkImport(false);
        router.refresh();
      } else if (!result.success && result.error) {
        toast.error(result.error);
      }
    });
  };

  return (
    <div className="space-y-3">
      {/* Package badges */}
      {packages.length > 0 ? (
        <div className="flex flex-wrap gap-1.5">
          {packages.map((pkg) => (
            <PackageBadge key={pkg.id} pkg={pkg} />
          ))}
        </div>
      ) : (
        <p className="text-xs text-muted-foreground">No packages yet</p>
      )}

      {/* Add package inline form */}
      <form action={handleAdd} className="flex items-center gap-2">
        <input type="hidden" name="bucketId" value={bucketId} />
        <input type="hidden" name="manager" value={manager} />
        <Input
          name="name"
          placeholder="Package name"
          className="h-7 text-xs flex-1"
          required
        />
        <Select value={manager} onValueChange={setManager}>
          <SelectTrigger className="h-7 w-20 text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="apt">apt</SelectItem>
            <SelectItem value="npm">npm</SelectItem>
            <SelectItem value="pip">pip</SelectItem>
            <SelectItem value="custom">custom</SelectItem>
          </SelectContent>
        </Select>
        <Button
          type="submit"
          size="icon-xs"
          variant="outline"
          disabled={addPending}
        >
          <Plus className="size-3" />
        </Button>
      </form>

      {/* Bulk import toggle */}
      <Button
        type="button"
        variant="ghost"
        size="xs"
        onClick={() => setShowBulkImport(!showBulkImport)}
        className="text-xs"
      >
        <Upload className="size-3" />
        Bulk Import
      </Button>

      {/* Bulk import form */}
      {showBulkImport && (
        <form
          action={handleBulkImport}
          className="space-y-2 rounded-md border p-3"
        >
          <input type="hidden" name="bucketId" value={bucketId} />
          <div className="space-y-1">
            <Label className="text-xs">
              Paste package list (one per line, # for comments)
            </Label>
            <Textarea
              name="content"
              placeholder={`# Example .apt file\ncurl\nwget\ngit`}
              className="min-h-20 text-xs font-mono"
              required
            />
          </div>
          <div className="flex items-center gap-2">
            <Select name="manager" defaultValue="apt">
              <SelectTrigger className="h-7 w-24 text-xs">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="apt">apt</SelectItem>
                <SelectItem value="npm">npm</SelectItem>
                <SelectItem value="pip">pip</SelectItem>
                <SelectItem value="custom">custom</SelectItem>
              </SelectContent>
            </Select>
            <Button type="submit" size="xs" disabled={bulkPending}>
              Import
            </Button>
            <Button
              type="button"
              size="xs"
              variant="ghost"
              onClick={() => setShowBulkImport(false)}
            >
              Cancel
            </Button>
          </div>
        </form>
      )}
    </div>
  );
}

function PackageBadge({ pkg }: { pkg: Package }) {
  const [isPending, startTransition] = useTransition();
  const router = useRouter();

  const handleRemove = () => {
    startTransition(async () => {
      const result = await removePackageAction(pkg.id);
      if (result.success) {
        toast.success("Package removed");
        router.refresh();
      } else {
        toast.error(result.error ?? "Failed to remove package");
      }
    });
  };

  return (
    <Badge
      variant="secondary"
      className={`gap-1 pr-1 ${isPending ? "opacity-50" : ""}`}
    >
      <span className="text-xs">{pkg.name}</span>
      <button
        type="button"
        onClick={handleRemove}
        disabled={isPending}
        className="rounded-full p-0.5 hover:bg-muted-foreground/20"
      >
        <X className="size-2.5" />
      </button>
    </Badge>
  );
}

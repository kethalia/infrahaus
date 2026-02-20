"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { Control, FieldPath, FieldValues } from "react-hook-form";
import { useWatch } from "react-hook-form";
import { Check, Loader2, X } from "lucide-react";
import { useAction } from "next-safe-action/hooks";

import { Input } from "@/components/ui/input";
import {
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import { checkVmidAction } from "@/lib/containers/actions";

type VmidStatus = "idle" | "checking" | "available" | "taken" | "invalid";

interface VmidFieldProps<T extends FieldValues> {
  control: Control<T>;
  name: FieldPath<T>;
  nodeId: string;
}

/**
 * VMID input field with inline validation against the Redis cache.
 *
 * Features:
 * - Debounced validation (~500ms after typing stops)
 * - Visual feedback: spinner (checking), green check (available), red X (taken)
 * - Accepts Proxmox VMID range (100 - 999999999)
 * - Integrates with react-hook-form via FormField pattern
 */
export function VmidField<T extends FieldValues>({
  control,
  name,
  nodeId,
}: VmidFieldProps<T>) {
  const [status, setStatus] = useState<VmidStatus>("idle");
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lastCheckedRef = useRef<number | null>(null);

  const { execute: checkVmid } = useAction(checkVmidAction, {
    onSuccess: ({ data }) => {
      if (data?.taken) {
        setStatus("taken");
      } else {
        setStatus("available");
      }
    },
    onError: () => {
      // On error, reset to idle — cache may not be populated
      setStatus("idle");
    },
  });

  // Watch the current vmid value for debounce triggering
  const currentVmid = useWatch({ control, name });

  const validateVmid = useCallback(
    (vmid: number) => {
      if (
        !nodeId ||
        vmid < 100 ||
        vmid > 999999999 ||
        !Number.isInteger(vmid)
      ) {
        setStatus("invalid");
        return;
      }

      // Skip duplicate checks
      if (lastCheckedRef.current === vmid) return;
      lastCheckedRef.current = vmid;

      setStatus("checking");
      checkVmid({ nodeId, vmid });
    },
    [nodeId, checkVmid],
  );

  // Debounce validation when VMID value changes
  useEffect(() => {
    if (debounceRef.current) {
      clearTimeout(debounceRef.current);
    }

    const vmidNum = Number(currentVmid);

    if (!currentVmid || isNaN(vmidNum) || vmidNum < 100) {
      setStatus("idle");
      lastCheckedRef.current = null;
      return;
    }

    debounceRef.current = setTimeout(() => {
      validateVmid(vmidNum);
    }, 500);

    return () => {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
      }
    };
  }, [currentVmid, validateVmid]);

  // Reset status when nodeId changes
  useEffect(() => {
    setStatus("idle");
    lastCheckedRef.current = null;
  }, [nodeId]);

  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>VMID</FormLabel>
          <div className="relative">
            <FormControl>
              <Input
                type="number"
                min={100}
                max={999999999}
                placeholder="Enter VMID (e.g. 100)"
                {...field}
                onChange={(e) => field.onChange(e.target.valueAsNumber || 0)}
              />
            </FormControl>
            {/* Inline status indicator */}
            <div className="absolute right-3 top-1/2 -translate-y-1/2">
              {status === "checking" && (
                <Loader2 className="size-4 animate-spin text-muted-foreground" />
              )}
              {status === "available" && (
                <Check className="size-4 text-green-600" />
              )}
              {status === "taken" && <X className="size-4 text-destructive" />}
            </div>
          </div>
          {/* Status text */}
          {status === "available" && (
            <FormDescription className="text-green-600">
              VMID available
            </FormDescription>
          )}
          {status === "taken" && (
            <FormDescription className="text-destructive">
              VMID already in use
            </FormDescription>
          )}
          {status === "idle" && (
            <FormDescription>
              Enter a unique VMID (100 - 999999999)
            </FormDescription>
          )}
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

import Link from "next/link";
import { AlertTriangle } from "lucide-react";

import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

/**
 * Reusable banner for when no Proxmox nodes are configured.
 * Used on the settings page and can be embedded in dashboard/wizard pages.
 */
export function NoNodesBanner() {
  return (
    <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/20">
      <AlertTriangle className="h-4 w-4 text-amber-500" />
      <AlertTitle>No Proxmox Nodes Configured</AlertTitle>
      <AlertDescription>
        Add a Proxmox node in{" "}
        <Link
          href="/settings/nodes"
          className="font-medium underline underline-offset-4"
        >
          Settings
        </Link>{" "}
        to start managing containers. You&apos;ll need your Proxmox host address
        and an API token.
      </AlertDescription>
    </Alert>
  );
}

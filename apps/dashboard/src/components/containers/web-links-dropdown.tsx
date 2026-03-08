"use client";

import { Globe, ExternalLink } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

interface WebLinksDropdownProps {
  /** Services that have a port (web-accessible) */
  services: Array<{ name: string; port: number }>;
  /** Container IP address for URL construction */
  containerIp: string | null;
}

/**
 * Globe icon dropdown showing all web-accessible services for a container.
 * Each item links to http://<containerIp>:<port> in a new tab.
 *
 * Returns null (renders nothing) when:
 * - containerIp is null (unknown IP)
 * - services is empty (no web-accessible services)
 *
 * Per user decision: shows ALL web-accessible services (not limited to MAX_PREVIEW_ITEMS).
 * URLs are always http://<ip>:<port> — no reverse proxy or reachability check.
 */
export function WebLinksDropdown({
  services,
  containerIp,
}: WebLinksDropdownProps) {
  if (!containerIp || services.length === 0) {
    return null;
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="icon-xs">
          <Globe className="size-4" />
          <span className="sr-only">Open web services</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {services.map((service) => {
          const url = `http://${containerIp}:${service.port}`;
          return (
            <DropdownMenuItem key={service.name} asChild>
              <a href={url} target="_blank" rel="noopener noreferrer">
                <span className="flex-1">{service.name}</span>
                <span className="text-muted-foreground text-xs">
                  :{service.port}
                </span>
                <ExternalLink className="size-3.5" />
              </a>
            </DropdownMenuItem>
          );
        })}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

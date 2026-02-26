"use client";

import Link from "next/link";
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
        {services.map((service) => (
          <DropdownMenuItem key={service.name} asChild>
            <Link
              href={`http://${containerIp}:${service.port}`}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2"
            >
              <span className="flex-1">{service.name}</span>
              <span className="text-muted-foreground text-xs">
                :{service.port}
              </span>
              <ExternalLink className="size-3.5" />
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

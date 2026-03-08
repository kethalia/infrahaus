import Link from "next/link";

import type { InfraService } from "@/lib/infra/catalog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";

/**
 * InfraServiceCard — Displays a single infra service catalog entry.
 * Server Component (no "use client") for the /infra page grid.
 */
export function InfraServiceCard({ service }: { service: InfraService }) {
  return (
    <Card className="flex flex-col h-full">
      <CardHeader>
        <CardTitle className="text-base">{service.name}</CardTitle>
        <CardDescription className="text-xs">{service.description}</CardDescription>
      </CardHeader>

      <CardContent className="flex flex-col gap-3 flex-1">
        {/* Badges row */}
        <div className="flex flex-wrap gap-1">
          <Badge variant="outline" className="text-xs">
            {service.deployType}
          </Badge>
          {service.requiresGpu && (
            <Badge variant="destructive" className="text-xs">
              GPU Required
            </Badge>
          )}
          {service.tags.map((tag) => (
            <Badge key={tag} variant="secondary" className="text-xs">
              {tag}
            </Badge>
          ))}
        </div>

        {/* Services list */}
        <div className="text-xs text-muted-foreground">
          <span className="font-medium">Services:</span>{" "}
          {service.services.join(", ")}
        </div>
      </CardContent>

      {service.docsPath && (
        <CardFooter>
          <Button asChild size="sm">
            <Link href={service.docsPath}>View Docs</Link>
          </Button>
        </CardFooter>
      )}
    </Card>
  );
}

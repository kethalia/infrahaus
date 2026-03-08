import { INFRA_CATALOG } from "@/lib/infra/catalog";
import { InfraServiceCard } from "@/components/infra/infra-service-card";

export default function InfraPage() {
  return (
    <main className="p-6 space-y-6">
      <div>
        <h1 className="text-2xl font-bold">Infrastructure Services</h1>
        <p className="text-sm text-muted-foreground mt-1">
          Browse all infra services — click View Docs for setup guides, or
          deploy LXC templates directly from the Templates page.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {INFRA_CATALOG.map((service) => (
          <InfraServiceCard key={service.id} service={service} />
        ))}
      </div>
    </main>
  );
}

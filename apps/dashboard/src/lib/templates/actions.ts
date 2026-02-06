"use server";

/**
 * Template Server Actions
 *
 * Server actions for template discovery, status checking, and mutations.
 * Callable from client components via React server action pattern.
 */

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { DatabaseService, prisma } from "@/lib/db";

import { discoverTemplates, type DiscoveryResult } from "./discovery";

/**
 * Trigger a full template discovery scan.
 *
 * Scans the infra/lxc/templates/ directory, parses all templates,
 * and upserts them into the database.
 */
export async function discoverTemplatesAction(): Promise<DiscoveryResult> {
  try {
    return await discoverTemplates();
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    console.error("[template-actions] Discovery failed:", message);
    return {
      discovered: 0,
      templates: [],
      errors: [{ template: "unknown", error: message }],
    };
  }
}

/**
 * Get the current discovery status.
 *
 * Returns the count of filesystem-sourced templates and the most
 * recent update timestamp, useful for UI "Last synced: ..." display.
 */
export async function getDiscoveryStatus(): Promise<{
  templateCount: number;
  lastDiscovery: string | null;
}> {
  try {
    const [count, latest] = await Promise.all([
      prisma.template.count({
        where: { source: "filesystem" },
      }),
      prisma.template.findFirst({
        where: { source: "filesystem" },
        orderBy: { updatedAt: "desc" },
        select: { updatedAt: true },
      }),
    ]);

    return {
      templateCount: count,
      lastDiscovery: latest?.updatedAt?.toISOString() ?? null,
    };
  } catch (err) {
    console.error("[template-actions] Status check failed:", err);
    return {
      templateCount: 0,
      lastDiscovery: null,
    };
  }
}

/**
 * Delete a template by ID.
 *
 * Cascading deletes handle related scripts, files, and packages.
 * On success, redirects to the templates list.
 */
export async function deleteTemplateAction(id: string): Promise<void> {
  await DatabaseService.deleteTemplate(id);
  revalidatePath("/templates");
  redirect("/templates");
}

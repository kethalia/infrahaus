"use server";

/**
 * Package Bucket Server Actions
 *
 * Server actions for managing package buckets and packages.
 * All mutations revalidate /templates/packages for fresh UI.
 */

import { revalidatePath } from "next/cache";
import { z } from "zod";

import { DatabaseService } from "@/lib/db";
import type { PackageManager } from "@/generated/prisma/client";

// ============================================================================
// Types
// ============================================================================

export type ActionState = {
  success: boolean;
  error?: string;
  message?: string;
};

// ============================================================================
// Validation Schemas
// ============================================================================

const bucketSchema = z.object({
  name: z
    .string()
    .min(1, "Name is required")
    .max(50, "Name must be 50 characters or less"),
  description: z
    .string()
    .max(200, "Description must be 200 characters or less")
    .optional()
    .or(z.literal("")),
});

const packageSchema = z.object({
  name: z.string().min(1, "Package name is required"),
  manager: z.enum(["apt", "npm", "pip", "custom"]),
});

// ============================================================================
// Bucket Actions
// ============================================================================

/**
 * Create a new package bucket.
 * Compatible with React 19 useActionState signature.
 */
export async function createBucketAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const raw = {
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || undefined,
    };

    const parsed = bucketSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Validation failed",
      };
    }

    await DatabaseService.createBucket(parsed.data);
    revalidatePath("/templates/packages");
    return { success: true, message: "Bucket created" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Update an existing package bucket.
 * Expects a hidden "id" field in the form.
 */
export async function updateBucketAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const id = formData.get("id") as string;
    if (!id) return { success: false, error: "Bucket ID is required" };

    const raw = {
      name: formData.get("name") as string,
      description: (formData.get("description") as string) || undefined,
    };

    const parsed = bucketSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Validation failed",
      };
    }

    await DatabaseService.updateBucket(id, parsed.data);
    revalidatePath("/templates/packages");
    return { success: true, message: "Bucket updated" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Delete a package bucket.
 * Called directly (not a form action) — blocked if bucket has packages.
 */
export async function deleteBucketAction(id: string): Promise<ActionState> {
  try {
    await DatabaseService.deleteBucket(id);
    revalidatePath("/templates/packages");
    return { success: true, message: "Bucket deleted" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

// ============================================================================
// Package Actions
// ============================================================================

/**
 * Add a single package to a bucket.
 */
export async function addPackageAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const bucketId = formData.get("bucketId") as string;
    const raw = {
      name: formData.get("name") as string,
      manager: formData.get("manager") as string,
    };

    if (!bucketId) return { success: false, error: "Bucket ID is required" };

    const parsed = packageSchema.safeParse(raw);
    if (!parsed.success) {
      return {
        success: false,
        error: parsed.error.issues[0]?.message ?? "Validation failed",
      };
    }

    await DatabaseService.addPackageToBucket(bucketId, {
      name: parsed.data.name,
      manager: parsed.data.manager as PackageManager,
    });
    revalidatePath("/templates/packages");
    return { success: true, message: "Package added" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Remove a package by ID.
 */
export async function removePackageAction(id: string): Promise<ActionState> {
  try {
    await DatabaseService.removePackage(id);
    revalidatePath("/templates/packages");
    return { success: true, message: "Package removed" };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Bulk import packages from pasted .apt/.npm content.
 * Parses multi-line content, strips comments (#) and blanks.
 */
export async function bulkImportAction(
  _prevState: ActionState,
  formData: FormData,
): Promise<ActionState> {
  try {
    const bucketId = formData.get("bucketId") as string;
    const content = formData.get("content") as string;
    const manager = (formData.get("manager") as string) || "apt";

    if (!bucketId) return { success: false, error: "Bucket ID is required" };
    if (!content?.trim()) {
      return { success: false, error: "Paste package content to import" };
    }

    // Validate manager
    const validManagers = ["apt", "npm", "pip", "custom"];
    if (!validManagers.includes(manager)) {
      return { success: false, error: "Invalid package manager" };
    }

    // Parse content: split by newlines, trim, filter out blanks and comments
    const packages = content
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line.length > 0 && !line.startsWith("#"))
      .map((name) => ({ name, manager: manager as PackageManager }));

    if (packages.length === 0) {
      return { success: false, error: "No valid package names found" };
    }

    const count = await DatabaseService.bulkAddPackagesToBucket(
      bucketId,
      packages,
    );
    revalidatePath("/templates/packages");
    return {
      success: true,
      message: `Imported ${count} package${count !== 1 ? "s" : ""} (${packages.length - count} duplicates skipped)`,
    };
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return { success: false, error: message };
  }
}

/**
 * Zod schemas for Proxmox node management forms.
 *
 * No "server-only" — shared with client forms for react-hook-form validation.
 * No "use server" — these are pure validation schemas.
 */

import { z } from "zod";

/**
 * Schema for creating a new Proxmox node.
 * All credential fields required on create.
 */
export const createNodeSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  host: z.string().min(1, "Host is required"),
  port: z.coerce
    .number()
    .int()
    .min(1, "Port must be at least 1")
    .max(65535, "Port must be at most 65535")
    .default(8006),
  tokenId: z
    .string()
    .min(1, "API Token ID is required (e.g., root@pam!mytoken)"),
  tokenSecret: z.string().min(1, "API Token Secret is required"),
  sshPassword: z.string().optional(), // Optional — needed for pct exec monitoring
});

/**
 * Schema for updating an existing Proxmox node.
 * tokenSecret is optional on update — keep existing if empty.
 */
export const updateNodeSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  host: z.string().min(1, "Host is required"),
  port: z.coerce
    .number()
    .int()
    .min(1, "Port must be at least 1")
    .max(65535, "Port must be at most 65535")
    .default(8006),
  tokenId: z.string().min(1, "API Token ID is required"),
  tokenSecret: z.string().optional(), // Optional on update — keep existing if empty
  sshPassword: z.string().optional(),
});

/**
 * Schema for deleting a Proxmox node.
 */
export const deleteNodeSchema = z.object({
  id: z.string().min(1),
});

/**
 * Schema for setting a node as the default.
 */
export const setDefaultNodeSchema = z.object({
  id: z.string().min(1),
});

/**
 * Form schema for NodeFormDialog (client-side with zodResolver).
 * Uses z.number() instead of z.coerce.number() for react-hook-form compatibility.
 * tokenSecret is optional — required for create is enforced manually in onSubmit.
 */
export const editNodeFormSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  host: z.string().min(1, "Host is required"),
  port: z
    .number()
    .int()
    .min(1, "Port must be at least 1")
    .max(65535, "Port must be at most 65535"),
  tokenId: z.string().min(1, "API Token ID is required"),
  tokenSecret: z.string().optional(), // Optional — required for create enforced in onSubmit
  sshPassword: z.string().optional(),
});

// ============================================================================
// Inferred Types (for use in forms and server actions)
// ============================================================================

export type CreateNodeInput = z.infer<typeof createNodeSchema>;
export type UpdateNodeInput = z.infer<typeof updateNodeSchema>;
export type EditNodeFormInput = z.infer<typeof editNodeFormSchema>;

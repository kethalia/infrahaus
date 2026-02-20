-- Infrastructure Refactor: Multi-user node ownership + remove stored container passwords
-- Decision: "no existing users, no migration helper" — clean break

-- Phase 1: Clean existing data (dev database, no production users)
-- Delete container events first (FK to containers)
DELETE FROM "ContainerEvent";
-- Delete containers (FK to nodes)
DELETE FROM "Container";
-- Delete nodes (will be recreated via settings page)
DELETE FROM "ProxmoxNode";

-- Phase 2: ProxmoxNode — add multi-user fields
-- Add sshPassword (optional, encrypted — for SSH to Proxmox host for pct exec)
ALTER TABLE "ProxmoxNode" ADD COLUMN "sshPassword" TEXT;

-- Add isDefault flag (default false — first node per user auto-set in app logic)
ALTER TABLE "ProxmoxNode" ADD COLUMN "isDefault" BOOLEAN NOT NULL DEFAULT false;

-- Add userId (required — every node belongs to a user)
ALTER TABLE "ProxmoxNode" ADD COLUMN "userId" TEXT NOT NULL;

-- Drop old global unique constraint on name
DROP INDEX "ProxmoxNode_name_key";

-- Add compound unique: each user can have unique node names within their own set
CREATE UNIQUE INDEX "ProxmoxNode_userId_name_key" ON "ProxmoxNode"("userId", "name");

-- Add index for userId queries (list nodes for user)
CREATE INDEX "ProxmoxNode_userId_idx" ON "ProxmoxNode"("userId");

-- Phase 3: Container — remove rootPassword (clean break)
ALTER TABLE "Container" DROP COLUMN "rootPassword";

-- DropForeignKey
ALTER TABLE "Container" DROP CONSTRAINT IF EXISTS "Container_nodeId_fkey";
ALTER TABLE "Container" DROP CONSTRAINT IF EXISTS "Container_templateId_fkey";
ALTER TABLE "ContainerEvent" DROP CONSTRAINT IF EXISTS "ContainerEvent_containerId_fkey";
ALTER TABLE "ContainerService" DROP CONSTRAINT IF EXISTS "ContainerService_containerId_fkey";

-- DropTable (ContainerService depends on Container, drop it first)
DROP TABLE IF EXISTS "ContainerService";

-- DropIndex
DROP INDEX IF EXISTS "Container_lifecycle_idx";
DROP INDEX IF EXISTS "Container_nodeId_idx";
DROP INDEX IF EXISTS "Container_templateId_idx";
DROP INDEX IF EXISTS "Container_vmid_key";
DROP INDEX IF EXISTS "ContainerEvent_containerId_createdAt_idx";

-- DropTable
DROP TABLE IF EXISTS "ContainerEvent";
DROP TABLE IF EXISTS "Container";

-- DropEnum
DROP TYPE IF EXISTS "ContainerLifecycle";
DROP TYPE IF EXISTS "EventType";

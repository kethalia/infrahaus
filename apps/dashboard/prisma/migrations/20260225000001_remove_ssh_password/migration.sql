-- AlterTable: Remove sshPassword column from ProxmoxNode
-- SSH access now uses per-container key pairs stored in ContainerCredential table
ALTER TABLE "ProxmoxNode" DROP COLUMN IF EXISTS "sshPassword";

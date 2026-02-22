-- AlterTable: Make API token fields optional on ProxmoxNode
-- API tokens are only needed for the worker process (background container creation).
-- Interactive requests use the session ticket from login.
-- On first login, the node is auto-provisioned without API tokens.
ALTER TABLE "ProxmoxNode" ALTER COLUMN "tokenId" DROP NOT NULL;
ALTER TABLE "ProxmoxNode" ALTER COLUMN "tokenSecret" DROP NOT NULL;

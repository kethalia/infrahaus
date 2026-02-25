-- Auth decoupling: Clear ProxmoxNode records with Proxmox username userId values.
-- After this migration, users log in via Universal Profile (wallet address).
-- Existing nodes stored under Proxmox usernames (e.g., 'root@pam') become
-- unreachable since the new userId format is a wallet address (e.g., '0x1234...').
-- Users will re-add their Proxmox nodes in Settings after first UP login.
--
-- ALTERNATIVE: If you want to preserve existing node data, skip this migration
-- and instead run a manual UPDATE after your first Universal Profile login:
--   UPDATE "ProxmoxNode" SET "userId" = '0xYourWalletAddress' WHERE "userId" = 'root@pam';

DELETE FROM "ProxmoxNode";

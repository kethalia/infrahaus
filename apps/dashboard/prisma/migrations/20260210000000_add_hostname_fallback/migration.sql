-- Add hostname field back to Container for fallback when Proxmox API unreachable
-- This is different from the original hostname column that was removed in 20260205000001_thin_container
-- Purpose: Store hostname for display when live Proxmox data is unavailable
ALTER TABLE "Container" ADD COLUMN "hostname" TEXT;

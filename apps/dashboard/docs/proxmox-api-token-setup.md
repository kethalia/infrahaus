# Proxmox API Token Setup

This guide walks you through creating a least-privilege API token for the InfraHaus dashboard. The token is scoped to a **single Proxmox node** and can only manage LXC containers — it cannot access other nodes, VMs, or cluster-wide settings.

## Overview

The dashboard uses a Proxmox API token (not username/password) to:

- List and create LXC containers
- Start, stop, shutdown, and delete containers
- Read container configuration and network interfaces
- List storage volumes and OS templates
- Poll task status during container creation

It does **not** need access to:

- Virtual machines (QEMU/KVM)
- Cluster configuration or HA
- User/permission management
- Firewall rules
- Backup/restore
- Other nodes in the cluster

## Prerequisites

- SSH or console access to your Proxmox host
- Root access (or a user with `Realm.AllocateUser` + `User.Modify` privileges)

## Step 1: Create a Custom Role

Create a role with only the privileges the dashboard needs:

```bash
pveum role add InfraHaus -privs "VM.Allocate,VM.Audit,VM.PowerMgmt,VM.Console,Datastore.Audit,Datastore.AllocateSpace,Sys.Audit"
```

### What each privilege does

| Privilege                 | Why it's needed                                                                            |
| ------------------------- | ------------------------------------------------------------------------------------------ |
| `VM.Allocate`             | Create and delete LXC containers                                                           |
| `VM.Audit`                | List containers, read config, read network interfaces, read status                         |
| `VM.PowerMgmt`            | Start, stop, shutdown, restart containers                                                  |
| `VM.Console`              | Access container console (future use — included for completeness)                          |
| `Datastore.Audit`         | List storage volumes and downloaded OS templates                                           |
| `Datastore.AllocateSpace` | Allocate disk space when creating containers (rootfs)                                      |
| `Sys.Audit`               | List nodes, read node status, read task status/logs, list available OS templates (aplinfo) |

### Privileges explicitly NOT included

| Privilege            | Why it's excluded                                                       |
| -------------------- | ----------------------------------------------------------------------- |
| `Sys.Modify`         | Not needed — dashboard doesn't change node configuration                |
| `Sys.PowerMgmt`      | Not needed — dashboard doesn't reboot/shutdown the host                 |
| `Sys.Console`        | Not needed — dashboard doesn't access the host console                  |
| `VM.Config.*`        | Not needed — container config is set at creation time via `VM.Allocate` |
| `VM.Migrate`         | Not needed — dashboard doesn't migrate containers between nodes         |
| `VM.Snapshot*`       | Not needed — dashboard doesn't create/manage snapshots                  |
| `VM.Backup`          | Not needed — dashboard doesn't create backups                           |
| `VM.Clone`           | Not needed — dashboard creates from OS templates, not clones            |
| `User.*`             | Not needed — dashboard doesn't manage Proxmox users                     |
| `Realm.*`            | Not needed — dashboard doesn't manage auth realms                       |
| `Pool.Allocate`      | Only needed if using pool-based access control (see Advanced section)   |
| `SDN.*`              | Not needed — dashboard doesn't manage software-defined networking       |
| `Permissions.Modify` | Not needed — dashboard doesn't change ACLs                              |

## Step 2: Create a Dedicated User

Create a PAM user specifically for the dashboard. Don't reuse `root@pam`:

```bash
# Create the user (no password needed — API tokens don't use passwords)
pveum user add infrahaus@pam -comment "InfraHaus dashboard service account"
```

> **Why PAM?** PAM users are local to the Proxmox host and don't require an external auth server. The dashboard only uses the API token, never the user's password, so no PAM password is needed.

## Step 3: Assign Permissions to a Specific Node

This is where you scope access to **only your target node**. Replace `pve-04` with your actual node name:

```bash
# Allow reading node info and task status on this specific node
pveum aclmod /nodes/pve-04 -user infrahaus@pam -role InfraHaus

# Allow creating/managing containers (see note about VM scoping below)
pveum aclmod /vms -user infrahaus@pam -role InfraHaus

# Allow listing storage and allocating disk space
# Option A: All storage on this node
pveum aclmod /storage -user infrahaus@pam -role InfraHaus

# Option B: Specific storage only (more restrictive)
# pveum aclmod /storage/local-lvm -user infrahaus@pam -role InfraHaus
```

### Important: `/vms` is cluster-wide

Proxmox's permission tree puts all VMs/containers under `/vms/{vmid}` regardless of which node they're on. There is no `/nodes/pve-04/vms` path in the ACL system. This means the `VM.*` privileges on `/vms` technically apply to containers on any node.

**In practice, this is acceptable** because:

1. The dashboard only queries the node you configure — it never discovers or contacts other nodes
2. The API token is scoped to a single user whose only role is `InfraHaus`
3. The token has no `Sys.Modify`, `VM.Migrate`, or cluster privileges — it can't move containers between nodes

**If you need stricter isolation**, use the pool-based approach in the [Advanced: Pool-Based Access Control](#advanced-pool-based-access-control) section.

## Step 4: Create the API Token

```bash
pveum user token add infrahaus@pam dashboard --privsep=0 --comment "InfraHaus dashboard"
```

This outputs:

```
┌──────────────┬──────────────────────────────────────┐
│ key          │ value                                │
╞══════════════╪══════════════════════════════════════╡
│ full-tokenid │ infrahaus@pam!dashboard              │
│ info         │ {"comment":"InfraHaus dashboard"}    │
│ value        │ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │
└──────────────┴──────────────────────────────────────┘
```

> **Save the token value immediately** — Proxmox only shows it once. If you lose it, delete and recreate the token.

### What is `--privsep=0`?

- `--privsep=0` — Token inherits the user's permissions. This is what you want.
- `--privsep=1` (default) — Token has **no** permissions unless you assign them separately to the token itself. This is more work and easy to misconfigure.

## Step 5: Add the Node in the Dashboard

1. Log in to the InfraHaus dashboard with your Universal Profile
2. Go to **Settings** → **Nodes**
3. Click **Add Node**
4. Fill in:
   - **Name**: A friendly name (e.g., `pve-04`)
   - **Host**: Your Proxmox IP or hostname (e.g., `10.0.0.10`)
   - **Port**: `8006` (default)
   - **Token ID**: `infrahaus@pam!dashboard`
   - **Token Secret**: The UUID value from step 4
5. Click **Save** — the dashboard will test the connection before saving

## Verifying the Setup

### From the Proxmox CLI

Test that the token can access the expected endpoints:

```bash
# Set variables
TOKEN_ID="infrahaus@pam!dashboard"
TOKEN_SECRET="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
PVE_HOST="localhost"

# Test: List nodes (should work)
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/nodes" | jq '.data[].node'

# Test: List containers on your node (should work)
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/nodes/pve-04/lxc" | jq '.data[].vmid'

# Test: List storage (should work)
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/nodes/pve-04/storage" | jq '.data[].storage'

# Test: Access cluster config (should FAIL with 403)
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/cluster/status" | jq
```

### From the Dashboard

After adding the node, verify on the dashboard:

1. **Containers page** loads and shows existing containers (or empty state)
2. **Create Container** wizard lists available OS templates and storage
3. You can start/stop a test container

## Revoking Access

If you need to revoke the dashboard's access:

```bash
# Option 1: Delete just the token (user and role remain)
pveum user token remove infrahaus@pam dashboard

# Option 2: Delete everything
pveum user token remove infrahaus@pam dashboard
pveum aclmod /nodes/pve-04 -user infrahaus@pam -delete -role InfraHaus
pveum aclmod /vms -user infrahaus@pam -delete -role InfraHaus
pveum aclmod /storage -user infrahaus@pam -delete -role InfraHaus
pveum user delete infrahaus@pam
pveum role delete InfraHaus
```

## Multi-Node Setup

If you have multiple Proxmox nodes (standalone, not clustered), repeat steps 1–5 on each node. Each node gets:

- Its own `infrahaus@pam` user + `InfraHaus` role
- Its own API token
- Its own entry in the dashboard's Settings → Nodes

For **clustered** Proxmox nodes, you only need one token — the API is shared across the cluster. Scope the `/nodes/{node}` ACL to whichever node(s) the dashboard should manage.

## Advanced: Pool-Based Access Control

If you need the API token to only manage containers it created (not pre-existing ones), use a Proxmox resource pool:

```bash
# 1. Create a pool for dashboard-managed containers
pveum pool add infrahaus-containers -comment "Containers managed by InfraHaus"

# 2. Add Pool.Allocate to the role
pveum role modify InfraHaus -privs "VM.Allocate,VM.Audit,VM.PowerMgmt,VM.Console,Datastore.Audit,Datastore.AllocateSpace,Sys.Audit,Pool.Allocate"

# 3. Assign permissions to the pool instead of /vms
pveum aclmod /pool/infrahaus-containers -user infrahaus@pam -role InfraHaus

# 4. Don't assign /vms permissions
# (The pool ACL covers containers within it)
```

Then when creating containers, Proxmox places them in the pool and the token can only see/manage containers in that pool.

> **Note:** The dashboard currently passes the `pool` parameter if configured in the container creation config, but there is no pool selector in the node settings UI yet. This is a planned feature.

## Proxmox API Reference

For the complete privilege documentation, see:

- [Proxmox VE API Permissions](https://pve.proxmox.com/pve-docs/pveum-plain.html)
- [Proxmox VE API Reference](https://pve.proxmox.com/pve-docs/api-viewer/)

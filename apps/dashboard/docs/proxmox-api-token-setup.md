# Proxmox API Token Setup

This guide walks you through creating a least-privilege API token for the InfraHaus dashboard. The token is scoped to a **single Proxmox node** and uses a **resource pool** so each dashboard user can only see and manage their own containers.

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

## Step 1: Create a Resource Pool

A Proxmox resource pool isolates containers so each token can only manage containers within its pool. This is critical when sharing a node — each user gets their own pool and can't see or touch anyone else's containers.

```bash
pveum pool add infrahaus-alice -comment "Containers managed by alice via InfraHaus"
```

> **Naming convention:** Use `infrahaus-{username}` so it's clear what each pool is for. If you're the only user, `infrahaus` is fine.

## Step 2: Create a Custom Role

Create a role with only the privileges the dashboard needs:

```bash
pveum role add InfraHaus -privs "VM.Allocate,VM.Audit,VM.PowerMgmt,VM.Console,Datastore.Audit,Datastore.AllocateSpace,Sys.Audit,Pool.Allocate,Pool.Audit"
```

> **One role for all users.** You only create the `InfraHaus` role once per Proxmox host. Every dashboard user shares the same role — isolation comes from the pool, not the role.

### What each privilege does

| Privilege                 | Why it's needed                                                                  |
| ------------------------- | -------------------------------------------------------------------------------- |
| `VM.Allocate`             | Create and delete LXC containers                                                 |
| `VM.Audit`                | List containers, read config, read network interfaces, read status               |
| `VM.PowerMgmt`            | Start, stop, shutdown, restart containers                                        |
| `VM.Console`              | Access container console (future use)                                            |
| `Datastore.Audit`         | List storage volumes and downloaded OS templates                                 |
| `Datastore.AllocateSpace` | Allocate disk space when creating containers (rootfs)                            |
| `Sys.Audit`               | List nodes, read node status, read task status/logs, list available OS templates |
| `Pool.Allocate`           | Add newly created containers to the user's pool                                  |
| `Pool.Audit`              | List pool contents                                                               |

### Privileges explicitly NOT included

| Privilege            | Why it's excluded                                          |
| -------------------- | ---------------------------------------------------------- |
| `Sys.Modify`         | Dashboard doesn't change node configuration                |
| `Sys.PowerMgmt`      | Dashboard doesn't reboot/shutdown the host                 |
| `Sys.Console`        | Dashboard doesn't access the host console                  |
| `VM.Config.*`        | Container config is set at creation time via `VM.Allocate` |
| `VM.Migrate`         | Dashboard doesn't migrate containers between nodes         |
| `VM.Snapshot*`       | Dashboard doesn't create/manage snapshots                  |
| `VM.Backup`          | Dashboard doesn't create backups                           |
| `VM.Clone`           | Dashboard creates from OS templates, not clones            |
| `User.*`             | Dashboard doesn't manage Proxmox users                     |
| `Realm.*`            | Dashboard doesn't manage auth realms                       |
| `SDN.*`              | Dashboard doesn't manage software-defined networking       |
| `Permissions.Modify` | Dashboard doesn't change ACLs                              |

## Step 3: Create a Dedicated User

Create a PAM user for this dashboard user. Don't reuse `root@pam`:

```bash
pveum user add infrahaus-alice@pam -comment "InfraHaus dashboard — alice"
```

> **Why PAM?** PAM users are local to the Proxmox host and don't require an external auth server. The dashboard only uses the API token, never the user's password, so no PAM password is needed.

> **One user per dashboard user.** If bob also uses the dashboard, create `infrahaus-bob@pam` with their own pool `infrahaus-bob`. They share the same `InfraHaus` role but are isolated by pool.

## Step 4: Assign Permissions

Scope the user's access to their pool, their node, and the storage they need. Replace `pve-04` with your node name:

```bash
# Pool — this is the primary isolation boundary
# The user can only manage containers inside this pool
pveum aclmod /pool/infrahaus-alice -user infrahaus-alice@pam -role InfraHaus

# Node — allows reading node info, task status, network interfaces, and OS template listing
pveum aclmod /nodes/pve-04 -user infrahaus-alice@pam -role InfraHaus

# Storage — you need BOTH the template storage AND the disk storage
# "local" holds OS templates (vztmpl) and ISOs
# "local-lvm" holds container disk volumes (rootdir/images)
# List your storages with: pvesm status
pveum aclmod /storage/local -user infrahaus-alice@pam -role InfraHaus
pveum aclmod /storage/local-lvm -user infrahaus-alice@pam -role InfraHaus
```

> **Why two storages?** Proxmox uses separate storages for different content types. OS templates (`vztmpl`) typically live on `local` (a directory-type storage), while container disk volumes (`rootdir`, `images`) live on `local-lvm` (LVM-thin). The dashboard needs access to both: `local` to list available OS templates in the creation wizard, and `local-lvm` to allocate disk space for new containers. Run `pvesm status` on your node to see your actual storage names — they may differ.

### What each ACL path grants

| ACL Path                | What it enables in the dashboard                                                              |
| ----------------------- | --------------------------------------------------------------------------------------------- |
| `/pool/infrahaus-alice` | Create, list, start, stop, delete containers in this pool                                     |
| `/nodes/pve-04`         | List node info, poll task status, list network bridges, list available OS templates (aplinfo) |
| `/storage/local`        | List downloaded OS templates in the creation wizard                                           |
| `/storage/local-lvm`    | List container-capable storage, allocate disk space for rootfs                                |

### Why no `/vms` ACL?

With pool-based access, you do **not** assign permissions on `/vms`. The pool ACL covers all `VM.*` operations for containers within the pool. Containers outside the pool are invisible to this token.

This is what makes pool-based access secure for shared nodes — alice's token literally cannot see bob's containers.

### How pool isolation works

```
/pool/infrahaus-alice    ← alice's token has InfraHaus role here
  └── CT 200             ← alice can manage this (in her pool)
  └── CT 201             ← alice can manage this (in her pool)

/pool/infrahaus-bob      ← bob's token has InfraHaus role here
  └── CT 300             ← bob can manage this (in his pool)

CT 100                   ← not in any InfraHaus pool — invisible to both
```

## Step 5: Create the API Token

```bash
pveum user token add infrahaus-alice@pam dashboard --privsep=0 --comment "InfraHaus dashboard"
```

This outputs:

```
┌──────────────┬──────────────────────────────────────┐
│ key          │ value                                │
╞══════════════╪══════════════════════════════════════╡
│ full-tokenid │ infrahaus-alice@pam!dashboard        │
│ info         │ {"comment":"InfraHaus dashboard"}    │
│ value        │ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │
└──────────────┴──────────────────────────────────────┘
```

> **Save the token value immediately** — Proxmox only shows it once. If you lose it, delete and recreate the token.

### What is `--privsep=0`?

- `--privsep=0` — Token inherits the user's permissions. This is what you want.
- `--privsep=1` (default) — Token has **no** permissions unless you assign them separately to the token itself. This is more work and easy to misconfigure.

## Step 6: Add the Node in the Dashboard

1. Log in to the InfraHaus dashboard with your Universal Profile
2. Go to **Settings** → **Nodes**
3. Click **Add Node**
4. Fill in:
   - **Name**: Your Proxmox node name (e.g., `pve-04`) — must match the actual node name
   - **Host**: Your Proxmox IP or hostname (e.g., `10.0.0.10`)
   - **Port**: `8006` (default)
   - **Token ID**: `infrahaus-alice@pam!dashboard`
   - **Token Secret**: The UUID value from step 5
   - **Pool**: `infrahaus-alice` — the pool containers will be created in
5. Click **Save** — the dashboard will test the connection before saving

## Verifying the Setup

### From the Proxmox CLI

```bash
# Set variables
TOKEN_ID="infrahaus-alice@pam!dashboard"
TOKEN_SECRET="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
PVE_HOST="localhost"
NODE="pve-04"

# Should work: list nodes
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/nodes" | jq '.data[].node'

# Should work: list containers (only those in your pool)
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/nodes/${NODE}/lxc" | jq '.data[].vmid'

# Should work: list storage volumes
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/nodes/${NODE}/storage" | jq '.data[].storage'

# Should work: list OS templates (from "local" storage)
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/nodes/${NODE}/storage/local/content?content=vztmpl" | jq '.data[].volid'

# Should work: list network bridges
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/nodes/${NODE}/network" | jq '.data[] | select(.type=="bridge") | .iface'

# Should work: list pool contents
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/pools/infrahaus-alice" | jq '.data.members[].vmid'

# Should FAIL (403): access cluster config
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/cluster/status" | jq

# Should FAIL (403): manage a container outside your pool
curl -s -k -X POST -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/nodes/${NODE}/lxc/100/status/stop"
```

### From the Dashboard

After adding the node:

1. **Containers page** loads and shows only your pool's containers (or empty state)
2. **Create Container** wizard lists available OS templates and storage
3. Creating a container places it in your pool automatically
4. You can start/stop containers you created

## Adding Another User

To give someone else access to the same Proxmox node with their own isolated containers:

```bash
# 1. Create their pool
pveum pool add infrahaus-bob -comment "Containers managed by bob via InfraHaus"

# 2. Create their user
pveum user add infrahaus-bob@pam -comment "InfraHaus dashboard — bob"

# 3. Assign permissions (same role, different pool)
pveum aclmod /pool/infrahaus-bob -user infrahaus-bob@pam -role InfraHaus
pveum aclmod /nodes/pve-04 -user infrahaus-bob@pam -role InfraHaus
pveum aclmod /storage/local -user infrahaus-bob@pam -role InfraHaus
pveum aclmod /storage/local-lvm -user infrahaus-bob@pam -role InfraHaus

# 4. Create their token
pveum user token add infrahaus-bob@pam dashboard --privsep=0 --comment "InfraHaus dashboard"
```

Bob adds the node in the dashboard with his own token ID (`infrahaus-bob@pam!dashboard`) and pool (`infrahaus-bob`). He can only see and manage containers in his pool.

## Revoking Access

### Revoke one user

```bash
# Delete token
pveum user token remove infrahaus-alice@pam dashboard

# Remove ACLs
pveum aclmod /pool/infrahaus-alice -user infrahaus-alice@pam -delete -role InfraHaus
pveum aclmod /nodes/pve-04 -user infrahaus-alice@pam -delete -role InfraHaus
pveum aclmod /storage/local -user infrahaus-alice@pam -delete -role InfraHaus
pveum aclmod /storage/local-lvm -user infrahaus-alice@pam -delete -role InfraHaus

# Delete user
pveum user delete infrahaus-alice@pam

# Delete pool (only if empty — move or delete containers first)
pveum pool delete infrahaus-alice
```

### Remove InfraHaus entirely

After revoking all users:

```bash
pveum role delete InfraHaus
```

## Multi-Node Setup

For **standalone nodes** (not clustered): Repeat this entire guide on each node. Each node gets its own user, token, pool, and role.

For **clustered nodes**: The Proxmox API is shared across the cluster, so you only need one user and token. Create separate pools per node if you want node-level isolation, or one pool per user if you want user-level isolation regardless of node.

## Simplified Setup (Single User Only)

If you're the only person who will ever use this Proxmox node with the dashboard, you can skip the pool and assign `/vms` directly:

```bash
# Role (no Pool.Allocate or Pool.Audit needed)
pveum role add InfraHaus -privs "VM.Allocate,VM.Audit,VM.PowerMgmt,VM.Console,Datastore.Audit,Datastore.AllocateSpace,Sys.Audit"

# User + permissions
pveum user add infrahaus@pam -comment "InfraHaus dashboard"
pveum aclmod /nodes/pve-04 -user infrahaus@pam -role InfraHaus
pveum aclmod /vms -user infrahaus@pam -role InfraHaus
pveum aclmod /storage -user infrahaus@pam -role InfraHaus

# Token
pveum user token add infrahaus@pam dashboard --privsep=0
```

> **Warning:** With `/vms` permissions, the token can manage **any** container on **any** node in the cluster. This is fine for single-user setups but not suitable if you share the node. Use the pool-based approach above for shared environments.

## Proxmox API Reference

- [Proxmox VE API Permissions](https://pve.proxmox.com/pve-docs/pveum-plain.html)
- [Proxmox VE API Reference](https://pve.proxmox.com/pve-docs/api-viewer/)

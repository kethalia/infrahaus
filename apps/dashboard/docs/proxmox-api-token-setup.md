# Proxmox API Token Setup

Least-privilege API token setup for the InfraHaus dashboard. Uses `privsep=0` (token inherits user permissions) with a dedicated role per ACL path, so each path grants only the exact privileges needed. The user has no password — only the token secret grants API access.

## What the Dashboard Needs

| API Endpoint                                    | Operation               | Used for                 |
| ----------------------------------------------- | ----------------------- | ------------------------ |
| `GET /nodes`                                    | List cluster nodes      | Wizard node selector     |
| `GET /cluster/nextid`                           | Next free VMID          | Wizard VMID suggestion   |
| `GET /nodes/{node}/status`                      | Node status             | Dashboard overview       |
| `GET /nodes/{node}/storage`                     | List storages           | Wizard storage selector  |
| `GET /nodes/{node}/network`                     | List network interfaces | Wizard bridge selector   |
| `GET /nodes/{node}/storage/{id}/content`        | List OS templates       | Wizard template selector |
| `GET /nodes/{node}/aplinfo`                     | Available templates     | Template catalog         |
| `POST /nodes/{node}/lxc`                        | Create container        | Container creation       |
| `GET /nodes/{node}/lxc`                         | List containers         | Dashboard container list |
| `GET /nodes/{node}/lxc/{vmid}/status/current`   | Container status        | Dashboard + detail page  |
| `GET /nodes/{node}/lxc/{vmid}/config`           | Container config        | Detail page              |
| `GET /nodes/{node}/lxc/{vmid}/interfaces`       | Container IPs           | Service discovery (DHCP) |
| `POST /nodes/{node}/lxc/{vmid}/status/start`    | Start container         | Lifecycle action         |
| `POST /nodes/{node}/lxc/{vmid}/status/stop`     | Stop container          | Lifecycle action         |
| `POST /nodes/{node}/lxc/{vmid}/status/shutdown` | Shutdown container      | Lifecycle action         |
| `DELETE /nodes/{node}/lxc/{vmid}`               | Delete container        | Lifecycle action         |
| `GET /nodes/{node}/tasks/{upid}/status`         | Task status             | Creation progress        |
| `GET /nodes/{node}/tasks/{upid}/log`            | Task log                | Creation progress        |
| `GET /version`                                  | API version             | Connection test          |

It does **not** need: QEMU/KVM VMs, cluster config, HA, user management, firewall, backup/restore, snapshots, migration, or cloning.

## Setup

All commands run as `root` on any node in your Proxmox cluster. Roles, users, and tokens are cluster-wide — you only do this once.

### Step 1: Create Roles

Four custom roles, each with the minimum privileges for its ACL path:

```bash
# Read-only cluster visibility (storages, networks, templates, node info)
pveum role add InfraHaus.Audit -privs "Sys.Audit,Datastore.Audit"

# Container lifecycle within a pool (create, start, stop, delete)
pveum role add InfraHaus.Containers -privs "VM.Allocate,VM.Audit,VM.PowerMgmt,VM.Console,Pool.Allocate"

# Container creation on a specific node (submit creation, poll tasks, use bridges)
pveum role add InfraHaus.Node -privs "Sys.Audit,VM.Allocate,SDN.Use"

# Disk allocation on a specific storage
pveum role add InfraHaus.Storage -privs "Datastore.AllocateSpace"
```

> **One-time setup.** These roles are shared by all dashboard users. Create them once per cluster.

#### Why four roles instead of one

A single role on every path would grant unnecessary privileges. For example, `VM.Allocate` on `/storage/local-zfs` is meaningless, and `Datastore.AllocateSpace` on `/pool/infrahaus-alice` does nothing. Per-path roles ensure each path grants **only** what it needs:

| Role                   | Privileges                                                               | What it does NOT include                                                                                    |
| ---------------------- | ------------------------------------------------------------------------ | ----------------------------------------------------------------------------------------------------------- |
| `InfraHaus.Audit`      | `Sys.Audit`, `Datastore.Audit`                                           | No VM access, no write operations, no pool management                                                       |
| `InfraHaus.Containers` | `VM.Allocate`, `VM.Audit`, `VM.PowerMgmt`, `VM.Console`, `Pool.Allocate` | No Sys._, no Datastore._, no network access                                                                 |
| `InfraHaus.Node`       | `Sys.Audit`, `VM.Allocate`, `SDN.Use`                                    | No VM.PowerMgmt (lifecycle is via pool), no Datastore.\*                                                    |
| `InfraHaus.Storage`    | `Datastore.AllocateSpace`                                                | No Datastore.Allocate (can't create/delete volumes), no Datastore.AllocateTemplate (can't upload templates) |

#### Privileges NOT included anywhere

| Privilege                    | Why excluded                                                       |
| ---------------------------- | ------------------------------------------------------------------ |
| `Sys.Modify`                 | Required for privileged containers — dashboard forces unprivileged |
| `Sys.PowerMgmt`              | Dashboard doesn't reboot/shutdown the host                         |
| `Sys.Console`                | Dashboard doesn't access the host console                          |
| `VM.Config.*`                | Container config is set at creation time via `VM.Allocate`         |
| `VM.Migrate`                 | Dashboard doesn't move containers between nodes                    |
| `VM.Snapshot*`               | Dashboard doesn't manage snapshots                                 |
| `VM.Backup`                  | Dashboard doesn't create backups                                   |
| `VM.Clone`                   | Dashboard creates from OS templates, not clones                    |
| `Datastore.Allocate`         | Dashboard doesn't create/delete storage volumes                    |
| `Datastore.AllocateTemplate` | Dashboard doesn't upload OS templates                              |
| `User.*`, `Realm.*`          | Dashboard doesn't manage Proxmox users                             |
| `SDN.Allocate`, `SDN.Audit`  | Dashboard doesn't manage SDN zones/vnets                           |
| `Permissions.Modify`         | Dashboard doesn't change ACLs                                      |

### Step 2: Create a Resource Pool

Each dashboard user gets their own pool. Containers in the pool are visible only to that user's token.

```bash
pveum pool add infrahaus-alice -comment "Containers managed by alice via InfraHaus"
```

### Step 3: Create the User and Token

The user is created in the `pve` realm (Proxmox-managed, no Linux system account needed) with no password — only the API token grants access.

```bash
# Create user (pve realm — no Linux account needed, no password)
pveum user add infrahaus-alice@pve -comment "InfraHaus dashboard — alice"

# Create token with privilege separation DISABLED (inherits user permissions)
pveum user token add infrahaus-alice@pve dashboard --privsep=0 --comment "InfraHaus dashboard"
```

Output:

```
┌──────────────┬─────────────────────────────────────────────────┐
│ key          │ value                                           │
╞══════════════╪═════════════════════════════════════════════════╡
│ full-tokenid │ infrahaus-alice@pve!dashboard                   │
├──────────────┼─────────────────────────────────────────────────┤
│ info         │ {"comment":"InfraHaus dashboard","privsep":"0"} │
├──────────────┼─────────────────────────────────────────────────┤
│ value        │ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx            │
└──────────────┴─────────────────────────────────────────────────┘
```

**Save the token secret immediately** — Proxmox only shows it once.

#### Why `@pve` realm

| Realm  | Behavior                                                                                                                                              |
| ------ | ----------------------------------------------------------------------------------------------------------------------------------------------------- |
| `@pam` | Requires a matching Linux system user on the Proxmox host. Token auth works but permission resolution may fail silently if the OS user doesn't exist. |
| `@pve` | Proxmox-managed user. No Linux account needed. Works reliably with API tokens.                                                                        |

#### Why `--privsep=0`

| Flag          | Behavior                                                              | Security                                                                                                                                                                                              |
| ------------- | --------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `--privsep=0` | Token inherits the user's ACLs. Permissions are assigned to the user. | Simpler setup. User has no password so it can't be used to log in — only the token secret grants access.                                                                                              |
| `--privsep=1` | Token has **its own** ACLs, independent of the user.                  | More granular — but the token's effective permissions are the **intersection** of token ACLs and user ACLs. The user must have at least the same permissions as the token, or the token gets nothing. |

We use `privsep=0` because it's simpler and the user account is passwordless (can't be used to log in). If you need multiple tokens with different permission levels for the same user, use `privsep=1` and assign ACLs to **both** the user and each token.

### Step 4: Assign Permissions

Each ACL targets the **user** (`-user`) with the exact role for that path.

Replace `pve-04` with your node name and `local-zfs` with your container storage (run `pvesm status` to find it — look for `rootdir` or `images` content).

```bash
# 1. Read-only cluster visibility
pveum aclmod / -user 'infrahaus-alice@pve' -role InfraHaus.Audit

# 2. Container lifecycle within user's pool
pveum aclmod /pool/infrahaus-alice -user 'infrahaus-alice@pve' -role InfraHaus.Containers

# 3. Container creation + task polling on this node
pveum aclmod /nodes/pve-04 -user 'infrahaus-alice@pve' -role InfraHaus.Node

# 4. Disk allocation on container storage
pveum aclmod /storage/local-zfs -user 'infrahaus-alice@pve' -role InfraHaus.Storage
```

#### Why each ACL exists

| #   | Path                    | Role                   | Privileges at this path                                                  | Why this path                                                                                                                                                                                                                                                          |
| --- | ----------------------- | ---------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/`                     | `InfraHaus.Audit`      | `Sys.Audit`, `Datastore.Audit`                                           | Proxmox clusters require root-level audit for `GET /nodes/{node}/storage` and `GET /nodes/{node}/network` to return data. Per-path ACLs on `/storage/local` or `/nodes/pve-04` alone don't work for these endpoints. This role is strictly read-only.                  |
| 2   | `/pool/infrahaus-alice` | `InfraHaus.Containers` | `VM.Allocate`, `VM.Audit`, `VM.PowerMgmt`, `VM.Console`, `Pool.Allocate` | The isolation boundary. Token can only create, list, start, stop, and delete containers **inside this pool**. Other users' pools and unassigned containers are not manageable. `Pool.Allocate` lets the dashboard assign new containers to this pool at creation time. |
| 3   | `/nodes/pve-04`         | `InfraHaus.Node`       | `Sys.Audit`, `VM.Allocate`, `SDN.Use`                                    | `POST /nodes/pve-04/lxc` (create container) requires `VM.Allocate` **on the node**. `SDN.Use` is required to attach network bridges to containers. Task polling requires `Sys.Audit` on the node.                                                                      |
| 4   | `/storage/local-zfs`    | `InfraHaus.Storage`    | `Datastore.AllocateSpace`                                                | Creating a container allocates disk on this storage. The audit role on `/` provides `Datastore.Audit` (read), but writing disk data requires `Datastore.AllocateSpace` on the specific storage.                                                                        |

#### How pool isolation works

```
/pool/infrahaus-alice    ← alice's token can manage containers here
  └── CT 200             ← alice can manage (in her pool)
  └── CT 201             ← alice can manage (in her pool)

/pool/infrahaus-bob      ← bob's token can manage containers here
  └── CT 300             ← bob can manage (in his pool)

CT 100                   ← not in any pool — visible (read-only via InfraHaus.Audit) but NOT manageable
```

> **Read visibility:** `InfraHaus.Audit` on `/` means tokens can see all containers in the cluster via `GET /nodes/{node}/lxc`. They can only **manage** containers in their own pool. The dashboard filters containers to the configured node, and the Adopt flow handles pre-existing containers. For stricter read isolation, see [Restricting Read Visibility](#restricting-read-visibility).

### Step 5: Add the Node in the Dashboard

1. Log in to the InfraHaus dashboard
2. Go to **Settings** → **Nodes** → **Add Node**
3. Fill in:
   - **Name**: `pve-04` (must match your Proxmox node name exactly)
   - **Host**: `192.168.0.94` (your Proxmox IP or hostname)
   - **Port**: `8006`
   - **Token ID**: `infrahaus-alice@pve!dashboard`
   - **Token Secret**: the UUID from step 3
   - **Resource Pool**: `infrahaus-alice`
4. Click **Save** — the dashboard tests the connection before saving

## Verification

```bash
export TOKEN_ID="infrahaus-alice@pve!dashboard"
export TOKEN_SECRET="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export PVE_HOST="192.168.0.94"
export NODE="pve-04"

# Should work: list cluster nodes
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/nodes" | jq '.data[].node'

# Should work: list storages
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/nodes/${NODE}/storage" | jq '.data[].storage'

# Should work: list network bridges
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/nodes/${NODE}/network" | jq '.data[] | select(.type=="bridge") | .iface'

# Should work: list OS templates
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/nodes/${NODE}/storage/local/content?content=vztmpl" | jq '.data[].volid'

# Should work: next free VMID
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/cluster/nextid" | jq '.data'

# Should FAIL (403): manage a container outside your pool
curl -s -k -X POST -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/nodes/${NODE}/lxc/100/status/stop"
```

### From the Dashboard

1. **Containers page** shows containers (or empty state if none in your pool yet)
2. **Create Container** wizard shows OS templates, storage options, and network bridges
3. New containers are assigned to your pool automatically
4. You can start/stop/delete containers you created

## Adding Another User

Roles already exist. Repeat steps 2-5 for each new user:

```bash
# Pool
pveum pool add infrahaus-bob -comment "Containers managed by bob via InfraHaus"

# User + token (pve realm, privsep=0)
pveum user add infrahaus-bob@pve -comment "InfraHaus dashboard — bob"
pveum user token add infrahaus-bob@pve dashboard --privsep=0 --comment "InfraHaus dashboard"

# Permissions on the USER (4 ACLs, different pool)
pveum aclmod / -user 'infrahaus-bob@pve' -role InfraHaus.Audit
pveum aclmod /pool/infrahaus-bob -user 'infrahaus-bob@pve' -role InfraHaus.Containers
pveum aclmod /nodes/pve-04 -user 'infrahaus-bob@pve' -role InfraHaus.Node
pveum aclmod /storage/local-zfs -user 'infrahaus-bob@pve' -role InfraHaus.Storage
```

## Revoking Access

### Remove one user

```bash
# Delete token (immediately revokes all API access)
pveum user token remove infrahaus-alice@pve dashboard

# Clean up ACLs, user, and pool
pveum aclmod / -user 'infrahaus-alice@pve' -delete -role InfraHaus.Audit
pveum aclmod /pool/infrahaus-alice -user 'infrahaus-alice@pve' -delete -role InfraHaus.Containers
pveum aclmod /nodes/pve-04 -user 'infrahaus-alice@pve' -delete -role InfraHaus.Node
pveum aclmod /storage/local-zfs -user 'infrahaus-alice@pve' -delete -role InfraHaus.Storage
pveum user delete infrahaus-alice@pve
pveum pool delete infrahaus-alice  # only if empty — delete containers first
```

### Remove InfraHaus entirely

After removing all users:

```bash
pveum role delete InfraHaus.Audit
pveum role delete InfraHaus.Containers
pveum role delete InfraHaus.Node
pveum role delete InfraHaus.Storage
```

## Multi-Node Setup

**Standalone nodes (not clustered):** Repeat this entire guide on each node.

**Clustered nodes:** Roles, users, and ACLs are cluster-wide. Add one node ACL per node the user should deploy to:

```bash
pveum aclmod /nodes/pve-01 -user 'infrahaus-alice@pve' -role InfraHaus.Node
pveum aclmod /nodes/pve-04 -user 'infrahaus-alice@pve' -role InfraHaus.Node
```

If different nodes use different container storages, add a storage ACL for each:

```bash
pveum aclmod /storage/local-zfs -user 'infrahaus-alice@pve' -role InfraHaus.Storage
pveum aclmod /storage/local-lvm -user 'infrahaus-alice@pve' -role InfraHaus.Storage
```

## Restricting Read Visibility

`InfraHaus.Audit` on `/` gives read-only visibility to all nodes, storages, and containers in the cluster. To prevent users from seeing other people's containers at the cluster level, you can remove `VM.Audit` from the audit role — container visibility within the user's pool is still granted by `InfraHaus.Containers`:

```bash
# More restrictive: no cluster-wide VM listing
pveum role modify InfraHaus.Audit -privs "Sys.Audit,Datastore.Audit"
```

This is already the default. The `InfraHaus.Audit` role as defined above does **not** include `VM.Audit` — only `InfraHaus.Containers` (on the pool path) includes it.

> **If the dashboard shows containers from other nodes:** This is expected behavior from `GET /nodes/{node}/lxc`. The dashboard already filters by the configured node name. Containers from other nodes won't appear in the UI even if the API returns them.

## Using `privsep=1` (Advanced)

If you need multiple tokens with different permission levels for the same user (e.g., a read-only token and a full-access token), use `privsep=1`. With privilege separation enabled, the token's effective permissions are the **intersection** of the token's ACLs and the user's ACLs. This means:

1. The **user** must have at least the same permissions as the token
2. The **token** also needs its own ACLs

```bash
# Create token with privsep=1
pveum user token add infrahaus-alice@pve dashboard --privsep=1

# ACLs on BOTH user AND token
pveum aclmod / -user 'infrahaus-alice@pve' -role InfraHaus.Audit
pveum aclmod / -token 'infrahaus-alice@pve!dashboard' -role InfraHaus.Audit
# ... repeat for all 4 paths
```

If the user has permissions but the token doesn't (or vice versa), the token gets **nothing**. Both must be set.

## Summary

| What            | Name                                                                     | Created once per |
| --------------- | ------------------------------------------------------------------------ | ---------------- |
| 4 custom roles  | `InfraHaus.Audit`, `.Containers`, `.Node`, `.Storage`                    | Cluster          |
| 1 resource pool | `infrahaus-{username}`                                                   | User             |
| 1 PVE user      | `infrahaus-{username}@pve` (no password)                                 | User             |
| 1 API token     | `infrahaus-{username}@pve!dashboard` (`privsep=0`)                       | User             |
| 4 ACL entries   | On `/`, `/pool/...`, `/nodes/...`, `/storage/...` targeting the **user** | User             |

## Reference

- [Proxmox VE User Management](https://pve.proxmox.com/wiki/User_Management)
- [Proxmox VE API Permissions](https://pve.proxmox.com/pve-docs/pveum-plain.html)
- [Proxmox VE API Viewer](https://pve.proxmox.com/pve-docs/api-viewer/)

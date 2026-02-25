# Proxmox API Token Setup

Least-privilege API token setup for the InfraHaus dashboard. Permissions are assigned directly to the **token** (not the user) with a dedicated role per ACL path, so each path grants only the exact privileges needed there.

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

# Container creation on a specific node (submit creation, poll tasks)
pveum role add InfraHaus.Node -privs "Sys.Audit,VM.Allocate"

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
| `InfraHaus.Node`       | `Sys.Audit`, `VM.Allocate`                                               | No VM.PowerMgmt (lifecycle is via pool), no Datastore.\*                                                    |
| `InfraHaus.Storage`    | `Datastore.AllocateSpace`                                                | No Datastore.Allocate (can't create/delete volumes), no Datastore.AllocateTemplate (can't upload templates) |

#### Privileges NOT included anywhere

| Privilege                    | Why excluded                                               |
| ---------------------------- | ---------------------------------------------------------- |
| `Sys.Modify`                 | Dashboard doesn't change node configuration                |
| `Sys.PowerMgmt`              | Dashboard doesn't reboot/shutdown the host                 |
| `Sys.Console`                | Dashboard doesn't access the host console                  |
| `VM.Config.*`                | Container config is set at creation time via `VM.Allocate` |
| `VM.Migrate`                 | Dashboard doesn't move containers between nodes            |
| `VM.Snapshot*`               | Dashboard doesn't manage snapshots                         |
| `VM.Backup`                  | Dashboard doesn't create backups                           |
| `VM.Clone`                   | Dashboard creates from OS templates, not clones            |
| `Datastore.Allocate`         | Dashboard doesn't create/delete storage volumes            |
| `Datastore.AllocateTemplate` | Dashboard doesn't upload OS templates                      |
| `User.*`, `Realm.*`          | Dashboard doesn't manage Proxmox users                     |
| `SDN.*`                      | Dashboard doesn't manage software-defined networking       |
| `Permissions.Modify`         | Dashboard doesn't change ACLs                              |

### Step 2: Create a Resource Pool

Each dashboard user gets their own pool. Containers in the pool are visible only to that user's token.

```bash
pveum pool add infrahaus-alice -comment "Containers managed by alice via InfraHaus"
```

### Step 3: Create the User and Token

The user is a blank shell — all permissions go on the token via `privsep=1`.

```bash
# Create user (no password needed — dashboard uses tokens, never passwords)
pveum user add infrahaus-alice@pam -comment "InfraHaus dashboard — alice"

# Create token with privilege separation ENABLED
pveum user token add infrahaus-alice@pam dashboard --privsep=1 --comment "InfraHaus dashboard"
```

Output:

```
┌──────────────┬──────────────────────────────────────┐
│ key          │ value                                │
╞══════════════╪══════════════════════════════════════╡
│ full-tokenid │ infrahaus-alice@pam!dashboard        │
│ info         │ {"comment":"InfraHaus dashboard"}    │
│ value        │ xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx │
└──────────────┴──────────────────────────────────────┘
```

**Save the token secret immediately** — Proxmox only shows it once.

#### Why `--privsep=1`

| Flag          | Behavior                                                                            | Security                                                                                                     |
| ------------- | ----------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ |
| `--privsep=1` | Token has **its own** ACLs, independent of the user. User account is a blank shell. | **More secure.** If the user account is compromised, it has zero permissions. Only the token secret matters. |
| `--privsep=0` | Token inherits the user's ACLs.                                                     | Less secure — compromising the user or the token both grant full access.                                     |

With `privsep=1`, ACLs are assigned to `infrahaus-alice@pam!dashboard` (the token) instead of `infrahaus-alice@pam` (the user).

### Step 4: Assign Permissions

Each ACL targets the **token** (`-token`) with the exact role for that path.

Replace `pve-04` with your node name and `local-zfs` with your container storage (run `pvesm status` to find it — look for `rootdir` or `images` content).

```bash
# 1. Read-only cluster visibility
pveum aclmod / -token 'infrahaus-alice@pam!dashboard' -role InfraHaus.Audit

# 2. Container lifecycle within user's pool
pveum aclmod /pool/infrahaus-alice -token 'infrahaus-alice@pam!dashboard' -role InfraHaus.Containers

# 3. Container creation + task polling on this node
pveum aclmod /nodes/pve-04 -token 'infrahaus-alice@pam!dashboard' -role InfraHaus.Node

# 4. Disk allocation on container storage
pveum aclmod /storage/local-zfs -token 'infrahaus-alice@pam!dashboard' -role InfraHaus.Storage
```

#### Why each ACL exists

| #   | Path                    | Role                   | Privileges at this path                                                  | Why this path                                                                                                                                                                                                                                                          |
| --- | ----------------------- | ---------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/`                     | `InfraHaus.Audit`      | `Sys.Audit`, `Datastore.Audit`                                           | Proxmox clusters require root-level audit for `GET /nodes/{node}/storage` and `GET /nodes/{node}/network` to return data. Per-path ACLs on `/storage/local` or `/nodes/pve-04` alone don't work for these endpoints. This role is strictly read-only.                  |
| 2   | `/pool/infrahaus-alice` | `InfraHaus.Containers` | `VM.Allocate`, `VM.Audit`, `VM.PowerMgmt`, `VM.Console`, `Pool.Allocate` | The isolation boundary. Token can only create, list, start, stop, and delete containers **inside this pool**. Other users' pools and unassigned containers are not manageable. `Pool.Allocate` lets the dashboard assign new containers to this pool at creation time. |
| 3   | `/nodes/pve-04`         | `InfraHaus.Node`       | `Sys.Audit`, `VM.Allocate`                                               | `POST /nodes/pve-04/lxc` (create container) requires `VM.Allocate` **on the node**. Task polling (`GET /nodes/{node}/tasks/{upid}/status`) requires `Sys.Audit` on the node. The audit on `/` covers read operations, but creation needs node-level write access.      |
| 4   | `/storage/local-zfs`    | `InfraHaus.Storage`    | `Datastore.AllocateSpace`                                                | Creating a container allocates disk on this storage. The audit role on `/` provides `Datastore.Audit` (read), but writing disk data requires `Datastore.AllocateSpace` on the specific storage.                                                                        |

#### How pool isolation works

```
/pool/infrahaus-alice    ← alice's token has InfraHaus.Containers here
  └── CT 200             ← alice can manage (in her pool)
  └── CT 201             ← alice can manage (in her pool)

/pool/infrahaus-bob      ← bob's token has InfraHaus.Containers here
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
   - **Token ID**: `infrahaus-alice@pam!dashboard`
   - **Token Secret**: the UUID from step 3
   - **Pool**: `infrahaus-alice`
4. Click **Save** — the dashboard tests the connection before saving

## Verification

```bash
export TOKEN_ID="infrahaus-alice@pam!dashboard"
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

Roles already exist. Repeat steps 2–5 for each new user:

```bash
# Pool
pveum pool add infrahaus-bob -comment "Containers managed by bob via InfraHaus"

# User + token
pveum user add infrahaus-bob@pam -comment "InfraHaus dashboard — bob"
pveum user token add infrahaus-bob@pam dashboard --privsep=1 --comment "InfraHaus dashboard"

# Permissions on the TOKEN (4 ACLs, different pool)
pveum aclmod / -token 'infrahaus-bob@pam!dashboard' -role InfraHaus.Audit
pveum aclmod /pool/infrahaus-bob -token 'infrahaus-bob@pam!dashboard' -role InfraHaus.Containers
pveum aclmod /nodes/pve-04 -token 'infrahaus-bob@pam!dashboard' -role InfraHaus.Node
pveum aclmod /storage/local-zfs -token 'infrahaus-bob@pam!dashboard' -role InfraHaus.Storage
```

## Revoking Access

### Remove one user

```bash
# Delete token (immediately revokes all API access)
pveum user token remove infrahaus-alice@pam dashboard

# Clean up ACLs, user, and pool
pveum aclmod / -token 'infrahaus-alice@pam!dashboard' -delete -role InfraHaus.Audit
pveum aclmod /pool/infrahaus-alice -token 'infrahaus-alice@pam!dashboard' -delete -role InfraHaus.Containers
pveum aclmod /nodes/pve-04 -token 'infrahaus-alice@pam!dashboard' -delete -role InfraHaus.Node
pveum aclmod /storage/local-zfs -token 'infrahaus-alice@pam!dashboard' -delete -role InfraHaus.Storage
pveum user delete infrahaus-alice@pam
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
pveum aclmod /nodes/pve-01 -token 'infrahaus-alice@pam!dashboard' -role InfraHaus.Node
pveum aclmod /nodes/pve-04 -token 'infrahaus-alice@pam!dashboard' -role InfraHaus.Node
```

If different nodes use different container storages, add a storage ACL for each:

```bash
pveum aclmod /storage/local-zfs -token 'infrahaus-alice@pam!dashboard' -role InfraHaus.Storage
pveum aclmod /storage/local-lvm -token 'infrahaus-alice@pam!dashboard' -role InfraHaus.Storage
```

## Restricting Read Visibility

`InfraHaus.Audit` on `/` gives read-only visibility to all nodes, storages, and containers in the cluster. To prevent users from seeing other people's containers at the cluster level, you can remove `VM.Audit` from the audit role — container visibility within the user's pool is still granted by `InfraHaus.Containers`:

```bash
# More restrictive: no cluster-wide VM listing
pveum role modify InfraHaus.Audit -privs "Sys.Audit,Datastore.Audit"
```

This is already the default. The `InfraHaus.Audit` role as defined above does **not** include `VM.Audit` — only `InfraHaus.Containers` (on the pool path) includes it.

> **If the dashboard shows containers from other nodes:** This is expected behavior from `GET /nodes/{node}/lxc`. The dashboard already filters by the configured node name. Containers from other nodes won't appear in the UI even if the API returns them.

## Summary

| What            | Name                                                                      | Created once per |
| --------------- | ------------------------------------------------------------------------- | ---------------- |
| 4 custom roles  | `InfraHaus.Audit`, `.Containers`, `.Node`, `.Storage`                     | Cluster          |
| 1 resource pool | `infrahaus-{username}`                                                    | User             |
| 1 PAM user      | `infrahaus-{username}@pam`                                                | User             |
| 1 API token     | `infrahaus-{username}@pam!dashboard` (`privsep=1`)                        | User             |
| 4 ACL entries   | On `/`, `/pool/...`, `/nodes/...`, `/storage/...` targeting the **token** | User             |

## Reference

- [Proxmox VE User Management](https://pve.proxmox.com/wiki/User_Management)
- [Proxmox VE API Permissions](https://pve.proxmox.com/pve-docs/pveum-plain.html)
- [Proxmox VE API Viewer](https://pve.proxmox.com/pve-docs/api-viewer/)

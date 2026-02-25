# Proxmox API Token Setup

Least-privilege API token setup for the InfraHaus dashboard. Uses a resource pool for container isolation so multiple users can share the same Proxmox node without seeing each other's containers.

## What the Dashboard Needs

The dashboard makes these Proxmox API calls:

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

All commands run as `root` on any node in your Proxmox cluster. Roles and users are cluster-wide — you only need to do this once, not per-node.

### Step 1: Create the Custom Role

```bash
pveum role add InfraHaus -privs "VM.Allocate,VM.Audit,VM.PowerMgmt,VM.Console,Pool.Allocate,Datastore.AllocateSpace"
```

This role is used on **scoped paths** (pool, node, storage) to grant write access. You only create it once — all dashboard users share it.

#### What each privilege does

| Privilege                 | Why                                                |
| ------------------------- | -------------------------------------------------- |
| `VM.Allocate`             | Create and delete LXC containers                   |
| `VM.Audit`                | List containers, read config/status/interfaces     |
| `VM.PowerMgmt`            | Start, stop, shutdown containers                   |
| `VM.Console`              | Container console access                           |
| `Pool.Allocate`           | Assign newly created containers to the user's pool |
| `Datastore.AllocateSpace` | Allocate rootfs disk when creating containers      |

#### What's NOT included and why

| Privilege                    | Why excluded                                            |
| ---------------------------- | ------------------------------------------------------- |
| `Sys.*`                      | No node config changes, no host reboot, no host console |
| `VM.Config.*`                | Config is set at creation time via `VM.Allocate`        |
| `VM.Migrate`                 | Dashboard doesn't move containers between nodes         |
| `VM.Snapshot*`               | Dashboard doesn't manage snapshots                      |
| `VM.Backup`                  | Dashboard doesn't create backups                        |
| `VM.Clone`                   | Dashboard creates from OS templates, not clones         |
| `Datastore.Allocate`         | Dashboard doesn't create/delete storage volumes         |
| `Datastore.AllocateTemplate` | Dashboard doesn't upload OS templates                   |
| `User.*`, `Realm.*`          | Dashboard doesn't manage Proxmox users                  |
| `SDN.*`                      | Dashboard doesn't manage software-defined networking    |
| `Permissions.Modify`         | Dashboard doesn't change ACLs                           |

### Step 2: Create a Resource Pool

Each dashboard user gets their own pool. Containers in the pool are visible only to that user's token.

```bash
pveum pool add infrahaus-alice -comment "Containers managed by alice via InfraHaus"
```

### Step 3: Create the User

```bash
pveum user add infrahaus-alice@pam -comment "InfraHaus dashboard — alice"
```

No password needed — the dashboard uses API tokens, never passwords.

### Step 4: Assign Permissions

This is where security scoping happens. Each ACL path serves a specific purpose.

```bash
# 1. Read-only cluster visibility (built-in role)
pveum aclmod / -user infrahaus-alice@pam -role PVEAuditor

# 2. Container management in user's pool
pveum aclmod /pool/infrahaus-alice -user infrahaus-alice@pam -role InfraHaus

# 3. Task polling + container creation on this node
pveum aclmod /nodes/pve-04 -user infrahaus-alice@pam -role InfraHaus

# 4. Disk allocation on the container storage
pveum aclmod /storage/local-zfs -user infrahaus-alice@pam -role InfraHaus
```

> **Storage names differ per setup.** Run `pvesm status` to find yours. You need the storage with `rootdir` or `images` content — that's where container disks are created. Common names: `local-lvm`, `local-zfs`, `zfspool`.

#### Why each ACL path is needed

| #   | Path                    | Role         | What it grants                                                     | Why this path                                                                                                                                                                                                                                                              |
| --- | ----------------------- | ------------ | ------------------------------------------------------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | `/`                     | `PVEAuditor` | Read-only: list nodes, storages, networks, templates, task status  | Proxmox clusters require root-level audit for `GET /nodes/{node}/storage` and `GET /nodes/{node}/network` to return data. Per-path ACLs (e.g. `/storage/local`) do not work for these endpoints. `PVEAuditor` is read-only — it cannot create, modify, or delete anything. |
| 2   | `/pool/infrahaus-alice` | `InfraHaus`  | Create, list, start, stop, delete containers **in this pool only** | This is the isolation boundary. The token can only manage containers inside this pool. Other users' pools and unassigned containers are invisible.                                                                                                                         |
| 3   | `/nodes/pve-04`         | `InfraHaus`  | Submit `POST /nodes/pve-04/lxc` (create), poll task status         | The `PVEAuditor` on `/` only grants read. Creating a container and polling tasks require `VM.Allocate` and `Sys.Audit` **on the specific node**, which `InfraHaus` provides here.                                                                                          |
| 4   | `/storage/local-zfs`    | `InfraHaus`  | `Datastore.AllocateSpace` for rootfs disk allocation               | Creating a container needs to write disk data to this storage. `PVEAuditor` only grants `Datastore.Audit` (read). This ACL adds the write permission on the specific storage used for container disks.                                                                     |

#### How pool isolation works

```
/pool/infrahaus-alice    ← alice's token has InfraHaus here
  └── CT 200             ← alice can manage (in her pool)
  └── CT 201             ← alice can manage (in her pool)

/pool/infrahaus-bob      ← bob's token has InfraHaus here
  └── CT 300             ← bob can manage (in his pool)

CT 100                   ← not in any InfraHaus pool — visible via PVEAuditor (read-only) but NOT manageable
```

> **Note:** `PVEAuditor` on `/` means all users can **see** all containers in the cluster via `GET /nodes/{node}/lxc`. However, they can only **manage** (start, stop, delete) containers in their own pool. The dashboard filters the container list to the user's node, and the Adopt flow handles pre-existing containers. If even read visibility is a concern, see [Restricting Read Visibility](#restricting-read-visibility).

### Step 5: Create the API Token

```bash
pveum user token add infrahaus-alice@pam dashboard --privsep=0 --comment "InfraHaus dashboard"
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

#### `--privsep=0` is required

| Flag                    | Meaning                                                                                                                                  |
| ----------------------- | ---------------------------------------------------------------------------------------------------------------------------------------- |
| `--privsep=0`           | Token inherits the user's permissions. **Use this.**                                                                                     |
| `--privsep=1` (default) | Token has **zero** permissions regardless of user ACLs. You'd need to assign ACLs to the token separately. Easy to misconfigure — avoid. |

### Step 6: Add the Node in the Dashboard

1. Log in to the InfraHaus dashboard
2. Go to **Settings** → **Nodes** → **Add Node**
3. Fill in:
   - **Name**: `pve-04` (must match your Proxmox node name exactly)
   - **Host**: `192.168.0.94` (your Proxmox IP or hostname)
   - **Port**: `8006`
   - **Token ID**: `infrahaus-alice@pam!dashboard`
   - **Token Secret**: the UUID from step 5
   - **Pool**: `infrahaus-alice`
4. Click **Save** — the dashboard tests the connection before saving

## Verification

### From the CLI

```bash
export TOKEN_ID="infrahaus-alice@pam!dashboard"
export TOKEN_SECRET="xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx"
export PVE_HOST="192.168.0.94"
export NODE="pve-04"

# Should work: list cluster nodes
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/nodes" | jq '.data[].node'

# Should work: list storages on your node
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/nodes/${NODE}/storage" | jq '.data[].storage'

# Should work: list network bridges
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/nodes/${NODE}/network" | jq '.data[] | select(.type=="bridge") | .iface'

# Should work: list OS templates
curl -s -k -H "Authorization: PVEAPIToken=${TOKEN_ID}=${TOKEN_SECRET}" \
  "https://${PVE_HOST}:8006/api2/json/nodes/${NODE}/storage/local/content?content=vztmpl" | jq '.data[].volid'

# Should work: get next free VMID
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

Repeat steps 2–6 for each new user. The `InfraHaus` role and `PVEAuditor` are shared — only pools, users, ACLs, and tokens are per-user.

```bash
# Pool
pveum pool add infrahaus-bob -comment "Containers managed by bob via InfraHaus"

# User
pveum user add infrahaus-bob@pam -comment "InfraHaus dashboard — bob"

# Permissions (same 4 ACLs, different user and pool)
pveum aclmod / -user infrahaus-bob@pam -role PVEAuditor
pveum aclmod /pool/infrahaus-bob -user infrahaus-bob@pam -role InfraHaus
pveum aclmod /nodes/pve-04 -user infrahaus-bob@pam -role InfraHaus
pveum aclmod /storage/local-zfs -user infrahaus-bob@pam -role InfraHaus

# Token
pveum user token add infrahaus-bob@pam dashboard --privsep=0 --comment "InfraHaus dashboard"
```

## Revoking Access

### Remove one user

```bash
pveum user token remove infrahaus-alice@pam dashboard
pveum aclmod / -user infrahaus-alice@pam -delete -role PVEAuditor
pveum aclmod /pool/infrahaus-alice -user infrahaus-alice@pam -delete -role InfraHaus
pveum aclmod /nodes/pve-04 -user infrahaus-alice@pam -delete -role InfraHaus
pveum aclmod /storage/local-zfs -user infrahaus-alice@pam -delete -role InfraHaus
pveum user delete infrahaus-alice@pam
pveum pool delete infrahaus-alice  # only if empty
```

### Remove InfraHaus entirely

After removing all users:

```bash
pveum role delete InfraHaus
```

## Multi-Node Setup

**Standalone nodes (not clustered):** Repeat this entire guide on each node. Each gets its own role, users, tokens, and pools.

**Clustered nodes:** Roles, users, and ACLs are cluster-wide. Add one ACL per node the user should deploy to:

```bash
pveum aclmod /nodes/pve-01 -user infrahaus-alice@pam -role InfraHaus
pveum aclmod /nodes/pve-04 -user infrahaus-alice@pam -role InfraHaus
```

## Restricting Read Visibility

`PVEAuditor` on `/` gives read-only visibility to the entire cluster. If you need to prevent users from even seeing other nodes or containers, you can create a minimal read-only role instead:

```bash
pveum role add InfraHausAudit -privs "Sys.Audit,Datastore.Audit,Pool.Audit"
pveum aclmod / -user infrahaus-alice@pam -role InfraHausAudit
```

This is more restrictive than `PVEAuditor` — it excludes `VM.Audit` (can't list other people's containers at the cluster level), `SDN.Audit`, `Mapping.Audit`, and `VM.GuestAgent.Audit`. Container visibility within the pool is still granted by the `InfraHaus` role on the pool path.

> **Test this carefully.** If the dashboard breaks with the restricted role, fall back to `PVEAuditor`.

## Reference

- [Proxmox VE User Management](https://pve.proxmox.com/wiki/User_Management)
- [Proxmox VE API Permissions](https://pve.proxmox.com/pve-docs/pveum-plain.html)
- [Proxmox VE API Viewer](https://pve.proxmox.com/pve-docs/api-viewer/)

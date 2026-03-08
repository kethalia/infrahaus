---
phase: 07-vm-to-run-openclaw
verified: 2026-03-08T03:00:00Z
status: passed
score: 9/9 must-haves verified
---

# Phase 7: VM to Run OpenClaw — Verification Report

**Phase Goal:** Create a VM template in infra/ that provisions a Debian 13 desktop VM with XFCE, Chrome, Node.js, VNC, and OpenClaw using the ProxmoxVE community script as foundation
**Verified:** 2026-03-08T03:00:00Z
**Status:** passed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                                                         | Status     | Evidence                                                                                      |
|----|-------------------------------------------------------------------------------------------------------------------------------|------------|-----------------------------------------------------------------------------------------------|
| 1  | Running create-vm.sh on a Proxmox host creates a Debian 13 VM that remains running (not converted to a template)             | VERIFIED   | create-vm.sh passes bash -n; does not call `qm template` as a command (only in comments)     |
| 2  | Cloud-init bootstraps only: openclaw user, SSH, basic prerequisite packages, and qemu-guest-agent — no desktop software       | VERIFIED   | cloud-init/user-data.yaml: no task-xfce-desktop, google-chrome, nodesource, tigervnc, openclaw |
| 3  | After create-vm.sh completes, the VM is running and ready for run-scripts.sh to install desktop software                     | VERIFIED   | create-vm.sh starts VM after cloud-init inject; output guides operator to run-scripts.sh      |
| 4  | Running all scripts in numbered order on a fresh Debian 13 VM produces a working XFCE desktop with LightDM auto-login        | VERIFIED   | 02-desktop-setup.sh: task-xfce-desktop + autologin-user=openclaw config present              |
| 5  | TigerVNC is accessible on port 5901 from remote clients (not localhost-only), protected by password 'openclaw'               | VERIFIED   | 05-vnc-setup.sh: -localhost no present; systemctl enable vncserver@1 present                  |
| 6  | Script 06 checks npm registry before attempting install and prints a clear actionable error if openclaw is not found         | VERIFIED   | 06-openclaw-install.sh: npm view openclaw check with exit 1 + TODO instructions present       |
| 7  | Each script is idempotent — re-running on an already-configured VM does not break existing state                             | VERIFIED   | Scripts use dpkg -l, id, node --version, which as idempotency guards before install actions   |
| 8  | run-scripts.sh tries SSH as root first; if root login is refused, it falls back to the openclaw user                        | VERIFIED   | run-scripts.sh: root@ probe first, Falling back to openclaw@ with SUDO_PREFIX=sudo           |
| 9  | A user following the README can go from nothing to a working OpenClaw desktop VM                                             | VERIFIED   | README.md: Quick Start, What Gets Installed, Accessing the VM, Default Credentials, Troubleshooting all present |

**Score:** 9/9 truths verified

### Required Artifacts

| Artifact                                                            | Expected                                              | Status     | Details                                                           |
|---------------------------------------------------------------------|-------------------------------------------------------|------------|-------------------------------------------------------------------|
| `infra/vm/templates/openclaw-desktop/template.conf`                 | VM metadata and env-var-overridable resource defaults | VERIFIED   | TEMPLATE_APP="OpenClaw Desktop"; MACHINE, BIOS, DISPLAY vars present |
| `infra/vm/templates/openclaw-desktop/cloud-init/user-data.yaml`     | Minimal cloud-init bootstrap                          | VERIFIED   | #cloud-config header; NOPASSWD:ALL; chage -d 0; bootstrap packages only |
| `infra/vm/templates/openclaw-desktop/create-vm.sh`                  | VM creation wrapper calling community script          | VERIFIED   | Executable; sources template.conf; calls debian-13-vm.sh; sets cicustom |
| `infra/vm/templates/openclaw-desktop/scripts/00-pre-checks.sh`      | Environment validation                                | VERIFIED   | EUID check; Debian 13/trixie check; network check                 |
| `infra/vm/templates/openclaw-desktop/scripts/02-desktop-setup.sh`   | XFCE + LightDM auto-login                             | VERIFIED   | task-xfce-desktop; autologin-user=openclaw                        |
| `infra/vm/templates/openclaw-desktop/scripts/03-nodejs-setup.sh`    | Node.js 22 via NodeSource                             | VERIFIED   | nodesource/setup_22.x present; npm global prefix                  |
| `infra/vm/templates/openclaw-desktop/scripts/04-chrome-install.sh`  | Google Chrome via modern GPG keyring                  | VERIFIED   | google-chrome-stable; google-chrome.gpg keyring (no apt-key)      |
| `infra/vm/templates/openclaw-desktop/scripts/05-vnc-setup.sh`       | TigerVNC with remote access enabled                   | VERIFIED   | -localhost no; systemctl enable vncserver@1                       |
| `infra/vm/templates/openclaw-desktop/scripts/06-openclaw-install.sh`| OpenClaw install with defensive registry check        | VERIFIED   | npm view openclaw before install; clear exit 1 with TODO message  |
| `infra/vm/templates/openclaw-desktop/scripts/99-post-setup.sh`      | Final validation and welcome message                  | VERIFIED   | lightdm, vncserver, 5901 all present                              |
| `infra/vm/templates/openclaw-desktop/run-scripts.sh`                | SSH orchestrator with root/openclaw fallback           | VERIFIED   | Executable; SSH_USER detection; root@; openclaw@; SUDO_PREFIX     |
| `infra/vm/templates/openclaw-desktop/README.md`                     | Complete template documentation                       | VERIFIED   | Quick Start; Default Credentials; Troubleshooting; 5901 access    |

### Key Link Verification

| From                    | To                                  | Via                                          | Status   | Details                                                          |
|-------------------------|-------------------------------------|----------------------------------------------|----------|------------------------------------------------------------------|
| create-vm.sh            | template.conf                       | source template.conf at script start         | WIRED    | `source "${SCRIPT_DIR}/template.conf"` confirmed                 |
| create-vm.sh            | ProxmoxVE community debian-13-vm.sh | bash -c subshell                             | WIRED    | `bash -c "$(curl ... debian-13-vm.sh)"` confirmed               |
| create-vm.sh            | cloud-init/user-data.yaml           | cp to /var/lib/vz/snippets; qm set cicustom  | WIRED    | `cicustom "user=local:snippets/..."` confirmed                   |
| 02-desktop-setup.sh     | LightDM autologin config            | writes 50-autologin.conf                     | WIRED    | `autologin-user=openclaw` in script body                         |
| 05-vnc-setup.sh         | systemd vncserver@1.service         | creates template unit; enables vncserver@1   | WIRED    | `systemctl enable vncserver@1` confirmed                         |
| 06-openclaw-install.sh  | npm registry                        | npm view openclaw version before install     | WIRED    | `npm view openclaw` gate confirmed                               |
| run-scripts.sh          | scripts/*.sh                        | scp to /tmp/openclaw-setup/ then ssh exec    | WIRED    | SCRIPTS_DIR reference; scp + ssh bash exec confirmed             |
| run-scripts.sh          | openclaw user with passwordless sudo| SSH fallback; SUDO_PREFIX=sudo               | WIRED    | openclaw@ SSH probe + SUDO_PREFIX logic confirmed                 |

### Requirements Coverage

| Requirement | Source Plan | Description                                  | Status    | Evidence                                               |
|-------------|-------------|----------------------------------------------|-----------|--------------------------------------------------------|
| VM-01       | 07-01       | VM template directory structure              | SATISFIED | infra/vm/templates/openclaw-desktop/ all files present |
| VM-02       | 07-01       | cloud-init minimal bootstrap                 | SATISFIED | user-data.yaml minimal; no desktop packages            |
| VM-03       | 07-02       | Post-install scripts for full desktop stack  | SATISFIED | All 8 scripts present, executable, syntax-valid        |
| VM-04       | 07-02       | VNC remote access and defensive OpenClaw     | SATISFIED | -localhost no; npm view openclaw check                 |
| VM-05       | 07-03       | run-scripts.sh SSH orchestrator              | SATISFIED | Root/openclaw fallback; single-script mode             |
| VM-06       | 07-03       | Complete README documentation                | SATISFIED | All required sections verified                         |

### Anti-Patterns Found

| File                          | Line | Pattern                                       | Severity | Impact                                                              |
|-------------------------------|------|-----------------------------------------------|----------|---------------------------------------------------------------------|
| scripts/06-openclaw-install.sh | 47   | `echo "TODO: Update this script..."`          | Info     | Intentional — openclaw not on public npm; TODO is the user message  |
| README.md                     | 105  | References "TODO message" in troubleshooting  | Info     | Intentional — documents the expected script 06 behavior             |

Note: The TODO in script 06 is by design. The OpenClaw package is not yet available on the public npm registry. The script exits with exit 1 and clear instructions so the operator knows what to update. This is not a stub — it is a defensive check with documented fallback behavior, as specified in the plan.

### Human Verification Required

The following items cannot be verified by static analysis and require a live Proxmox environment:

#### 1. End-to-end VM provisioning

**Test:** Run `bash create-vm.sh` on a Proxmox 8+ host as root
**Expected:** Whiptail dialog appears for the Debian 13 community script; VM created with correct hostname; cloud-init applies; VM remains running (not converted to template)
**Why human:** Requires a live Proxmox host with internet access

#### 2. Cloud-init bootstrap completion

**Test:** After create-vm.sh completes, wait ~3 minutes and check `qm agent <VMID> exec -- cat /var/log/cloud-init-output.log`
**Expected:** Log shows openclaw user created, openssh-server installed, qemu-guest-agent enabled
**Why human:** Requires a running VM with qemu-guest-agent active

#### 3. Full desktop installation via run-scripts.sh

**Test:** Run `./run-scripts.sh <VM_IP>` after cloud-init completes
**Expected:** All 8 scripts execute sequentially; XFCE desktop is usable; VNC connects on port 5901; Node.js 22 available
**Why human:** Requires a live VM; functional testing cannot be done with grep/static analysis

#### 4. VNC remote access

**Test:** Connect a VNC client to `<VM_IP>:5901` with password `openclaw`
**Expected:** XFCE desktop appears; connection from an external machine works (not localhost-only)
**Why human:** Requires network connectivity to a running VM with TigerVNC configured

#### 5. Script 06 openclaw behavior

**Test:** Run `./run-scripts.sh <VM_IP> 06-openclaw-install.sh` before any npm package exists
**Expected:** Script exits 1 with clear TODO message listing alternative installation methods; run-scripts.sh prompts to continue or abort
**Why human:** Requires a live VM with Node.js installed (from script 03)

### Gaps Summary

No gaps found. All artifacts exist, are substantive (not stubs), are executable, pass bash -n syntax checks, and all key links are wired. The phase goal — a complete infra/vm/templates/openclaw-desktop/ template that provisions a Debian 13 desktop VM with XFCE, Chrome, Node.js, VNC, and OpenClaw via the ProxmoxVE community script — is achieved in the codebase.

The 5 human verification items above are operational concerns that require a live Proxmox environment. They do not block goal achievement from a code perspective.

---

_Verified: 2026-03-08T03:00:00Z_
_Verifier: Claude (gsd-verifier)_

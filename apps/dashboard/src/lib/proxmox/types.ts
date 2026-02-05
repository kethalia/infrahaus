/**
 * Proxmox VE API TypeScript definitions
 * Based on Proxmox VE API documentation
 */

// ============================================================================
// Generic API Response
// ============================================================================

export interface ProxmoxApiResponse<T> {
  data: T;
}

// ============================================================================
// Authentication
// ============================================================================

export interface ProxmoxTicketRequest {
  username: string;
  password: string;
  realm?: string; // Default: 'pam'
}

export interface ProxmoxTicketResponse {
  ticket: string;
  CSRFPreventionToken: string;
  username: string;
  clustername?: string;
}

export interface ProxmoxTicketCredentials {
  type: "ticket";
  ticket: string;
  csrfToken: string;
  username: string; // Stored for ticket refresh
  expiresAt: Date; // Tickets expire after 2 hours
}

export interface ProxmoxApiTokenCredentials {
  type: "token";
  tokenId: string; // Format: user@realm!tokenname
  tokenSecret: string;
}

export type ProxmoxCredentials =
  | ProxmoxTicketCredentials
  | ProxmoxApiTokenCredentials;

// ============================================================================
// Client Configuration
// ============================================================================

export interface ProxmoxClientConfig {
  host: string;
  port?: number; // Default: 8006
  credentials: ProxmoxCredentials;
  verifySsl?: boolean; // Default: false (for self-signed certs)
  retryConfig?: {
    maxRetries?: number; // Default: 3
    initialDelayMs?: number; // Default: 1000
    maxDelayMs?: number; // Default: 10000
  };
}

// ============================================================================
// Node
// ============================================================================

export interface ProxmoxNode {
  node: string;
  status: "online" | "offline" | "unknown";
  type: "node";
  id: string;
  maxcpu?: number;
  maxmem?: number;
  cpu?: number;
  mem?: number;
  disk?: number;
  maxdisk?: number;
  level?: string;
  uptime?: number;
}

export interface ProxmoxNodeStatus {
  uptime: number;
  idle: number;
  loadavg: number[];
  kversion: string;
  cpuinfo: {
    cpus: number;
    model: string;
    mhz: string;
    hvm?: string;
    sockets: number;
    cores: number;
  };
  memory: {
    total: number;
    used: number;
    free: number;
  };
  swap: {
    total: number;
    used: number;
    free: number;
  };
  pveversion: string;
  rootfs: {
    total: number;
    used: number;
    avail: number;
  };
}

// ============================================================================
// Container (LXC)
// ============================================================================

export interface ProxmoxContainer {
  vmid: number;
  status: "running" | "stopped" | "mounted" | "paused";
  name?: string;
  maxdisk?: number;
  disk?: number;
  maxmem?: number;
  mem?: number;
  maxswap?: number;
  swap?: number;
  uptime?: number;
  cpus?: number;
  cpu?: number;
  type: "lxc";
  netin?: number;
  netout?: number;
  diskread?: number;
  diskwrite?: number;
  template?: boolean;
  lock?: string;
  tags?: string;
}

export interface ProxmoxContainerConfig {
  arch?: "amd64" | "i386" | "arm64" | "armhf";
  cmode?: "tty" | "console" | "shell";
  console?: boolean;
  cores?: number;
  cpulimit?: number;
  cpuunits?: number;
  description?: string;
  features?: string; // e.g., "keyctl=1,nesting=1"
  hookscript?: string;
  hostname?: string;
  lock?: string;
  memory?: number; // MB
  mp?: Record<string, string>; // Mount points
  nameserver?: string;
  net?: Record<string, string>; // Network interfaces
  onboot?: boolean;
  ostype?: string;
  protection?: boolean;
  rootfs?: string; // e.g., "local-lvm:8"
  searchdomain?: string;
  startup?: string;
  swap?: number; // MB
  tags?: string;
  template?: boolean;
  tty?: number;
  unprivileged?: boolean;
  unused?: Record<string, string>;
}

export interface ProxmoxContainerCreateConfig {
  vmid?: number; // Auto-assigned if not provided
  ostemplate: string; // e.g., "local:vztmpl/ubuntu-22.04-standard_22.04-1_amd64.tar.zst"
  hostname?: string;
  description?: string;
  memory?: number; // MB, default 512
  swap?: number; // MB, default 512
  cores?: number; // Default 1
  cpulimit?: number;
  cpuunits?: number;
  rootfs?: string; // e.g., "local-lvm:8" for 8GB
  net0?: string; // e.g., "name=eth0,bridge=vmbr0,ip=dhcp"
  nameserver?: string;
  searchdomain?: string;
  password?: string; // Root password
  "ssh-public-keys"?: string;
  unprivileged?: boolean; // Default true
  features?: string; // e.g., "nesting=1,keyctl=1"
  onboot?: boolean;
  startup?: string;
  storage?: string; // Default storage for rootfs
  pool?: string;
  tags?: string;
  start?: boolean; // Start after creation
}

export interface ProxmoxContainerStatus {
  status: "running" | "stopped" | "mounted" | "paused";
  vmid: number;
  name?: string;
  cpus?: number;
  cpu?: number;
  maxmem?: number;
  mem?: number;
  maxswap?: number;
  swap?: number;
  maxdisk?: number;
  disk?: number;
  uptime?: number;
  netin?: number;
  netout?: number;
  diskread?: number;
  diskwrite?: number;
  ha?: {
    managed: boolean;
  };
  tags?: string;
  lock?: string;
}

// ============================================================================
// Task
// ============================================================================

export interface ProxmoxTask {
  upid: string; // Unique Process ID
  node: string;
  pid: number;
  pstart: number;
  starttime: number;
  type: string;
  id?: string;
  user: string;
  status?: "running" | "stopped";
  exitstatus?: string;
}

export interface ProxmoxTaskStatus {
  status: "running" | "stopped";
  exitstatus?: string; // "OK" on success, error message on failure
  upid: string;
  node: string;
  pid: number;
  pstart: number;
  starttime: number;
  type: string;
  id?: string;
  user: string;
}

export interface ProxmoxTaskLogEntry {
  n: number; // Line number
  t: string; // Log text
}

export interface ProxmoxTaskWaitOptions {
  interval?: number; // Poll interval in ms, default 2000
  timeout?: number; // Timeout in ms, default 300000 (5 min)
  onProgress?: (log: ProxmoxTaskLogEntry[]) => void;
  signal?: AbortSignal; // Optional AbortSignal to cancel polling
}

// ============================================================================
// Storage
// ============================================================================

export interface ProxmoxStorage {
  storage: string;
  type: string; // 'dir', 'lvm', 'lvmthin', 'zfs', 'nfs', etc.
  content?: string; // Comma-separated: 'images', 'rootdir', 'vztmpl', etc.
  shared?: boolean;
  active?: boolean;
  enabled?: boolean;
  total?: number; // Bytes
  used?: number; // Bytes
  avail?: number; // Bytes
}

// ============================================================================
// Template (aplinfo)
// ============================================================================

export interface ProxmoxTemplate {
  package: string;
  template: string; // Full template name
  headline?: string;
  description?: string;
  os: string;
  version: string;
  architecture: string;
  infopage?: string;
  section?: string;
  type: "lxc" | "openvz";
}

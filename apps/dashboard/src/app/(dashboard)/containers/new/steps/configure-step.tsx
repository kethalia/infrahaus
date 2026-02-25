"use client";

import { useEffect, useMemo, useState } from "react";
import { useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAction } from "next-safe-action/hooks";
import { KeyRound, Copy, Check, Loader2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Separator } from "@/components/ui/separator";
import { generateSshKeyPairAction } from "@/lib/containers/ssh-key-actions";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";

import {
  containerConfigBaseSchema,
  type ContainerConfig,
  type ContainerConfigFormValues,
} from "@/lib/containers/schemas";
import { VmidField } from "@/components/containers/vmid-field";
import type {
  WizardStorage,
  WizardBridge,
  WizardOsTemplate,
  WizardNode,
} from "@/lib/containers/actions";
import type { UserNode } from "../container-wizard";

interface ConfigureStepProps {
  data: ContainerConfig | null;
  defaultsFromTemplate: {
    cores?: number | null;
    memory?: number | null;
    swap?: number | null;
    diskSize?: number | null;
    storage?: string | null;
    bridge?: string | null;
    nesting?: boolean;
    osTemplate?: string | null;
    tags?: string | null;
  } | null;
  storages: WizardStorage[];
  bridges: WizardBridge[];
  nextVmid: number;
  osTemplates: WizardOsTemplate[];
  clusterNodes: WizardNode[];
  onNext: (data: ContainerConfig) => void;
  onBack: () => void;
  nodeId: string;
  userNodes: UserNode[];
  onNodeChange: (nodeId: string) => void;
}

export function ConfigureStep({
  data,
  defaultsFromTemplate,
  storages,
  bridges,
  nextVmid,
  osTemplates,
  clusterNodes,
  onNext,
  onBack,
  nodeId,
  userNodes,
  onNodeChange,
}: ConfigureStepProps) {
  // Sort all dropdown data alphabetically
  const sortedNodes = useMemo(
    () => [...clusterNodes].sort((a, b) => a.node.localeCompare(b.node)),
    [clusterNodes],
  );

  // Resolve current Proxmox node name from userNodes + nodeId
  const currentUserNode = userNodes.find((n) => n.id === nodeId);
  const defaultNodeName = currentUserNode?.name ?? sortedNodes[0]?.node ?? "";

  const form = useForm<ContainerConfigFormValues>({
    resolver: zodResolver(containerConfigBaseSchema),
    defaultValues: {
      targetNode: data?.targetNode ?? defaultNodeName,
      hostname: data?.hostname ?? "",
      vmid: data?.vmid ?? nextVmid,
      cores: data?.cores ?? defaultsFromTemplate?.cores ?? 1,
      memory: data?.memory ?? defaultsFromTemplate?.memory ?? 512,
      swap: data?.swap ?? defaultsFromTemplate?.swap ?? 512,
      diskSize: data?.diskSize ?? defaultsFromTemplate?.diskSize ?? 8,
      storage:
        data?.storage ??
        defaultsFromTemplate?.storage ??
        storages[0]?.storage ??
        "",
      bridge:
        data?.bridge ?? defaultsFromTemplate?.bridge ?? bridges[0]?.iface ?? "",
      dhcp: data?.dhcp ?? true,
      ip: data?.ip ?? "",
      gateway: data?.gateway ?? "",
      nameserver: data?.nameserver ?? "",
      nesting: data?.nesting ?? defaultsFromTemplate?.nesting ?? false,
      sshPublicKey: data?.sshPublicKey ?? "",
      sshPrivateKey: data?.sshPrivateKey ?? "",
      tags: data?.tags ?? defaultsFromTemplate?.tags ?? "",
      ostemplate:
        data?.ostemplate ??
        defaultsFromTemplate?.osTemplate ??
        osTemplates[0]?.volid ??
        "",
    },
  });

  // Watch target node to filter storages, bridges, and OS templates per-node
  const selectedNode = useWatch({ control: form.control, name: "targetNode" });
  const isDhcp = useWatch({ control: form.control, name: "dhcp" });

  const filteredStorages = useMemo(
    () =>
      storages
        .filter((s) => s.node === selectedNode)
        .sort((a, b) => a.storage.localeCompare(b.storage)),
    [storages, selectedNode],
  );
  const filteredBridges = useMemo(
    () =>
      bridges
        .filter((b) => b.node === selectedNode)
        .sort((a, b) => a.iface.localeCompare(b.iface)),
    [bridges, selectedNode],
  );
  const filteredOsTemplates = useMemo(
    () =>
      osTemplates
        .filter((t) => t.node === selectedNode)
        .sort((a, b) => a.name.localeCompare(b.name)),
    [osTemplates, selectedNode],
  );

  // When target node changes, reset storage/bridge/ostemplate to first available for that node
  // Also sync the parent's nodeId for VmidField validation
  useEffect(() => {
    if (!selectedNode) return;
    const nodeStorages = storages.filter((s) => s.node === selectedNode);
    const nodeBridges = bridges.filter((b) => b.node === selectedNode);
    const nodeOsTemplates = osTemplates.filter((t) => t.node === selectedNode);

    // Only reset if current value is not valid for the new node
    const currentStorage = form.getValues("storage");
    if (!nodeStorages.some((s) => s.storage === currentStorage)) {
      form.setValue("storage", nodeStorages[0]?.storage ?? "");
    }
    const currentBridge = form.getValues("bridge");
    if (!nodeBridges.some((b) => b.iface === currentBridge)) {
      form.setValue("bridge", nodeBridges[0]?.iface ?? "");
    }
    const currentOstemplate = form.getValues("ostemplate");
    if (!nodeOsTemplates.some((t) => t.volid === currentOstemplate)) {
      form.setValue("ostemplate", nodeOsTemplates[0]?.volid ?? "");
    }

    // Sync nodeId to parent for VmidField validation
    const matchingUserNode = userNodes.find((n) => n.name === selectedNode);
    if (matchingUserNode && matchingUserNode.id !== nodeId) {
      onNodeChange(matchingUserNode.id);
    }
  }, [
    selectedNode,
    storages,
    bridges,
    osTemplates,
    form,
    userNodes,
    nodeId,
    onNodeChange,
  ]);

  // When template defaults change (e.g., user went back and selected a different template),
  // we DON'T reset if user already has data (they manually edited)
  useEffect(() => {
    if (!data && defaultsFromTemplate) {
      if (defaultsFromTemplate.cores)
        form.setValue("cores", defaultsFromTemplate.cores);
      if (defaultsFromTemplate.memory)
        form.setValue("memory", defaultsFromTemplate.memory);
      if (
        defaultsFromTemplate.swap !== undefined &&
        defaultsFromTemplate.swap !== null
      )
        form.setValue("swap", defaultsFromTemplate.swap);
      if (defaultsFromTemplate.diskSize)
        form.setValue("diskSize", defaultsFromTemplate.diskSize);
      if (defaultsFromTemplate.storage)
        form.setValue("storage", defaultsFromTemplate.storage);
      if (defaultsFromTemplate.bridge)
        form.setValue("bridge", defaultsFromTemplate.bridge);
      if (defaultsFromTemplate.nesting !== undefined)
        form.setValue("nesting", defaultsFromTemplate.nesting);
      if (defaultsFromTemplate.tags)
        form.setValue("tags", defaultsFromTemplate.tags);
      if (defaultsFromTemplate.osTemplate)
        form.setValue("ostemplate", defaultsFromTemplate.osTemplate);
    }
  }, [defaultsFromTemplate, data, form]);

  function onSubmit(values: ContainerConfigFormValues) {
    onNext(values as ContainerConfig);
  }

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold">Container Configuration</h2>
        <p className="text-sm text-muted-foreground">
          Configure the container settings. Fields pre-filled from template can
          be customized.
        </p>
      </div>

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-8">
          {/* Target Node Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Target Node
            </h3>
            <FormField
              control={form.control}
              name="targetNode"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Proxmox Node</FormLabel>
                  {sortedNodes.length > 0 ? (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a node" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {sortedNodes.map((n) => {
                          const isDefault = userNodes.find(
                            (un) => un.name === n.node,
                          )?.isDefault;
                          return (
                            <SelectItem key={n.node} value={n.node}>
                              {n.node}
                              {isDefault ? " (default)" : ""}
                              {n.maxcpu != null && n.maxmem != null
                                ? ` — ${n.maxcpu} CPU, ${Math.round((n.maxmem ?? 0) / 1024 / 1024 / 1024)} GB RAM`
                                : ""}
                            </SelectItem>
                          );
                        })}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormControl>
                      <Input placeholder="pve" {...field} />
                    </FormControl>
                  )}
                  <FormDescription>
                    The cluster node where the container will be created
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator />

          {/* OS Template Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              OS Template
            </h3>
            <FormField
              control={form.control}
              name="ostemplate"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Template</FormLabel>
                  {filteredOsTemplates.length > 0 ? (
                    <Select onValueChange={field.onChange} value={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select an OS template" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {filteredOsTemplates.map((t) => (
                          <SelectItem key={t.volid} value={t.volid}>
                            {t.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  ) : (
                    <FormControl>
                      <Input
                        placeholder="local:vztmpl/debian-12-standard_12.7-1_amd64.tar.zst"
                        {...field}
                      />
                    </FormControl>
                  )}
                  <FormDescription>
                    The OS template to use for the container. Only downloaded
                    templates are shown.
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          <Separator />

          {/* Identity Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Identity
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="hostname"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Hostname</FormLabel>
                    <FormControl>
                      <Input placeholder="my-container" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <VmidField control={form.control} name="vmid" nodeId={nodeId} />
            </div>
          </div>

          <Separator />

          {/* SSH Key Pair Section */}
          <SshKeyPairSection control={form.control} setValue={form.setValue} />

          <Separator />

          {/* Resources Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Resources
            </h3>
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <FormField
                control={form.control}
                name="cores"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>CPU Cores</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={128}
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.valueAsNumber || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="memory"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Memory (MB)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={128}
                        max={65536}
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.valueAsNumber || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="swap"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Swap (MB)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={0}
                        max={65536}
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.valueAsNumber || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="diskSize"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Disk Size (GB)</FormLabel>
                    <FormControl>
                      <Input
                        type="number"
                        min={1}
                        max={10240}
                        {...field}
                        onChange={(e) =>
                          field.onChange(e.target.valueAsNumber || 0)
                        }
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator />

          {/* Storage & Network Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Storage & Network
            </h3>
            <div className="grid gap-4 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="storage"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Storage</FormLabel>
                    {filteredStorages.length > 0 ? (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select storage" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {filteredStorages.map((s) => (
                            <SelectItem key={s.storage} value={s.storage}>
                              {s.storage} ({s.type})
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <FormControl>
                        <Input placeholder="local-lvm" {...field} />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="bridge"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Network Bridge</FormLabel>
                    {filteredBridges.length > 0 ? (
                      <Select
                        onValueChange={field.onChange}
                        value={field.value}
                      >
                        <FormControl>
                          <SelectTrigger>
                            <SelectValue placeholder="Select bridge" />
                          </SelectTrigger>
                        </FormControl>
                        <SelectContent>
                          {filteredBridges.map((b) => (
                            <SelectItem key={b.iface} value={b.iface}>
                              {b.iface}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    ) : (
                      <FormControl>
                        <Input placeholder="vmbr0" {...field} />
                      </FormControl>
                    )}
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            <FormField
              control={form.control}
              name="dhcp"
              render={({ field }) => (
                <FormItem className="flex items-center gap-2">
                  <FormControl>
                    <Checkbox
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                  <FormLabel className="!mt-0">Use DHCP</FormLabel>
                </FormItem>
              )}
            />
            <div className="grid gap-4 sm:grid-cols-3">
              <FormField
                control={form.control}
                name="ip"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>IP Address</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="10.0.0.50/24"
                        disabled={isDhcp}
                        {...field}
                      />
                    </FormControl>
                    <FormDescription>
                      CIDR notation (e.g. 10.0.0.50/24)
                    </FormDescription>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="gateway"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Gateway</FormLabel>
                    <FormControl>
                      <Input
                        placeholder="10.0.0.1"
                        disabled={isDhcp}
                        {...field}
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="nameserver"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nameserver (optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="8.8.8.8" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
          </div>

          <Separator />

          {/* Features Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Features
            </h3>
            <p className="text-xs text-muted-foreground">
              All containers are created as unprivileged (required by
              least-privilege API token setup).
            </p>
            <FormField
              control={form.control}
              name="nesting"
              render={({ field }) => (
                <FormItem className="flex items-center justify-between rounded-lg border p-3">
                  <div className="space-y-0.5">
                    <FormLabel className="text-sm">Nesting</FormLabel>
                    <FormDescription className="text-xs">
                      Allow running containers inside this container
                    </FormDescription>
                  </div>
                  <FormControl>
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                    />
                  </FormControl>
                </FormItem>
              )}
            />
          </div>

          <Separator />

          {/* Tags Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
              Tags
            </h3>
            <FormField
              control={form.control}
              name="tags"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Tags (optional)</FormLabel>
                  <FormControl>
                    <Input placeholder="web;production;nginx" {...field} />
                  </FormControl>
                  <FormDescription>
                    Semicolon-separated tags for organizing containers
                  </FormDescription>
                  <FormMessage />
                </FormItem>
              )}
            />
          </div>

          {/* Navigation */}
          <div className="flex justify-between">
            <Button type="button" variant="outline" onClick={onBack}>
              Back
            </Button>
            <Button type="submit">Next</Button>
          </div>
        </form>
      </Form>
    </div>
  );
}

// ============================================================================
// SSH Key Pair Section
// ============================================================================

function SshKeyPairSection({
  control,
  setValue,
}: {
  control: ReturnType<typeof useForm<ContainerConfigFormValues>>["control"];
  setValue: ReturnType<typeof useForm<ContainerConfigFormValues>>["setValue"];
}) {
  const [copied, setCopied] = useState(false);

  const { execute: generateKeys, isPending: isGenerating } = useAction(
    generateSshKeyPairAction,
    {
      onSuccess: ({ data }) => {
        if (data) {
          setValue("sshPrivateKey", data.privateKey, { shouldValidate: true });
          setValue("sshPublicKey", data.publicKey, { shouldValidate: true });
        }
      },
    },
  );

  const publicKey = useWatch({ control, name: "sshPublicKey" });

  const handleCopyPublicKey = async () => {
    if (!publicKey) return;
    await navigator.clipboard.writeText(publicKey);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-medium text-muted-foreground uppercase tracking-wider">
          SSH Key Pair
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          disabled={isGenerating}
          onClick={() => generateKeys({})}
        >
          {isGenerating ? (
            <Loader2 className="size-3.5 animate-spin" />
          ) : (
            <KeyRound className="size-3.5" />
          )}
          {isGenerating ? "Generating..." : "Generate Key Pair"}
        </Button>
      </div>

      <FormField
        control={control}
        name="sshPrivateKey"
        render={({ field }) => (
          <FormItem>
            <FormLabel>Private Key</FormLabel>
            <FormControl>
              <Textarea
                placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;..."
                className="font-mono text-xs"
                rows={4}
                {...field}
              />
            </FormControl>
            <FormDescription>
              Stored encrypted. Used by the dashboard to SSH into the container
              for service discovery and log fetching.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />

      <FormField
        control={control}
        name="sshPublicKey"
        render={({ field }) => (
          <FormItem>
            <div className="flex items-center justify-between">
              <FormLabel>Public Key</FormLabel>
              {publicKey && (
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  className="h-6 gap-1 text-xs"
                  onClick={handleCopyPublicKey}
                >
                  {copied ? (
                    <Check className="size-3" />
                  ) : (
                    <Copy className="size-3" />
                  )}
                  {copied ? "Copied" : "Copy"}
                </Button>
              )}
            </div>
            <FormControl>
              <Textarea
                placeholder="ssh-ed25519 AAAA..."
                className="font-mono text-xs bg-muted"
                rows={2}
                readOnly
                {...field}
              />
            </FormControl>
            <FormDescription>
              Injected into the container during creation. Add this to
              authorized_keys on the Proxmox host if needed.
            </FormDescription>
            <FormMessage />
          </FormItem>
        )}
      />
    </div>
  );
}

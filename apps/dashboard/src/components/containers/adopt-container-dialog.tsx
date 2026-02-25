"use client";

import { useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { useAction } from "next-safe-action/hooks";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { z } from "zod";
import { ShieldCheck, KeyRound, Lock } from "lucide-react";

import { adoptContainerAction } from "@/lib/containers/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

// ============================================================================
// Form Schemas (client-side only — for react-hook-form zodResolver)
// ============================================================================

const passwordFormSchema = z.object({
  password: z.string().min(1, "Root password is required"),
});

const importKeyFormSchema = z.object({
  privateKey: z.string().min(1, "SSH private key is required"),
});

type PasswordFormValues = z.infer<typeof passwordFormSchema>;
type ImportKeyFormValues = z.infer<typeof importKeyFormSchema>;

// ============================================================================
// Component
// ============================================================================

interface AdoptContainerDialogProps {
  containerId: string;
  hostname: string;
  trigger: React.ReactNode;
}

/**
 * Dialog for adopting a pre-existing container into the dashboard.
 *
 * Two strategies:
 *   1. Password — SSH in with root password, inject new Ed25519 key, harden SSH
 *   2. Import Key — Provide an existing SSH private key that already has access
 */
export function AdoptContainerDialog({
  containerId,
  hostname,
  trigger,
}: AdoptContainerDialogProps) {
  const [open, setOpen] = useState(false);
  const [strategy, setStrategy] = useState<"password" | "import-key">(
    "password",
  );
  const router = useRouter();

  // Password form
  const passwordForm = useForm<PasswordFormValues>({
    resolver: zodResolver(passwordFormSchema),
    defaultValues: { password: "" },
  });

  // Import key form
  const importKeyForm = useForm<ImportKeyFormValues>({
    resolver: zodResolver(importKeyFormSchema),
    defaultValues: { privateKey: "" },
  });

  const { execute, isPending } = useAction(adoptContainerAction, {
    onSuccess: () => {
      setOpen(false);
      passwordForm.reset();
      importKeyForm.reset();
      toast.success(`Container "${hostname}" adopted successfully`, {
        description: "Service discovery and logs are now available.",
      });
      router.refresh();
    },
    onError: ({ error }) => {
      toast.error("Failed to adopt container", {
        description: error.serverError ?? "An unexpected error occurred",
      });
    },
  });

  function onSubmitPassword(values: PasswordFormValues) {
    execute({
      containerId,
      strategy: "password",
      password: values.password,
    });
  }

  function onSubmitImportKey(values: ImportKeyFormValues) {
    execute({
      containerId,
      strategy: "import-key",
      privateKey: values.privateKey,
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>{trigger}</DialogTrigger>
      <DialogContent className="sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <ShieldCheck className="size-5" />
            Adopt Container
          </DialogTitle>
          <DialogDescription>
            Adopt &ldquo;{hostname}&rdquo; to enable service discovery, logs,
            and SSH-based management.
          </DialogDescription>
        </DialogHeader>

        <Tabs
          value={strategy}
          onValueChange={(v) => setStrategy(v as "password" | "import-key")}
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="password" className="gap-1.5">
              <Lock className="size-3.5" />
              Password
            </TabsTrigger>
            <TabsTrigger value="import-key" className="gap-1.5">
              <KeyRound className="size-3.5" />
              SSH Key
            </TabsTrigger>
          </TabsList>

          <TabsContent value="password" className="mt-4">
            <Form {...passwordForm}>
              <form
                onSubmit={passwordForm.handleSubmit(onSubmitPassword)}
                className="space-y-4"
              >
                <FormField
                  control={passwordForm.control}
                  name="password"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Root Password</FormLabel>
                      <FormControl>
                        <Input
                          type="password"
                          placeholder="Container root password"
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        The dashboard will SSH in, inject a new Ed25519 key, and
                        disable password auth for security.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Adopting..." : "Adopt with Password"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>

          <TabsContent value="import-key" className="mt-4">
            <Form {...importKeyForm}>
              <form
                onSubmit={importKeyForm.handleSubmit(onSubmitImportKey)}
                className="space-y-4"
              >
                <FormField
                  control={importKeyForm.control}
                  name="privateKey"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>SSH Private Key</FormLabel>
                      <FormControl>
                        <Textarea
                          placeholder="-----BEGIN OPENSSH PRIVATE KEY-----&#10;...&#10;-----END OPENSSH PRIVATE KEY-----"
                          className="font-mono text-xs"
                          rows={8}
                          {...field}
                        />
                      </FormControl>
                      <FormDescription>
                        Paste an existing private key that has root access to
                        this container. The key will be verified before saving.
                      </FormDescription>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <DialogFooter>
                  <Button type="submit" disabled={isPending}>
                    {isPending ? "Verifying..." : "Adopt with Key"}
                  </Button>
                </DialogFooter>
              </form>
            </Form>
          </TabsContent>
        </Tabs>
      </DialogContent>
    </Dialog>
  );
}

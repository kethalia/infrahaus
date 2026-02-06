"use client";

import { useActionState, useEffect } from "react";
import { useFormStatus } from "react-dom";
import { useRouter } from "next/navigation";
import { loginAction, type ActionState } from "@/lib/auth/actions";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

const initialState: ActionState = { success: false };

function SubmitButton() {
  const { pending } = useFormStatus();

  return (
    <Button type="submit" className="w-full" disabled={pending}>
      {pending ? "Signing in..." : "Sign in"}
    </Button>
  );
}

export default function LoginPage() {
  const [state, formAction] = useActionState(loginAction, initialState);
  const router = useRouter();

  useEffect(() => {
    if (state.success) {
      router.push("/");
    }
  }, [state.success, router]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader>
        <CardTitle className="text-2xl">LXC Manager</CardTitle>
        <CardDescription>
          Sign in with your Proxmox VE credentials
        </CardDescription>
      </CardHeader>
      <CardContent>
        <form action={formAction} className="flex flex-col gap-4">
          <div className="flex flex-col gap-2">
            <label htmlFor="username" className="text-sm font-medium">
              Username
            </label>
            <Input
              id="username"
              name="username"
              placeholder="admin"
              required
              autoFocus
            />
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="realm" className="text-sm font-medium">
              Realm
            </label>
            <select
              id="realm"
              name="realm"
              defaultValue="pam"
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-base shadow-xs transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] md:text-sm"
            >
              <option value="pam">Linux PAM</option>
              <option value="pve">Proxmox VE</option>
            </select>
          </div>

          <div className="flex flex-col gap-2">
            <label htmlFor="password" className="text-sm font-medium">
              Password
            </label>
            <Input id="password" name="password" type="password" required />
          </div>

          {state.error && (
            <p className="text-sm text-destructive">{state.error}</p>
          )}

          <SubmitButton />
        </form>
      </CardContent>
    </Card>
  );
}

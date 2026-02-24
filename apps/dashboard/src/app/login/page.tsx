"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { WalletButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";
import {
  Card,
  CardHeader,
  CardTitle,
  CardDescription,
  CardContent,
} from "@/components/ui/card";

export default function LoginPage() {
  const router = useRouter();
  const { isConnected } = useAccount();

  // Redirect to dashboard when authentication completes.
  // RainbowKit's auth adapter handles the SIWE flow automatically
  // after wallet connection. Once verified, the server session exists
  // and the user should be on the dashboard.
  useEffect(() => {
    if (isConnected) {
      // Small delay to let the session cookie propagate
      const timer = setTimeout(() => router.push("/"), 500);
      return () => clearTimeout(timer);
    }
  }, [isConnected, router]);

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">LXC Manager</CardTitle>
        <CardDescription>
          Connect your Universal Profile to sign in
        </CardDescription>
      </CardHeader>
      <CardContent className="flex justify-center">
        <WalletButton wallet="universal-profiles" />
      </CardContent>
    </Card>
  );
}

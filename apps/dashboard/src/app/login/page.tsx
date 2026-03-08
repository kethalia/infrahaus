"use client";

import { useEffect, useRef } from "react";
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

/**
 * Poll /api/auth/me to detect when the SIWE verify flow completes.
 *
 * Why not useAccount().isConnected? That fires as soon as the wallet
 * connects — before SIWE sign+verify finishes. The server session
 * doesn't exist yet, so middleware bounces us back to /login (loop).
 *
 * Instead we poll the server: once /api/auth/me returns an address,
 * we know the Redis session + iron-session cookie are set and the
 * middleware will let us through.
 */
function useRedirectOnAuth() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    // Only start polling after wallet is connected (SIWE flow in progress)
    if (!isConnected) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
        intervalRef.current = null;
      }
      return;
    }

    const checkSession = async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (data.address) {
          // Server session confirmed — safe to navigate
          if (intervalRef.current) clearInterval(intervalRef.current);
          router.push("/");
        }
      } catch {
        // Network error — keep polling
      }
    };

    // Check immediately, then every 1s (500ms was excessive server load)
    checkSession();
    intervalRef.current = setInterval(checkSession, 1000);

    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isConnected, router]);
}

export default function LoginPage() {
  useRedirectOnAuth();

  return (
    <Card className="w-full max-w-md">
      <CardHeader className="text-center">
        <CardTitle className="text-2xl">Infrahaus</CardTitle>
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

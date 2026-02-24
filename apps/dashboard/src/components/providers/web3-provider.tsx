"use client";

import "@rainbow-me/rainbowkit/styles.css";

import { useState, useEffect, useMemo, type ReactNode } from "react";
import { WagmiProvider } from "wagmi";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import {
  RainbowKitProvider,
  RainbowKitAuthenticationProvider,
  createAuthenticationAdapter,
  type AuthenticationStatus,
} from "@rainbow-me/rainbowkit";
import { createSiweMessage } from "viem/siwe";
import { wagmiConfig } from "@/lib/web3/config";

/**
 * SIWE authentication adapter for RainbowKit.
 * Wires getNonce → createMessage → verify → signOut through our API routes.
 */
const authAdapter = createAuthenticationAdapter({
  getNonce: async () => {
    const response = await fetch("/api/auth/nonce");
    if (!response.ok) {
      throw new Error(`Nonce request failed: ${response.status}`);
    }
    return await response.text();
  },
  createMessage: ({ nonce, address, chainId }) => {
    return createSiweMessage({
      domain: window.location.host,
      address,
      statement: "Sign in to LXC Manager with your Universal Profile.",
      uri: window.location.origin,
      version: "1",
      chainId,
      nonce,
      expirationTime: new Date(Date.now() + 2 * 60 * 60 * 1000), // 2 hours
    });
  },
  verify: async ({ message, signature }) => {
    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ message, signature }),
      });

      if (!response.ok) {
        const data = await response.json().catch(() => ({}));
        console.error(
          "[auth] Verification failed:",
          data.error ?? response.status,
        );
        return false;
      }

      return true;
    } catch (error) {
      // Network error — distinct from auth failure
      console.error("[auth] Network error during verification:", error);
      return false;
    }
  },
  signOut: async () => {
    await fetch("/api/auth/logout", { method: "POST" });
  },
});

/**
 * Web3Provider wraps children with the full Web3 provider stack:
 * WagmiProvider → QueryClientProvider → RainbowKitAuthenticationProvider → RainbowKitProvider
 *
 * This is scoped to the login route group — the dashboard uses its own
 * QueryProvider (from query-provider.tsx) so there's no conflict.
 *
 * Auth status is polled on mount and on window focus via /api/auth/me.
 * Uses a mounted ref to prevent state updates after unmount.
 */
export function Web3Provider({ children }: { children: ReactNode }) {
  const [authStatus, setAuthStatus] = useState<AuthenticationStatus>("loading");
  const queryClient = useMemo(() => new QueryClient(), []);

  useEffect(() => {
    let mounted = true;

    const checkAuth = async () => {
      try {
        const res = await fetch("/api/auth/me");
        const data = await res.json();
        if (mounted) {
          setAuthStatus(data.address ? "authenticated" : "unauthenticated");
        }
      } catch {
        if (mounted) {
          setAuthStatus("unauthenticated");
        }
      }
    };

    checkAuth();
    window.addEventListener("focus", checkAuth);
    return () => {
      mounted = false;
      window.removeEventListener("focus", checkAuth);
    };
  }, []);

  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitAuthenticationProvider
          adapter={authAdapter}
          status={authStatus}
        >
          <RainbowKitProvider>{children}</RainbowKitProvider>
        </RainbowKitAuthenticationProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}

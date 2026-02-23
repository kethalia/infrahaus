import { createConfig, http } from "wagmi";
import { lukso } from "wagmi/chains";
import { connectorsForWallets } from "@rainbow-me/rainbowkit";
import { universalProfilesWallet } from "@rainbow-me/rainbowkit/wallets";

/**
 * RainbowKit connectors configured for Universal Profile wallets only.
 * Uses WalletConnect under the hood for mobile UP app connectivity.
 */
const connectors = connectorsForWallets(
  [
    {
      groupName: "Connect with Universal Profile",
      wallets: [universalProfilesWallet],
    },
  ],
  {
    appName: "LXC Manager",
    projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID!,
  },
);

/**
 * Wagmi config for LUKSO mainnet with Universal Profile wallet connector.
 *
 * - chains: LUKSO mainnet only (chain ID 42)
 * - connectors: Universal Profile wallet only (no MetaMask, no generic wallets)
 * - transports: default LUKSO RPC via http()
 * - ssr: true for Next.js SSR compatibility
 *
 * This is a pure config module — importable by both client and server code.
 * No "use client" directive needed.
 */
export const wagmiConfig = createConfig({
  chains: [lukso],
  connectors,
  transports: {
    [lukso.id]: http(),
  },
  ssr: true,
});

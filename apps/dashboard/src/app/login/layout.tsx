import { Web3Provider } from "@/components/providers/web3-provider";

export default function LoginLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <Web3Provider>
      <div className="flex min-h-screen items-center justify-center bg-background">
        {children}
      </div>
    </Web3Provider>
  );
}

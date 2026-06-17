"use client";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useConnect, useAccount } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";

const queryClient = new QueryClient();

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        <MiniPayAutoConnect />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );
}

/**
 * When the app is opened inside MiniPay the wallet is already injected and
 * ready — auto-connecting skips the landing page so users go straight to
 * the lobby without having to tap "Connect Wallet".
 */
function MiniPayAutoConnect() {
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (isConnected) return;
    const eth = (window as unknown as { ethereum?: { isMiniPay?: boolean } }).ethereum;
    if (eth?.isMiniPay) {
      const connector = connectors[0];
      if (connector) connect({ connector });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

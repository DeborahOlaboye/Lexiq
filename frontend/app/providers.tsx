"use client";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useConnect } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { useEffect } from "react";

const queryClient = new QueryClient();

function AutoConnect() {
  const { connect, connectors } = useConnect();
  useEffect(() => { if (connectors[0]) connect({ connector: connectors[0] }); }, [connect, connectors]);
  return null;
}

export function Providers({ children }: { children: React.ReactNode }) {
  return (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}><AutoConnect />{children}</QueryClientProvider>
    </WagmiProvider>
  );
}

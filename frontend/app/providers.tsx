"use client";
import { useEffect, useRef, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useSetActiveWallet } from "@privy-io/wagmi";
import { PrivyProvider, useWallets } from "@privy-io/react-auth";
import { useConnect, useAccount } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { celo } from "wagmi/chains";

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export function Providers({ children }: { children: React.ReactNode }) {
  // New QueryClient per component instance — avoids cross-request state leaks during SSR
  const [queryClient] = useState(() => new QueryClient());

  // QueryClientProvider MUST wrap WagmiProvider — @privy-io/wagmi calls useQuery internally
  const inner = (
    <QueryClientProvider client={queryClient}>
      <WagmiProvider config={wagmiConfig}>
        {privyAppId && <SyncPrivyToWagmi />}
        <MiniPayAutoConnect />
        {children}
      </WagmiProvider>
    </QueryClientProvider>
  );

  if (!privyAppId) return inner;

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ["google", "twitter", "discord", "github", "email", "farcaster", "telegram", "tiktok"],
        appearance: {
          theme: "dark",
          accentColor: "#CFE94B",
          logo: "https://playlexiq.xyz/icon.svg",
          landingHeader: "Sign in to Lexiq",
          loginMessage: "Play, stake & compete on Celo",
          walletList: ["metamask", "coinbase_wallet", "detected_wallets"],
        },
        embeddedWallets: {
          ethereum: {
            createOnLogin: "users-without-wallets",
          },
          showWalletUIs: true,
        },
        defaultChain: celo,
        supportedChains: [celo],
      }}
    >
      {inner}
    </PrivyProvider>
  );
}

/** Keep wagmi's active account in sync with the Privy embedded wallet. */
function SyncPrivyToWagmi() {
  const { wallets } = useWallets();
  const { setActiveWallet } = useSetActiveWallet();

  useEffect(() => {
    if (wallets.length === 0) return;
    const embedded = wallets.find(w => w.walletClientType === "privy");
    setActiveWallet(embedded ?? wallets[0]);
  }, [wallets, setActiveWallet]);

  return null;
}

/**
 * Auto-connect when running inside MiniPay.
 *
 * Runs on every relevant change rather than once on mount: the injected connector is not
 * always registered on the first frame, and a handshake that errors must be retried.
 * A MiniPay user who never connects has no way back — the UI shows them no wallet button.
 */
function MiniPayAutoConnect() {
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();
  const inFlight = useRef(false);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (isConnected || inFlight.current || attempt >= 3) return;
    const eth = (window as unknown as { ethereum?: { isMiniPay?: boolean } }).ethereum;
    if (!eth?.isMiniPay) return;
    // Connectors can still be registering — bail and let the effect re-run when they land.
    const connector = connectors.find(c => c.type === "injected");
    if (!connector) return;

    inFlight.current = true;
    connect({ connector }, {
      onError: () => {
        inFlight.current = false;
        setTimeout(() => setAttempt(a => a + 1), 600);
      },
    });
  }, [isConnected, connectors, connect, attempt]);

  return null;
}

"use client";
import { useEffect } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { WagmiProvider, useSetActiveWallet } from "@privy-io/wagmi";
import { PrivyProvider, useWallets } from "@privy-io/react-auth";
import { useConnect, useAccount } from "wagmi";
import { wagmiConfig } from "@/lib/wagmi";
import { celo } from "wagmi/chains";

const queryClient = new QueryClient();

const privyAppId = process.env.NEXT_PUBLIC_PRIVY_APP_ID;

export function Providers({ children }: { children: React.ReactNode }) {
  const inner = (
    <WagmiProvider config={wagmiConfig}>
      <QueryClientProvider client={queryClient}>
        {privyAppId && <SyncPrivyToWagmi />}
        <MiniPayAutoConnect />
        {children}
      </QueryClientProvider>
    </WagmiProvider>
  );

  if (!privyAppId) return inner;

  return (
    <PrivyProvider
      appId={privyAppId}
      config={{
        loginMethods: ["google", "twitter", "discord", "github", "email"],
        appearance: {
          theme: "dark",
          accentColor: "#CFE94B",
          logo: "https://lexiq.vercel.app/icon.png",
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

/** Auto-connect when running inside MiniPay. */
function MiniPayAutoConnect() {
  const { connect, connectors } = useConnect();
  const { isConnected } = useAccount();

  useEffect(() => {
    if (isConnected) return;
    const eth = (window as unknown as { ethereum?: { isMiniPay?: boolean } }).ethereum;
    if (eth?.isMiniPay) {
      const connector = connectors.find(c => c.type === "injected");
      if (connector) connect({ connector });
    }
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  return null;
}

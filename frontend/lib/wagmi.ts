import { createConfig } from "@privy-io/wagmi";
import { http } from "wagmi";
import { celo } from "wagmi/chains";
import { injected } from "wagmi/connectors";

// Privy manages social-login connectors automatically.
// injected() stays for MiniPay / browser-extension users.
export const wagmiConfig = createConfig({
  chains: [celo],
  connectors: [injected()],
  transports: { [celo.id]: http("https://forno.celo.org") },
  ssr: false,
});

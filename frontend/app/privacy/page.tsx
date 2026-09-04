export const metadata = { title: "Privacy Policy — Lexiq" };

const LINE = "1px solid var(--line)";

export default function PrivacyPage() {
  return (
    <div className="min-h-dvh bg-ink text-cream font-ui" style={{ width: "min(720px, 100%)", margin: "0 auto", padding: "clamp(24px,5vw,48px) clamp(18px,5vw,24px)" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(26px,4vw,34px)", marginBottom: 8 }}>Privacy Policy</h1>
      <p style={{ fontSize: 12, color: "#9A8C77", marginBottom: 32 }}>Last updated: August 2026</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 22, fontSize: 14, lineHeight: 1.7, color: "#CBC0AE" }}>
        <section>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "#F5EFE2", marginBottom: 6 }}>1. What we collect</h2>
          <p>Lexiq collects only what's needed to run the game: your wallet address (from MiniPay or your connected wallet), an optional username you choose, and gameplay data such as scores, rounds played, and streaks. If you sign in through Privy, we receive the identifier for the login method you use (e.g. email, Google, Telegram) to create your account.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "#F5EFE2", marginBottom: 6 }}>2. What we don't collect</h2>
          <p>We do not ask for or store passwords, private keys, or seed phrases — wallet access is handled entirely by MiniPay or your wallet provider. Guest-mode play stores progress locally on your device and is never sent to us.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "#F5EFE2", marginBottom: 6 }}>3. On-chain data</h2>
          <p>Round results, scores, and any prize payouts happen on the public Celo blockchain. Anything written on-chain, including your wallet address, is public and permanent by nature of the blockchain, independent of this policy.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "#F5EFE2", marginBottom: 6 }}>4. How we use your data</h2>
          <p>We use gameplay and account data to operate leaderboards, streaks, and rank progression, and to communicate with you about your account when needed. We do not sell your data.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "#F5EFE2", marginBottom: 6 }}>5. Third parties</h2>
          <p>We use Privy for sign-in and wallet management, and standard web analytics to understand app usage. These providers process data under their own privacy policies.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "#F5EFE2", marginBottom: 6 }}>6. Your choices</h2>
          <p>You can play entirely in guest mode without creating an account. If you've signed in, you can stop using Lexiq at any time; on-chain history will remain on the Celo blockchain as it is not something we can delete.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "#F5EFE2", marginBottom: 6 }}>7. Contact</h2>
          <p>Questions about this policy or your data? Reach out via the support link in the app.</p>
        </section>
      </div>

      <div style={{ marginTop: 40, paddingTop: 20, borderTop: LINE }}>
        <a href="/" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#CFE94B" }}>← Back to Lexiq</a>
      </div>
    </div>
  );
}

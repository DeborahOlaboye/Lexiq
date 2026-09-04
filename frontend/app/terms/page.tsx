export const metadata = { title: "Terms of Service — Lexiq" };

const LINE = "1px solid var(--line)";

export default function TermsPage() {
  return (
    <div className="min-h-dvh bg-ink text-cream font-ui" style={{ width: "min(720px, 100%)", margin: "0 auto", padding: "clamp(24px,5vw,48px) clamp(18px,5vw,24px)" }}>
      <h1 style={{ fontFamily: "var(--font-display)", fontWeight: 800, fontSize: "clamp(26px,4vw,34px)", marginBottom: 8 }}>Terms of Service</h1>
      <p style={{ fontSize: 12, color: "#9A8C77", marginBottom: 32 }}>Last updated: August 2026</p>

      <div style={{ display: "flex", flexDirection: "column", gap: 22, fontSize: 14, lineHeight: 1.7, color: "#CBC0AE" }}>
        <section>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "#F5EFE2", marginBottom: 6 }}>1. What Lexiq is</h2>
          <p>Lexiq is a word game on the Celo blockchain. Each round, players build words from a set of randomly generated letters within a time limit. Rounds and scores are recorded on-chain. Lexiq is free to play and never asks you to risk your own funds.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "#F5EFE2", marginBottom: 6 }}>2. Prizes</h2>
          <p>From time to time we fund a weekly prize pool, which is shared between the highest-scoring players of that week. Entry is free and requires no payment or deposit of any kind — you cannot lose money by playing. Prizes are not guaranteed: a pool exists only in weeks we have funded one, and we may run a week with no prize at all. Where a pool exists, its balance is held by the Lexiq smart contract and is visible on-chain.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "#F5EFE2", marginBottom: 6 }}>3. No financial advice</h2>
          <p>Nothing in Lexiq constitutes financial, investment, or legal advice. Stablecoin values, network availability, and smart contract behavior are outside our control. Playing costs only the network fee, which is a fraction of a cent.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "#F5EFE2", marginBottom: 6 }}>4. Eligibility</h2>
          <p>You must be able to lawfully use stablecoin staking features in your jurisdiction to use that part of Lexiq. If staking is restricted where you live, play in free mode only.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "#F5EFE2", marginBottom: 6 }}>5. On-chain data</h2>
          <p>Round outcomes, scores, and any prize payouts are recorded on the Celo blockchain and are public and permanent. Off-chain data such as your chosen username may be stored to operate leaderboards and matchmaking.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "#F5EFE2", marginBottom: 6 }}>6. Limitation of liability</h2>
          <p>Lexiq is provided "as is." We are not liable for losses arising from smart contract bugs, network issues, wallet or MiniPay behavior, or your own use of the staking feature.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "#F5EFE2", marginBottom: 6 }}>7. Changes</h2>
          <p>We may update these terms as Lexiq evolves. Continued use after an update means you accept the current version.</p>
        </section>

        <section>
          <h2 style={{ fontFamily: "var(--font-display)", fontWeight: 700, fontSize: 17, color: "#F5EFE2", marginBottom: 6 }}>8. Contact</h2>
          <p>Questions about these terms? Reach out via the support link in the app.</p>
        </section>
      </div>

      <div style={{ marginTop: 40, paddingTop: 20, borderTop: LINE }}>
        <a href="/" style={{ fontFamily: "var(--font-mono)", fontSize: 12, color: "#CFE94B" }}>← Back to Lexiq</a>
      </div>
    </div>
  );
}

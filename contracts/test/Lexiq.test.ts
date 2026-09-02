import { expect } from "chai";
import { ethers } from "hardhat";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import type { Lexiq, MockUSDM } from "../typechain-types";
import type { HardhatEthersSigner } from "@nomicfoundation/hardhat-ethers/signers";

const DAY  = 86_400;
const USDM = (n: string) => ethers.parseUnits(n, 18);

const EASY = 0, NORMAL = 1, HARD = 2;

describe("Lexiq", () => {
  async function deploy() {
    const [owner, relayer, gameSigner, alice, bob] = await ethers.getSigners();

    const usdm = await (await ethers.getContractFactory("MockUSDM")).deploy() as unknown as MockUSDM;
    const lexiq = await (await ethers.getContractFactory("Lexiq")).deploy(
      await usdm.getAddress(), gameSigner.address, relayer.address,
    ) as unknown as Lexiq;

    for (const who of [alice, bob]) {
      await usdm.mint(who.address, USDM("1000"));
    }

    const domain = {
      name: "Lexiq",
      version: "2",
      chainId: (await ethers.provider.getNetwork()).chainId,
      verifyingContract: await lexiq.getAddress(),
    };

    return { lexiq, usdm, owner, relayer, gameSigner, alice, bob, domain };
  }

  type Ctx = Awaited<ReturnType<typeof deploy>>;

  const SEED_TYPES = {
    Seed: [
      { name: "player",     type: "address" },
      { name: "nonce",      type: "uint256" },
      { name: "difficulty", type: "uint8"   },
      { name: "seed",       type: "bytes32" },
      { name: "deadline",   type: "uint256" },
    ],
  };

  const SCORE_TYPES = {
    Score: [
      { name: "roundId",   type: "uint256" },
      { name: "player",    type: "address" },
      { name: "score",     type: "uint16"  },
      { name: "wordCount", type: "uint8"   },
      { name: "deadline",  type: "uint256" },
    ],
  };

  async function signSeed(
    ctx: Ctx, player: string, difficulty: number,
    opts: { signer?: HardhatEthersSigner; nonce?: bigint; seed?: string; deadline?: number } = {},
  ) {
    const nonce    = opts.nonce    ?? await ctx.lexiq.roundNonce(player);
    const seed     = opts.seed     ?? ethers.hexlify(ethers.randomBytes(32));
    const deadline = opts.deadline ?? (await time()) + DAY;
    const signer   = opts.signer   ?? ctx.gameSigner;
    const sig = await signer.signTypedData(ctx.domain, SEED_TYPES, {
      player, nonce, difficulty, seed, deadline,
    });
    return { seed, deadline, sig };
  }

  async function signScore(
    ctx: Ctx, roundId: bigint, player: string, score: number, wordCount: number,
    opts: { signer?: HardhatEthersSigner; deadline?: number } = {},
  ) {
    const deadline = opts.deadline ?? (await time()) + DAY;
    const signer   = opts.signer   ?? ctx.gameSigner;
    const sig = await signer.signTypedData(ctx.domain, SCORE_TYPES, {
      roundId, player, score, wordCount, deadline,
    });
    return { deadline, sig };
  }

  async function time() {
    return (await ethers.provider.getBlock("latest"))!.timestamp;
  }

  /** Open a free round via the relayer and return its id. */
  async function openFree(ctx: Ctx, player: string, difficulty = NORMAL) {
    const { seed, deadline, sig } = await signSeed(ctx, player, difficulty);
    const tx = await ctx.lexiq.connect(ctx.relayer).startRoundFor(player, difficulty, seed, deadline, sig);
    await tx.wait();
    return (await ctx.lexiq.totalRounds()) - 1n;
  }

  /** Open a staked round sent by the player themselves. */
  async function openStaked(ctx: Ctx, player: HardhatEthersSigner, stake: bigint, difficulty = NORMAL) {
    await ctx.usdm.connect(player).approve(await ctx.lexiq.getAddress(), stake);
    const { seed, deadline, sig } = await signSeed(ctx, player.address, difficulty);
    await ctx.lexiq.connect(player).startRound(stake, difficulty, seed, deadline, sig);
    return (await ctx.lexiq.totalRounds()) - 1n;
  }

  async function settle(ctx: Ctx, roundId: bigint, player: string, score: number, wordCount = 5) {
    const { deadline, sig } = await signScore(ctx, roundId, player, score, wordCount);
    return ctx.lexiq.connect(ctx.relayer).submitRound(roundId, score, wordCount, deadline, sig);
  }

  // ── Stake accounting — the only path touching user money ──────────────────

  describe("stake accounting", () => {
    it("returns the stake minus a 1% fee when the threshold is cleared", async () => {
      const ctx = await loadFixture(deploy);
      const stake = USDM("10");
      const before = await ctx.usdm.balanceOf(ctx.alice.address);

      const id = await openStaked(ctx, ctx.alice, stake);
      expect(await ctx.usdm.balanceOf(ctx.alice.address)).to.equal(before - stake);

      await settle(ctx, id, ctx.alice.address, 50); // threshold is 50

      const fee = stake / 100n;
      expect(await ctx.usdm.balanceOf(ctx.alice.address)).to.equal(before - fee);
    });

    it("forfeits the whole stake to the prize pool below the threshold", async () => {
      const ctx = await loadFixture(deploy);
      const stake = USDM("10");
      const before = await ctx.usdm.balanceOf(ctx.alice.address);

      const id = await openStaked(ctx, ctx.alice, stake);
      await settle(ctx, id, ctx.alice.address, 49); // one under

      expect(await ctx.usdm.balanceOf(ctx.alice.address)).to.equal(before - stake);
      expect(await ctx.lexiq.weeklyPrizePool()).to.equal(stake);
      expect(await ctx.lexiq.platformFeeBalance()).to.equal(0n);
    });

    it("splits the fee without losing wei to rounding", async () => {
      const ctx = await loadFixture(deploy);
      const stake = 300n; // fee = 3, half = 1, remainder = 2 — the case where fee/2 truncates
      await ctx.usdm.mint(ctx.alice.address, stake);

      const id = await openStaked(ctx, ctx.alice, stake);
      await settle(ctx, id, ctx.alice.address, 60);

      const fee = stake / 100n;
      expect(await ctx.lexiq.platformFeeBalance() + await ctx.lexiq.weeklyPrizePool())
        .to.equal(fee, "fee split must account for every wei");
    });

    it("keeps the contract solvent: balance >= pool + fees at all times", async () => {
      const ctx = await loadFixture(deploy);
      const addr = await ctx.lexiq.getAddress();

      const win  = await openStaked(ctx, ctx.alice, USDM("10"));
      await settle(ctx, win, ctx.alice.address, 80);
      const lose = await openStaked(ctx, ctx.bob, USDM("25"));
      await settle(ctx, lose, ctx.bob.address, 10);
      await openStaked(ctx, ctx.alice, USDM("5")); // left unsettled, still escrowed

      const balance = await ctx.usdm.balanceOf(addr);
      const owed    = await ctx.lexiq.weeklyPrizePool() + await ctx.lexiq.platformFeeBalance();
      expect(balance).to.be.greaterThanOrEqual(owed);
    });

    it("cannot spend an active round's stake through distributePrize", async () => {
      const ctx = await loadFixture(deploy);
      const lose = await openStaked(ctx, ctx.bob, USDM("25"));
      await settle(ctx, lose, ctx.bob.address, 5);       // 25 into the pool
      await openStaked(ctx, ctx.alice, USDM("40"));      // still escrowed, not in the pool

      const pool = await ctx.lexiq.weeklyPrizePool();
      expect(pool).to.equal(USDM("25"));
      await expect(
        ctx.lexiq.connect(ctx.owner).distributePrize([ctx.bob.address], [pool + 1n]),
      ).to.be.revertedWith("Exceeds pool");
    });

    it("rejects a stake over MAX_STAKE", async () => {
      const ctx = await loadFixture(deploy);
      const tooBig = (await ctx.lexiq.MAX_STAKE()) + 1n;
      await ctx.usdm.mint(ctx.alice.address, tooBig);
      await ctx.usdm.connect(ctx.alice).approve(await ctx.lexiq.getAddress(), tooBig);
      const { seed, deadline, sig } = await signSeed(ctx, ctx.alice.address, NORMAL);
      await expect(
        ctx.lexiq.connect(ctx.alice).startRound(tooBig, NORMAL, seed, deadline, sig),
      ).to.be.revertedWithCustomError(ctx.lexiq, "StakeTooLarge");
    });

    it("refunds a stuck stake and closes the round", async () => {
      const ctx = await loadFixture(deploy);
      const before = await ctx.usdm.balanceOf(ctx.alice.address);
      const id = await openStaked(ctx, ctx.alice, USDM("10"));

      await ctx.lexiq.connect(ctx.owner).emergencyRefundStake(id);
      expect(await ctx.usdm.balanceOf(ctx.alice.address)).to.equal(before);
      await expect(ctx.lexiq.connect(ctx.owner).emergencyRefundStake(id))
        .to.be.revertedWithCustomError(ctx.lexiq, "NotActive");
    });
  });

  // ── Attestations ─────────────────────────────────────────────────────────

  describe("score attestation", () => {
    it("rejects a score signed by anyone but the game signer", async () => {
      const ctx = await loadFixture(deploy);
      const id = await openFree(ctx, ctx.alice.address);
      const { deadline, sig } = await signScore(ctx, id, ctx.alice.address, 100, 5, { signer: ctx.relayer });
      await expect(ctx.lexiq.connect(ctx.relayer).submitRound(id, 100, 5, deadline, sig))
        .to.be.revertedWithCustomError(ctx.lexiq, "BadAttestation");
    });

    it("rejects a tampered score", async () => {
      const ctx = await loadFixture(deploy);
      const id = await openFree(ctx, ctx.alice.address);
      const { deadline, sig } = await signScore(ctx, id, ctx.alice.address, 40, 5);
      await expect(ctx.lexiq.connect(ctx.relayer).submitRound(id, 900, 5, deadline, sig))
        .to.be.revertedWithCustomError(ctx.lexiq, "BadAttestation");
    });

    it("rejects an attestation replayed onto another round", async () => {
      const ctx = await loadFixture(deploy);
      const a = await openFree(ctx, ctx.alice.address);
      const b = await openFree(ctx, ctx.alice.address);
      const { deadline, sig } = await signScore(ctx, a, ctx.alice.address, 70, 5);
      await expect(ctx.lexiq.connect(ctx.relayer).submitRound(b, 70, 5, deadline, sig))
        .to.be.revertedWithCustomError(ctx.lexiq, "BadAttestation");
    });

    it("cannot settle the same round twice", async () => {
      const ctx = await loadFixture(deploy);
      const id = await openFree(ctx, ctx.alice.address);
      await settle(ctx, id, ctx.alice.address, 70);
      await expect(settle(ctx, id, ctx.alice.address, 70))
        .to.be.revertedWithCustomError(ctx.lexiq, "NotActive");
    });

    it("rejects an expired attestation", async () => {
      const ctx = await loadFixture(deploy);
      const id = await openFree(ctx, ctx.alice.address);
      const deadline = (await time()) - 1;
      const sig = await ctx.gameSigner.signTypedData(ctx.domain, SCORE_TYPES, {
        roundId: id, player: ctx.alice.address, score: 70, wordCount: 5, deadline,
      });
      await expect(ctx.lexiq.connect(ctx.relayer).submitRound(id, 70, 5, deadline, sig))
        .to.be.revertedWithCustomError(ctx.lexiq, "AttestationExpired");
    });

    it("rejects a score above MAX_SCORE", async () => {
      const ctx = await loadFixture(deploy);
      const id = await openFree(ctx, ctx.alice.address);
      const over = Number(await ctx.lexiq.MAX_SCORE()) + 1;
      const { deadline, sig } = await signScore(ctx, id, ctx.alice.address, over, 5);
      await expect(ctx.lexiq.connect(ctx.relayer).submitRound(id, over, 5, deadline, sig))
        .to.be.revertedWithCustomError(ctx.lexiq, "ScoreTooHigh");
    });

    it("credits the player, not the relayer that submitted it", async () => {
      const ctx = await loadFixture(deploy);
      const id = await openFree(ctx, ctx.alice.address);
      await settle(ctx, id, ctx.alice.address, 120);

      expect(await ctx.lexiq.totalScore(ctx.alice.address)).to.equal(120n);
      expect(await ctx.lexiq.highScore(ctx.alice.address)).to.equal(120n);
      expect(await ctx.lexiq.gamesPlayed(ctx.alice.address)).to.equal(1n);
      expect(await ctx.lexiq.totalScore(ctx.relayer.address)).to.equal(0n);
    });

    it("accumulates totalScore but keeps highScore at the best round", async () => {
      const ctx = await loadFixture(deploy);
      await settle(ctx, await openFree(ctx, ctx.alice.address), ctx.alice.address, 90);
      await settle(ctx, await openFree(ctx, ctx.alice.address), ctx.alice.address, 40);
      expect(await ctx.lexiq.totalScore(ctx.alice.address)).to.equal(130n);
      expect(await ctx.lexiq.highScore(ctx.alice.address)).to.equal(90n);
    });
  });

  describe("seed attestation", () => {
    it("rejects a seed signed by anyone but the game signer", async () => {
      const ctx = await loadFixture(deploy);
      const { seed, deadline, sig } = await signSeed(ctx, ctx.alice.address, NORMAL, { signer: ctx.alice });
      await expect(
        ctx.lexiq.connect(ctx.relayer).startRoundFor(ctx.alice.address, NORMAL, seed, deadline, sig),
      ).to.be.revertedWithCustomError(ctx.lexiq, "BadAttestation");
    });

    it("cannot reuse a seed attestation — no re-rolling the draw", async () => {
      const ctx = await loadFixture(deploy);
      const { seed, deadline, sig } = await signSeed(ctx, ctx.alice.address, NORMAL);
      await ctx.lexiq.connect(ctx.relayer).startRoundFor(ctx.alice.address, NORMAL, seed, deadline, sig);
      await expect(
        ctx.lexiq.connect(ctx.relayer).startRoundFor(ctx.alice.address, NORMAL, seed, deadline, sig),
      ).to.be.revertedWithCustomError(ctx.lexiq, "BadAttestation");
    });

    it("advances the nonce per player independently", async () => {
      const ctx = await loadFixture(deploy);
      await openFree(ctx, ctx.alice.address);
      await openFree(ctx, ctx.alice.address);
      expect(await ctx.lexiq.roundNonce(ctx.alice.address)).to.equal(2n);
      expect(await ctx.lexiq.roundNonce(ctx.bob.address)).to.equal(0n);
    });
  });

  // ── Access control ───────────────────────────────────────────────────────

  describe("access control", () => {
    it("only the relayer may open free rounds", async () => {
      const ctx = await loadFixture(deploy);
      const { seed, deadline, sig } = await signSeed(ctx, ctx.alice.address, NORMAL);
      await expect(
        ctx.lexiq.connect(ctx.alice).startRoundFor(ctx.alice.address, NORMAL, seed, deadline, sig),
      ).to.be.revertedWithCustomError(ctx.lexiq, "NotRelayer");
    });

    it("a compromised relayer cannot settle a round or move a stake", async () => {
      const ctx = await loadFixture(deploy);
      const id = await openStaked(ctx, ctx.alice, USDM("10"));
      const { deadline, sig } = await signScore(ctx, id, ctx.alice.address, 200, 5, { signer: ctx.relayer });
      await expect(ctx.lexiq.connect(ctx.relayer).submitRound(id, 200, 5, deadline, sig))
        .to.be.revertedWithCustomError(ctx.lexiq, "BadAttestation");
    });

    it("restricts the setters to the owner and bounds the threshold", async () => {
      const ctx = await loadFixture(deploy);
      await expect(ctx.lexiq.connect(ctx.alice).setGameSigner(ctx.alice.address))
        .to.be.revertedWithCustomError(ctx.lexiq, "OwnableUnauthorizedAccount");

      const min = await ctx.lexiq.MIN_STAKE_THRESHOLD();
      const max = await ctx.lexiq.MAX_STAKE_THRESHOLD();
      await expect(ctx.lexiq.connect(ctx.owner).setStakeThreshold(min - 1n)).to.be.revertedWith("Out of range");
      await expect(ctx.lexiq.connect(ctx.owner).setStakeThreshold(max + 1n)).to.be.revertedWith("Out of range");
      await ctx.lexiq.connect(ctx.owner).setStakeThreshold(75);
      expect(await ctx.lexiq.stakeThreshold()).to.equal(75n);
    });

    it("honours a rotated game signer", async () => {
      const ctx = await loadFixture(deploy);
      await ctx.lexiq.connect(ctx.owner).setGameSigner(ctx.bob.address);

      const stale = await signSeed(ctx, ctx.alice.address, NORMAL); // old signer
      await expect(
        ctx.lexiq.connect(ctx.relayer)
          .startRoundFor(ctx.alice.address, NORMAL, stale.seed, stale.deadline, stale.sig),
      ).to.be.revertedWithCustomError(ctx.lexiq, "BadAttestation");

      const fresh = await signSeed(ctx, ctx.alice.address, NORMAL, { signer: ctx.bob });
      await expect(
        ctx.lexiq.connect(ctx.relayer)
          .startRoundFor(ctx.alice.address, NORMAL, fresh.seed, fresh.deadline, fresh.sig),
      ).to.emit(ctx.lexiq, "RoundStarted");
    });
  });

  // ── Letters ──────────────────────────────────────────────────────────────

  describe("letters", () => {
    it("always meets the vowel floor across many draws", async () => {
      const ctx = await loadFixture(deploy);
      const VOWELS = new Set(["A", "E", "I", "O", "U"]);

      for (const [difficulty, floor] of [[EASY, 3], [NORMAL, 2], [HARD, 2]] as const) {
        for (let i = 0; i < 40; i++) {
          const id = await openFree(ctx, ctx.alice.address, difficulty);
          const letters = await ctx.lexiq.getLetters(id);
          const chars = letters.map((b: string) => Buffer.from(b.slice(2), "hex").toString());
          const vowels = chars.filter((c) => VOWELS.has(c)).length;
          expect(vowels, `difficulty ${difficulty} drew ${chars.join("")}`).to.be.greaterThanOrEqual(floor);
          expect(chars.every((c) => /^[A-Z]$/.test(c))).to.equal(true);
        }
      }
    }).timeout(120_000);

    it("gives a challenge the original round's letters and difficulty", async () => {
      const ctx = await loadFixture(deploy);
      const orig = await openFree(ctx, ctx.alice.address, HARD);
      await settle(ctx, orig, ctx.alice.address, 60);

      await ctx.lexiq.connect(ctx.bob).startChallenge(orig, 0);
      const id = (await ctx.lexiq.totalRounds()) - 1n;

      expect(await ctx.lexiq.getLetters(id)).to.deep.equal(await ctx.lexiq.getLetters(orig));
      const [, , , difficulty] = await ctx.lexiq.getRound(id);
      expect(difficulty).to.equal(HARD);
    });

    it("refuses to challenge a round that is still active", async () => {
      const ctx = await loadFixture(deploy);
      const orig = await openFree(ctx, ctx.alice.address);
      await expect(ctx.lexiq.connect(ctx.bob).startChallenge(orig, 0))
        .to.be.revertedWithCustomError(ctx.lexiq, "NotActive");
    });
  });
});

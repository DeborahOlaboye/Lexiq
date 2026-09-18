// Run:  NODE_PATH=<dir containing a server-only shim> npx tsx lib/__tests__/opponent.test.ts
// lib/wordlist and lib/opponent both import "server-only", whose exports only resolve under
// Next's react-server condition, so a one-line stub package is needed to run this outside Next.
import { opponentPlay, LEVEL_NAMES } from "../opponent";
import { solveBoard, boardMaxScore } from "@/lib/wordlist";
import { scoreWords, MAX_WORDS } from "@/lib/scoring";

let pass = 0, fail = 0;
const ok = (n: string, c: boolean, e = "") => { c ? pass++ : fail++; console.log(`${c ? "  PASS" : "  FAIL"}  ${n}${e && !c ? "  -> " + e : ""}`); };

// Real boards from the deployed contract.
const BOARDS = ["EOILKRE", "EEYASHU", "TSAFOTC", "AUNENIV", "PVFQPOA"];
const SEED = "0x9f2c4a1b3e5d7f8a0c2e4b6d8f0a1c3e5b7d9f1a3c5e7b9d1f3a5c7e9b1d3f5a";

(async () => {
  console.log("\ndeterminism");
  const a = opponentPlay({ seed: SEED, letters: "EOILKRE", lang: "en", level: 1 });
  const b = opponentPlay({ seed: SEED, letters: "EOILKRE", lang: "en", level: 1 });
  ok("same seed gives an identical play", JSON.stringify(a) === JSON.stringify(b));
  const c = opponentPlay({ seed: SEED.replace(/a$/, "b"), letters: "EOILKRE", lang: "en", level: 1 });
  ok("a different seed plays differently", JSON.stringify(a.words) !== JSON.stringify(c.words));

  console.log("\nlegality — every word must be real and buildable");
  let allLegal = true, allScored = true;
  for (const letters of BOARDS) {
    const valid = new Set(solveBoard(letters, "en").map(w => w.word));
    for (const lvl of [0, 1, 2]) {
      const p = opponentPlay({ seed: SEED, letters, lang: "en", level: lvl });
      if (!p.words.every(w => valid.has(w))) allLegal = false;
      if (p.score !== scoreWords(p.words)) allScored = false;
      if (p.words.length > MAX_WORDS) allLegal = false;
      if (new Set(p.words).size !== p.words.length) allLegal = false;
    }
  }
  ok("every word is in the dictionary and buildable from the letters", allLegal);
  ok("reported score matches scoreWords of its own words", allScored);

  console.log("\nlevels must actually differ, and in the right order");
  let ordered = true;
  for (const letters of BOARDS) {
    const s = [0, 1, 2].map(l => opponentPlay({ seed: SEED, letters, lang: "en", level: l }).score);
    if (!(s[0] < s[1] && s[1] < s[2])) { ordered = false; console.log(`    ${letters}: ${s.join(" < ")} NOT ascending`); }
  }
  ok("Casual < Sharp < Relentless on every board", ordered);

  console.log("\ncoverage must stay in human range (under the 75% implausible flag)");
  let inRange = true;
  const rows: string[] = [];
  for (const letters of BOARDS) {
    const max = boardMaxScore(letters, "en");
    const cells = [0, 1, 2].map(l => {
      const p = opponentPlay({ seed: SEED, letters, lang: "en", level: l });
      if (p.coverage >= 75) inRange = false;
      return `${LEVEL_NAMES[l]} ${String(p.score).padStart(3)}pts/${String(p.words.length).padStart(2)}w ${String(p.coverage).padStart(2)}%`;
    });
    rows.push(`    ${letters} (max ${String(max).padStart(3)})  ${cells.join("   ")}`);
  }
  rows.forEach(r => console.log(r));
  ok("no level ever reaches the 75% implausible-coverage threshold", inRange);

  console.log("\nbeatability against real observed rounds");
  // Scores real players actually achieved on these exact boards.
  const REAL: Array<[string, number]> = [["EEYASHU", 54], ["TSAFOTC", 48], ["AUNENIV", 34]];
  let worthwhile = true, casualBeatsSomething = false;
  const casualScores: Array<[number, number]> = [];
  for (const [letters, human] of REAL) {
    const s0 = opponentPlay({ seed: SEED, letters, lang: "en", level: 0 }).score;
    const s2 = opponentPlay({ seed: SEED, letters, lang: "en", level: 2 }).score;
    console.log(`    ${letters}: human ${human}  vs  Casual ${s0}  Relentless ${s2}`);
    casualScores.push([human, s0]);
    if (s0 > human) casualBeatsSomething = true;
    if (s2 <= human) worthwhile = false;
  }
  const strongest = casualScores.reduce((a, b) => (b[0] > a[0] ? b : a));
  const strongestBeatsCasual = strongest[0] > strongest[1];
  // Not "Casual always loses": that was the original assertion, and it described a level that
  // went 0 from 4 in production. A difficulty nobody can lose to is not a difficulty. What
  // must hold is that Casual is beatable by a good round and still capable of punishing a
  // weak one.
  ok("Casual loses to the strongest observed round", strongestBeatsCasual);
  ok("Casual can still beat a weak round", casualBeatsSomething);
  ok("Relentless beats a real observed round", worthwhile);

  console.log("\nlanguages");
  const fr = opponentPlay({ seed: SEED, letters: "EOILKRE", lang: "fr", level: 1 });
  ok("plays French boards too", fr.words.length > 0, `${fr.words.length} words`);

  console.log("\nedge cases");
  const empty = opponentPlay({ seed: SEED, letters: "QQQQQQQ", lang: "en", level: 2 });
  ok("a board with no words returns an empty play, not a crash", empty.words.length === 0 && empty.score === 0);
  const badLevel = opponentPlay({ seed: SEED, letters: "EOILKRE", lang: "en", level: 9 });
  ok("an unknown level falls back rather than throwing", badLevel.level === 1 && badLevel.words.length > 0);

  console.log("\nsample game (EOILKRE, Sharp)");
  console.log("   ", a.words.join(", "));

  console.log(`\n${pass} passed, ${fail} failed\n`);
  process.exit(fail ? 1 : 0);
})();

export type Lang = "en" | "es" | "fr";

// Letters are no longer generated in the browser — every round, guest or wallet, draws its
// seven from the chain so the words a player finds can be checked against the round they
// settle into. This module now only carries the language type.

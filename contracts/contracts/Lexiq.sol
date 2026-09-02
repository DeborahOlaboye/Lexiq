// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";
import "@openzeppelin/contracts/utils/cryptography/ECDSA.sol";
import "@openzeppelin/contracts/utils/cryptography/EIP712.sol";

/// @title Lexiq — word race on Celo. Build words from 7 letters against the clock.
/// @notice Scores are signed by the game server: English can't be validated on-chain, so
///         without an attestation any caller could submit letter-permutations for full points.
///         Seeds are signed for the same reason — a self-sent transaction can be simulated
///         first, so a player deriving their own letters could re-roll until the draw was good.
contract Lexiq is Ownable, ReentrancyGuard, EIP712 {
    using ECDSA for bytes32;

    IERC20 public immutable usdm;

    /// @notice Signs seed and score attestations. Authoritative over scoring.
    address public gameSigner;
    /// @notice May only open free rounds for players, so play can be gas-sponsored. It cannot
    ///         settle a round, mint a score, or touch a stake.
    address public relayer;

    uint8  public constant MAX_WORDS = 30;
    uint16 public constant MAX_SCORE = 3000;

    uint8 public constant DIFFICULTY_EASY   = 0;
    uint8 public constant DIFFICULTY_NORMAL = 1;
    uint8 public constant DIFFICULTY_HARD   = 2;

    uint8 public constant LANG_EN = 0;
    uint8 public constant LANG_ES = 1;
    uint8 public constant LANG_FR = 2;

    /// @notice Bounds what one round can pull from a player's approval.
    uint256 public constant MAX_STAKE = 100e18;

    /// @notice Score a staked round must reach to get the stake back. Adjustable, but bounded
    ///         so it can never be moved somewhere that makes staked rounds unwinnable.
    uint16 public stakeThreshold = 50;
    uint16 public constant MIN_STAKE_THRESHOLD = 20;
    uint16 public constant MAX_STAKE_THRESHOLD = 200;

    enum RoundState { ACTIVE, FINISHED }

    struct Round {
        address    player;     // ─┐
        uint32     startedAt;  //  │ 30 bytes — one slot
        uint8      difficulty; //  │
        uint8      lang;       //  │
        uint16     score;      //  │
        uint8      wordCount;  //  │
        RoundState state;      // ─┘
        bytes32    seed;
        uint256    stake;
    }

    uint256 private _roundCounter;
    mapping(uint256 => Round)     private rounds;
    mapping(address => uint256[]) public playerRounds;
    mapping(address => uint256)   public totalScore;
    mapping(address => uint256)   public highScore;
    /// @notice Finished rounds only — counting at start would be free to inflate.
    mapping(address => uint256)   public gamesPlayed;
    /// @notice One valid seed per index, so draws can't be re-rolled.
    mapping(address => uint256)   public roundNonce;

    uint256 public weeklyPrizePool;
    uint256 public platformFeeBalance;

    bytes32 private constant SEED_TYPEHASH =
        keccak256("Seed(address player,uint256 nonce,uint8 difficulty,uint8 lang,bytes32 seed,uint256 deadline)");
    bytes32 private constant SCORE_TYPEHASH =
        keccak256("Score(uint256 roundId,address player,uint16 score,uint8 wordCount,uint256 deadline)");

    event RoundStarted(uint256 indexed roundId, address indexed player, uint8 difficulty, uint8 lang, uint256 stake);
    event ChallengeStarted(uint256 indexed roundId, uint256 indexed originalRoundId, address indexed challenger);
    event RoundFinished(uint256 indexed roundId, address indexed player, uint16 score, uint8 wordCount);
    event StakeReturned(uint256 indexed roundId, address indexed player, uint256 amount);
    event PrizeDistributed(address indexed recipient, uint256 amount);
    event GameSignerUpdated(address indexed signer);
    event RelayerUpdated(address indexed relayer);
    event StakeThresholdUpdated(uint16 threshold);

    error NotRelayer();
    error NotActive();
    error BadAttestation();
    error AttestationExpired();
    error StakeTooLarge();
    error ScoreTooHigh();

    constructor(address _usdm, address _gameSigner, address _relayer)
        Ownable(msg.sender)
        EIP712("Lexiq", "2")
    {
        usdm       = IERC20(_usdm);
        gameSigner = _gameSigner;
        relayer    = _relayer;
    }

    // ── Admin ────────────────────────────────────────────────────────────────

    function setGameSigner(address s) external onlyOwner {
        gameSigner = s;
        emit GameSignerUpdated(s);
    }

    function setRelayer(address r) external onlyOwner {
        relayer = r;
        emit RelayerUpdated(r);
    }

    function setStakeThreshold(uint16 t) external onlyOwner {
        require(t >= MIN_STAKE_THRESHOLD && t <= MAX_STAKE_THRESHOLD, "Out of range");
        stakeThreshold = t;
        emit StakeThresholdUpdated(t);
    }

    // ── Starting rounds ──────────────────────────────────────────────────────

    /// @notice Start a free round for a player. Relayer pays the gas.
    function startRoundFor(
        address player,
        uint8   difficulty,
        uint8   lang,
        bytes32 seed,
        uint256 deadline,
        bytes calldata seedSig
    ) external nonReentrant returns (uint256) {
        if (msg.sender != relayer) revert NotRelayer();
        _verifySeed(player, difficulty, lang, seed, deadline, seedSig);
        return _open(player, 0, difficulty, lang, seed);
    }

    /// @notice Start a staked round. Sent by the player: `transferFrom` needs their approval,
    ///         and an approval can't be sponsored. Approve the exact stake, not an unlimited
    ///         amount, so a compromised relayer can never pull more.
    function startRound(
        uint256 stakeAmount,
        uint8   difficulty,
        uint8   lang,
        bytes32 seed,
        uint256 deadline,
        bytes calldata seedSig
    ) external nonReentrant returns (uint256) {
        _verifySeed(msg.sender, difficulty, lang, seed, deadline, seedSig);
        return _open(msg.sender, stakeAmount, difficulty, lang, seed);
    }

    /// @notice Open a free challenge for a player. Relayer pays the gas, and the stake is
    ///         forced to zero — the relayer must never be able to move a player's tokens.
    function startChallengeFor(address player, uint256 originalRoundId)
        external nonReentrant returns (uint256)
    {
        if (msg.sender != relayer) revert NotRelayer();
        return _challenge(player, originalRoundId, 0);
    }

    /// @notice Race a finished round's letters. Inherits its seed, difficulty and language.
    ///         Sent by the player when staking, for the same reason startRound is.
    function startChallenge(uint256 originalRoundId, uint256 stakeAmount)
        external nonReentrant returns (uint256)
    {
        return _challenge(msg.sender, originalRoundId, stakeAmount);
    }

    function _challenge(address player, uint256 originalRoundId, uint256 stakeAmount)
        private returns (uint256 roundId)
    {
        Round storage orig = rounds[originalRoundId];
        if (orig.state != RoundState.FINISHED) revert NotActive();
        roundId = _open(player, stakeAmount, orig.difficulty, orig.lang, orig.seed);
        emit ChallengeStarted(roundId, originalRoundId, player);
    }

    function _open(address player, uint256 stakeAmount, uint8 difficulty, uint8 lang, bytes32 seed)
        private returns (uint256 roundId)
    {
        if (difficulty > DIFFICULTY_HARD || lang > LANG_FR) revert BadAttestation();
        if (stakeAmount > MAX_STAKE) revert StakeTooLarge();
        if (stakeAmount > 0) {
            require(usdm.transferFrom(player, address(this), stakeAmount), "Stake failed");
        }

        roundId = _roundCounter++;
        Round storage r = rounds[roundId];
        r.player     = player;
        r.startedAt  = uint32(block.timestamp);
        r.difficulty = difficulty;
        r.lang       = lang;
        r.state      = RoundState.ACTIVE;
        r.seed       = seed;
        r.stake      = stakeAmount;

        playerRounds[player].push(roundId);
        emit RoundStarted(roundId, player, difficulty, lang, stakeAmount);
    }

    // ── Finishing rounds ─────────────────────────────────────────────────────

    /// @notice Settle a round against a signed score. Also the "quit early" path — submit
    ///         what you have and keep the stake if it clears the threshold.
    /// @dev The ACTIVE→FINISHED transition makes an attestation single-use, so no nonce is
    ///      needed. `deadline` bounds signature freshness only; the game clock is enforced by
    ///      the server, which measures real elapsed time rather than racing block timestamps
    ///      and rejecting honest transactions that land a second late.
    function submitRound(
        uint256 roundId,
        uint16  score,
        uint8   wordCount,
        uint256 deadline,
        bytes calldata scoreSig
    ) external nonReentrant {
        Round storage r = rounds[roundId];
        address player  = r.player;

        if (r.state != RoundState.ACTIVE) revert NotActive();
        if (block.timestamp > deadline)   revert AttestationExpired();
        if (score > MAX_SCORE)            revert ScoreTooHigh();
        if (wordCount > MAX_WORDS)        revert ScoreTooHigh();

        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(SCORE_TYPEHASH, roundId, player, score, wordCount, deadline))
        );
        if (digest.recover(scoreSig) != gameSigner) revert BadAttestation();

        r.state     = RoundState.FINISHED;
        r.score     = score;
        r.wordCount = wordCount;

        totalScore[player] += score;
        if (score > highScore[player]) highScore[player] = score;
        gamesPlayed[player]++;

        uint256 stake = r.stake;
        if (stake > 0) {
            r.stake = 0;
            if (score >= stakeThreshold) {
                uint256 fee  = stake / 100;
                uint256 half = fee / 2;
                platformFeeBalance += half;
                weeklyPrizePool    += fee - half; // remainder, so odd fees lose no wei
                uint256 back = stake - fee;
                require(usdm.transfer(player, back), "Payout failed");
                emit StakeReturned(roundId, player, back);
            } else {
                weeklyPrizePool += stake;
            }
        }

        emit RoundFinished(roundId, player, score, wordCount);
    }

    // ── Attestations ─────────────────────────────────────────────────────────

    function _verifySeed(
        address player,
        uint8   difficulty,
        uint8   lang,
        bytes32 seed,
        uint256 deadline,
        bytes calldata sig
    ) private {
        if (block.timestamp > deadline) revert AttestationExpired();
        uint256 nonce = roundNonce[player];
        bytes32 digest = _hashTypedDataV4(
            keccak256(abi.encode(SEED_TYPEHASH, player, nonce, difficulty, lang, seed, deadline))
        );
        if (digest.recover(sig) != gameSigner) revert BadAttestation();
        roundNonce[player] = nonce + 1;
    }

    // ── Letters ──────────────────────────────────────────────────────────────

    function getLetters(uint256 roundId) external view returns (bytes1[7] memory) {
        Round storage r = rounds[roundId];
        return _lettersFor(r.seed, r.difficulty, r.lang);
    }

    /// @dev Every draw is topped up to a vowel floor: a flat table produces an all-consonant
    ///      hand ~2% of the time, which is an unplayable round and, with a stake on it, a loss
    ///      the player could do nothing about.
    function _lettersFor(bytes32 seed, uint8 difficulty, uint8 lang)
        internal pure returns (bytes1[7] memory letters)
    {
        bytes memory freq = _freqTable(difficulty, lang);
        uint8 vowels;

        for (uint8 i = 0; i < 7; i++) {
            bytes1 c = freq[uint256(keccak256(abi.encodePacked(seed, i))) % freq.length];
            letters[i] = c;
            if (_isVowel(c)) vowels++;
        }

        uint8 minVowels = difficulty == DIFFICULTY_EASY ? 3 : 2;
        bytes memory vw = "AEIOU";
        for (uint8 k = 0; k < 7 && vowels < minVowels; k++) {
            uint8 i = 6 - k;
            if (!_isVowel(letters[i])) {
                letters[i] = vw[uint256(keccak256(abi.encodePacked(seed, "v", i))) % 5];
                vowels++;
            }
        }
    }

    /// @dev A draw weighted for the language being played. Dealing English frequencies to a
    ///      French or Spanish player leaves far fewer findable words on the board.
    function _freqTable(uint8 difficulty, uint8 lang) private pure returns (bytes memory) {
        if (lang == LANG_ES) {
            if (difficulty == DIFFICULTY_EASY) {
                return "AAAAAAAAAAAAAAEEEEEEEEEEEEEEOOOOOOOOOOIIIIIIIUUUUUSSSSSSSNNNNNNNRRRRRRLLLLLLDDDDDTTTTTCCCCMMMPPPB";
            }
            if (difficulty == DIFFICULTY_HARD) {
                return "AAAAAEEEEEOOOOIIIUUUBBBCCCDDDFFFGGGHHHJJJLLLMMMNNNPPPQQRRRSSSTTTVVVXXYYZZZ";
            }
            return "AAAAAAAAAAAAEEEEEEEEEEEEEEOOOOOOOOSSSSSSSNNNNNNNRRRRRRRIIIIIIILLLLLDDDDDDTTTTTCCCCUUUUMMMPPBBGVYFHZ";
        }
        if (lang == LANG_FR) {
            if (difficulty == DIFFICULTY_EASY) {
                return "EEEEEEEEEEEEEEEEEEEEAAAAAAAAAAIIIIIIIIOOOOOOOUUUUUUSSSSSSSTTTTTTTNNNNNNNRRRRRRLLLLLLDDDDDCCCCMMMPPP";
            }
            if (difficulty == DIFFICULTY_HARD) {
                return "AAAAEEEEEEEIIIIOOOOUUUBBBCCCDDDFFFGGGHHHJJKKLLLMMMNNNPPPQQQRRRSSSTTTVVVWXXYYZZ";
            }
            return "EEEEEEEEEEEEEEEEEAAAAAAAASSSSSSSIIIIIIIITTTTTTTNNNNNNNRRRRRRRUUUUUULLLLLOOOOODDDCCCMMMPPPVVGFBQHZ";
        }
        if (difficulty == DIFFICULTY_EASY) {
            return "AAAAAAAAAAAAEEEEEEEEEEEEEEEEIIIIIIIIIIOOOOOOOOOOUUUUUURRRRRRRSSSSSSSTTTTTTTNNNNNNLLLLLDDDDCCCMMMPPPHHHGGYY";
        }
        if (difficulty == DIFFICULTY_HARD) {
            return "AAAABBBCCCDDDEEEEEFFFGGGHHHIIIIJJKKLLLMMMNNNOOOOPPPQQRRRSSSTTTUUUVVVWWWXXYYYZZ";
        }
        return "AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ";
    }

    function _isVowel(bytes1 c) private pure returns (bool) {
        return c == "A" || c == "E" || c == "I" || c == "O" || c == "U";
    }

    // ── Views ────────────────────────────────────────────────────────────────

    function getRound(uint256 roundId) external view returns (
        address player, bytes32 seed, uint32 startedAt, uint8 difficulty, uint8 lang,
        uint16 score, uint8 wordCount, RoundState state, uint256 stake
    ) {
        Round storage r = rounds[roundId];
        return (r.player, r.seed, r.startedAt, r.difficulty, r.lang, r.score, r.wordCount, r.state, r.stake);
    }

    /// @notice Advisory only — the clock is enforced by the server when it signs a score.
    function roundDuration(uint8 difficulty) public pure returns (uint32) {
        if (difficulty == DIFFICULTY_EASY) return 120;
        if (difficulty == DIFFICULTY_HARD) return 60;
        return 90;
    }

    function getPlayerRounds(address p) external view returns (uint256[] memory) {
        return playerRounds[p];
    }

    /// @dev `playerRounds` grows without bound — page it rather than reading the whole array.
    function getPlayerRoundsPaged(address p, uint256 offset, uint256 limit)
        external view returns (uint256[] memory page)
    {
        uint256[] storage all = playerRounds[p];
        if (offset >= all.length) return new uint256[](0);
        uint256 end = offset + limit;
        if (end > all.length) end = all.length;
        page = new uint256[](end - offset);
        for (uint256 i = offset; i < end; i++) page[i - offset] = all[i];
    }

    function playerRoundCount(address p) external view returns (uint256) {
        return playerRounds[p].length;
    }

    function totalRounds() external view returns (uint256) { return _roundCounter; }

    // ── Treasury ─────────────────────────────────────────────────────────────

    function depositWeeklyPrize(uint256 amount) external {
        require(usdm.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        weeklyPrizePool += amount;
    }

    function withdrawFees() external onlyOwner {
        uint256 a = platformFeeBalance;
        platformFeeBalance = 0;
        require(usdm.transfer(owner(), a), "Transfer failed");
    }

    function distributePrize(address[] calldata recipients, uint256[] calldata amounts)
        external onlyOwner nonReentrant
    {
        require(recipients.length == amounts.length, "Length mismatch");
        uint256 total;
        for (uint256 i = 0; i < amounts.length; i++) total += amounts[i];
        require(total <= weeklyPrizePool, "Exceeds pool");
        weeklyPrizePool -= total;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(usdm.transfer(recipients[i], amounts[i]), "Transfer failed");
            emit PrizeDistributed(recipients[i], amounts[i]);
        }
    }

    /// @notice Return a stake if a round can never be settled — a signer outage, say.
    function emergencyRefundStake(uint256 roundId) external onlyOwner nonReentrant {
        Round storage r = rounds[roundId];
        if (r.state != RoundState.ACTIVE) revert NotActive();
        uint256 stake = r.stake;
        require(stake > 0, "No stake");
        r.stake = 0;
        r.state = RoundState.FINISHED;
        require(usdm.transfer(r.player, stake), "Transfer failed");
        emit StakeReturned(roundId, r.player, stake);
    }
}

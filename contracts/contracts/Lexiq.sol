// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Lexiq — solo word race on Celo. Build words from 7 letters in 90 seconds.
/// @notice Stake USDM for bonus: get it back if you score >= 10 points.
contract Lexiq is Ownable, ReentrancyGuard {
    IERC20 public immutable usdm;

    uint32 public constant ROUND_DURATION  = 90; // used for legacy; new rounds use difficulty
    uint8  public constant MAX_WORDS       = 15;
    uint8  public constant STAKE_THRESHOLD = 10;

    // Difficulty: 0 = Easy (120s), 1 = Normal (90s), 2 = Hard (60s)
    uint8  public constant DIFFICULTY_EASY   = 0;
    uint8  public constant DIFFICULTY_NORMAL = 1;
    uint8  public constant DIFFICULTY_HARD   = 2;

    enum RoundState { ACTIVE, FINISHED }
    struct WordCommit { bytes32 hash; bool revealed; uint8 score; }
    struct Round {
        address player; bytes32 letterSeed; uint32 startedAt;
        WordCommit[15] commits; uint8 commitCount; uint8 totalScore;
        RoundState state; uint256 stake; uint8 difficulty;
    }

    uint256 private _roundCounter;
    mapping(uint256 => Round) private rounds;
    mapping(address => uint256[]) public playerRounds;
    mapping(address => uint256) public totalScore;
    mapping(address => uint256) public highScore;
    mapping(address => uint256) public gamesPlayed;
    uint256 public weeklyPrizePool;
    uint256 public platformFeeBalance;

    event RoundStarted(uint256 indexed roundId, address indexed player, bytes32 letterSeed);
    event ChallengeStarted(uint256 indexed challengeRoundId, uint256 indexed originalRoundId, address indexed challenger);
    event WordCommitted(uint256 indexed roundId, uint8 slot);
    event WordRevealed(uint256 indexed roundId, string word, uint8 score);
    event RoundFinished(uint256 indexed roundId, address indexed player, uint8 finalScore);
    event PrizeDistributed(address indexed recipient, uint256 amount);

    constructor(address _usdm) Ownable(msg.sender) { usdm = IERC20(_usdm); }

    function startRound(uint256 stakeAmount, uint8 difficulty) external nonReentrant returns (uint256 roundId) {
        require(difficulty <= DIFFICULTY_HARD, "Invalid difficulty");
        if (stakeAmount > 0) require(usdm.transferFrom(msg.sender, address(this), stakeAmount), "Stake failed");
        roundId = _roundCounter++;
        Round storage r = rounds[roundId];
        r.player = msg.sender; r.startedAt = uint32(block.timestamp);
        r.stake = stakeAmount; r.state = RoundState.ACTIVE; r.difficulty = difficulty;
        r.letterSeed = keccak256(abi.encodePacked(block.prevrandao, msg.sender, roundId, block.timestamp));
        playerRounds[msg.sender].push(roundId); gamesPlayed[msg.sender]++;
        emit RoundStarted(roundId, msg.sender, r.letterSeed);
    }

    function _roundDuration(uint8 difficulty) internal pure returns (uint32) {
        if (difficulty == DIFFICULTY_EASY) return 120;
        if (difficulty == DIFFICULTY_HARD) return 60;
        return 90;
    }

    /// @notice Start a round using the same 7 letters as an existing finished round.
    ///         Lets a friend accept a challenge and race on identical letters.
    function startChallenge(uint256 originalRoundId, uint256 stakeAmount) external nonReentrant returns (uint256 roundId) {
        Round storage orig = rounds[originalRoundId];
        require(orig.state == RoundState.FINISHED, "Original not finished");
        if (stakeAmount > 0) require(usdm.transferFrom(msg.sender, address(this), stakeAmount), "Stake failed");
        roundId = _roundCounter++;
        Round storage r = rounds[roundId];
        r.player = msg.sender; r.startedAt = uint32(block.timestamp);
        r.stake = stakeAmount; r.state = RoundState.ACTIVE;
        r.letterSeed = orig.letterSeed; // same letters as the challenge source
        playerRounds[msg.sender].push(roundId); gamesPlayed[msg.sender]++;
        emit RoundStarted(roundId, msg.sender, r.letterSeed);
        emit ChallengeStarted(roundId, originalRoundId, msg.sender);
    }

    function commitWord(uint256 roundId, bytes32 wordHash) external {
        Round storage r = rounds[roundId];
        require(r.player == msg.sender, "Not your round");
        require(r.state == RoundState.ACTIVE, "Not active");
        require(block.timestamp < r.startedAt + _roundDuration(r.difficulty), "Time up");
        require(r.commitCount < MAX_WORDS, "Max words reached");
        r.commits[r.commitCount] = WordCommit({ hash: wordHash, revealed: false, score: 0 });
        r.commitCount++;
        emit WordCommitted(roundId, r.commitCount - 1);
    }

    /// @notice Batch-commit all word hashes in a single transaction.
    ///         Can be called any time while the round is ACTIVE (no time window restriction).
    function commitWords(uint256 roundId, bytes32[] calldata wordHashes) external {
        Round storage r = rounds[roundId];
        require(r.player == msg.sender, "Not your round");
        require(r.state == RoundState.ACTIVE, "Not active");
        for (uint256 i = 0; i < wordHashes.length; i++) {
            if (r.commitCount >= MAX_WORDS) break;
            r.commits[r.commitCount] = WordCommit({ hash: wordHashes[i], revealed: false, score: 0 });
            r.commitCount++;
            emit WordCommitted(roundId, r.commitCount - 1);
        }
    }

    function revealWords(uint256 roundId, string[] calldata words, bytes32[] calldata salts) external nonReentrant {
        Round storage r = rounds[roundId];
        require(r.player == msg.sender, "Not your round");
        require(r.state == RoundState.ACTIVE, "Already finished");
        require(words.length == salts.length, "Length mismatch");
        bytes1[7] memory roundLetters = _getLetters(r.letterSeed);
        for (uint8 i = 0; i < words.length && i < r.commitCount; i++) {
            bytes32 expected = keccak256(abi.encodePacked(words[i], salts[i]));
            if (expected == r.commits[i].hash && !r.commits[i].revealed && _wordUsesValidLetters(words[i], roundLetters)) {
                uint8 pts = _scoreWord(uint8(bytes(words[i]).length));
                r.commits[i].score = pts; r.commits[i].revealed = true;
                r.totalScore += pts;
                emit WordRevealed(roundId, words[i], pts);
            }
        }
        r.state = RoundState.FINISHED;
        totalScore[msg.sender] += r.totalScore;
        if (r.totalScore > highScore[msg.sender]) highScore[msg.sender] = r.totalScore;
        if (r.stake > 0) {
            if (r.totalScore >= STAKE_THRESHOLD) {
                uint256 fee = r.stake / 100; uint256 back = r.stake - fee;
                platformFeeBalance += fee / 2; weeklyPrizePool += fee / 2;
                require(usdm.transfer(msg.sender, back), "Payout failed");
            } else { weeklyPrizePool += r.stake; }
        }
        emit RoundFinished(roundId, msg.sender, r.totalScore);
    }

    function getLetters(uint256 roundId) external view returns (bytes1[7] memory letters) {
        return _getLetters(rounds[roundId].letterSeed);
    }

    function _getLetters(bytes32 seed) internal pure returns (bytes1[7] memory letters) {
        bytes memory freq = "AAAAAAAAABBCCDDDDEEEEEEEEEEEEFFGGGHHIIIIIIIIIJKLLLLMMNNNNNNOOOOOOOOPPQRRRRRRSSSSTTTTTTUUUUVVWWXYYZ";
        for (uint8 i = 0; i < 7; i++) {
            uint8 idx = uint8(uint256(keccak256(abi.encodePacked(seed, i))) % freq.length);
            letters[i] = freq[idx];
        }
    }

    function _wordUsesValidLetters(string memory word, bytes1[7] memory letters) internal pure returns (bool) {
        bytes memory wb = bytes(word);
        if (wb.length < 2 || wb.length > 7) return false;
        uint8[26] memory avail;
        for (uint8 i = 0; i < 7; i++) avail[uint8(letters[i]) - 65]++;
        for (uint8 i = 0; i < wb.length; i++) {
            uint8 c = uint8(wb[i]);
            if (c < 65 || c > 90) return false; // must be A–Z uppercase
            uint8 idx = c - 65;
            if (avail[idx] == 0) return false;
            avail[idx]--;
        }
        return true;
    }

    function getRound(uint256 roundId) external view returns (
        address player, bytes32 letterSeed, uint32 startedAt,
        uint8 commitCount, uint8 totalScore_, RoundState state, uint256 stake, uint8 difficulty_
    ) {
        Round storage r = rounds[roundId];
        return (r.player, r.letterSeed, r.startedAt, r.commitCount, r.totalScore, r.state, r.stake, r.difficulty);
    }

    function getPlayerRounds(address p) external view returns (uint256[] memory) { return playerRounds[p]; }
    function totalRounds() external view returns (uint256) { return _roundCounter; }

    function depositWeeklyPrize(uint256 amount) external {
        require(usdm.transferFrom(msg.sender, address(this), amount), "Transfer failed");
        weeklyPrizePool += amount;
    }

    function withdrawFees() external onlyOwner {
        uint256 a = platformFeeBalance; platformFeeBalance = 0;
        require(usdm.transfer(owner(), a), "Transfer failed");
    }

    function distributePrize(address[] calldata recipients, uint256[] calldata amounts) external onlyOwner {
        require(recipients.length == amounts.length, "Length mismatch");
        uint256 total = 0;
        for (uint256 i = 0; i < amounts.length; i++) total += amounts[i];
        require(total <= weeklyPrizePool, "Exceeds pool");
        weeklyPrizePool -= total;
        for (uint256 i = 0; i < recipients.length; i++) {
            require(usdm.transfer(recipients[i], amounts[i]), "Transfer failed");
            emit PrizeDistributed(recipients[i], amounts[i]);
        }
    }

    function emergencyRefundStake(uint256 roundId) external onlyOwner {
        Round storage r = rounds[roundId];
        require(r.state == RoundState.ACTIVE, "Not active");
        require(r.stake > 0, "No stake");
        r.state = RoundState.FINISHED;
        require(usdm.transfer(r.player, r.stake), "Transfer failed");
    }

    function _scoreWord(uint8 length) internal pure returns (uint8) {
        if (length < 2) return 0; if (length == 2) return 1; if (length == 3) return 2;
        if (length == 4) return 3; if (length == 5) return 5; if (length == 6) return 8;
        return 11;
    }
}

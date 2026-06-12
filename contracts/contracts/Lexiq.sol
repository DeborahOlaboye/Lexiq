// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

/// @title Lexiq — solo word race on Celo. Build words from 7 letters in 90 seconds.
/// @notice Stake USDM for bonus: get it back if you score >= 10 points.
contract Lexiq is Ownable, ReentrancyGuard {
    IERC20 public immutable usdm;

    uint32 public constant ROUND_DURATION  = 90;
    uint8  public constant MAX_WORDS       = 15;
    uint8  public constant STAKE_THRESHOLD = 10;

    enum RoundState { ACTIVE, FINISHED }
    struct WordCommit { bytes32 hash; bool revealed; uint8 score; }
    struct Round {
        address player; bytes32 letterSeed; uint32 startedAt;
        WordCommit[15] commits; uint8 commitCount; uint8 totalScore;
        RoundState state; uint256 stake;
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
    event WordCommitted(uint256 indexed roundId, uint8 slot);
    event WordRevealed(uint256 indexed roundId, string word, uint8 score);
    event RoundFinished(uint256 indexed roundId, address indexed player, uint8 finalScore);
    event PrizeDistributed(address indexed recipient, uint256 amount);

    constructor(address _usdm) Ownable(msg.sender) { usdm = IERC20(_usdm); }

    function startRound(uint256 stakeAmount) external nonReentrant returns (uint256 roundId) {
        if (stakeAmount > 0) require(usdm.transferFrom(msg.sender, address(this), stakeAmount), "Stake failed");
        roundId = _roundCounter++;
        Round storage r = rounds[roundId];
        r.player = msg.sender; r.startedAt = uint32(block.timestamp);
        r.stake = stakeAmount; r.state = RoundState.ACTIVE;
        r.letterSeed = keccak256(abi.encodePacked(block.prevrandao, msg.sender, roundId, block.timestamp));
        playerRounds[msg.sender].push(roundId); gamesPlayed[msg.sender]++;
        emit RoundStarted(roundId, msg.sender, r.letterSeed);
    }

    function commitWord(uint256 roundId, bytes32 wordHash) external {
        Round storage r = rounds[roundId];
        require(r.player == msg.sender, "Not your round");
        require(r.state == RoundState.ACTIVE, "Not active");
        require(block.timestamp < r.startedAt + ROUND_DURATION, "Time up");
        require(r.commitCount < MAX_WORDS, "Max words reached");
        r.commits[r.commitCount] = WordCommit({ hash: wordHash, revealed: false, score: 0 });
        r.commitCount++;
        emit WordCommitted(roundId, r.commitCount - 1);
    }

    function revealWords(uint256 roundId, string[] calldata words, bytes32[] calldata salts) external nonReentrant {
        Round storage r = rounds[roundId];
        require(r.player == msg.sender, "Not your round");
        require(r.state == RoundState.ACTIVE, "Already finished");
        require(words.length == salts.length, "Length mismatch");
        for (uint8 i = 0; i < words.length && i < r.commitCount; i++) {
            bytes32 expected = keccak256(abi.encodePacked(words[i], salts[i]));
            if (expected == r.commits[i].hash && !r.commits[i].revealed) {
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
        bytes32 seed = rounds[roundId].letterSeed;
        bytes memory freq = "AAABBBCCDDDEEEEEEFFGGGHHIIIIJKLLLLMMNNNNNOOOOOOPPQRRRRRSSSSSTTTTTTUUUVVWWXYYZ";
        for (uint8 i = 0; i < 7; i++) {
            uint8 idx = uint8(uint256(keccak256(abi.encodePacked(seed, i))) % freq.length);
            letters[i] = freq[idx];
        }
    }

    function getRound(uint256 roundId) external view returns (
        address player, bytes32 letterSeed, uint32 startedAt,
        uint8 commitCount, uint8 totalScore_, RoundState state, uint256 stake
    ) {
        Round storage r = rounds[roundId];
        return (r.player, r.letterSeed, r.startedAt, r.commitCount, r.totalScore, r.state, r.stake);
    }

    function getPlayerRounds(address p) external view returns (uint256[] memory) { return playerRounds[p]; }
    function totalRounds() external view returns (uint256) { return _roundCounter; }

    function _scoreWord(uint8 length) internal pure returns (uint8) {
        if (length < 2) return 0; if (length == 2) return 1; if (length == 3) return 2;
        if (length == 4) return 3; if (length == 5) return 5; if (length == 6) return 8;
        return 11;
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/utils/ReentrancyGuard.sol";
import "@openzeppelin/contracts/token/ERC20/IERC20.sol";

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

    constructor(address _usdm) Ownable(msg.sender) {
        usdm = IERC20(_usdm);
    }
}

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

    constructor(address _usdm) Ownable(msg.sender) {
        usdm = IERC20(_usdm);
    }
}

// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import "@openzeppelin/contracts/token/ERC20/ERC20.sol";

/// @dev Test-only stand-in for USDm.
contract MockUSDM is ERC20 {
    constructor() ERC20("Mock USDm", "USDm") {}

    function mint(address to, uint256 amount) external {
        _mint(to, amount);
    }
}

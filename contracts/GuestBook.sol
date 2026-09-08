// SPDX-License-Identifier: MIT
pragma solidity ^0.8.19;

/// @title GuestBook
/// @notice A decentralized guest book. Each wallet can register once.
contract GuestBook {
    struct Guest {
        address wallet;
        string name;
        uint256 timestamp;
    }

    Guest[] private guests;
    mapping(address => bool) public hasSignedIn;

    event GuestRegistered(address indexed wallet, string name, uint256 timestamp);

    function signGuestBook(string calldata _name) external {
        require(!hasSignedIn[msg.sender], "This wallet has already signed in");
        require(bytes(_name).length > 0, "Name cannot be empty");
        require(bytes(_name).length <= 64, "Name is too long");

        guests.push(Guest({
            wallet: msg.sender,
            name: _name,
            timestamp: block.timestamp
        }));

        hasSignedIn[msg.sender] = true;
        emit GuestRegistered(msg.sender, _name, block.timestamp);
    }

    function getGuests() external view returns (Guest[] memory) {
        return guests;
    }

    function getGuestCount() external view returns (uint256) {
        return guests.length;
    }
}

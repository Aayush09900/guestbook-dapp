// Deployment configuration for the live Sepolia GuestBook deployment.
window.GUESTBOOK_CONFIG = {
  CONTRACT_ADDRESS: "0x8457d9aa0af94b94235ad6fb46c5e683313656c3",
  CHAIN_ID_HEX: "0xaa36a7",
  CHAIN_NAME: "Sepolia",
  BLOCK_EXPLORER: "https://sepolia.etherscan.io",
  READ_ONLY_RPC_URL: "https://ethereum-sepolia-rpc.publicnode.com",
  RPC_URLS: [
    "https://ethereum-sepolia-rpc.publicnode.com",
    "https://sepolia.drpc.org",
    "https://sepolia.gateway.tenderly.co",
    "https://eth-sepolia.blockscout.com/api"
  ],
  BLOCKSCOUT_LOGS_URL: "https://eth-sepolia.blockscout.com/api/v2/addresses/0x8457d9aa0af94b94235ad6fb46c5e683313656c3/logs",
  METAMASK_CONNECT_VERSION: "2.1.1",
  POLL_INTERVAL_MS: 15000,
  CONTRACT_ABI: [
    {"anonymous":false,"inputs":[{"indexed":true,"internalType":"address","name":"wallet","type":"address"},{"indexed":false,"internalType":"string","name":"name","type":"string"},{"indexed":false,"internalType":"uint256","name":"timestamp","type":"uint256"}],"name":"GuestRegistered","type":"event"},
    {"inputs":[{"internalType":"string","name":"_name","type":"string"}],"name":"signGuestBook","outputs":[],"stateMutability":"nonpayable","type":"function"},
    {"inputs":[],"name":"getGuestCount","outputs":[{"internalType":"uint256","name":"","type":"uint256"}],"stateMutability":"view","type":"function"},
    {"inputs":[],"name":"getGuests","outputs":[{"components":[{"internalType":"address","name":"wallet","type":"address"},{"internalType":"string","name":"name","type":"string"},{"internalType":"uint256","name":"timestamp","type":"uint256"}],"internalType":"struct GuestBook.Guest[]","name":"","type":"tuple[]"}],"stateMutability":"view","type":"function"},
    {"inputs":[{"internalType":"address","name":"","type":"address"}],"name":"hasSignedIn","outputs":[{"internalType":"bool","name":"","type":"bool"}],"stateMutability":"view","type":"function"}
  ]
};

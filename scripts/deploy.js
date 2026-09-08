const { ethers } = require("hardhat");

async function main() {
  const GuestBook = await ethers.getContractFactory("GuestBook");
  const guestBook = await GuestBook.deploy();
  await guestBook.waitForDeployment();
  console.log(`GuestBook deployed to: ${await guestBook.getAddress()}`);
}

main().catch((error) => {
  console.error(error);
  process.exitCode = 1;
});

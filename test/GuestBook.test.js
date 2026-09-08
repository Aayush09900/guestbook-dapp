const { expect } = require("chai");
const { ethers } = require("hardhat");

describe("GuestBook", function () {
  async function deploy() {
    const [owner, second] = await ethers.getSigners();
    const GuestBook = await ethers.getContractFactory("GuestBook");
    const guestBook = await GuestBook.deploy();
    await guestBook.waitForDeployment();
    return { guestBook, owner, second };
  }

  it("starts empty", async function () {
    const { guestBook } = await deploy();
    expect(await guestBook.getGuestCount()).to.equal(0n);
    expect(await guestBook.getGuests()).to.deep.equal([]);
  });

  it("registers a guest and emits an event", async function () {
    const { guestBook, owner } = await deploy();
    await expect(guestBook.signGuestBook("Aayush"))
      .to.emit(guestBook, "GuestRegistered")
      .withArgs(owner.address, "Aayush", anyValue);

    expect(await guestBook.hasSignedIn(owner.address)).to.equal(true);
    expect(await guestBook.getGuestCount()).to.equal(1n);
  });

  it("prevents the same wallet from signing twice", async function () {
    const { guestBook } = await deploy();
    await guestBook.signGuestBook("Aayush");
    await expect(guestBook.signGuestBook("Again"))
      .to.be.revertedWith("This wallet has already signed in");
  });

  it("rejects empty names", async function () {
    const { guestBook } = await deploy();
    await expect(guestBook.signGuestBook(""))
      .to.be.revertedWith("Name cannot be empty");
  });

  it("rejects names longer than 64 bytes", async function () {
    const { guestBook } = await deploy();
    const longName = "a".repeat(65);
    await expect(guestBook.signGuestBook(longName))
      .to.be.revertedWith("Name is too long");
  });

  it("allows different wallets to sign", async function () {
    const { guestBook, owner, second } = await deploy();
    await guestBook.signGuestBook("Aayush");
    await guestBook.connect(second).signGuestBook("Second");
    const guests = await guestBook.getGuests();
    expect(guests.length).to.equal(2);
    expect(guests[0].wallet).to.equal(owner.address);
    expect(guests[1].wallet).to.equal(second.address);
  });
});

const anyValue = (value) => value >= 0n;

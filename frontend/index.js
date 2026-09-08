(() => {
  const cfg = window.GUESTBOOK_CONFIG;
  const els = {
    connect: document.getElementById("connectBtn"),
    network: document.getElementById("networkStatus"),
    wallet: document.getElementById("walletAddress"),
    count: document.getElementById("guestCount"),
    contractLink: document.getElementById("contractLink"),
    refresh: document.getElementById("refreshBtn"),
    form: document.getElementById("guestForm"),
    name: document.getElementById("name"),
    sign: document.getElementById("signBtn"),
    status: document.getElementById("status"),
    grid: document.getElementById("guestGrid"),
    empty: document.getElementById("emptyState"),
    live: document.getElementById("liveIndicator")
  };

  let readProvider;
  let readContract;
  let browserProvider;
  let signer;
  let writeContract;
  let currentAddress = null;

  function shortAddress(address) {
    return `${address.slice(0, 6)}…${address.slice(-4)}`;
  }

  function setStatus(message, kind = "") {
    els.status.textContent = message || "";
    els.status.className = `status ${kind}`.trim();
  }

  function setLive(live) {
    els.live.innerHTML = `<i></i> ${live ? "live" : "reconnecting…"}`;
    els.live.classList.toggle("offline", !live);
  }

  function renderGuests(guests) {
    els.grid.innerHTML = "";
    els.empty.hidden = guests.length !== 0;
    els.count.textContent = guests.length;

    [...guests].reverse().forEach((guest) => {
      const card = document.createElement("article");
      card.className = "guest-card";
      const date = new Date(Number(guest.timestamp) * 1000);
      const wallet = guest.wallet;
      card.innerHTML = `
        <div class="guest-name"></div>
        <div class="guest-address"><a href="${cfg.BLOCK_EXPLORER}/address/${wallet}" target="_blank" rel="noopener">${shortAddress(wallet)}</a></div>
        <time datetime="${date.toISOString()}">${date.toLocaleString()}</time>
      `;
      card.querySelector(".guest-name").textContent = guest.name;
      els.grid.appendChild(card);
    });
  }

  async function loadGuests(contract = readContract) {
    if (!contract) return;
    const guests = await contract.getGuests();
    renderGuests(guests);
  }

  function createReadContract() {
    if (!cfg.CONTRACT_ADDRESS || cfg.CONTRACT_ADDRESS.includes("YOUR_DEPLOYED")) {
      throw new Error("GuestBook contract address is not configured yet.");
    }
    readProvider = new ethers.JsonRpcProvider(cfg.READ_ONLY_RPC_URL);
    readContract = new ethers.Contract(cfg.CONTRACT_ADDRESS, cfg.CONTRACT_ABI, readProvider);
    els.contractLink.href = `${cfg.BLOCK_EXPLORER}/address/${cfg.CONTRACT_ADDRESS}`;
    return readContract;
  }

  async function ensureNetwork(provider) {
    const network = await provider.getNetwork();
    const expected = BigInt(cfg.CHAIN_ID_HEX);
    if (network.chainId !== expected) {
      throw new Error(`Wrong network. Please switch MetaMask to ${cfg.CHAIN_NAME}.`);
    }
  }

  async function connectWallet() {
    if (!window.ethereum) {
      setStatus("MetaMask is not installed. You can still browse the guest list.", "error");
      return;
    }
    try {
      browserProvider = new ethers.BrowserProvider(window.ethereum);
      await browserProvider.send("eth_requestAccounts", []);
      await ensureNetwork(browserProvider);
      signer = await browserProvider.getSigner();
      currentAddress = await signer.getAddress();
      writeContract = new ethers.Contract(cfg.CONTRACT_ADDRESS, cfg.CONTRACT_ABI, signer);
      els.wallet.textContent = shortAddress(currentAddress);
      els.network.textContent = cfg.CHAIN_NAME;
      els.network.className = "status-pill success";
      const signed = await readContract.hasSignedIn(currentAddress);
      els.name.disabled = signed;
      els.sign.disabled = signed;
      setStatus(signed ? "This wallet has already signed the guest book." : "Wallet connected. Ready to sign.", signed ? "success" : "");
    } catch (error) {
      console.error(error);
      setStatus(error?.shortMessage || error?.message || "Unable to connect wallet.", "error");
    }
  }

  async function signGuest() {
    if (!writeContract || !currentAddress) {
      await connectWallet();
      if (!writeContract) return;
    }
    const name = els.name.value.trim();
    if (!name) return setStatus("Enter your name.", "error");
    if (new TextEncoder().encode(name).length > 64) return setStatus("Name must be at most 64 bytes.", "error");

    try {
      els.sign.disabled = true;
      setStatus("Waiting for MetaMask confirmation…");
      const tx = await writeContract.signGuestBook(name);
      setStatus(`Transaction submitted: ${tx.hash.slice(0, 10)}…`);
      await tx.wait();
      setStatus("Signed successfully. Your guest entry is now on-chain.", "success");
      els.name.value = "";
      els.name.disabled = true;
      await loadGuests();
    } catch (error) {
      console.error(error);
      const msg = error?.code === 4001 || error?.info?.error?.code === 4001
        ? "Transaction rejected in MetaMask."
        : (error?.shortMessage || error?.reason || error?.message || "Transaction failed.");
      setStatus(msg, "error");
    } finally {
      if (currentAddress) {
        els.sign.disabled = await readContract.hasSignedIn(currentAddress).catch(() => false);
      }
    }
  }

  async function init() {
    try {
      createReadContract();
      await loadGuests();
      setLive(true);

      readContract.on("GuestRegistered", async () => {
        try {
          await loadGuests();
        } catch (error) {
          console.error(error);
        }
      });
    } catch (error) {
      console.error(error);
      els.network.textContent = "Not configured";
      els.network.className = "status-pill error";
      setStatus(error.message, "error");
    }
  }

  els.connect.addEventListener("click", connectWallet);
  els.refresh.addEventListener("click", async () => {
    try {
      await loadGuests();
      setStatus("Guest list refreshed.", "success");
    } catch (error) {
      setStatus(error.message, "error");
    }
  });
  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    signGuest();
  });

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", async () => window.location.reload());
    window.ethereum.on("chainChanged", async () => window.location.reload());
  }

  init();
})();

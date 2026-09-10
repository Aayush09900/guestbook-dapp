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

  function setConfigured(enabled) {
    els.refresh.disabled = !enabled;
    els.name.disabled = !enabled;
    els.sign.disabled = !enabled;
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

  function createRpcProvider(url, network) {
    // The Sepolia network is fixed for these read-only RPC URLs, so using a
    // static network avoids an initial eth_chainId discovery request. This is
    // useful when a browser, proxy, or privacy layer interferes with that call.
    return new ethers.JsonRpcProvider(url, network, {
      staticNetwork: network,
      pollingInterval: cfg.POLL_INTERVAL_MS
    });
  }

  async function createReadProvider() {
    const network = ethers.Network.from(Number(BigInt(cfg.CHAIN_ID_HEX)));
    const urls = Array.isArray(cfg.RPC_URLS) && cfg.RPC_URLS.length
      ? cfg.RPC_URLS
      : [cfg.READ_ONLY_RPC_URL];

    const providers = urls.map((url, index) => ({
      provider: createRpcProvider(url, network),
      priority: index + 1,
      weight: 1
    }));

    // Quorum 1 means the first healthy RPC can serve the request. If one
    // endpoint is unavailable in Edge, another Sepolia endpoint can answer.
    const provider = new ethers.FallbackProvider(providers, network, {
      quorum: 1,
      pollingInterval: cfg.POLL_INTERVAL_MS
    });

    // Prove the fallback provider can actually reach Sepolia before creating
    // the contract object. This gives the UI a useful failure instead of an
    // endless JsonRpcProvider network-detection loop.
    await provider.getBlockNumber();
    return provider;
  }

  async function createReadContract() {
    if (!cfg.CONTRACT_ADDRESS || cfg.CONTRACT_ADDRESS.includes("YOUR_DEPLOYED")) {
      throw new Error("GuestBook is not configured for Sepolia yet. Deploy GuestBook.sol with MetaMask on Sepolia, then add that contract address to frontend/config.js.");
    }

    readProvider = await createReadProvider();
    const code = await readProvider.getCode(cfg.CONTRACT_ADDRESS);
    if (code === "0x") {
      throw new Error("No contract bytecode exists at the configured address on Sepolia. Check the GuestBook deployment address.");
    }

    readContract = new ethers.Contract(cfg.CONTRACT_ADDRESS, cfg.CONTRACT_ABI, readProvider);

    try {
      await readContract.getGuestCount();
    } catch (error) {
      console.error("GuestBook preflight failed", error);
      throw new Error("The configured Sepolia address is not compatible with this GuestBook contract. Deploy the GuestBook.sol source from this repository and use its new contract address.");
    }

    els.contractLink.href = `${cfg.BLOCK_EXPLORER}/address/${cfg.CONTRACT_ADDRESS}`;
    setConfigured(true);
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
    if (!readContract) {
      setStatus("GuestBook contract is not available right now. Refresh the page and try again.", "error");
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
    setConfigured(false);
    try {
      await createReadContract();
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
      els.network.textContent = "RPC unavailable";
      els.network.className = "status-pill error";
      setLive(false);
      setStatus("Unable to reach a Sepolia RPC from this browser. Try refreshing, or disable browser/VPN/network filtering for the site.", "error");
    }
  }

  els.connect.addEventListener("click", connectWallet);

  els.refresh.addEventListener("click", async () => {
    try {
      await loadGuests();
      setStatus("Guest list refreshed.", "success");
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || "Unable to refresh guest list.", "error");
    }
  });

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    signGuest();
  });

  if (window.ethereum) {
    window.ethereum.on("accountsChanged", () => window.location.reload());
    window.ethereum.on("chainChanged", () => window.location.reload());
  }

  init();
})();

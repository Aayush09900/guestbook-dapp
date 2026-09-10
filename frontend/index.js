(() => {
  const cfg = window.GUESTBOOK_CONFIG;
  const els = {
    connect: document.getElementById("connectBtn"),
    mobileWallet: document.getElementById("mobileWalletBtn"),
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

  let readProvider = null;
  let readContract = null;
  let browserProvider = null;
  let signer = null;
  let writeContract = null;
  let currentAddress = null;
  let metaMaskClient = null;
  let explorerMode = false;
  let pollTimer = null;

  const SEPOLIA_CHAIN = {
    chainId: cfg.CHAIN_ID_HEX,
    chainName: cfg.CHAIN_NAME,
    nativeCurrency: { name: "Sepolia Ether", symbol: "ETH", decimals: 18 },
    rpcUrls: cfg.RPC_URLS,
    blockExplorerUrls: [cfg.BLOCK_EXPLORER]
  };

  function isMobileBrowser() {
    return /Android|iPhone|iPad|iPod|Windows Phone|webOS|BlackBerry/i.test(navigator.userAgent);
  }

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

  function getMetaMaskDeepLink() {
    return `https://metamask.app.link/dapp/${window.location.host}${window.location.pathname}`;
  }

  function injectedMetaMask() {
    if (!window.ethereum) return null;
    if (Array.isArray(window.ethereum.providers)) {
      return window.ethereum.providers.find((provider) => provider.isMetaMask) || window.ethereum.providers[0] || null;
    }
    return window.ethereum;
  }

  function renderGuests(guests) {
    const safeGuests = Array.isArray(guests) ? guests : [];
    els.grid.innerHTML = "";
    els.empty.hidden = safeGuests.length !== 0;
    els.count.textContent = safeGuests.length;

    [...safeGuests]
      .sort((a, b) => Number(b.timestamp) - Number(a.timestamp))
      .forEach((guest) => {
        const card = document.createElement("article");
        card.className = "guest-card";
        const seconds = Number(guest.timestamp);
        const date = new Date(seconds * 1000);
        const wallet = guest.wallet;
        card.innerHTML = `
          <div class="guest-name"></div>
          <div class="guest-address"><a href="${cfg.BLOCK_EXPLORER}/address/${wallet}" target="_blank" rel="noopener noreferrer">${shortAddress(wallet)}</a></div>
          <time datetime="${date.toISOString()}">${date.toLocaleString()}</time>
        `;
        card.querySelector(".guest-name").textContent = guest.name;
        els.grid.appendChild(card);
      });
  }

  async function fetchExplorerGuests() {
    const response = await fetch(cfg.BLOCKSCOUT_LOGS_URL, {
      headers: { accept: "application/json" },
      cache: "no-store"
    });
    if (!response.ok) throw new Error(`Explorer fallback returned HTTP ${response.status}.`);

    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];
    const coder = ethers.AbiCoder.defaultAbiCoder();

    const guests = items.map((item) => {
      const params = Array.isArray(item.decoded?.parameters) ? item.decoded.parameters : [];
      const valueOf = (name) => params.find((parameter) => parameter.name === name)?.value;

      let wallet = valueOf("wallet");
      let name = valueOf("name");
      let timestamp = valueOf("timestamp");

      if (!wallet && Array.isArray(item.topics) && item.topics[1]) {
        wallet = ethers.getAddress(`0x${item.topics[1].slice(-40)}`);
      }

      if ((name == null || timestamp == null) && item.data && item.data !== "0x") {
        const decoded = coder.decode(["string", "uint256"], item.data);
        name = decoded[0];
        timestamp = decoded[1];
      }

      if (!wallet || name == null || timestamp == null) return null;
      return { wallet, name: String(name), timestamp: BigInt(timestamp).toString() };
    }).filter(Boolean);

    return guests;
  }

  function createRpcProvider(url, network) {
    return new ethers.JsonRpcProvider(url, network, {
      staticNetwork: network,
      pollingInterval: cfg.POLL_INTERVAL_MS
    });
  }

  async function createReadProvider() {
    const network = ethers.Network.from(Number(BigInt(cfg.CHAIN_ID_HEX)));
    const urls = Array.isArray(cfg.RPC_URLS) && cfg.RPC_URLS.length ? cfg.RPC_URLS : [cfg.READ_ONLY_RPC_URL];
    const providers = urls.map((url, index) => ({
      provider: createRpcProvider(url, network),
      priority: index + 1,
      weight: 1,
      stallTimeout: 1500
    }));

    const provider = new ethers.FallbackProvider(providers, network, {
      quorum: 1,
      pollingInterval: cfg.POLL_INTERVAL_MS
    });

    await provider.getBlockNumber();
    return provider;
  }

  async function loadGuests() {
    try {
      if (readContract) {
        const guests = await readContract.getGuests();
        explorerMode = false;
        setLive(true);
        renderGuests(guests);
        return guests;
      }
    } catch (error) {
      console.warn("RPC guest read failed; switching to Blockscout fallback.", error);
      readProvider = null;
      readContract = null;
    }

    const guests = await fetchExplorerGuests();
    explorerMode = true;
    setLive(true);
    renderGuests(guests);
    return guests;
  }

  async function createReadContract() {
    if (!cfg.CONTRACT_ADDRESS || cfg.CONTRACT_ADDRESS.includes("YOUR_DEPLOYED")) {
      throw new Error("GuestBook contract address is not configured.");
    }

    els.contractLink.href = `${cfg.BLOCK_EXPLORER}/address/${cfg.CONTRACT_ADDRESS}`;

    try {
      readProvider = await createReadProvider();
      readContract = new ethers.Contract(cfg.CONTRACT_ADDRESS, cfg.CONTRACT_ABI, readProvider);
      await readContract.getGuestCount();
    } catch (rpcError) {
      console.warn("Primary Sepolia RPCs unavailable; using browser-safe explorer fallback.", rpcError);
      readProvider = null;
      readContract = null;
    }

    await loadGuests();
    setConfigured(true);
    return readContract;
  }

  async function getWalletProvider() {
    const injected = injectedMetaMask();
    if (injected) return injected;

    try {
      const version = cfg.METAMASK_CONNECT_VERSION || "2.1.1";
      const module = await import(`https://cdn.jsdelivr.net/npm/@metamask/connect-evm@${version}/+esm`);
      const { createEVMClient } = module;
      metaMaskClient = await createEVMClient({
        dapp: {
          name: "GuestBook DApp",
          url: window.location.href
        },
        api: {
          supportedNetworks: {
            [cfg.CHAIN_ID_HEX]: cfg.RPC_URLS[0]
          }
        },
        ui: {
          preferExtension: true,
          showInstallModal: true
        },
        analytics: { enabled: false }
      });
      return metaMaskClient.getProvider();
    } catch (error) {
      console.error("MetaMask Connect initialization failed", error);
      if (isMobileBrowser()) {
        window.location.href = getMetaMaskDeepLink();
        throw new Error("Opening MetaMask Mobile…");
      }
      throw new Error("MetaMask could not be opened. Install the MetaMask extension or use MetaMask Mobile.");
    }
  }

  async function ensureNetwork(provider) {
    const chainId = await provider.request({ method: "eth_chainId" });
    if (String(chainId).toLowerCase() === String(cfg.CHAIN_ID_HEX).toLowerCase()) return;

    try {
      await provider.request({
        method: "wallet_switchEthereumChain",
        params: [{ chainId: cfg.CHAIN_ID_HEX }]
      });
    } catch (switchError) {
      if (switchError?.code !== 4902) throw switchError;
      await provider.request({
        method: "wallet_addEthereumChain",
        params: [SEPOLIA_CHAIN]
      });
    }
  }

  async function connectWallet() {
    if (!readContract && !explorerMode) {
      try {
        await createReadContract();
      } catch (error) {
        setStatus(error?.message || "GuestBook is temporarily unavailable.", "error");
        return;
      }
    }

    try {
      const eip1193Provider = await getWalletProvider();
      await eip1193Provider.request({ method: "eth_requestAccounts", params: [] });
      await ensureNetwork(eip1193Provider);

      browserProvider = new ethers.BrowserProvider(eip1193Provider);
      signer = await browserProvider.getSigner();
      currentAddress = await signer.getAddress();
      writeContract = new ethers.Contract(cfg.CONTRACT_ADDRESS, cfg.CONTRACT_ABI, signer);

      els.wallet.textContent = shortAddress(currentAddress);
      els.network.textContent = cfg.CHAIN_NAME;
      els.network.className = "status-pill success";

      const guests = await loadGuests();
      const signed = guests.some((guest) => guest.wallet.toLowerCase() === currentAddress.toLowerCase());
      els.name.disabled = signed;
      els.sign.disabled = signed;
      setStatus(
        signed ? "This wallet has already signed the guest book." : "Wallet connected. Ready to sign.",
        signed ? "success" : ""
      );
    } catch (error) {
      console.error(error);
      if (error?.code === 4001) {
        setStatus("Connection was rejected in MetaMask.", "error");
      } else {
        setStatus(error?.shortMessage || error?.message || "Unable to connect wallet.", "error");
      }
    }
  }

  async function signGuest() {
    if (!writeContract || !currentAddress) {
      await connectWallet();
      if (!writeContract) return;
    }

    const name = els.name.value.trim();
    if (!name) return setStatus("Enter your name.", "error");
    if (new TextEncoder().encode(name).length > 64) {
      return setStatus("Name must be at most 64 bytes.", "error");
    }

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
        try {
          const guests = await loadGuests();
          els.sign.disabled = guests.some((guest) => guest.wallet.toLowerCase() === currentAddress.toLowerCase());
        } catch {
          els.sign.disabled = false;
        }
      }
    }
  }

  async function init() {
    setConfigured(false);
    try {
      await createReadContract();
      els.network.textContent = explorerMode ? "Sepolia • fallback" : cfg.CHAIN_NAME;
      els.network.className = "status-pill success";
      setStatus(
        explorerMode
          ? "Connected to Sepolia through a browser-safe fallback. You can still browse the guest list."
          : "GuestBook is live on Sepolia.",
        "success"
      );
      startPolling();
    } catch (error) {
      console.error(error);
      els.network.textContent = "Retrying…";
      els.network.className = "status-pill error";
      setLive(false);
      setConfigured(false);
      setStatus("The guest list could not be reached. Refresh the page or try another network.", "error");
      startPolling();
    }
  }

  function startPolling() {
    if (pollTimer) window.clearInterval(pollTimer);
    pollTimer = window.setInterval(async () => {
      try {
        const guests = await loadGuests();
        if (currentAddress) {
          const signed = guests.some((guest) => guest.wallet.toLowerCase() === currentAddress.toLowerCase());
          els.name.disabled = signed;
          els.sign.disabled = signed;
        }
      } catch (error) {
        console.warn("GuestBook refresh failed", error);
        setLive(false);
      }
    }, Math.max(5000, Number(cfg.POLL_INTERVAL_MS) || 15000));
  }

  els.connect.addEventListener("click", connectWallet);

  if (els.mobileWallet) {
    const mobile = isMobileBrowser();
    els.mobileWallet.href = getMetaMaskDeepLink();
    els.mobileWallet.hidden = !mobile;
    els.mobileWallet.style.display = mobile ? "block" : "none";
  }

  els.refresh.addEventListener("click", async () => {
    try {
      await loadGuests();
      setStatus(explorerMode ? "Guest list refreshed using the fallback explorer." : "Guest list refreshed.", "success");
    } catch (error) {
      setStatus(error?.shortMessage || error?.message || "Unable to refresh guest list.", "error");
      setLive(false);
    }
  });

  els.form.addEventListener("submit", (event) => {
    event.preventDefault();
    signGuest();
  });

  const injected = injectedMetaMask();
  if (injected?.on) {
    injected.on("accountsChanged", () => window.location.reload());
    injected.on("chainChanged", () => window.location.reload());
  }

  init();
})();

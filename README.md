# GuestBook DApp

A production-oriented decentralized guest book on Ethereum.

Visitors can connect MetaMask, sign the guest book on-chain, and view live guest registrations without needing a wallet just to browse.

## Stack

- Solidity 0.8.x
- Hardhat
- ethers.js v6
- MetaMask
- Ethereum Sepolia
- GitHub Actions
- GitHub Pages

## Security model

Each wallet can sign once. Names are validated on-chain to be non-empty and at most 64 bytes. The contract emits `GuestRegistered` events for auditability.

## Local development

```bash
npm ci
npm run check
npm run frontend
```

## Deploy the contract

Create a local `.env` from `.env.example` and provide a deployer private key and Sepolia RPC URL. Never commit real private keys.

```bash
npm run compile
npm test
npm run deploy:sepolia
```

After deployment, copy the contract address into `frontend/config.js`.

## Production checklist

1. Run the full Hardhat test suite.
2. Run coverage and inspect uncovered branches.
3. Deploy to Sepolia.
4. Verify the contract source on a block explorer.
5. Test connect, wrong-network handling, first sign-in, duplicate sign-in rejection, empty/oversized names, and live event updates.
6. Replace the demo public RPC with a production provider and rate limits.
7. Deploy the frontend through GitHub Pages/Netlify/Vercel.
8. Before mainnet, obtain independent smart-contract security review and operational review.

This repository is testnet/staging ready. It is not an audited mainnet system and should not be represented as such until the contract and deployment operations are independently reviewed.

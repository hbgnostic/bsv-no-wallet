# bsv-no-wallet

**Move a coin on BSV with no wallet framework — just a key, a script, and a broadcast.**

Before you reach for a wallet library (BRC-100, HandCash, Electrum, whatever), it's worth
seeing what's *underneath* all of them. Every wallet is wrapping the same four simple
pieces. This repo shows those pieces, in plain JavaScript, in files short enough to read in
one sitting — and then lets you play with Bitcoin Script directly (a hash puzzle, a
claimable quiz) to prove the point: **you don't send coins to an address, you lock a coin
with a script and later satisfy it.**

> Prefer a guided walkthrough with progress checkboxes? → [BSV No-Wallet Lab](https://claude.ai/code/artifact/2ef0963f-385e-4232-a2c0-234d3168a6e6)

---

## ⚠️ Read this first — it uses REAL money

These scripts run on **BSV mainnet**. That's deliberate: BSV fees are sub-cent, so it's
cheaper and more reliable than chasing dead testnet faucets. But it means:

- **Fund your wallet with SUB-PENNIES only.** One US cent (~76,000 sats at $13 BSV) covers
  *thousands* of these transactions.
- **NEVER store anything of value here.** This is a learning toy, full stop.
- **NEVER commit or share your `.wif` file.** That file *is* your wallet — anyone who gets it
  takes the coins. The included `.gitignore` excludes `*.wif`; leave that in place.

---

## The four parts every transaction shares

A wallet is really just these, glued together:

1. **Treasury** — a private key with coins on it. (`.wif` file. Also your signer.)
2. **Read the chain** — look up your coins (UTXOs) and fetch the transaction you're spending.
3. **Assemble + sign** — build the inputs, outputs, and scripts; sign.
4. **Broadcast** — send the raw transaction to the network.

That's it. No framework required.

## Prerequisites

- **Node.js** v18+ (v20 or v22 recommended)
- One dependency: **`@bsv/sdk`** — `npm install`
- An internet connection (the scripts read from and broadcast to WhatsOnChain)
- A few sub-penny sats to actually broadcast (dry runs need nothing)

You do **not** need: TypeScript, Docker, a local node, a database, an API key, or a wallet
framework.

## Setup

```bash
npm install          # installs @bsv/sdk, the only dependency
```

## The lessons (run in order)

### 0 · Make a wallet
```bash
node 00-create-your-wallet.js
```
Creates one private key (`treasury-main.wif`) and prints its address. Fund that address with
a few hundred sats (a fraction of a cent) from any BSV wallet — HandCash, Electrum SV, etc.
*A wallet, at its atom, is just a key.*

### 1 · Send a payment

The plain-vanilla case: pay an address, get your change back. Same four parts as every
wallet — find a UTXO, build one input + two outputs (payment, change), sign, broadcast.
```bash
node 01-send-payment.js <destAddress> <amountSats> --broadcast
```
Dry-runs by default; add `--broadcast` to actually send. Under the hood this is *still* a
lock/unlock pair — the "pay to an address" script (P2PKH) just means "unlock with a
signature from this key." There's no special case for a normal payment; it's the same
mechanism as everything else in this repo.

### 2 · Lock coins behind a question, then claim them with the answer

Now the same mechanism with a different lock — proof this isn't specific to addresses.
`create` locks coins behind the **hash** of the answer; `claim` unlocks them with the
**answer itself** — no key, no signature. Two separate transactions, two separate commands.
```bash
# You (the host) lock a bounty behind the answer:
node bsv-quiz.js create --broadcast

# Anyone who knows the answer claims it — no private key needed, just the answer + an address:
node bsv-quiz.js claim <txid> "satoshi nakamoto" <yourAddress> --broadcast
```
Answers are **exact bytes** — lowercase, exact spacing (`"satoshi nakamoto"`), no commas.
That's not a quirk of the quiz; it's how SHA-256 works, and it's part of the lesson.

## A note on how these run

- **Your key** is saved as `treasury-main.wif` right next to the scripts, so it doesn't matter
  which folder you run them from.
- **Rate limits:** these use WhatsOnChain's free public API. If you broadcast a lot, you may hit
  a `429 Too Many Requests`. The scripts automatically wait and retry a few times; if it still
  fails, pause ~30 seconds and re-run. (For heavy or classroom use, grab a free WhatsOnChain API key.)
- If you ever see `"No secure random number generator"`, you're in an unusual environment — a
  normal terminal has what the SDK needs (the scripts already polyfill it).

---

*Part of the UTXO Engineer fundamentals series. If you found the "BSV Fundamentals for
Developers" course useful, this is the hands-on companion.*

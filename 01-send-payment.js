#!/usr/bin/env node
// 01-send-payment.js — the plain-vanilla case: pay an address, get your change back.
// ─────────────────────────────────────────────────────────────────────────────
// Same four parts as every wallet, spelled out:
//   1. TREASURY   — load the key from 00-create-your-wallet.js
//   2. READ CHAIN — find a UTXO on that key, fetch the tx it came from
//   3. ASSEMBLE   — one input (unlocked with your key), two outputs (payment + change)
//   4. BROADCAST  — post the signed hex to the network
//
// Even a "plain" payment is still a lock/unlock pair — the P2PKH script just
// happens to be "unlock with a signature from this key" instead of a puzzle.
//
//   node 01-send-payment.js <destAddress> <amountSats> [--broadcast]
//
// Dry-runs by default. Add --broadcast to actually send.
// ─────────────────────────────────────────────────────────────────────────────

import fs from 'fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { webcrypto } from 'node:crypto'
if (!globalThis.crypto) globalThis.crypto = webcrypto           // @bsv/sdk ESM needs a CSPRNG…
if (typeof globalThis.self === 'undefined') globalThis.self = globalThis   // …and `self` to reach it
import { PrivateKey, Transaction, P2PKH, SatoshisPerKilobyte } from '@bsv/sdk'

const HERE = path.dirname(fileURLToPath(import.meta.url))   // so the key is found next to the script, not wherever you run from

// ═══ CONFIG ══════════════════════════════════════════════════════════════════
const NETWORK = 'main'                                    // 'main' | 'test'

// derived
const IS_MAIN = NETWORK === 'main'
const API = `https://api.whatsonchain.com/v1/bsv/${IS_MAIN ? 'main' : 'test'}`
const UI  = IS_MAIN ? 'https://whatsonchain.com' : 'https://test.whatsonchain.com'
const ADDR_PREFIX = IS_MAIN ? [0x00] : [0x6f]
const fee = new SatoshisPerKilobyte(100)
const TREASURY_FILE = path.join(HERE, `treasury-${NETWORK}.wif`)   // next to THIS script, so cwd doesn't matter

const argv = process.argv.slice(2)
const BROADCAST = argv.includes('--broadcast')
const args = argv.filter(a => a !== '--broadcast')
const [DEST, AMOUNT_STR] = args

// ═══ chain read / write (same API, different endpoints) ══════════════════════
// wocFetch auto-retries when WhatsOnChain rate-limits us (HTTP 429) — a throttle
// shouldn't kill you mid-demo. Waits a few seconds, tries again, a few times.
async function wocFetch (url, opts) {
  for (let attempt = 1; ; attempt++) {
    const r = await fetch(url, opts)
    if (r.status !== 429 || attempt >= 4) return r
    const wait = attempt * 3000
    console.log(`  (WhatsOnChain rate-limited us — waiting ${wait / 1000}s, retry ${attempt}/3…)`)
    await new Promise(res => setTimeout(res, wait))
  }
}
const getJson = async p => { const r = await wocFetch(API + p); if (!r.ok) throw new Error(`${p} -> ${r.status}`); return r.json() }
const getHex  = async id => { const r = await wocFetch(`${API}/tx/${id}/hex`); if (!r.ok) throw new Error(`hex ${id} -> ${r.status}`); return (await r.text()).trim() }
const broadcast = async hex => {
  const r = await wocFetch(`${API}/tx/raw`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ txhex: hex }) })
  const b = await r.text(); if (!r.ok) throw new Error(`broadcast: ${b}`); return b.trim().replace(/"/g, '')
}

// ───────────────────────────────────────────────────────────────────────────
async function send (destAddr, amountSats) {
  if (!destAddr || !amountSats) throw new Error(`usage: node 01-send-payment.js <destAddress> <amountSats> [--broadcast]`)
  if (!fs.existsSync(TREASURY_FILE)) throw new Error(`no treasury yet — run "node 00-create-your-wallet.js" first, then fund it`)
  const treasury = PrivateKey.fromWif(fs.readFileSync(TREASURY_FILE, 'utf8').trim())
  const treasuryAddr = treasury.toPublicKey().toAddress(ADDR_PREFIX)

  const utxos = await getJson(`/address/${treasuryAddr}/unspent`)
  if (!utxos.length) throw new Error(`treasury ${treasuryAddr} has no coins — fund it first`)
  const u = utxos.sort((a, b) => b.value - a.value)[0]        // biggest UTXO — simplest thing that works for a lesson
  const srcTx = Transaction.fromHex(await getHex(u.tx_hash))

  const tx = new Transaction()
  tx.addInput({ sourceTransaction: srcTx, sourceOutputIndex: u.tx_pos, unlockingScriptTemplate: new P2PKH().unlock(treasury) })
  tx.addOutput({ lockingScript: new P2PKH().lock(destAddr), satoshis: amountSats })      // the payment
  tx.addOutput({ lockingScript: new P2PKH().lock(treasuryAddr), change: true })          // your change comes home
  await tx.fee(fee); await tx.sign()

  console.log(`\n== SEND PAYMENT (${NETWORK}net, ${BROADCAST ? 'BROADCAST' : 'DRY RUN'}) ==`)
  console.log(`From   : ${treasuryAddr}   (spending ${u.value} sats from ${u.tx_hash}:${u.tx_pos})`)
  console.log(`To     : ${destAddr}   ${amountSats} sats`)
  console.log(`Change : ${tx.outputs[1].satoshis} sats back to you`)
  console.log(`Unlock : ${tx.inputs[0].unlockingScript.toASM().slice(0, 40)}…   (a signature from your key)`)
  if (!BROADCAST) { console.log(`\nDRY RUN — not sent. Hex:\n  ${tx.toHex()}\n\nRe-run with --broadcast to actually send.`); return }
  const id = await broadcast(tx.toHex())
  console.log(`\n✅ Sent: ${UI}/tx/${id}`)
}

send(DEST, AMOUNT_STR && Number(AMOUNT_STR))
  .catch(e => { console.error('❌', e.message || e); process.exit(1) })

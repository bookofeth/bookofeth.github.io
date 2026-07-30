/* ===========================================================================
   THE EXCHANGE, runtime for the BOOE swap widget.
   ---------------------------------------------------------------------------
   Mirrors holylabs.xyz/swap by calling the SAME team swap contract + functions.
   Real money on Ethereum mainnet: simulate before every write, honest slippage,
   deadlines, and decimals resolved on-chain.

   Bundled (viem included) into public/assets/js/swap.js by esbuild. From the
   repo root (viem is a build-only dep, not committed):

     npm install viem
     npx esbuild swap-src/index.js --bundle --minify --format=iife \
       --outfile=public/assets/js/swap.js

   The committed bundle is self-contained; the only runtime network calls are the
   eth.merkle.io RPC and the user's injected wallet.

   The only runtime network calls are the eth.merkle.io RPC and the user's
   injected wallet (window.ethereum). Nothing else is fetched.
   =========================================================================== */

import {
  createPublicClient, createWalletClient, custom, http,
  parseUnits, formatUnits, parseEther, isAddress, getAddress,
} from 'viem';
import { mainnet } from 'viem/chains';

/* --- chain + contracts (all mainnet, all on-chain verified) --------------- */
const RPC = 'https://eth.merkle.io';
const CHAIN_ID = 1;
const ROUTER = '0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D'; // Uniswap V2 Router02 (== team contract's uniswapV2())
const WETH = '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2';
const TEAM_SWAP = '0xe71B0Bde957C46bC4c0f610147b05735C6BF3580'; // Holy Labs swap contract
const ETHERSCAN_TX = 'https://etherscan.io/tx/';

/* --- Tabler icon inner paths (verbatim, copied from @tabler/icons) --------- */
const ICON_ETH = '<path d="M6 12l6 -9l6 9l-6 9l-6 -9"/><path d="M6 12l6 -3l6 3l-6 2l-6 -2"/>';
const ICON_USD = '<path d="M16.7 8a3 3 0 0 0 -2.7 -2h-4a3 3 0 0 0 0 6h4a3 3 0 0 1 0 6h-4a3 3 0 0 1 -2.7 -2"/><path d="M12 3v3m0 12v3"/>';
const ICON_WALLET = '<path d="M17 8v-3a1 1 0 0 0 -1 -1h-10a2 2 0 0 0 0 4h12a1 1 0 0 1 1 1v3m0 4v3a1 1 0 0 1 -1 1h-12a2 2 0 0 1 -2 -2v-12"/><path d="M20 12v4h-4a2 2 0 0 1 0 -4h4"/>';
const ICON_SPIN = '<path d="M12 3a9 9 0 1 0 9 9"/>';
const ICON_CHECK = '<path d="M3 12a9 9 0 1 0 18 0a9 9 0 1 0 -18 0"/><path d="M9 12l2 2l4 -4"/>';
const ICON_ALERT = '<path d="M12 9v4"/><path d="M10.363 3.591l-8.106 13.534a1.914 1.914 0 0 0 1.636 2.871h16.214a1.914 1.914 0 0 0 1.636 -2.87l-8.106 -13.536a1.914 1.914 0 0 0 -3.274 0"/><path d="M12 16h.01"/>';
const ICON_LOGOUT = '<path d="M14 8v-2a2 2 0 0 0 -2 -2h-7a2 2 0 0 0 -2 2v12a2 2 0 0 0 2 2h7a2 2 0 0 0 2 -2v-2"/><path d="M9 12h12l-3 -3"/><path d="M18 15l3 -3"/>';

/* --- the locked token list (mainnet). decimals verified on-chain. --------- */
const TOKENS = [
  { key: 'ETH',     symbol: 'ETH',      name: 'Ethereum',              address: null,                                          decimals: 18, native: true, icon: { svg: ICON_ETH } },
  { key: 'WETH',    symbol: 'WETH',     name: 'Wrapped Ether',         address: WETH,                                          decimals: 18, icon: { svg: ICON_ETH } },
  { key: 'BOOE',    symbol: '$BOOE',    name: 'The Pillar of Inscription', address: '0x289ff00235d2b98b0145ff5d4435d3e92f9540a6', decimals: 18, icon: { img: '/assets/img/relics/booe.webp' } },
  { key: 'HOPE',    symbol: '$HOPE',    name: 'The Keeper of History', address: '0x3b37a9caf74ead14e521d46af0bf00737d827828',      decimals: 18, icon: { img: '/assets/img/relics/hope.webp' } },
  { key: 'PROPHET', symbol: '$PROPHET', name: 'The Spirit of Guidance', address: '0x3fa55eb91be2c5d72890da11a4c0269e7f786555',     decimals: 18, icon: { img: '/assets/img/relics/prophet.webp' } },
  { key: 'HOLY',    symbol: '$HOLY',    name: 'The Reward of Faith',   address: '0x2216848e673541199b9ce168af2b6148f2ad9247',      decimals: 18, icon: { img: '/assets/img/relics/holy.webp' } },
  { key: 'USDC',    symbol: 'USDC',     name: 'USD Coin',              address: '0xA0b86991c6218b36c1D19D4a2e9Eb0cE3606eB48',      decimals: 6,  icon: { svg: ICON_USD } },
];
const byKey = (k) => TOKENS.find((t) => t.key === k);

/* --- ABIs ----------------------------------------------------------------- */
const ROUTER_ABI = [
  { name: 'getAmountsOut', type: 'function', stateMutability: 'view', inputs: [{ type: 'uint256' }, { type: 'address[]' }], outputs: [{ type: 'uint256[]' }] },
];
const ERC20_ABI = [
  { name: 'balanceOf', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'allowance', type: 'function', stateMutability: 'view', inputs: [{ type: 'address' }, { type: 'address' }], outputs: [{ type: 'uint256' }] },
  { name: 'approve', type: 'function', stateMutability: 'nonpayable', inputs: [{ type: 'address' }, { type: 'uint256' }], outputs: [{ type: 'bool' }] },
];
/* Team swap contract 0xe71B... The swap selectors were extracted from the live
   bytecode with @shazow/whatsabi and each signature was keccak-verified: the
   ETH-input selector is 0x1135e2fe, the exact selector holylabs.xyz/swap uses.
   WETH9() and uniswapV2() reads confirmed the ABI decodes against the live
   contract (they return canonical WETH and the Uniswap V2 Router02). */
const SWAP_ABI = [
  // payable: ETH in. value = amountIn.  0x1135e2fe
  { name: 'swapExactETHForTokensV2', type: 'function', stateMutability: 'payable', inputs: [{ name: 'path', type: 'address[]' }, { name: 'amountOutMin', type: 'uint256' }, { name: 'to', type: 'address' }, { name: 'deadline', type: 'uint256' }], outputs: [] },
  // token in -> token out.  0x660e1f8c
  { name: 'swapExactTokensForTokensV2', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amountIn', type: 'uint256' }, { name: 'amountOutMin', type: 'uint256' }, { name: 'path', type: 'address[]' }, { name: 'to', type: 'address' }, { name: 'deadline', type: 'uint256' }], outputs: [] },
  // token in -> ETH out.  0x661cdbfa
  { name: 'swapExactTokensForETHV2', type: 'function', stateMutability: 'nonpayable', inputs: [{ name: 'amountIn', type: 'uint256' }, { name: 'amountOutMin', type: 'uint256' }, { name: 'path', type: 'address[]' }, { name: 'to', type: 'address' }, { name: 'deadline', type: 'uint256' }], outputs: [] },
];

/* --- shared read client --------------------------------------------------- */
const publicClient = createPublicClient({
  chain: mainnet,
  transport: http(RPC, { retryCount: 3, retryDelay: 1500, timeout: 20000 }),
});

/* --- number helpers ------------------------------------------------------- */
function groupInt(intStr) {
  return intStr.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}
// Pretty-print a bigint amount for display (thousands grouped, sensible fraction).
function fmtUnits(bi, decimals, sig) {
  if (bi === 0n) return '0';
  const s = formatUnits(bi, decimals);
  let [i, f = ''] = s.split('.');
  const neg = i.startsWith('-');
  if (neg) i = i.slice(1);
  let frac;
  if (i !== '0') {
    // large-ish number: 2 to 4 decimals
    frac = f.slice(0, i.length >= 4 ? 2 : 4);
  } else {
    // < 1: keep enough leading significant digits
    const lead = f.search(/[1-9]/);
    frac = lead < 0 ? f.slice(0, 4) : f.slice(0, lead + (sig || 4));
  }
  frac = frac.replace(/0+$/, '');
  const out = frac ? `${groupInt(i)}.${frac}` : groupInt(i);
  return neg ? `-${out}` : out;
}
function fmtRate(n) {
  if (!isFinite(n) || n <= 0) return '0';
  if (n >= 1000) return groupInt(Math.round(n).toString());
  if (n >= 1) return n.toFixed(4).replace(/0+$/, '').replace(/\.$/, '');
  // small: show 4 significant figures
  const digits = Math.max(4, 4 - Math.floor(Math.log10(n)) - 1);
  return n.toFixed(Math.min(digits, 18)).replace(/0+$/, '').replace(/\.$/, '');
}
function shortAddr(a) { return a.slice(0, 6) + '...' + a.slice(-4); }
function emblemMarkup(t) {
  if (t.icon.img) return `<img src="${t.icon.img}" alt="" width="34" height="34" decoding="async">`;
  return `<svg class="ti" viewBox="0 0 24 24" aria-hidden="true">${t.icon.svg}</svg>`;
}
function friendlyError(e) {
  const msg = (e && (e.shortMessage || e.details || e.message)) || 'Something went wrong.';
  if (/rejected|denied|4001|user rejected/i.test(msg)) return 'Transaction rejected in your wallet.';
  if (/insufficient funds/i.test(msg)) return 'Insufficient ETH for gas.';
  return msg.split('\n')[0].slice(0, 160);
}
function isNoRouteError(e) {
  const m = (e && (e.shortMessage || e.message) || '').toLowerCase();
  return /reverted|execution reverted|insufficient_liquidity|invalid|out of gas/.test(m);
}

/* --- the widget controller (scoped to one [data-swap] root) --------------- */
function initSwap(root) {
  const $ = (sel) => root.querySelector(sel);
  const $$ = (sel) => Array.from(root.querySelectorAll(sel));

  const els = {
    settingsBtn: $('[data-swap-settings]'),
    settingsPanel: $('[data-swap-settings-panel]'),
    slipChoices: $('[data-slip-choices]'),
    slipInput: $('[data-slip-input]'),
    slipWarn: $('[data-slip-warn]'),
    deadlineMin: $('[data-deadline-min]'),
    payInput: $('[data-amount="pay"]'),
    outEl: $('[data-amount="receive"]'),
    maxBtn: $('[data-max]'),
    balText: $('[data-balance-text]'),
    rate: $('[data-rate]'),
    rateText: $('[data-rate-text]'),
    note: $('[data-note]'),
    noteText: $('[data-note-text]'),
    action: $('[data-action]'),
    actionText: $('[data-action-text]'),
    tx: $('[data-tx]'),
    txIcon: $('[data-tx-icon]'),
    txText: $('[data-tx-text]'),
    txLink: $('[data-tx-link]'),
    head: $('.sw-head'),
    modal: $('[data-token-modal]'),
    tokenList: $('[data-token-list]'),
    search: $('[data-token-search]'),
  };

  const state = {
    pay: 'ETH',
    receive: 'BOOE',
    slippage: 0.5,
    deadlineMin: 20,
    amountIn: '',
    quote: null,
    account: null,
    chainId: null,
    balances: Object.create(null),
    selecting: null,
    busy: false,
    needsApproval: false,
  };
  let walletClient = null;
  let quoteSeq = 0;
  let debounceTimer = null;
  let accountChip = null;

  /* ---- path shared by quote AND execution (must match) ---- */
  function buildPath(inT, outT) {
    const inAddr = inT.native ? WETH : inT.address;
    const outAddr = outT.native ? WETH : outT.address;
    if (inAddr.toLowerCase() === outAddr.toLowerCase()) return null; // ETH<->WETH or same token
    if (inAddr.toLowerCase() === WETH.toLowerCase() || outAddr.toLowerCase() === WETH.toLowerCase()) return [inAddr, outAddr];
    return [inAddr, WETH, outAddr];
  }

  /* ---- token chrome ---- */
  function renderToken(side) {
    const t = byKey(state[side]);
    const symEl = root.querySelector(`[data-symbol="${side}"]`);
    const embEl = root.querySelector(`[data-emblem="${side}"]`);
    if (symEl) symEl.textContent = t.symbol;
    if (embEl) {
      embEl.innerHTML = t.icon.img
        ? `<img src="${t.icon.img}" alt="" width="28" height="28" decoding="async">`
        : `<svg class="ti" viewBox="0 0 24 24" aria-hidden="true">${t.icon.svg}</svg>`;
    }
  }

  /* ---- notes / rate ---- */
  function showNote(msg, isError) {
    els.noteText.textContent = msg;
    els.note.classList.toggle('is-error', !!isError);
    els.note.hidden = false;
  }
  function clearNote() { els.note.hidden = true; }
  function showRate(text) { els.rateText.textContent = text; els.rate.hidden = false; }
  function clearRate() { els.rate.hidden = true; }

  function setOut(text, loading) {
    els.outEl.textContent = text;
    els.outEl.classList.toggle('is-loading', !!loading);
  }

  /* ---- quotes ---- */
  function scheduleQuote() {
    clearTimeout(debounceTimer);
    debounceTimer = setTimeout(refreshQuote, 350);
  }

  async function refreshQuote() {
    clearNote();
    const payT = byKey(state.pay);
    const recT = byKey(state.receive);
    const raw = (state.amountIn || '').trim();
    state.quote = null;

    if (!raw || Number(raw) <= 0 || !isFinite(Number(raw))) {
      setOut('0.0'); clearRate(); updateAction(); return;
    }
    const path = buildPath(payT, recT);
    if (!path) {
      setOut('0.0'); clearRate();
      showNote('That pair cannot route on Uniswap. Pick a different token.');
      updateAction(); return;
    }
    let amountIn;
    try { amountIn = parseUnits(raw, payT.decimals); }
    catch { setOut('0.0'); clearRate(); updateAction(); return; }
    if (amountIn <= 0n) { setOut('0.0'); clearRate(); updateAction(); return; }

    setOut('...', true);
    const reqId = ++quoteSeq;
    try {
      const amounts = await publicClient.readContract({ address: ROUTER, abi: ROUTER_ABI, functionName: 'getAmountsOut', args: [amountIn, path] });
      if (reqId !== quoteSeq) return;
      const out = amounts[amounts.length - 1];
      state.quote = { amountIn, amountOut: out, path };
      setOut(fmtUnits(out, recT.decimals));
      const rate = Number(formatUnits(out, recT.decimals)) / Number(formatUnits(amountIn, payT.decimals));
      showRate(`1 ${payT.symbol} = ${fmtRate(rate)} ${recT.symbol}`);
      await maybeCheckApproval();
      updateAction();
    } catch (e) {
      if (reqId !== quoteSeq) return;
      setOut('0.0'); clearRate();
      showNote(isNoRouteError(e) ? 'No Uniswap route for this pair yet.' : 'Could not reach the network for a quote. Try again.');
      updateAction();
    }
  }

  function minOut() {
    if (!state.quote) return 0n;
    const bps = BigInt(Math.round(state.slippage * 100)); // 0.5% -> 50
    return state.quote.amountOut - (state.quote.amountOut * bps) / 10000n;
  }
  function deadline() { return BigInt(Math.floor(Date.now() / 1000) + state.deadlineMin * 60); }

  /* ---- balances ---- */
  async function balanceOf(t) {
    if (!state.account) return 0n;
    if (t.native) return publicClient.getBalance({ address: state.account });
    return publicClient.readContract({ address: t.address, abi: ERC20_ABI, functionName: 'balanceOf', args: [state.account] });
  }
  async function refreshActiveBalances() {
    if (!state.account) { els.balText.textContent = ''; els.maxBtn.hidden = true; return; }
    try {
      const payT = byKey(state.pay);
      const bal = await balanceOf(payT);
      state.balances[state.pay] = bal;
      els.balText.textContent = 'Balance ' + fmtUnits(bal, payT.decimals);
      els.maxBtn.hidden = bal <= 0n;
      updateAction();
    } catch { els.balText.textContent = ''; els.maxBtn.hidden = true; }
  }

  async function maybeCheckApproval() {
    state.needsApproval = false;
    const payT = byKey(state.pay);
    if (!state.account || payT.native || !state.quote) return;
    try {
      const allowance = await publicClient.readContract({ address: payT.address, abi: ERC20_ABI, functionName: 'allowance', args: [state.account, TEAM_SWAP] });
      state.needsApproval = allowance < state.quote.amountIn;
    } catch { /* ignore, execute path re-checks */ }
  }

  /* ---- action button state machine ---- */
  function setAction(text, { disabled = false, busy = false, icon } = {}) {
    els.actionText.textContent = text;
    els.action.disabled = disabled;
    els.action.classList.toggle('is-busy', busy);
    const svg = els.action.querySelector('.ti');
    if (svg && icon) svg.innerHTML = icon;
    if (svg) svg.style.display = busy ? 'none' : '';
    let spin = els.action.querySelector('.sw-spin');
    if (busy && !spin) {
      spin = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
      spin.setAttribute('class', 'ti sw-spin');
      spin.setAttribute('viewBox', '0 0 24 24');
      spin.innerHTML = ICON_SPIN;
      els.action.insertBefore(spin, els.actionText);
    } else if (!busy && spin) { spin.remove(); }
  }

  function updateAction() {
    if (state.busy) return;
    const payT = byKey(state.pay);
    if (!state.account) { setAction('Connect Wallet', { icon: ICON_WALLET }); return; }
    if (state.chainId !== CHAIN_ID) { setAction('Switch to Ethereum', { icon: ICON_ALERT }); return; }
    const raw = (state.amountIn || '').trim();
    if (!raw || Number(raw) <= 0) { setAction('Enter an amount', { disabled: true, icon: ICON_WALLET }); return; }
    if (!state.quote) {
      const routeless = !buildPath(payT, byKey(state.receive));
      setAction(routeless ? 'No route' : 'Fetching quote...', { disabled: true, icon: ICON_WALLET });
      return;
    }
    const bal = state.balances[state.pay];
    if (bal != null && state.quote.amountIn > bal) { setAction('Insufficient ' + payT.symbol, { disabled: true, icon: ICON_ALERT }); return; }
    setAction(state.needsApproval ? ('Approve ' + payT.symbol) : 'Swap', { icon: ICON_WALLET });
  }

  /* ---- tx status ---- */
  function txStatus(kind, text, hash) {
    els.tx.hidden = false;
    els.tx.classList.remove('is-pending', 'is-success', 'is-fail');
    els.tx.classList.add('is-' + kind);
    const icon = kind === 'success' ? ICON_CHECK : kind === 'fail' ? ICON_ALERT : ICON_SPIN;
    els.txIcon.innerHTML = `<svg class="ti" viewBox="0 0 24 24" aria-hidden="true">${icon}</svg>`;
    els.txText.innerHTML = text;
    if (hash) { els.txLink.href = ETHERSCAN_TX + hash; els.txLink.hidden = false; }
  }

  /* ---- wallet ---- */
  function attachProviderEvents() {
    const p = window.ethereum;
    if (!p || !p.on || p._booeBound) return;
    p._booeBound = true;
    p.on('accountsChanged', (accs) => {
      if (!accs || !accs.length) { softDisconnect(); return; }
      state.account = getAddress(accs[0]);
      renderAccountChip(); refreshActiveBalances(); refreshQuote();
    });
    p.on('chainChanged', (cid) => {
      state.chainId = typeof cid === 'string' ? parseInt(cid, 16) : cid;
      updateAction(); refreshActiveBalances();
    });
  }

  async function connect() {
    if (!window.ethereum) { showNote('No Ethereum wallet detected. Install MetaMask or a compatible wallet.', true); return; }
    try {
      walletClient = createWalletClient({ chain: mainnet, transport: custom(window.ethereum) });
      const accounts = await walletClient.requestAddresses();
      if (!accounts || !accounts.length) return;
      state.account = getAddress(accounts[0]);
      state.chainId = await walletClient.getChainId();
      attachProviderEvents();
      clearNote();
      renderAccountChip();
      updateAction();
      refreshActiveBalances();
      refreshQuote();
    } catch (e) { showNote(friendlyError(e), true); }
  }

  function softDisconnect() {
    state.account = null; state.chainId = null; walletClient = null; state.balances = Object.create(null);
    els.balText.textContent = ''; els.maxBtn.hidden = true;
    if (accountChip) { accountChip.remove(); accountChip = null; }
    els.tx.hidden = true;
    updateAction();
  }

  async function switchChain() {
    try { await walletClient.switchChain({ id: CHAIN_ID }); state.chainId = CHAIN_ID; clearNote(); updateAction(); refreshActiveBalances(); }
    catch (e) { showNote(friendlyError(e), true); }
  }

  function renderAccountChip() {
    if (!state.account) return;
    if (!accountChip) {
      accountChip = document.createElement('button');
      accountChip.type = 'button';
      accountChip.className = 'sw-account';
      accountChip.title = 'Disconnect';
      els.head.insertBefore(accountChip, els.settingsBtn);
      accountChip.addEventListener('click', softDisconnect);
    }
    accountChip.innerHTML = `<span class="sw-dot" aria-hidden="true"></span><span>${shortAddr(state.account)}</span><svg class="ti" viewBox="0 0 24 24" aria-hidden="true">${ICON_LOGOUT}</svg>`;
  }

  /* ---- execution (the real swap; simulate first, always) ---- */
  async function execute() {
    if (state.busy) return;
    if (!state.account) return connect();
    if (state.chainId !== CHAIN_ID) return switchChain();
    if (!state.quote) return;

    const payT = byKey(state.pay);
    const recT = byKey(state.receive);
    const to = getAddress(state.account);
    const path = state.quote.path;
    const amountIn = state.quote.amountIn;
    const outMin = minOut();
    const dl = deadline();

    state.busy = true;
    els.action.disabled = true;
    clearNote();

    try {
      // 1) ERC20 input: ensure allowance for the exact amountIn (never silent max).
      if (!payT.native) {
        const allowance = await publicClient.readContract({ address: payT.address, abi: ERC20_ABI, functionName: 'allowance', args: [to, TEAM_SWAP] });
        if (allowance < amountIn) {
          setAction('Approving...', { busy: true });
          txStatus('pending', `Approving <b>${fmtUnits(amountIn, payT.decimals)} ${payT.symbol}</b> for the swap contract. Confirm in your wallet.`);
          const sim = await publicClient.simulateContract({ account: to, address: payT.address, abi: ERC20_ABI, functionName: 'approve', args: [TEAM_SWAP, amountIn] });
          const ahash = await walletClient.writeContract(sim.request);
          txStatus('pending', 'Approval submitted. Waiting for confirmation...', ahash);
          const arcpt = await publicClient.waitForTransactionReceipt({ hash: ahash });
          if (arcpt.status !== 'success') { txStatus('fail', 'Approval failed. Nothing was swapped.', ahash); throw new Error('approval failed'); }
        }
      }

      // 2) Simulate the swap FIRST. Only write if the simulation succeeds.
      setAction('Confirm swap...', { busy: true });
      txStatus('pending', 'Simulating the swap...');
      let sim;
      if (payT.native) {
        sim = await publicClient.simulateContract({ account: to, address: TEAM_SWAP, abi: SWAP_ABI, functionName: 'swapExactETHForTokensV2', args: [path, outMin, to, dl], value: amountIn });
      } else if (recT.native) {
        sim = await publicClient.simulateContract({ account: to, address: TEAM_SWAP, abi: SWAP_ABI, functionName: 'swapExactTokensForETHV2', args: [amountIn, outMin, path, to, dl] });
      } else {
        sim = await publicClient.simulateContract({ account: to, address: TEAM_SWAP, abi: SWAP_ABI, functionName: 'swapExactTokensForTokensV2', args: [amountIn, outMin, path, to, dl] });
      }

      // 3) Write.
      txStatus('pending', 'Confirm the swap in your wallet...');
      const hash = await walletClient.writeContract(sim.request);
      txStatus('pending', `Swap submitted. Minimum received <b>${fmtUnits(outMin, recT.decimals)} ${recT.symbol}</b>. Waiting...`, hash);
      const rcpt = await publicClient.waitForTransactionReceipt({ hash });
      if (rcpt.status === 'success') {
        txStatus('success', `Swapped <b>${fmtUnits(amountIn, payT.decimals)} ${payT.symbol}</b> for <b>${recT.symbol}</b>.`, hash);
        state.amountIn = ''; els.payInput.value = ''; setOut('0.0'); clearRate();
        refreshActiveBalances();
      } else {
        txStatus('fail', 'The swap transaction reverted on-chain.', hash);
      }
    } catch (e) {
      const msg = friendlyError(e);
      txStatus('fail', msg);
      showNote(msg, true);
    } finally {
      state.busy = false;
      await maybeCheckApproval();
      updateAction();
    }
  }

  /* ---- token modal ---- */
  function openModal(side) {
    state.selecting = side;
    els.search.value = '';
    renderTokenList('');
    els.modal.hidden = false;
    document.body.classList.add('menu-open');
    setTimeout(() => els.search.focus(), 20);
    if (state.account) loadModalBalances();
  }
  function closeModal() { els.modal.hidden = true; state.selecting = null; document.body.classList.remove('menu-open'); }

  async function loadModalBalances() {
    await Promise.all(TOKENS.map(async (t) => {
      try { state.balances[t.key] = await balanceOf(t); } catch { /* skip */ }
    }));
    if (!els.modal.hidden) renderTokenList(els.search.value);
  }

  function renderTokenList(query) {
    const q = (query || '').trim().toLowerCase();
    const other = state.selecting === 'pay' ? state.receive : state.pay;
    const rows = TOKENS.filter((t) => {
      if (!q) return true;
      return t.symbol.toLowerCase().includes(q) || t.name.toLowerCase().includes(q) || (t.address && t.address.toLowerCase() === q);
    });
    if (!rows.length) { els.tokenList.innerHTML = '<li class="sw-row-empty">No tokens match that search.</li>'; return; }
    els.tokenList.innerHTML = rows.map((t) => {
      const current = t.key === state[state.selecting];
      const bal = state.balances[t.key];
      const balStr = state.account && bal != null ? fmtUnits(bal, t.decimals) : '';
      return `<li><button type="button" class="sw-row" data-token-key="${t.key}" ${current ? 'aria-current="true"' : ''}>
        <span class="sw-row-emblem${t.icon.img ? '' : ''}">${emblemMarkup(t)}</span>
        <span class="sw-row-id"><span class="sw-row-sym">${t.symbol}</span><span class="sw-row-name">${t.name}</span></span>
        <span class="sw-row-bal">${balStr}</span>
      </button></li>`;
    }).join('');
    void other;
  }

  function chooseToken(key) {
    const side = state.selecting;
    if (!side) return;
    const otherSide = side === 'pay' ? 'receive' : 'pay';
    if (state[otherSide] === key) state[otherSide] = state[side]; // picked the other side's token: swap them
    state[side] = key;
    closeModal();
    renderToken('pay'); renderToken('receive');
    state.quote = null;
    refreshActiveBalances();
    refreshQuote();
  }

  function flip() {
    const prevOut = state.quote ? fmtUnits(state.quote.amountOut, byKey(state.receive).decimals).replace(/,/g, '') : '';
    const p = state.pay; state.pay = state.receive; state.receive = p;
    if (prevOut) { state.amountIn = prevOut; els.payInput.value = prevOut; }
    renderToken('pay'); renderToken('receive');
    state.quote = null;
    refreshActiveBalances();
    refreshQuote();
  }

  function doMax() {
    const payT = byKey(state.pay);
    const bal = state.balances[state.pay];
    if (bal == null || bal <= 0n) return;
    let max = bal;
    if (payT.native) { const reserve = parseEther('0.002'); max = bal > reserve ? bal - reserve : 0n; }
    state.amountIn = formatUnits(max, payT.decimals);
    els.payInput.value = state.amountIn;
    refreshQuote();
  }

  /* ---- slippage settings ---- */
  function setSlippage(v, fromInput) {
    const num = Number(v);
    if (!isFinite(num) || num <= 0) return;
    state.slippage = Math.min(num, 50);
    $$('[data-slip]').forEach((b) => b.classList.toggle('on', !fromInput && Number(b.dataset.slip) === state.slippage));
    els.slipWarn.hidden = !(state.slippage >= 5);
    if (state.slippage >= 5) els.slipWarn.textContent = 'High slippage. You may receive far less than expected.';
  }

  /* ---- wire events ---- */
  els.payInput.addEventListener('input', (e) => {
    let v = e.target.value.replace(/[^0-9.]/g, '');
    const parts = v.split('.');
    if (parts.length > 2) v = parts[0] + '.' + parts.slice(1).join('');
    e.target.value = v;
    state.amountIn = v;
    scheduleQuote();
  });
  els.maxBtn.addEventListener('click', doMax);
  els.action.addEventListener('click', () => {
    if (!state.account) return connect();
    if (state.chainId !== CHAIN_ID) return switchChain();
    execute();
  });
  root.querySelector('[data-flip]').addEventListener('click', flip);
  $$('[data-token-select]').forEach((btn) => btn.addEventListener('click', () => openModal(btn.dataset.tokenSelect)));
  $$('[data-token-close]').forEach((el) => el.addEventListener('click', closeModal));
  els.tokenList.addEventListener('click', (e) => {
    const btn = e.target.closest('[data-token-key]');
    if (btn) chooseToken(btn.dataset.tokenKey);
  });
  els.search.addEventListener('input', (e) => renderTokenList(e.target.value));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !els.modal.hidden) closeModal(); });

  els.settingsBtn.addEventListener('click', () => {
    const open = els.settingsPanel.hidden;
    els.settingsPanel.hidden = !open;
    els.settingsBtn.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
  els.slipChoices.addEventListener('click', (e) => {
    const b = e.target.closest('[data-slip]');
    if (b) { els.slipInput.value = ''; setSlippage(b.dataset.slip, false); }
  });
  els.slipInput.addEventListener('input', (e) => {
    const v = e.target.value.replace(/[^0-9.]/g, '');
    e.target.value = v;
    if (v) setSlippage(v, true);
  });

  /* ---- boot ---- */
  renderToken('pay'); renderToken('receive');
  setOut('0.0');
  updateAction();
  // If the wallet is already authorized, resume silently (no prompt).
  if (window.ethereum && window.ethereum.request) {
    window.ethereum.request({ method: 'eth_accounts' }).then((accs) => {
      if (accs && accs.length) {
        walletClient = createWalletClient({ chain: mainnet, transport: custom(window.ethereum) });
        state.account = getAddress(accs[0]);
        walletClient.getChainId().then((c) => { state.chainId = c; updateAction(); });
        attachProviderEvents();
        renderAccountChip();
        refreshActiveBalances();
      }
    }).catch(() => {});
  }
}

/* --- init every widget on the page --------------------------------------- */
function boot() {
  document.querySelectorAll('[data-swap]').forEach(initSwap);
}
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', boot);
else boot();

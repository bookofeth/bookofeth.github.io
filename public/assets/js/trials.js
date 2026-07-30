/* ===========================================================================
   THE TRIALS. The Scriptorium's knowledge test of Ethereum + the lore of the
   Book. Self-contained, no bundler, progressive enhancement: the page carries a
   static intro + <noscript> note, this file drives the interactive quiz.

   Ported from the original Book of Ethereum trivia game: every question, its
   options, its correct answer and its lore verse are carried over verbatim, plus
   the Fisher-Yates shuffle and the score mechanic. One verse at a time, immediate
   correct/wrong feedback, a running score, and a final rank from the lexicon
   ladder (Catechumen / Acolyte / Scribe / Disciple / Prophet).

   Icons are Tabler, copied verbatim (never hand-authored). House rules: no
   em-dashes, no en-dashes. Extends the locked tokens, never fights them.
   =========================================================================== */
(function () {
  'use strict';

  /* --- The verses (all carried over from the source, verbatim) ------------ */
  var QUESTIONS = [
    { q: "Who authored Ethereum's original whitepaper?", options: ["Vitalik Buterin", "Satoshi Nakamoto", "Gavin Wood", "Nick Szabo"], answer: "Vitalik Buterin", lore: "Vitalik Buterin outlined Ethereum's vision in 2013." },
    { q: "What does EVM stand for?", options: ["Ethereum Virtual Machine", "Electronic Value Module", "Ether Verification Method", "Encrypted Virtual Memory"], answer: "Ethereum Virtual Machine", lore: "The EVM executes smart contracts across the network." },
    { q: "Which event moved Ethereum from Proof of Work to Proof of Stake?", options: ["The Merge", "The Burn", "The Forkening", "The Halving"], answer: "The Merge", lore: "The Merge shifted consensus to Proof of Stake, saving energy." },
    { q: "Which Ethereum upgrade introduced base fee burning?", options: ["EIP-1559", "The Merge", "The DAO Fork", "London Upgrade"], answer: "EIP-1559", lore: "EIP-1559 burns base fees to reduce ETH inflation." },
    { q: "Which smart contract language is most commonly used on Ethereum?", options: ["Solidity", "Vyper", "Rust", "Go"], answer: "Solidity", lore: "Solidity is Ethereum's primary smart contract language." },
    { q: "What is a 'nonce' in Ethereum?", options: ["Transaction counter for accounts", "Random number generator", "Block timestamp", "Gas limit per block"], answer: "Transaction counter for accounts", lore: "A nonce counts transactions to prevent replay attacks." },
    { q: "Who co-founded Ethereum and wrote the first EVM specification?", options: ["Gavin Wood", "Satoshi Nakamoto", "Nick Szabo", "Vitalik Buterin"], answer: "Gavin Wood", lore: "Gavin Wood co-founded Ethereum and wrote the first EVM specification." },
    { q: "What is a gas fee?", options: ["Payment for computation", "Mining reward", "Block reward", "Ether locked in smart contracts"], answer: "Payment for computation", lore: "Gas fees pay validators for processing transactions and contracts." },
    { q: "Which layer helps scale Ethereum transactions?", options: ["Layer 2", "Layer 3", "Layer 1", "Consensus Layer"], answer: "Layer 2", lore: "Layer 2 solutions like rollups increase transaction throughput." },
    { q: "What is a smart contract?", options: ["Self-executing code on the blockchain", "A physical contract", "A legal agreement", "An ERC-20 token"], answer: "Self-executing code on the blockchain", lore: "Smart contracts automatically execute instructions when conditions are met." },
    { q: "What was 'The DAO'?", options: ["First major Ethereum decentralized organization", "A DeFi protocol", "Ethereum fork", "Consensus algorithm"], answer: "First major Ethereum decentralized organization", lore: "The DAO was an early decentralized venture fund that led to a major Ethereum fork." },
    { q: "What does ERC-20 define?", options: ["Token standard on Ethereum", "A mining algorithm", "A wallet type", "Gas limit standard"], answer: "Token standard on Ethereum", lore: "ERC-20 standardizes fungible tokens on Ethereum." },
    { q: "What is an ERC-721 token?", options: ["Non-fungible token", "Fungible token", "Stablecoin", "DAO share"], answer: "Non-fungible token", lore: "ERC-721 defines unique digital assets like NFTs." },
    { q: "Which year did Ethereum mainnet launch?", options: ["2015", "2013", "2017", "2014"], answer: "2015", lore: "Ethereum's mainnet launched in July 2015." },
    { q: "What is 'staking' in Ethereum?", options: ["Locking ETH to secure the network", "Mining blocks", "Buying tokens", "Paying gas"], answer: "Locking ETH to secure the network", lore: "Validators stake ETH to participate in consensus and earn rewards." },
    { q: "Which Ethereum upgrade focused on security and gas improvements?", options: ["London", "Istanbul", "Byzantium", "Constantinople"], answer: "London", lore: "The London upgrade introduced EIP-1559 and gas optimizations." },
    { q: "What is an Ethereum 'address'?", options: ["Unique identifier for accounts", "Email of wallet owner", "Private key", "Smart contract ID"], answer: "Unique identifier for accounts", lore: "Ethereum addresses are unique identifiers derived from a public key." },
    { q: "What is 'Web3'?", options: ["Decentralized internet powered by blockchains", "A browser version", "A mining software", "A DeFi token"], answer: "Decentralized internet powered by blockchains", lore: "Web3 represents a decentralized web where users own data and value." },
    { q: "What is a 'rollup'?", options: ["Layer 2 aggregation of transactions", "Ethereum miner", "NFT standard", "Wallet type"], answer: "Layer 2 aggregation of transactions", lore: "Rollups bundle multiple transactions to increase throughput." },
    { q: "What does 'DeFi' stand for?", options: ["Decentralized Finance", "Digital Ethereum Fund", "Distributed File Index", "Deployed Finance"], answer: "Decentralized Finance", lore: "DeFi refers to financial apps built on blockchain without intermediaries." },
    { q: "What is 'sharding'?", options: ["Splitting Ethereum state to improve scalability", "Token airdrop", "Validator selection method", "Consensus algorithm"], answer: "Splitting Ethereum state to improve scalability", lore: "Sharding divides Ethereum's network into pieces for parallel processing." },
    { q: "What is a 'validator'?", options: ["Node that stakes ETH and proposes blocks", "Miner", "Smart contract", "NFT holder"], answer: "Node that stakes ETH and proposes blocks", lore: "Validators maintain Ethereum's PoS blockchain by proposing and attesting blocks." },
    { q: "Which language is Vyper?", options: ["Ethereum smart contract language", "Bitcoin scripting", "Python library", "Frontend language"], answer: "Ethereum smart contract language", lore: "Vyper is Python-inspired for writing Ethereum contracts." },
    { q: "What is a 'Genesis Block'?", options: ["First block of Ethereum", "Last block mined", "Block with highest gas", "Block with DAO fork"], answer: "First block of Ethereum", lore: "The Genesis Block is Ethereum's very first block." },
    { q: "What is an 'account' in Ethereum?", options: ["A wallet that can send transactions or hold smart contracts", "A bank account", "A miner", "A token type"], answer: "A wallet that can send transactions or hold smart contracts", lore: "Accounts can be externally owned or contract-based." },
    { q: "What is an 'immutable ledger'?", options: ["Blockchain that cannot be altered", "Smart contract", "Ethereum wallet", "Gas fee"], answer: "Blockchain that cannot be altered", lore: "Ethereum's ledger records all transactions permanently." },
    { q: "What does 'gas limit' mean?", options: ["Max computation allowed in a transaction", "Fee per transaction", "Number of blocks mined", "Token cap"], answer: "Max computation allowed in a transaction", lore: "Gas limit sets the maximum computational work a transaction can use." },
    { q: "What is a 'hard fork'?", options: ["Incompatible blockchain upgrade", "Token burn", "Validator reward", "Wallet type"], answer: "Incompatible blockchain upgrade", lore: "A hard fork creates a new chain version that may not be compatible with older versions." },
    { q: "Which cryptographic algorithm secures Ethereum addresses?", options: ["Keccak-256", "SHA-1", "MD5", "RSA"], answer: "Keccak-256", lore: "Ethereum uses Keccak-256 to hash public keys into addresses." }
  ];

  var TOTAL = QUESTIONS.length;

  /* --- The lexicon ladder (low to high). Thresholds are ratios, so the ladder
         holds whatever the verse count becomes. ------------------------------ */
  var RANKS = [
    { key: 'catechumen', name: 'Catechumen', min: 0,
      blurb: 'You have heard the word, but the ledger is still a rumor to you. Sit closer to the fire, and read again.' },
    { key: 'acolyte', name: 'Acolyte', min: 0.3,
      blurb: 'The first candles are lit. You know the shape of the chain, if not yet its every verse.' },
    { key: 'scribe', name: 'Scribe', min: 0.5,
      blurb: 'A steady hand and a clear eye. You could copy the Book through the night and never smudge the ink.' },
    { key: 'disciple', name: 'Disciple', min: 0.7,
      blurb: 'Few verses escape you. The brethren would seat you near the front and pour you the good ether.' },
    { key: 'prophet', name: 'Prophet', min: 0.9,
      blurb: 'You answer as one who stood at the Genesis block. The Book itself leans in to hear what you say next.' }
  ];

  /* --- Tabler icons, verbatim inner paths ---------------------------------- */
  var ICON = {
    check: '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l5 5l10 -10"/></svg>',
    x: '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="M18 6l-12 12"/><path d="M6 6l12 12"/></svg>',
    arrow: '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="M5 12l14 0"/><path d="M13 18l6 -6"/><path d="M13 6l6 6"/></svg>',
    refresh: '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="M20 11a8.1 8.1 0 0 0 -15.5 -2m-.5 -4v4h4"/><path d="M4 13a8.1 8.1 0 0 0 15.5 2m.5 4v-4h-4"/></svg>',
    trophy: '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="M8 21l8 0"/><path d="M12 17l0 4"/><path d="M7 4l10 0"/><path d="M17 4v8a5 5 0 0 1 -10 0v-8"/><path d="M3 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/><path d="M17 9a2 2 0 1 0 4 0a2 2 0 1 0 -4 0"/></svg>',
    book: '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="M19 4v16h-12a2 2 0 0 1 -2 -2v-12a2 2 0 0 1 2 -2h12"/><path d="M19 16h-12a2 2 0 0 0 -2 2"/><path d="M9 8h6"/></svg>',
    feather: '<svg class="ti" viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20l10 -10m0 -5v5h5m-9 -1v5h5m-9 -1v5h5m-5 -5l4 -4l4 -4"/><path d="M19 10c.638 -.636 1 -1.515 1 -2.486a3.515 3.515 0 0 0 -3.517 -3.514c-.97 0 -1.847 .367 -2.483 1m-3 13l4 -4l4 -4"/></svg>'
  };

  var TG = 'https://t.co/9CV0sztBLG';
  var KEYS = ['A', 'B', 'C', 'D', 'E', 'F'];

  /* --- Helpers ------------------------------------------------------------- */
  // Fisher-Yates, on a copy (carried over from the source game).
  function shuffle(source) {
    var arr = source.slice();
    for (var i = arr.length - 1; i > 0; i--) {
      var j = Math.floor(Math.random() * (i + 1));
      var t = arr[i];
      arr[i] = arr[j];
      arr[j] = t;
    }
    return arr;
  }

  function esc(s) {
    return String(s)
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function rankFor(ratio) {
    var chosen = RANKS[0];
    for (var i = 0; i < RANKS.length; i++) {
      if (ratio >= RANKS[i].min) chosen = RANKS[i];
    }
    return chosen;
  }

  /* --- Boot ---------------------------------------------------------------- */
  var app = document.getElementById('trial-app');
  if (!app) return;

  var reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  var state = {
    order: [],      // shuffled question objects, each with a shuffled options copy
    idx: 0,
    score: 0,
    answered: false
  };

  function newRun() {
    state.order = shuffle(QUESTIONS).map(function (q) {
      return { q: q.q, options: shuffle(q.options), answer: q.answer, lore: q.lore };
    });
    state.idx = 0;
    state.score = 0;
    state.answered = false;
  }

  /* --- Screens ------------------------------------------------------------- */
  function renderIntro() {
    var chips = RANKS.map(function (r) {
      return '<li class="rank-' + r.key + '">' + esc(r.name) + '</li>';
    }).join('');

    app.innerHTML =
      '<section class="trial-card trial-intro" aria-labelledby="trial-title">' +
        '<span class="trial-hairline" aria-hidden="true"></span>' +
        '<span class="ti-emblem">' + ICON.book + '</span>' +
        '<p class="trial-kicker">' + TOTAL + ' verses &middot; five ranks</p>' +
        '<h2 class="trial-h" id="trial-title">Sit for the <em>Trial</em>.</h2>' +
        '<p class="trial-lede">A test of Ethereum and the lore of the Book. Answer true and the ledger remembers you. Answer false and it forgives you, mostly. When the last verse is read, the Scriptorium names your rank.</p>' +
        '<ul class="trial-ranks" aria-label="The ranks you may earn, lowest to highest">' + chips + '</ul>' +
        '<div class="trial-actions">' +
          '<button type="button" class="btn btn-silver" data-begin>' + ICON.arrow + 'Begin the Trial</button>' +
        '</div>' +
        '<p class="trial-fine">No wallet. No gas. Only knowing.</p>' +
      '</section>';

    var begin = app.querySelector('[data-begin]');
    begin.addEventListener('click', function () {
      newRun();
      renderQuestion();
    });
    focus(app.querySelector('.trial-h'));
  }

  function renderQuestion() {
    state.answered = false;
    var item = state.order[state.idx];
    var human = state.idx + 1;
    var pct = Math.round((state.idx / TOTAL) * 100);

    var opts = item.options.map(function (o, i) {
      return '<button type="button" class="trial-opt" data-opt="' + esc(o) + '">' +
        '<span class="to-key" aria-hidden="true">' + KEYS[i] + '</span>' +
        '<span class="to-text">' + esc(o) + '</span>' +
        '<span class="to-mark" aria-hidden="true"></span>' +
      '</button>';
    }).join('');

    app.innerHTML =
      '<section class="trial-card trial-quiz" aria-labelledby="trial-q">' +
        '<span class="trial-hairline" aria-hidden="true"></span>' +
        '<div class="trial-top">' +
          '<div class="trial-meter">' +
            '<span class="tm-label">Verse <b>' + human + '</b> of <b>' + TOTAL + '</b></span>' +
            '<div class="tm-bar"><span class="tm-fill" style="width:' + pct + '%"></span></div>' +
          '</div>' +
          '<div class="trial-score" role="status" aria-live="polite">' +
            '<span class="ts-num">' + state.score + '</span>' +
            '<span class="ts-word">true</span>' +
          '</div>' +
        '</div>' +
        '<h2 class="trial-q" id="trial-q" tabindex="-1">' + esc(item.q) + '</h2>' +
        '<div class="trial-options" role="group" aria-label="Choose one answer">' + opts + '</div>' +
        '<p class="trial-hint" data-hint>Choose the true answer</p>' +
        '<div class="trial-feedback" aria-live="polite" hidden>' +
          '<span class="tf-icon" aria-hidden="true"></span>' +
          '<p class="tf-text"></p>' +
        '</div>' +
        '<div class="trial-actions" data-actions hidden>' +
          '<button type="button" class="btn btn-silver" data-next></button>' +
        '</div>' +
      '</section>';

    var buttons = Array.prototype.slice.call(app.querySelectorAll('.trial-opt'));
    buttons.forEach(function (b) {
      b.addEventListener('click', function () { choose(b, item, buttons); });
    });

    focus(app.querySelector('.trial-q'));
  }

  function choose(button, item, buttons) {
    if (state.answered) return;
    state.answered = true;
    var picked = button.getAttribute('data-opt');
    var correct = picked === item.answer;
    if (correct) state.score++;

    buttons.forEach(function (b) {
      b.disabled = true;
      var value = b.getAttribute('data-opt');
      var mark = b.querySelector('.to-mark');
      if (value === item.answer) {
        b.classList.add('is-correct');
        mark.innerHTML = ICON.check;
      } else if (b === button) {
        b.classList.add('is-wrong');
        mark.innerHTML = ICON.x;
      } else {
        b.classList.add('is-muted');
      }
    });

    // running score chip
    var num = app.querySelector('.ts-num');
    if (num) num.textContent = state.score;

    // the pre-answer hint has done its job, the feedback verse takes its slot
    var hint = app.querySelector('[data-hint]');
    if (hint) hint.hidden = true;

    // feedback verse
    var fb = app.querySelector('.trial-feedback');
    var fbIcon = app.querySelector('.tf-icon');
    var fbText = app.querySelector('.tf-text');
    fb.classList.toggle('is-correct', correct);
    fb.classList.toggle('is-wrong', !correct);
    fbIcon.innerHTML = correct ? ICON.check : ICON.x;
    var lead = correct
      ? 'The ledger confirms it. '
      : 'Not the path chosen. The truth was "' + item.answer + '". ';
    fbText.textContent = lead + item.lore;
    fb.hidden = false;

    // fill the meter to reflect this verse being read
    var fill = app.querySelector('.tm-fill');
    if (fill) fill.style.width = Math.round(((state.idx + 1) / TOTAL) * 100) + '%';

    // advance control
    var actions = app.querySelector('[data-actions]');
    var next = app.querySelector('[data-next]');
    var last = state.idx === TOTAL - 1;
    next.innerHTML = last
      ? 'See your standing' + ICON.arrow
      : 'Next verse' + ICON.arrow;
    next.addEventListener('click', function () {
      if (last) {
        renderResult();
      } else {
        state.idx++;
        renderQuestion();
      }
    });
    actions.hidden = false;
    focus(next);
  }

  function renderResult() {
    var ratio = TOTAL ? state.score / TOTAL : 0;
    var rank = rankFor(ratio);

    var ladder = RANKS.slice().reverse().map(function (r) {
      var here = r.key === rank.key ? ' is-here' : '';
      return '<li class="rank-' + r.key + here + '">' +
        '<span class="tl-name">' + esc(r.name) + '</span>' +
        (r.key === rank.key ? '<span class="tl-you">You</span>' : '') +
      '</li>';
    }).join('');

    app.innerHTML =
      '<section class="trial-card trial-result rank-' + rank.key + '" aria-labelledby="trial-verdict">' +
        '<span class="trial-hairline is-gold" aria-hidden="true"></span>' +
        '<span class="tr-trophy">' + ICON.trophy + '</span>' +
        '<p class="trial-kicker">The verdict</p>' +
        '<h2 class="trial-h" id="trial-verdict" tabindex="-1">You have proven yourself <em>' + esc(rank.name) + '</em>.</h2>' +
        '<p class="tr-score"><b>' + state.score + '</b> of <b>' + TOTAL + '</b> verses answered true</p>' +
        '<p class="trial-lede">' + esc(rank.blurb) + '</p>' +
        '<ol class="trial-ladder" aria-label="The lexicon ladder, highest to lowest">' + ladder + '</ol>' +
        '<div class="trial-actions">' +
          '<button type="button" class="btn btn-silver" data-again>' + ICON.refresh + 'Take the Trial again</button>' +
          '<a class="btn btn-ghost" href="' + TG + '" target="_blank" rel="noopener">Join the Brethren</a>' +
        '</div>' +
      '</section>';

    var again = app.querySelector('[data-again]');
    again.addEventListener('click', function () {
      newRun();
      renderQuestion();
    });
    focus(app.querySelector('.trial-h'));
  }

  /* --- Focus (skip when reduced motion users prefer no scroll jumps is fine;
         focus() itself is the a11y contract, not motion). ------------------- */
  function focus(el) {
    if (!el) return;
    // let the DOM settle before moving focus
    window.requestAnimationFrame(function () {
      try { el.focus({ preventScroll: reduce }); } catch (e) { el.focus(); }
    });
  }

  renderIntro();
})();

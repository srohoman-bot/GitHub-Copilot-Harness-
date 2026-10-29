(() => {
  'use strict';

  // frame-busting (frame-ancestors cannot be set via <meta> CSP)
  if (window.top !== window.self) {
    document.documentElement.hidden = true;
    try { window.top.location.href = window.self.location.href; } catch (_) { /* cross-origin */ }
    return;
  }

  const SITE_URL = 'https://srohoman-bot.github.io/GitHub-Copilot-Harness-/';
  const KEY = 'ghch.v1';
  const MAX_NOTES = 50, NAME_MAX = 24, MSG_MAX = 140, COOLDOWN_MS = 8000;
  const MAX_CANDLES = 7, ALTAR_MAX = 40, KODEN_UNIT = 1000000;
  const FLOWERS = ['💐', '🌸', '🌼', '🌷', '🥀', '🍙', '🍵', '🍶'];
  const $ = (s) => document.querySelector(s);
  const reduceMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* ---------- i18n (Japanese text lives in the HTML; English here) ---------- */
  const EN = {
    title: 'GitHub Copilot Harness Memorial | R.I.P.',
    description: 'The GitHub Copilot harness is now the Microsoft Copilot harness. An unofficial parody memorial for the old name.',
    skip: 'Skip to content', brand: '🕯 Memorial Hall', sound_label: 'Toggle temple bell sound',
    eyebrow: 'OBITUARY  —  Passed away in 2026 due to a rename',
    dates: 'Birth unknown — 2026 (renamed)',
    epitaph: 'The name changed. The insides… probably did not.',
    cta1: 'Pay respects', cta2: 'Hear the last words', poke: 'Poke the gravestone',
    news_pre: 'Cause of death:',
    words_h: 'Last Words', words_p: 'Witnesses say the deceased typed this into the terminal at the very end.',
    life_h: 'A Life in Review', life_p: '* Embellished. This is a parody.',
    tl1_t: 'Birth', tl1_p: '"Even Copilot needs reins," someone said. And so the harness was born.',
    tl2_t: 'Career', tl2_p: 'Silently held the reins so the AI would not run wild. Rarely thanked.',
    tl3_t: 'The GitHub Era', tl3_p: 'Years beside the Octocat. The name always started with "GitHub".',
    tl4_t: 'The Rename', tl4_p: 'One day, a blog post appeared: "Microsoft Copilot harness". The timeline knew before the harness did.',
    tl5_t: 'Today', tl5_p: 'Name changed, reins still held. The deceased is, in fact, alive.',
    offer_h: 'Offerings', offer_p: 'Press the buttons and remember the old name.',
    local_note: '* Your records are stored only in this browser.',
    candle_h: 'Light a Candle', candle_p: 'Light candles for the old name. Up to 7.',
    candle_btn: 'Light', candle_off: 'Blow out', candle_count: 'Candles lit',
    flower_h: 'Flowers & Offerings', flower_p: 'Choose whatever you like.', altar_label: 'Offering altar', flower_count: 'Offerings',
    f_h: 'Press F to pay respects', f_p: 'You can also press the F key on your keyboard.', f_btn_label: 'Pay respects', f_count: 'Respects paid',
    koden_h: 'Condolence Gift', koden_p: '1 gift = 1,000,000 tokens. * You will not be billed.',
    koden_btn: 'Send a gift', koden_total: 'Total gifts',
    tribute_h: 'Leave a Tribute', tribute_p: 'Write a few words. Posts are stored only in this browser and are not sent to anyone.',
    name_label: 'Name (optional)', name_ph: 'Anonymous mourner', msg_label: 'Tribute', msg_ph: 'e.g. Thank you, GitHub Copilot Harness.',
    send: 'Offer tribute', wall_h: 'Wall of Tributes', wall_note: '* Some tributes are jokes (made up).',
    reborn_h: 'Reincarnation', reborn_p: 'Maybe the deceased has simply been reincarnated.',
    reborn_before: 'Here lies', reborn_after: 'Reincarnated as a Microsoft thing',
    reborn_btn: 'Reincarnate', reborn_back: 'Put back to rest',
    share_h: 'Spread the News', share_p: '#GitHubCopilotHarness #RIP', share_x: 'Post on X', share_copy: 'Copy link', share_native: 'Share…',
    foot_disclaimer: 'This is an unofficial, fan-made parody. Not affiliated with, endorsed by, or sponsored by GitHub or Microsoft. Trademarks belong to their respective owners. The product is alive and well; only the name changed.',
    foot_security: 'No cookies, no trackers, no external requests (CSP blocks outbound connections). What you enter is stored only in your browser\'s localStorage.',
    reset_btn: 'Erase my records on this device'
  };
  const JA = {};
  const JA_ATTR = [];
  document.querySelectorAll('[data-i18n]').forEach((el) => { JA[el.dataset.i18n] = el.textContent; });
  document.querySelectorAll('[data-i18n-attr]').forEach((el) => {
    el.dataset.i18nAttr.split(';').forEach((pair) => {
      const [attr, key] = pair.split(':');
      JA_ATTR.push({ el, attr, key, ja: el.getAttribute(attr) });
    });
  });
  JA.title = document.title;
  const metaDesc = document.querySelector('meta[name="description"]');
  JA.description = metaDesc ? metaDesc.content : '';

  // dynamic strings
  const D = {
    ja: {
      max: 'もう十分明るいです。電気代がかかります。',
      flower: ['花束', '桜', '黄色い花', 'チューリップ', '枯れた花', 'おにぎり', 'お茶', 'お酒'],
      fMilestone: (n) => `${n} 回、敬意が表されました`,
      koden: ['受領しました。請求書は発行されません。', '追加の香典、ありがとうございます。', 'トークンは故人が責任を持って使い切ります。'],
      noteOk: '弔辞を受け付けました。', empty: '弔辞を入力してください。', fast: '少し間を置いてから投稿してください。',
      anon: '匿名の参列者', you: 'あなた', del: '削除',
      copied: 'リンクをコピーしました', copyFail: 'コピーできませんでした',
      quips: ['触らないでください。故人です。', 'Ctrl+Z を試しましたが、改名は取り消せませんでした。', 'ここに眠るのは名前だけです。', '中の人は元気です。', 'git blame したら、犯人は改名でした。', '墓石は意外と軽い。ハリボテです。'],
      share: 'GitHub Copilot Harness は Microsoft Copilot harness に改名しました。ここに追悼を。',
      resetConfirm: 'この端末に保存された記録をすべて消去しますか？', resetDone: '記録を消去しました',
      soundOn: 'お鈴 オン', soundOff: 'お鈴 オフ'
    },
    en: {
      max: 'It is bright enough. Think of the electricity bill.',
      flower: ['Bouquet', 'Cherry blossom', 'Yellow flower', 'Tulip', 'Wilted flower', 'Rice ball', 'Tea', 'Sake'],
      fMilestone: (n) => `${n} respects paid`,
      koden: ['Received. No invoice will be issued.', 'Thank you for the additional gift.', 'The deceased will spend those tokens responsibly.'],
      noteOk: 'Your tribute has been received.', empty: 'Please write a tribute.', fast: 'Please wait a moment before posting again.',
      anon: 'Anonymous mourner', you: 'You', del: 'Delete',
      copied: 'Link copied', copyFail: 'Could not copy',
      quips: ['Please do not touch. The deceased is resting.', 'Tried Ctrl+Z. The rename could not be undone.', 'Only the name is buried here.', 'The insides are fine.', 'git blame says: the rename did it.', 'The gravestone is surprisingly light. It is cardboard.'],
      share: 'The GitHub Copilot harness is now the Microsoft Copilot harness. Pay your respects here.',
      resetConfirm: 'Erase all records stored on this device?', resetDone: 'Records erased',
      soundOn: 'Bell on', soundOff: 'Bell off'
    }
  };
  const TERM = {
    ja: [
      '$ git mv "GitHub Copilot harness" "Microsoft Copilot harness"',
      '$ git commit -m "chore: 改名 (本人は聞いていない)"',
      '[main 7f3a9c2] chore: 改名 (本人は聞いていない)',
      ' 1 file changed, 1 rename(+), 1 identity crisis(-)',
      '$ git push origin main',
      'remote: Resolving deltas: 100% (悲しみ)',
      'remote: 名前が変わりました。筋肉の記憶を更新してください。',
      '$ echo "さようなら、そしてありがとう"',
      'さようなら、そしてありがとう',
      '$ exit 0'
    ],
    en: [
      '$ git mv "GitHub Copilot harness" "Microsoft Copilot harness"',
      '$ git commit -m "chore: rename (nobody asked me)"',
      '[main 7f3a9c2] chore: rename (nobody asked me)',
      ' 1 file changed, 1 rename(+), 1 identity crisis(-)',
      '$ git push origin main',
      'remote: Resolving deltas: 100% (sadness)',
      'remote: Name changed. Please update your muscle memory.',
      '$ echo "So long, and thanks for all the commits"',
      'So long, and thanks for all the commits',
      '$ exit 0'
    ]
  };
  const SEED = [
    { n: { ja: 'Octocat', en: 'Octocat' }, m: { ja: '君のいない GitHub は、触手が一本足りない。', en: 'GitHub feels one tentacle short without you.' } },
    { n: { ja: 'Git', en: 'Git' }, m: { ja: 'ブランチは枯れても、履歴は永遠に残る。reflog で会おう。', en: 'Branches wither, history is forever. See you in the reflog.' } },
    { n: { ja: 'エディタのタブ', en: 'An editor tab' }, m: { ja: '隣のタブで、いつまでも開いて待っています。', en: 'I will keep waiting, open, in the next tab.' } },
    { n: { ja: 'package-lock.json', en: 'package-lock.json' }, m: { ja: 'あなたの改名で、私も 4,000 行書き換わりました。', en: 'Your rename changed 4,000 lines of me.' } },
    { n: { ja: '未解決のコンフリクト', en: 'An unresolved conflict' }, m: { ja: '<<<<<<< 旧名 ======= 新名 >>>>>>> 解決できません', en: '<<<<<<< old name ======= new name >>>>>>> cannot resolve' } },
    { n: { ja: 'Tab キー', en: 'The Tab key' }, m: { ja: 'いつも提案を受け入れてくれて、ありがとう。', en: 'Thanks for always accepting the suggestions.' } },
    { n: { ja: 'Q&A サイト', en: 'Q&A sites' }, m: { ja: 'ライバルでした。今日だけは休戦します。', en: 'We were rivals. Today, a ceasefire.' } }
  ];

  /* ---------- state / storage ---------- */
  const CTRL = /[\u0000-\u001F\u007F-\u009F\u200B-\u200F\u2028\u2029\u202A-\u202E\u2066-\u2069\uFEFF]/g;
  const clean = (s, max) => typeof s === 'string'
    ? Array.from(s.replace(CTRL, ' ').replace(/\s+/g, ' ').trim()).slice(0, max).join('')
    : '';
  const clampInt = (v, max) => (Number.isInteger(v) ? Math.min(Math.max(v, 0), max) : 0);
  const cleanNote = (o) => {
    if (!o || typeof o !== 'object') return null;
    const m = clean(o.m, MSG_MAX);
    return m ? { n: clean(o.n, NAME_MAX), m } : null;
  };
  const defaults = (lang) => ({ lang, candles: 0, flowers: FLOWERS.map(() => 0), f: 0, koden: 0, notes: [] });

  function load() {
    const s = defaults('ja');
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw || raw.length > 100000) return s;
      const o = JSON.parse(raw);
      if (!o || typeof o !== 'object') return s;
      s.lang = o.lang === 'en' ? 'en' : 'ja';
      s.candles = clampInt(o.candles, MAX_CANDLES);
      if (Array.isArray(o.flowers)) s.flowers = FLOWERS.map((_, i) => clampInt(o.flowers[i], 999));
      s.f = clampInt(o.f, 999999);
      s.koden = clampInt(o.koden, 999999);
      if (Array.isArray(o.notes)) s.notes = o.notes.slice(0, MAX_NOTES).map(cleanNote).filter(Boolean);
    } catch (_) { /* corrupted or blocked storage */ }
    return s;
  }
  const state = load();
  const save = () => { try { localStorage.setItem(KEY, JSON.stringify(state)); } catch (_) { /* storage unavailable */ } };
  const t = (k) => D[state.lang][k];

  /* ---------- toast ---------- */
  const toastEl = $('#toast');
  let toastTimer = 0;
  function toast(msg) {
    toastEl.textContent = msg;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2600);
  }

  /* ---------- sound ---------- */
  let soundOn = false, ac = null;
  function bell() {
    if (!soundOn) return;
    try {
      ac = ac || new AudioContext();
      const now = ac.currentTime;
      [1, 2.76, 5.4].forEach((mul, i) => {
        const o = ac.createOscillator(), g = ac.createGain();
        o.type = 'sine';
        o.frequency.value = 330 * mul;
        g.gain.setValueAtTime(0.0001, now);
        g.gain.exponentialRampToValueAtTime(0.25 / (i + 1), now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 3);
        o.connect(g).connect(ac.destination);
        o.start(now);
        o.stop(now + 3.1);
      });
    } catch (_) { /* audio unavailable */ }
  }
  $('#sound').addEventListener('click', () => {
    soundOn = !soundOn;
    $('#sound').setAttribute('aria-pressed', String(soundOn));
    $('#sound-ico').textContent = soundOn ? '🔔' : '🔇';
    toast(t(soundOn ? 'soundOn' : 'soundOff'));
    bell();
  });

  /* ---------- sky + confetti canvas ---------- */
  const cv = $('#sky'), ctx = cv.getContext('2d');
  let W = 0, H = 0, raf = 0;
  const stars = [], petals = [], conf = [];
  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    W = window.innerWidth; H = window.innerHeight;
    cv.width = W * dpr; cv.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    stars.length = 0; petals.length = 0;
    for (let i = 0, n = Math.round((W * H) / 9000); i < n; i++) {
      stars.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 1.4 + .3, p: Math.random() * 6.28, s: Math.random() * 2 + .5 });
    }
    if (!reduceMotion) {
      for (let i = 0; i < 22; i++) {
        petals.push({ x: Math.random() * W, y: Math.random() * H, r: Math.random() * 4 + 3, vy: Math.random() * .6 + .3, ph: Math.random() * 6.28 });
      }
    }
    draw(performance.now());
  }
  function draw(ts) {
    ctx.clearRect(0, 0, W, H);
    for (const s of stars) {
      ctx.globalAlpha = .35 + .65 * Math.abs(Math.sin(ts / 1000 * s.s + s.p));
      ctx.fillStyle = '#fff';
      ctx.beginPath(); ctx.arc(s.x, s.y, s.r, 0, 6.283); ctx.fill();
    }
    ctx.fillStyle = '#ffc2d9';
    for (const p of petals) {
      p.y += p.vy; p.x += Math.sin(ts / 900 + p.ph) * .6;
      if (p.y > H + 10) { p.y = -10; p.x = Math.random() * W; }
      ctx.globalAlpha = .6;
      ctx.beginPath(); ctx.ellipse(p.x, p.y, p.r, p.r * .55, p.ph + ts / 1500, 0, 6.283); ctx.fill();
    }
    for (let i = conf.length - 1; i >= 0; i--) {
      const c = conf[i];
      c.vy += .25; c.x += c.vx; c.y += c.vy; c.rot += c.vr; c.life -= .006;
      if (c.life <= 0 || c.y > H + 20) { conf.splice(i, 1); continue; }
      ctx.save();
      ctx.globalAlpha = Math.min(1, c.life * 2);
      ctx.translate(c.x, c.y); ctx.rotate(c.rot);
      ctx.fillStyle = c.c;
      ctx.fillRect(-c.s / 2, -c.s / 4, c.s, c.s / 2);
      ctx.restore();
    }
    ctx.globalAlpha = 1;
  }
  function loop(ts) { draw(ts); raf = requestAnimationFrame(loop); }
  function startLoop() { cancelAnimationFrame(raf); if (!reduceMotion && !document.hidden) raf = requestAnimationFrame(loop); }
  function confetti(n, colors) {
    if (reduceMotion) return;
    for (let i = 0; i < n; i++) {
      conf.push({
        x: W / 2, y: H * .4, vx: (Math.random() - .5) * 14, vy: -Math.random() * 11 - 3,
        s: 5 + Math.random() * 6, c: colors[i % colors.length], rot: Math.random() * 6, vr: (Math.random() - .5) * .4, life: 1
      });
    }
    if (conf.length > 400) conf.splice(0, conf.length - 400);
  }
  const BRAND_COLORS = ['#f25022', '#7fba00', '#00a4ef', '#ffb900'];
  const PINKS = ['#ffc2d9', '#ffe0ec', '#ff9ec2'];
  window.addEventListener('resize', resize);
  document.addEventListener('visibilitychange', startLoop);

  /* ---------- candles ---------- */
  const candleEls = [];
  for (let i = 0; i < MAX_CANDLES; i++) {
    const c = document.createElement('div');
    c.className = 'candle';
    const f = document.createElement('div');
    f.className = 'flame';
    c.append(f);
    $('#candles').append(c);
    candleEls.push(c);
  }
  $('#candle-btn').addEventListener('click', () => {
    if (state.candles >= MAX_CANDLES) { toast(t('max')); return; }
    state.candles++; save(); renderCounts(); bell();
  });
  $('#candle-off').addEventListener('click', () => { state.candles = 0; save(); renderCounts(); });

  /* ---------- flowers / altar ---------- */
  const altar = $('#altar');
  function offerEl(i, drop) {
    const s = document.createElement('span');
    s.className = drop ? 'offer' : 'offer still';
    s.textContent = FLOWERS[i];
    return s;
  }
  function renderAltar() {
    altar.replaceChildren();
    FLOWERS.forEach((_, i) => { for (let k = 0; k < Math.min(state.flowers[i], 8); k++) altar.append(offerEl(i, false)); });
    while (altar.children.length > ALTAR_MAX) altar.firstChild.remove();
  }
  const flowerBtns = FLOWERS.map((e, i) => {
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'flower-btn'; b.textContent = e;
    b.addEventListener('click', () => {
      state.flowers[i] = Math.min(state.flowers[i] + 1, 999);
      save();
      altar.append(offerEl(i, true));
      while (altar.children.length > ALTAR_MAX) altar.firstChild.remove();
      renderCounts();
    });
    $('#flower-btns').append(b);
    return b;
  });

  /* ---------- F / koden ---------- */
  const fx = $('#fx');
  function payRespects() {
    state.f = Math.min(state.f + 1, 999999); save(); renderCounts();
    if (fx.children.length < 60) {
      const s = document.createElement('span');
      s.className = 'float-f'; s.textContent = 'F';
      s.style.left = (5 + Math.random() * 90) + 'vw';
      s.style.setProperty('--r', (Math.random() * 60 - 30) + 'deg');
      fx.append(s);
      setTimeout(() => s.remove(), 2600);
    }
    if (state.f % 10 === 0) toast(t('fMilestone')(state.f));
  }
  $('#f-btn').addEventListener('click', payRespects);
  document.addEventListener('keydown', (e) => {
    if (e.repeat || e.ctrlKey || e.metaKey || e.altKey || typeof e.key !== 'string' || e.key.toLowerCase() !== 'f') return;
    const el = e.target;
    if (el instanceof HTMLElement && (el.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(el.tagName))) return;
    payRespects();
  });
  $('#koden-btn').addEventListener('click', () => {
    state.koden = Math.min(state.koden + 1, 999999); save(); renderCounts(); bell();
    const q = t('koden');
    toast(q[state.koden % q.length]);
  });

  /* ---------- counters ---------- */
  function renderCounts() {
    candleEls.forEach((c, i) => c.classList.toggle('lit', i < state.candles));
    $('#c-candle').textContent = state.candles;
    $('#c-flower').textContent = state.flowers.reduce((a, b) => a + b, 0);
    $('#c-f').textContent = state.f;
    $('#c-koden').textContent = new Intl.NumberFormat(state.lang === 'en' ? 'en-US' : 'ja-JP').format(state.koden * KODEN_UNIT);
  }

  /* ---------- tribute wall ---------- */
  const wall = $('#wall');
  function noteEl(name, msg, mineIdx) {
    const a = document.createElement('article');
    a.className = mineIdx === null ? 'note' : 'note mine';
    a.style.setProperty('--tilt', ((msg.length % 5) - 2) * .6 + 'deg');
    const p = document.createElement('p');
    p.className = 'note-msg'; p.textContent = msg;
    const by = document.createElement('p');
    by.className = 'note-by';
    if (mineIdx !== null) {
      const tag = document.createElement('span');
      tag.className = 'tag'; tag.textContent = t('you');
      by.append(tag);
      const del = document.createElement('button');
      del.type = 'button'; del.className = 'del'; del.textContent = '×';
      del.setAttribute('aria-label', t('del'));
      del.addEventListener('click', () => { state.notes.splice(mineIdx, 1); save(); renderWall(); });
      a.append(del);
    }
    by.append('— ' + (name || t('anon')));
    a.append(p, by);
    return a;
  }
  function renderWall() {
    const frag = document.createDocumentFragment();
    state.notes.forEach((n, i) => frag.append(noteEl(n.n, n.m, i)));
    SEED.forEach((s) => frag.append(noteEl(s.n[state.lang], s.m[state.lang], null)));
    wall.replaceChildren(frag);
  }
  const nameIn = $('#t-name'), msgIn = $('#t-msg');
  msgIn.addEventListener('input', () => { $('#msg-count').textContent = Array.from(msgIn.value).length; });
  let lastPost = 0;
  $('#tribute-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const now = Date.now();
    if (now - lastPost < COOLDOWN_MS) { toast(t('fast')); return; }
    const m = clean(msgIn.value, MSG_MAX);
    if (!m) { toast(t('empty')); msgIn.focus(); return; }
    lastPost = now;
    state.notes.unshift({ n: clean(nameIn.value, NAME_MAX), m });
    state.notes.length = Math.min(state.notes.length, MAX_NOTES);
    save(); renderWall();
    msgIn.value = ''; $('#msg-count').textContent = '0';
    toast(t('noteOk')); bell(); confetti(50, PINKS);
  });

  /* ---------- reincarnation ---------- */
  const card = $('#reborn-card'), truck = $('#truck');
  let reborn = false;
  $('#reborn-btn').addEventListener('click', () => {
    reborn = !reborn;
    card.dataset.reborn = String(reborn);
    if (!reborn) return;
    bell(); confetti(160, BRAND_COLORS);
    if (!reduceMotion) {
      truck.classList.remove('go'); void truck.offsetWidth; truck.classList.add('go');
      truck.addEventListener('animationend', () => truck.classList.remove('go'), { once: true });
    }
  });

  /* ---------- gravestone ---------- */
  let quip = 0;
  const stone = $('#stone');
  function poke() {
    const q = t('quips');
    toast(q[quip++ % q.length]);
    stone.classList.remove('shake'); void stone.offsetWidth; stone.classList.add('shake');
  }
  $('#poke').addEventListener('click', poke);
  stone.addEventListener('click', poke);

  /* ---------- terminal ---------- */
  const termOut = $('#term-out');
  let termTimer = 0, termStarted = false;
  function typeTerminal(instant) {
    clearInterval(termTimer);
    const text = TERM[state.lang].join('\n');
    if (instant || reduceMotion) { termOut.textContent = text; return; }
    let i = 0;
    termOut.textContent = '';
    termTimer = setInterval(() => {
      i += 2;
      termOut.textContent = text.slice(0, i);
      if (i >= text.length) clearInterval(termTimer);
    }, 24);
  }
  if ('IntersectionObserver' in window) {
    const io = new IntersectionObserver((entries) => {
      if (entries.some((en) => en.isIntersecting)) { io.disconnect(); termStarted = true; typeTerminal(false); }
    }, { threshold: .4 });
    io.observe($('#words'));
  } else { termStarted = true; typeTerminal(true); }

  /* ---------- share ---------- */
  function renderShare() {
    $('#share-x').href = 'https://x.com/intent/post?text=' + encodeURIComponent(t('share')) +
      '&url=' + encodeURIComponent(SITE_URL) + '&hashtags=' + encodeURIComponent('GitHubCopilotHarness,RIP');
  }
  $('#share-copy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(SITE_URL); toast(t('copied')); } catch (_) { toast(t('copyFail')); }
  });
  if (navigator.share) {
    const b = $('#share-native');
    b.hidden = false;
    b.addEventListener('click', () => { navigator.share({ title: document.title, text: t('share'), url: SITE_URL }).catch(() => {}); });
  }

  /* ---------- language ---------- */
  function applyLang(lang) {
    state.lang = lang;
    const dict = lang === 'en' ? EN : JA;
    document.documentElement.lang = lang;
    document.title = dict.title;
    if (metaDesc) metaDesc.content = dict.description;
    document.querySelectorAll('[data-i18n]').forEach((el) => {
      const v = dict[el.dataset.i18n];
      if (typeof v === 'string') el.textContent = v;
    });
    JA_ATTR.forEach((a) => {
      const v = lang === 'en' ? EN[a.key] : a.ja;
      if (typeof v === 'string') a.el.setAttribute(a.attr, v);
    });
    $('#lang-ja').setAttribute('aria-pressed', String(lang === 'ja'));
    $('#lang-en').setAttribute('aria-pressed', String(lang === 'en'));
    flowerBtns.forEach((b, i) => { const l = t('flower')[i]; b.title = l; b.setAttribute('aria-label', l); });
    renderCounts(); renderWall(); renderShare();
    if (termStarted) typeTerminal(true);
  }
  $('#lang-ja').addEventListener('click', () => { applyLang('ja'); save(); });
  $('#lang-en').addEventListener('click', () => { applyLang('en'); save(); });

  /* ---------- reset ---------- */
  $('#reset').addEventListener('click', () => {
    if (!window.confirm(t('resetConfirm'))) return;
    try { localStorage.removeItem(KEY); } catch (_) { /* ignore */ }
    Object.assign(state, defaults(state.lang));
    renderAltar(); renderCounts(); renderWall();
    toast(t('resetDone'));
  });

  /* ---------- init ---------- */
  resize();
  startLoop();
  renderAltar();
  applyLang(state.lang);
})();

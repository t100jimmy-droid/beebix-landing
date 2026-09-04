/* ═══════════════════════════════════════════════════════════
   BeeBix Landing — 互動與動效 v2
   零依賴、純原生。所有動畫只動 transform / opacity / clip-path。
   捲動事件統一走單一 rAF 迴圈，避免多個 listener 互相搶幀。
   ═══════════════════════════════════════════════════════════ */
(() => {
'use strict';

const $  = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const clamp = (v, a, b) => v < a ? a : v > b ? b : v;
const lerp  = (a, b, t) => a + (b - a) * t;
const REDUCED = matchMedia('(prefers-reduced-motion: reduce)').matches;
const COARSE  = matchMedia('(pointer: coarse)').matches;
const ARW = '<i class="card-arw"></i>';

/* ═════ 單一捲動迴圈：所有需要逐幀更新的東西掛在這 ═════ */
const onFrame = [];
let ticking = false, lastY = scrollY, velocity = 0;
const tick = () => {
  ticking = false;
  const y = scrollY;
  velocity = lerp(velocity, y - lastY, .25);
  lastY = y;
  for (const fn of onFrame) fn(y, velocity);
};
addEventListener('scroll', () => {
  if (!ticking) { ticking = true; requestAnimationFrame(tick); }
}, { passive:true });
// 速度需要持續衰減，否則停止捲動後殘留
setInterval(() => { if (Math.abs(velocity) > .1) { velocity *= .85; tick(); } }, 60);

let relabelCells = () => {};   // 由 cellGrid() 指派
let arcGoTo   = () => {};      // 由 arc() 指派：把第 i 張卡轉到正中央
let offerShow = () => {};      // 由 offer() 指派：切到第 i 個方案

/* ═════ 可重建區塊的清理登記 ═════
   切語系會重跑 arc()/soon()，舊的計時器／監聽器／onFrame 必須先收掉，否則每切一次疊一組。 */
const disposers = {};
const dispose  = k => { (disposers[k] || []).forEach(fn => fn()); disposers[k] = []; };
const onDispose= (k, fn) => { (disposers[k] = disposers[k] || []).push(fn); };
const frame    = (k, fn) => { onFrame.push(fn);
  onDispose(k, () => { const i = onFrame.indexOf(fn); if (i > -1) onFrame.splice(i, 1); }); };
const listen   = (k, tgt, ev, fn, opt) => { tgt.addEventListener(ev, fn, opt);
  onDispose(k, () => tgt.removeEventListener(ev, fn, opt)); };
const every    = (k, ms, fn) => { const id = setInterval(fn, ms); onDispose(k, () => clearInterval(id)); };

/* ═════ 0 · 多語系 ═════ */
const STORE_KEY = 'beebix-lang';
let LANG = 'en';

// 找不到 key 就原字串回傳，方便漸進導入
const t = k => (I18N[k] && I18N[k][LANG]) || (I18N[k] && I18N[k].en) || k;

const pickInitialLang = () => {
  try { const saved = localStorage.getItem(STORE_KEY);
        if (saved && LANGS.some(l => l.code === saved)) return saved; } catch(e){}
  const nav = (navigator.language || 'en').toLowerCase();
  if (nav.startsWith('zh')) return 'zh';
  if (nav.startsWith('th')) return 'th';
  return 'en';
};

const applyI18n = () => {
  $$('[data-i18n]').forEach(el => {
    const v = t(el.dataset.i18n);
    if (el.textContent !== v) el.textContent = v;
  });
  const meta = LANGS.find(l => l.code === LANG);
  document.documentElement.lang = meta ? meta.htmlLang : LANG;
  document.documentElement.dataset.lang = LANG;
  const cur = $('.lang-cur');
  if (cur) cur.textContent = meta ? meta.short : LANG.toUpperCase();
  $$('.lang-menu button').forEach(b =>
    b.setAttribute('aria-selected', String(b.dataset.lang === LANG)));
  const tt = $('.to-top'); if (tt) tt.setAttribute('aria-label', t('ui.toTop'));
  const bg = $('.burger');  if (bg) bg.setAttribute('aria-label', t('ui.menu'));
  const cx = $('.cm-x');    if (cx) cx.setAttribute('aria-label', t('cm.close'));
  const hint = $('.drag-hint'); if (hint) hint.textContent = t(COARSE ? 'ui.swipe' : 'ui.drag');
};

// 切換語系：先更新靜態文字，再重建由 JS 產生的區塊
let rebuilders = [];
const setLang = code => {
  if (code === LANG) return;
  LANG = code;
  try { localStorage.setItem(STORE_KEY, code); } catch(e){}
  applyI18n();
  rebuilders.forEach(fn => fn());
  applyI18n();
};

function langSwitcher(){
  const wrap = $('.lang-wrap'); if (!wrap) return;
  const btn = $('.lang', wrap), menu = $('.lang-menu', wrap);
  menu.innerHTML = LANGS.map(l =>
    `<button type="button" role="option" data-lang="${l.code}"
             aria-selected="${l.code===LANG}">${l.label}</button>`).join('');
  const close = () => { wrap.classList.remove('open'); btn.setAttribute('aria-expanded','false'); };
  btn.addEventListener('click', e => {
    e.stopPropagation();
    const open = wrap.classList.toggle('open');
    btn.setAttribute('aria-expanded', String(open));
  });
  menu.addEventListener('click', e => {
    const b = e.target.closest('button[data-lang]');
    if (!b) return;
    setLang(b.dataset.lang); close();
  });
  addEventListener('click', close);
  addEventListener('keydown', e => { if (e.key === 'Escape') close(); });
}

/* ═════ 1 · 導覽列（隱藏／展開／scrollspy）═════ */
function nav(){
  const h = $('#header');
  let last = 0;
  onFrame.push(y => {
    h.classList.toggle('is-hidden',
      y > 240 && y > last + 2 && !document.body.classList.contains('nav-open'));
    h.classList.toggle('is-scrolled', y > 40);      // 離開頂端後玻璃收緊
    if (Math.abs(y - last) > 2) last = y;
  });

  $('.burger').addEventListener('click', () => document.body.classList.toggle('nav-open'));
  $$('.nav-links a').forEach(a => a.addEventListener('click', () => document.body.classList.remove('nav-open')));

  $$('.has-menu > button').forEach(b => b.addEventListener('click', () => {
    if (innerWidth > 1024) return;
    const open = b.getAttribute('aria-expanded') === 'true';
    b.setAttribute('aria-expanded', String(!open));
    b.parentElement.classList.toggle('open', !open);
  }));

  const HEADER_GAP = 96;                       // 固定導覽列高度 + 呼吸空間
  document.addEventListener('click', e => {
    const a = e.target.closest('a[href^="#"]');
    if (!a) return;
    const id = a.getAttribute('href');
    if (id === '#'){ e.preventDefault(); return; }   // 佔位連結：不要跳回頁頂
    const t = $(id);
    if (!t) return;
    e.preventDefault();
    scrollTo({ top: t.getBoundingClientRect().top + scrollY - HEADER_GAP, behavior: REDUCED ? 'auto' : 'smooth' });
    if (location.hash !== id) history.pushState(null, '', id);   // 讓上一頁／分享網址有意義
    // 深連結：捲到區塊後，把對應的卡片／方案帶到前面
    if (a.dataset.arc   !== undefined) arcGoTo(+a.dataset.arc);
    if (a.dataset.offer !== undefined) offerShow(+a.dataset.offer);
  });
  // 用上一頁／下一頁回到某個 hash 時也對齊到導覽列下方
  addEventListener('popstate', () => {
    const t = location.hash && $(location.hash);
    if (t) scrollTo({ top: t.getBoundingClientRect().top + scrollY - HEADER_GAP, behavior:'auto' });
  });
  addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    document.body.classList.remove('nav-open');
    $$('.has-menu.open').forEach(li => { li.classList.remove('open'); $('button', li).setAttribute('aria-expanded', 'false'); });
  });
  addEventListener('click', e => {
    if (!e.target.closest('.has-menu')) $$('.has-menu.open').forEach(li => {
      li.classList.remove('open'); $('button', li).setAttribute('aria-expanded', 'false'); });
  });

  /* scrollspy：標示目前所在區塊 */
  const links = $$('.nav-links a[href^="#"]');
  const sections = $$('main > section[id]');
  const parents  = $$('.nav-links .has-menu > button');
  if (sections.length) onFrame.push(y => {
    const mid = y + innerHeight * .35;
    let sec = null;
    for (const s of sections){ if (s.getBoundingClientRect().top + y <= mid) sec = s; }
    const id = sec ? '#' + sec.id : null;
    const hit = id ? links.find(a => a.getAttribute('href') === id) : null;
    links.forEach(a => a.classList.toggle('current', a === hit));
    // 子選單裡的連結命中時，點亮它的父按鈕（Games / Discover）
    parents.forEach(b => b.classList.toggle('current', !!hit && b.parentElement.contains(hit)));
  });
}

/* ═════ 2 · 進場：區塊淡入 + 標題逐行遮罩揭示 ═════ */
function reveals(){
  /* 顯示層級的大標，逐行用 clip-path 揭開 */
  const LINE_SEL = '.ghost .gl, .split-title span, .split-title em, .cta-title span, .hero-title span';
  $$(LINE_SEL).forEach(el => el.classList.add('rv-line'));

  const io = new IntersectionObserver(es => {
    es.forEach(e => {
      if (!e.isIntersecting) return;
      io.unobserve(e.target);
      const el = e.target;
      // 同一個標題內的行，依序錯開
      const lines = $$('.rv-line', el);
      if (lines.length){
        lines.forEach((l, i) => setTimeout(() => l.classList.add('in'), REDUCED ? 0 : i * 130));
        setTimeout(() => el.classList.add('in'), 0);
      } else {
        el.classList.add('in');
      }
    });
  }, { threshold:.01, rootMargin:'0px 0px -40px 0px' });

  $$('[data-reveal]').forEach(el => io.observe(el));

  // 沒有被 data-reveal 包住的獨立行（例如 hero 標題在 lockup 內）
  const lineIO = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    lineIO.unobserve(e.target);
    e.target.classList.add('in');
  }), { threshold:.01, rootMargin:'0px 0px -40px 0px' });
  $$('.rv-line').forEach(l => { if (!l.closest('[data-reveal]')) lineIO.observe(l); });
}

/* ═════ 3 · HERO 進場編排（依序而非同時）═════ */
function heroChoreo(){
  if (REDUCED) return;
  const seq = [
    ['.hero .eyebrow',      0],
    ['.hero-title .l1',   140],
    ['.hero-title .l2',   260],
    ['.brand-plate',      420],
    ['.bolt-streak',      520],
    ['.hero-sub',         640],
    ['.hero-stats',       740]
  ];
  seq.forEach(([sel, d]) => {
    const el = $(sel);
    if (!el) return;
    setTimeout(() => { el.classList.add('in'); }, 260 + d);
  });
  // 卡片依序滑入
  setTimeout(() => {
    $$('.hero-cards-run .hcard').forEach((c, i) => {
      c.style.transition = 'opacity .7s var(--e-out), transform .8s var(--e-out)';
      c.style.opacity = '0';
      c.style.transform = 'translateY(40px)';
      requestAnimationFrame(() => setTimeout(() => {
        c.style.opacity = '1'; c.style.transform = 'none';
      }, i * 110));
    });
  }, 40);
}

/* ═════ 4 · 跑馬燈（速度隨捲動微幅變化）═════ */
function marquees(){
  const anims = [];
  $$('.marquee-run').forEach(run => {
    run.innerHTML += run.innerHTML;                 // 複製一份 → translateX(-50%) 無縫
    if (REDUCED) return;
    anims.push(run.animate(
      [{ transform:'translateX(0)' }, { transform:'translateX(-50%)' }],
      { duration: (+run.dataset.speed || 34) * 1000, iterations: Infinity, easing:'linear' }
    ));
  });
  // 刻意「不」隨捲動變速：跑馬燈維持等速。
  // 速度隨捲動起伏會讓文字讀起來在飄；穩定的等速才像正常的 ticker。
}


/* 依標題決定卡片該去哪：輪播有 → 作品區並轉到那張；Offer 有 → 方案區並切到那項 */
const linkFor = title => FEATURED.some(g => g.t === title) ? '#games'
                       : OFFER.some(o => o.t === title)    ? '#offer' : '#games';
const dataFor = title => {
  const i = FEATURED.findIndex(g => g.t === title); if (i >= 0) return ` data-arc="${i}"`;
  const j = OFFER.findIndex(o => o.t === title);    if (j >= 0) return ` data-offer="${j}"`;
  return '';
};
/* ═════ 5 · HERO 卡片 ═════ */
function hero(){
  const viewport = $('#heroCards');
  if (!viewport) return;

  const card = g => `
    <a class="hcard" href="${linkFor(g.t)}"${dataFor(g.t)} aria-label="${g.t}">
      <div class="hcard-media spot">
        <img class="bg" src="${g.bg}" alt="" loading="lazy">
        <img class="hcard-char" src="${g.ch}" alt="" loading="lazy">
        <span class="hcard-tag">${t(g.tag)}</span>
        <div class="hcard-veil"></div>
        <div class="hcard-foot"><h3>${g.t}</h3>${ARW}</div>
      </div>
    </a>`;

  // 內層才是被動畫的軌道；複製一份讓 translateX(-50%) 無縫接回
  const run = document.createElement('div');
  run.className = 'hero-cards-run';
  const html = HERO.map(card).join('');
  run.innerHTML = html + html;
  viewport.replaceChildren(run);

  if (REDUCED) return;

  // 12 張 × 每張約 5.2 秒 → 一輪約 62 秒，速度沉穩不搶戲
  const anim = run.animate(
    [{ transform:'translateX(0)' }, { transform:'translateX(-50%)' }],
    { duration: HERO.length * 5200, iterations: Infinity, easing:'linear' }
  );

  // 滑入時平滑停下，滑出再平滑回復（不是硬切）
  let rate = 1, target = 1, raf = 0;
  const step = () => {
    raf = 0;
    rate = lerp(rate, target, .12);
    if (Math.abs(rate - target) < .01) rate = target;
    anim.playbackRate = rate;
    if (rate !== target) raf = requestAnimationFrame(step);
  };
  const setTarget = v => { target = v; if (!raf) raf = requestAnimationFrame(step); };
  viewport.addEventListener('pointerenter', () => setTarget(0));
  viewport.addEventListener('pointerleave', () => setTarget(1));
  viewport.addEventListener('focusin',  () => setTarget(0));
  viewport.addEventListener('focusout', () => setTarget(1));
}

/* ═════ 6 · 橫幅雙軌跑道 ═════ */
function lanes(){
  const build = (el, list) => {
    if (!el) return;
    const html = list.map(src => `<img src="${src}" alt="" loading="lazy">`).join('');
    el.innerHTML = html + html;
    if (REDUCED) return;
    const dir = +(el.dataset.dir || 1);
    const dur = +(el.dataset.speed || 46);
    const anim = el.animate(
      dir > 0
        ? [{ transform:'translateX(0)' },    { transform:'translateX(-50%)' }]
        : [{ transform:'translateX(-50%)' }, { transform:'translateX(0)' }],
      { duration: dur * 1000, iterations: Infinity, easing:'linear' }
    );
    return anim;
  };
  const a = build($('#laneA'), LANE_A);
  const b = build($('#laneB'), LANE_B);
  if (REDUCED || !a || !b) return;
  // 捲動速度帶動跑道速度
  let rate = 1;
  onFrame.push((y, v) => {
    // 上限收到 1.35 倍且大幅平滑：只是很淡的呼應，不會讓人覺得在飄
    rate = lerp(rate, clamp(1 + Math.abs(v) / 90, 1, 1.35), .08);
    a.playbackRate = rate; b.playbackRate = rate;
  });
}

/* ═════ 7 · 精選作品：弧形輪播（含觸控滑動）═════ */
function arc(){
  const el = $('#arc'), stage = $('#arcStage'), dots = $('#arcDots');
  if (!el || !stage) return;
  dispose('arc');
  $$('.drag-hint, .arc-nav', el).forEach(n => n.remove());

  stage.innerHTML = FEATURED.map(g => `
    <a class="gcard" href="#games" data-i="${FEATURED.indexOf(g)}" aria-label="${g.t}">
      <div class="gcard-in spot">
        <img src="${g.img}" alt="" loading="eager" decoding="async">
        <span class="gcard-tag">${t(g.tag)}</span>
        <div class="gcard-veil"></div>
        <!-- 圖上本來就有遊戲 logo，這裡不再重複標題，只留箭頭 -->
        <div class="gcard-foot">${ARW}</div>
      </div>
    </a>`).join('');

  const hint = document.createElement('span');
  hint.className = 'drag-hint';
  hint.textContent = t(COARSE ? 'ui.swipe' : 'ui.drag');
  el.appendChild(hint);

  const cards = $$('.gcard', stage);
  const N = cards.length;
  dots.innerHTML = cards.map((_, i) =>
    `<button type="button" aria-label="${t('ui.gameNo').replace('{n}', i + 1)}"></button>`).join('');
  const dotEls = $$('button', dots);

  let STEP = 6.0, RADIUS = 2600, SPAN = 2.6;
  const measure = () => {
    const w = innerWidth;
    RADIUS = w < 720 ? 1500 : w < 1100 ? 2000 : 2600;
    STEP   = w < 720 ? 8.6  : w < 1100 ? 7.0  : 6.0;
    SPAN   = w < 720 ? 1.6  : w < 1100 ? 2.2  : 2.6;
    cards.forEach(c => c.style.transformOrigin = `50% ${-RADIUS}px`);
  };
  const wrap = d => { d = (d + N * 1.5) % N; return d > N / 2 ? d - N : d; };

  let cur = 0, goal = 0, dragging = false, startX = 0, startGoal = 0, raf = 0, vel = 0;

  const paint = () => {
    raf = 0;
    const prev = cur;
    cur = lerp(cur, goal, REDUCED ? 1 : .12);
    vel = cur - prev;
    if (Math.abs(goal - cur) < .0008) cur = goal;

    cards.forEach((c, i) => {
      const d = wrap(i - cur), ad = Math.abs(d);
      if (ad > SPAN + .6){ c.style.visibility = 'hidden'; return; }
      c.style.visibility = 'visible';
      c.style.transform = `rotate(${d * STEP}deg)`;
      c.style.opacity   = String(clamp(1 - Math.max(0, ad - SPAN + .8) * 1.1, 0, 1));
      c.style.zIndex    = String(100 - Math.round(ad * 10));
      c.classList.toggle('is-active', ad < .5);
      // 拖曳時卡片依速度微傾，放手回正
      const inner = c.firstElementChild;
      if (inner && !REDUCED) inner.style.rotate = `${clamp(-vel * 26, -7, 7)}deg`;
    });

    const active = ((Math.round(cur) % N) + N) % N;
    dotEls.forEach((d, i) => {
      d.classList.toggle('on', i === active);
      d.setAttribute('aria-current', i === active ? 'true' : 'false');
    });
    if (cur !== goal) raf = requestAnimationFrame(paint);
  };
  const kick = () => { if (!raf) raf = requestAnimationFrame(paint); };
  const go = v => { goal = v; kick(); };
  arcGoTo = i => { pause(6000); go(goal + wrap(i - goal)); };
  listen('arc', stage, 'click', e => {
    const c = e.target.closest('.gcard'); if (!c) return;
    e.preventDefault(); e.stopPropagation();        // 卡片本身不再捲動頁面
    if (moved) return;                              // 拖曳結束的那一下不算點擊
    if (!c.classList.contains('is-active')) arcGoTo(+c.dataset.i);
  }, true);

  const arcPx = () => (RADIUS * STEP * Math.PI) / 180;

  let moved = false;                            // 這一次按下後是否真的拖過（> 6px）
  listen('arc', el, 'pointerdown', e => {
    dragging = true; startX = e.clientX; startGoal = goal; moved = false; el.classList.remove('dragged');
    el.classList.add('drag', 'touched'); el.setPointerCapture(e.pointerId);
  });
  listen('arc', el, 'pointermove', e => {
    if (!dragging) return;
    if (Math.abs(e.clientX - startX) > 6){ moved = true; el.classList.add('dragged'); }
    go(startGoal - (e.clientX - startX) / arcPx());
  });
  const end = e => {
    if (!dragging) return;
    dragging = false; el.classList.remove('drag');
    // 依甩動速度多帶一格，手感更自然
    const flick = clamp(-vel * 9, -1.6, 1.6);
    go(Math.round(goal + flick));
    if (e && e.pointerId != null && el.hasPointerCapture(e.pointerId)) el.releasePointerCapture(e.pointerId);
  };
  listen('arc', el, 'pointerup', end);
  listen('arc', el, 'pointercancel', end);
  listen('arc', el, 'click', e => { if (Math.abs(goal - startGoal) > .04) e.preventDefault(); }, true);

  listen('arc', el, 'wheel', e => {
    if (Math.abs(e.deltaX) <= Math.abs(e.deltaY)) return;
    e.preventDefault(); e.stopPropagation();
    go(goal + e.deltaX / 220);
  }, { passive:false });

  dotEls.forEach((d, i) => d.addEventListener('click', () => go(goal + wrap(i - goal))));
  el.setAttribute('tabindex', '0');
  el.setAttribute('role', 'group');
  el.setAttribute('aria-label', t('ui.arcLabel'));
  listen('arc', el, 'keydown', e => {
    if (e.key === 'ArrowLeft'){ e.preventDefault(); go(Math.round(goal) - 1); }
    if (e.key === 'ArrowRight'){ e.preventDefault(); go(Math.round(goal) + 1); }
  });

  /* ── 自動輪播：緩慢自己前進，任何互動都先讓路 ── */
  let hold = 0, inView = false, entered = false;
  const AUTO_MS = 4200;
  const pause = (ms = 5200) => { hold = performance.now() + ms; };
  every('arc', AUTO_MS, () => {
    if (REDUCED || document.hidden || dragging || !inView) return;
    if (performance.now() < hold) return;
    go(Math.round(goal) + 1);
  });

  // 滑到／點到／用鍵盤時暫停，離開後才接手
  ['pointerenter','pointerdown','focusin','wheel'].forEach(ev =>
    listen('arc', el, ev, () => pause(), { passive:true }));
  listen('arc', el, 'pointerleave', () => pause(1200), { passive:true });

  /* ── 左右切換按鈕 ── */
  const navBtn = dir => {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = 'arc-nav arc-nav--' + (dir < 0 ? 'prev' : 'next');
    b.setAttribute('aria-label', t(dir < 0 ? 'ui.prev' : 'ui.next'));
    b.innerHTML = '<i></i>';
    b.addEventListener('click', e => {
      e.preventDefault(); e.stopPropagation();
      pause(); go(Math.round(goal) + dir);
    });
    // 按鈕本身不要觸發輪播的拖曳
    b.addEventListener('pointerdown', e => e.stopPropagation());
    return b;
  };
  el.append(navBtn(-1), navBtn(1));

  listen('arc', window, 'resize', () => { measure(); cur = goal; paint(); });
  measure();
  const io = new IntersectionObserver(es => es.forEach(e => {
    inView = e.isIntersecting;
    if (e.isIntersecting && !entered){ entered = true; cur = -2.4; go(0); pause(2600); }
  }), { threshold:.2 });
  io.observe(el);
  onDispose('arc', () => { io.disconnect(); if (raf) cancelAnimationFrame(raf); });
  paint();
}

/* ═════ 8 · 即將上線：雙欄無限直向輪播 ═════
   外層 .soon-col 吃捲動視差，內層 .soon-run 跑自己的無限迴圈，
   兩者分開才不會互相蓋掉 transform。 */
function soon(){
  const host = $('#soonCols');
  if (!host) return;
  dispose('soon');

  const tile = g => `<article class="soon-tile spot">
      <div class="st-art"><img src="${g.img}" alt="" loading="eager" decoding="async">
        <span class="st-shine"></span></div>
      <span class="d">${g.d}</span><span class="n">${g.t}</span>
    </article>`;

  // 每欄的內容複製一份 → 位移剛好一份的高度就能無縫接回
  host.innerHTML = [0, 1].map(c => {
    const items = SOON.filter((_, i) => i % 2 === c);
    const run = items.map(tile).join('');
    return `<div class="soon-col" data-sp="${c ? -1 : 1}">
              <div class="soon-run" data-dir="${c ? -1 : 1}">${run}${run}</div>
            </div>`;
  }).join('');

  const cols = $$('.soon-col', host), sec = $('#soon');
  if (REDUCED) return;

  /* 捲動視差（外層）*/
  frame('soon', () => {
    const r = sec.getBoundingClientRect();
    if (r.bottom < -200 || r.top > innerHeight + 200) return;
    const p = clamp((innerHeight - r.top) / (innerHeight + r.height), 0, 1) - .5;
    cols.forEach(c => { c.style.transform = `translate3d(0,${p * 90 * +c.dataset.sp}px,0)`; });
  });

  /* 無限直向輪播（內層）*/
  const runs = $$('.soon-run', host);
  const anims = [];
  const startLoop = () => {
    anims.forEach(a => a.cancel()); anims.length = 0;
    runs.forEach(run => {
      const tiles = $$('.soon-tile', run);
      if (tiles.length < 2) return;
      const gap = parseFloat(getComputedStyle(run).rowGap) || 0;
      const half = tiles.length / 2;                       // 一份的張數
      // 一份的高度 = 最後一張的底 - 第一張的頂 + 一個 gap
      const top  = tiles[0].offsetTop;
      const dist = tiles[half].offsetTop - top;            // 第二份第一張的位移即為一份高度
      if (!dist) return;
      const dir = +run.dataset.dir;                        // 1 往上跑、-1 往下跑
      const from = dir > 0 ? 0 : -dist, to = dir > 0 ? -dist : 0;
      const a = run.animate(
        [{ transform:`translateY(${from}px)` }, { transform:`translateY(${to}px)` }],
        { duration: dist * 34, iterations: Infinity, easing:'linear' });
      anims.push(a);
      // 滑到該欄就慢慢停下來，離開再慢慢加速
      const ramp = target => {
        const step = () => {
          const r = a.playbackRate, d = target - r;
          a.playbackRate = Math.abs(d) < .04 ? target : r + d * .18;
          if (a.playbackRate !== target) requestAnimationFrame(step);
        };
        step();
      };
      run.addEventListener('pointerenter', () => ramp(0),  { passive:true });
      run.addEventListener('pointerleave', () => ramp(1),  { passive:true });
      run.addEventListener('focusin',      () => ramp(0));
      run.addEventListener('focusout',     () => ramp(1));
    });
  };
  // 圖片載完高度才準
  const imgs = $$('.soon-tile img', host);
  let left = imgs.filter(i => !i.complete).length;
  if (!left) startLoop();
  else imgs.forEach(i => i.complete || i.addEventListener('load', () => { if (!--left) startLoop(); }, { once:true }));
  let rt;
  listen('soon', window, 'resize', () => { clearTimeout(rt); rt = setTimeout(startLoop, 250); });
  onDispose('soon', () => { clearTimeout(rt); anims.forEach(a => a.cancel()); anims.length = 0; });
}

/* ═════ 8b · 路線圖左欄：游標視差 + 標題掃光 ═════ */
function soonCopy(){
  const copy = $('.soon-copy'), sec = $('#soon');
  if (!copy || !sec || REDUCED || COARSE) return;
  let tx = 0, ty = 0, cx = 0, cy = 0;
  sec.addEventListener('pointermove', e => {
    const r = sec.getBoundingClientRect();
    tx = ((e.clientX - r.left) / r.width  - .5) * 16;
    ty = ((e.clientY - r.top)  / r.height - .5) * 12;
  }, { passive:true });
  sec.addEventListener('pointerleave', () => { tx = ty = 0; }, { passive:true });
  // 只在還沒追上目標值時跑，靜止就讓 rAF 停下來
  let running = false;
  const step = () => {
    cx = lerp(cx, tx, .08); cy = lerp(cy, ty, .08);
    copy.style.transform = `translate3d(${cx.toFixed(2)}px,${cy.toFixed(2)}px,0)`;
    if (Math.abs(tx - cx) > .05 || Math.abs(ty - cy) > .05) requestAnimationFrame(step);
    else running = false;
  };
  const kickCopy = () => { if (!running){ running = true; requestAnimationFrame(step); } };
  sec.addEventListener('pointermove',  kickCopy, { passive:true });
  sec.addEventListener('pointerleave', kickCopy, { passive:true });
}

/* ═════ 9 · 服務項目：清單 ↔ 預覽卡（含鍵盤）═════ */
function offer(){
  const list = $('#offerList'), card = $('#offerCard');
  if (!list || !card) return;

  list.setAttribute('role', 'tablist');
  list.innerHTML = OFFER.map((o, i) => `
    <li${i === 0 ? ' class="on"' : ''} role="presentation">
      <button type="button" role="tab" aria-selected="${i === 0}"
              tabindex="${i === 0 ? 0 : -1}"><span class="n">${o.n}</span>${t(o.t)}</button>
    </li>`).join('');

  const bg = $('.oc-bg', card), ch = $('.oc-char', card);
  const txt = $('#ocText'), cta = $('#ocCta span');
  const btns = $$('button', list);
  let idx = -1, timer = 0, hoverTimer = 0;

  const show = i => {
    if (i === idx) return;
    idx = i;
    const o = OFFER[i];
    $$('li', list).forEach((li, k) => {
      li.classList.toggle('on', k === i);
      const b = $('button', li);
      b.setAttribute('aria-selected', String(k === i));
      b.tabIndex = k === i ? 0 : -1;
    });
    clearTimeout(timer);
    card.classList.add('swap');
    timer = setTimeout(() => {
      bg.src = o.bg; ch.src = o.ch;
      txt.textContent = t(o.d); cta.textContent = t(o.cta);
      card.classList.remove('swap');
    }, REDUCED ? 0 : 240);
  };

  offerShow = show;
  btns.forEach((b, i) => {
    b.addEventListener('click', () => show(i));
    // hover intent：停留 90ms 才切換，避免滑過閃爍
    b.addEventListener('mouseenter', () => {
      if (innerWidth <= 1024) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => show(i), 90);
    });
    b.addEventListener('mouseleave', () => clearTimeout(hoverTimer));
    b.addEventListener('focus', () => show(i));
    b.addEventListener('keydown', e => {
      let n = null;
      if (e.key === 'ArrowDown' || e.key === 'ArrowRight') n = (i + 1) % btns.length;
      if (e.key === 'ArrowUp'   || e.key === 'ArrowLeft')  n = (i - 1 + btns.length) % btns.length;
      if (e.key === 'Home') n = 0;
      if (e.key === 'End')  n = btns.length - 1;
      if (n === null) return;
      e.preventDefault(); btns[n].focus();
    });
  });
  show(0);
}

/* ═════ 10 · 清單內容 ═════ */
function lists(){
  const caps = $('#capsList');
  if (caps) caps.innerHTML = CAPS.map(([k, v]) =>
    `<li><span class="k">${t(k)}</span><span class="v">${t(v)}</span></li>`).join('');

  const proof = $('#proofList');
  if (proof) proof.innerHTML = PROOF.map(([k, v]) =>
    `<li><i class="dot"></i><span class="k">${t(k)}</span><span class="v">${t(v)}</span></li>`).join('');

  const stats = $('#statsList');
  if (stats) stats.innerHTML = STATS.map(s =>
    `<li class="spot${s.hero ? ' is-hero' : ''}">`
    + `<b data-count="${s.n}" data-suffix="${s.suffix}">${s.n.toLocaleString()}${s.suffix}</b>`
    + `<span>${t(s.label)}</span></li>`).join('');
}

/* ═════ 10a · 聯絡彈窗：行動型連結一律開這裡；區塊導覽不受影響 ═════ */
const CM_TRIGGER = '.btn, .btn-ghost, a[href^="mailto:"], a[href="#"], .hcard, .gcard.is-active';
const CM_ICON = {
  email:'<svg viewBox="0 0 24 24" aria-hidden="true"><rect x="3" y="5" width="18" height="14" rx="3"/><path d="M3 7l9 6 9-6"/></svg>',
  tg:   '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M21 4L3 11l6 2.5L11 20l3-4 5 3z"/><path d="M9 13.5l10-8"/></svg>',
  wa:   '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M12 3a9 9 0 0 0-7.7 13.6L3 21l4.5-1.2A9 9 0 1 0 12 3z"/><path d="M9 9.5c0 3 2.5 5.5 5.5 5.5l1.2-1.4-1.9-.9-.9.8a4 4 0 0 1-2.3-2.3l.8-.9-.9-1.9z"/></svg>'
};
function contactModal(){
  const cm = $('#contactModal'); if (!cm) return;
  const panel = $('.cm-panel', cm), list = $('#cmList'), re = $('#cmRe'), reLabel = $('#cmReLabel');
  list.innerHTML = CONTACTS.map(c => `
    <li class="cm-row">
      <span class="cm-ico" aria-hidden="true">${CM_ICON[c.k] || ''}</span>
      <span class="cm-txt"><span class="cm-k" data-i18n="${c.label}">${t(c.label)}</span><b class="cm-v">${c.handle}</b></span>
      <span class="cm-act">
        ${c.url ? `<a class="cm-btn cm-btn--ghost" href="${c.url}" target="_blank" rel="noopener" data-i18n="cm.open">${t('cm.open')}</a>` : ''}
        <button class="cm-btn" type="button" data-copy="${c.handle}"><span data-i18n="cm.copy">${t('cm.copy')}</span></button>
      </span>
    </li>`).join('');

  let opener = null, closeTimer = 0;
  const focusables = () => $$('a[href], button:not([disabled])', panel);
  const open = label => {
    opener = document.activeElement;
    if (label){ reLabel.textContent = label; re.hidden = false; } else re.hidden = true;
    clearTimeout(closeTimer);
    cm.hidden = false; document.documentElement.classList.add('cm-open');
    requestAnimationFrame(() => { cm.classList.add('on'); (focusables()[0] || panel).focus(); });
  };
  const close = () => {
    if (cm.hidden) return;
    cm.classList.remove('on'); document.documentElement.classList.remove('cm-open');
    closeTimer = setTimeout(() => { cm.hidden = true; if (opener && opener.focus) opener.focus(); }, REDUCED ? 0 : 320);
  };

  // 觸發：任何行動型連結（彈窗內部的按鈕除外）。用 capture 搶在錨點捲動處理之前。
  document.addEventListener('click', e => {
    if (e.target.closest('.cm')) return;
    const trig = e.target.closest(CM_TRIGGER); if (!trig) return;
    if (trig.closest('.arc.dragged')) return;            // 拖曳結束落在中央卡上，不算點擊
    e.preventDefault(); e.stopPropagation();
    const label = (trig.getAttribute('aria-label') || trig.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 40);
    open(label);
  }, true);

  cm.addEventListener('click', e => { if (e.target.closest('[data-cm-close]')) close(); });
  addEventListener('keydown', e => {
    if (cm.hidden) return;
    if (e.key === 'Escape'){ e.preventDefault(); close(); return; }
    if (e.key === 'Tab'){                                  // 焦點只在彈窗內循環
      const f = focusables(); if (!f.length) return;
      const i = f.indexOf(document.activeElement);
      if (e.shiftKey && i <= 0){ e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && i === f.length - 1){ e.preventDefault(); f[0].focus(); }
    }
  });

  // 複製帳號（clipboard API 失敗時退回 execCommand）
  list.addEventListener('click', async e => {
    const b = e.target.closest('[data-copy]'); if (!b) return;
    const txt = b.dataset.copy; let ok = false;
    try { await navigator.clipboard.writeText(txt); ok = true; }
    catch {
      const ta = document.createElement('textarea'); ta.value = txt;
      ta.style.cssText = 'position:fixed;opacity:0'; document.body.appendChild(ta); ta.select();
      try { ok = document.execCommand('copy'); } catch {} ta.remove();
    }
    if (!ok) return;
    const span = $('span', b); span.textContent = t('cm.copied'); b.classList.add('is-done');
    setTimeout(() => { span.textContent = t('cm.copy'); b.classList.remove('is-done'); }, 1600);
  });
}

/* ═════ 10b · 遊戲區陣容速覽（數字全部由資料算出，不寫死）═════ */
function lineupMeta(){
  const box = $('.lineup'); if (!box) return;
  const types = new Set(HERO.map(h => h.tag)).size;
  const vals = [FEATURED.length, SOON.length, types];
  $$('.lineup-reads b', box).forEach((b, i) => {
    b.dataset.count = vals[i]; b.textContent = vals[i].toLocaleString();
  });
}

/* ═════ 11 · 數字滾動 ═════ */
function counters(){
  const io = new IntersectionObserver(es => es.forEach(e => {
    if (!e.isIntersecting) return;
    io.unobserve(e.target);
    const el = e.target, to = +el.dataset.count, suf = el.dataset.suffix || '';
    if (REDUCED){ el.textContent = to.toLocaleString() + suf; return; }
    const t0 = performance.now(), D = 1600;
    const step = t => {
      const p = clamp((t - t0) / D, 0, 1);
      const e2 = 1 - Math.pow(1 - p, 4);           // 更緩的收尾
      el.textContent = Math.round(to * e2).toLocaleString() + suf;
      if (p < 1) requestAnimationFrame(step);
    };
    requestAnimationFrame(step);
  }), { threshold:.4 });
  $$('[data-count]').forEach(el => io.observe(el));
}

/* ═════ 12 · 通用視差 ═════ */
function parallax(){
  const els = $$('[data-parallax]');
  if (!els.length || REDUCED) return;
  onFrame.push(() => {
    els.forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.bottom < 0 || r.top > innerHeight) return;
      const p = (innerHeight - r.top) / (innerHeight + r.height) - .5;
      el.style.transform = `translate3d(0,${p * +el.dataset.parallax}px,0)`;
    });
  });
}

/* ═════ 13 · HERO 捲動視差（大標與浮水印不同速）═════ */
function heroParallax(){
  if (REDUCED) return;
  const title = $('.hero-lockup'), wm = $('.hero-watermark'),
        sub = $('.hero-sub'), stats = $('.hero-stats');
  if (!title) return;
  onFrame.push(y => {
    if (y > 1100) return;
    const p = y / 1000;
    title.style.transform = `translate3d(0,${p * -70}px,0)`;
    if (wm)    wm.style.transform    = `translate3d(0,${p * 40}px,0)`;
    if (sub)   sub.style.transform   = `translate3d(0,${p * -34}px,0)`;
    if (stats) stats.style.transform = `translate3d(0,${p * -50}px,0)`;
  });
}

/* ═════ 14 · 卡片聚光燈 + 微傾斜 ═════ */
function spotlight(){
  if (REDUCED || COARSE) return;
  const bind = el => {
    el.addEventListener('pointermove', e => {
      const r = el.getBoundingClientRect();
      const mx = (e.clientX - r.left) / r.width;
      const my = (e.clientY - r.top) / r.height;
      el.style.setProperty('--mx', (mx * 100).toFixed(1) + '%');
      el.style.setProperty('--my', (my * 100).toFixed(1) + '%');
      if (el.classList.contains('hcard-media') || el.classList.contains('gcard-in')){
        el.style.transform =
          `rotateX(${((.5 - my) * 7).toFixed(2)}deg) rotateY(${((mx - .5) * 9).toFixed(2)}deg)`;
      }
    });
    el.addEventListener('pointerleave', () => { el.style.transform = ''; });
  };
  $$('.spot').forEach(bind);
}

/* ═════ 15 · 磁吸箭頭 ═════ */
function magnetic(){
  if (REDUCED || COARSE) return;
  $$('.btn, .hcard, .gcard').forEach(host => {
    const arw = $('.arw, .card-arw', host);
    if (!arw) return;
    host.addEventListener('pointermove', e => {
      const r = arw.getBoundingClientRect();
      const dx = e.clientX - (r.left + r.width / 2);
      const dy = e.clientY - (r.top + r.height / 2);
      const d = Math.hypot(dx, dy);
      if (d > 160) { arw.style.translate = ''; return; }
      const k = (1 - d / 160) * .34;
      arw.style.translate = `${(dx * k).toFixed(1)}px ${(dy * k).toFixed(1)}px`;
    });
    host.addEventListener('pointerleave', () => { arw.style.translate = ''; });
  });
}

/* ═════ 16 · 捲動進度條 + 回到頂端 ═════ */
function chrome(){
  const bar = document.createElement('div');
  bar.className = 'progress';
  document.body.appendChild(bar);

  const top = document.createElement('button');
  top.className = 'to-top';
  top.type = 'button';
  top.setAttribute('aria-label', '回到頁面頂端');
  document.body.appendChild(top);
  top.addEventListener('click', () =>
    scrollTo({ top:0, behavior: REDUCED ? 'auto' : 'smooth' }));

  onFrame.push(y => {
    const max = document.documentElement.scrollHeight - innerHeight;
    bar.style.transform = `scaleX(${max > 0 ? clamp(y / max, 0, 1) : 0})`;
    top.classList.toggle('on', y > innerHeight * 1.2);
  });
}

/* ═════ 17 · HERO 背景方格（波浪起伏 + 游標感應）═════ */
function cellGrid(){
  const host = $('#hero');
  if (!host) return;
  const WORDS = 50;
  // 用格子座標雜湊選詞：同一格永遠是同一個字，相鄰格不會重複
  const wordIdx = (r, c) => ((r * 7 + c * 13) % WORDS) + 1;

  const grid = document.createElement('div');
  grid.className = 'cell-grid';
  grid.setAttribute('aria-hidden', 'true');
  // 必須排在 .backdrop 之後 —— backdrop 是不透明漸層，會把方格整片蓋掉
  const bd = host.querySelector('.backdrop');
  if (bd && bd.nextSibling) host.insertBefore(grid, bd.nextSibling);
  else host.appendChild(grid);

  let cells = [], cols = 0, rows = 0;
  let ptLayer = null;
  let said = null;                 // 目前正在浮字的那一格（relabelCells 也要讀）

  const build = () => {
    const w = host.clientWidth, h = host.clientHeight;
    if (!w || !h) return;

    /* 蜂窩排列（尖頂六角形）—— 幾何與 assets/img/honeycomb.svg 對齊：
       寬 W、高 H = W·2/√3，水平間距 W+gap，垂直間距 0.75H+gap，奇數列右移半格。
       交錯列沒辦法用 CSS grid 表達，所以逐格絕對定位。 */
    const small = w <= 720;
    const W  = small ? 36 : 54;
    const H  = Math.round(W * 2 / Math.sqrt(3));      // 36→42, 54→62
    const PX = W + (small ? 3 : 4);                   // 39 / 58
    const PY = Math.round(H * 0.75) + (small ? 3 : 4);// 35 / 51

    cols = Math.ceil(w / PX) + 1;                     // +1 讓奇數列右移後仍蓋滿右緣
    rows = Math.ceil(h / PY) + 1;
    const x0 = (w - cols * PX) / 2;                   // 置中，左右溢出量相同
    const y0 = (h - rows * PY) / 2;

    const frag = document.createDocumentFragment();
    for (let r = 0; r < rows; r++){
      for (let c = 0; c < cols; c++){
        const cell = document.createElement('span');
        cell.className = 'cell';
        cell.style.left = (x0 + c * PX + (r & 1 ? PX / 2 : 0) - W / 2 + PX / 2).toFixed(1) + 'px';
        cell.style.top  = (y0 + r * PY - H / 2 + PY / 2).toFixed(1) + 'px';
        // 兩道波：位移走正對角、明暗走反對角，交錯出有機起伏
        // 負值 → 一載入就已在進行中，不會全部從同一相位開始
        cell.style.setProperty('--d1', `-${((c + r) * 0.09).toFixed(2)}s`);
        cell.style.setProperty('--d2', `-${((r - c + cols) * 0.14).toFixed(2)}s`);
        cell.dataset.wi = wordIdx(r, c);
        cell.dataset.w  = t('word.' + cell.dataset.wi);
        frag.appendChild(cell);
      }
    }
    grid.replaceChildren(frag);
    if (wordEl)  grid.appendChild(wordEl);       // replaceChildren 會清掉這兩層，補回來
    if (ptLayer) grid.appendChild(ptLayer);
    cells = $$('.cell', grid).map(el => ({ el, x:0, y:0, p:0, hot:false }));
    requestAnimationFrame(cache);
  };

  // 切語系只換字串，不動 DOM 結構（450 格重建太貴）
  relabelCells = () => {
    for (const c of cells) c.el.dataset.w = t('word.' + c.el.dataset.wi);
    if (said && wordEl) wordEl.textContent = t('word.' + said.el.dataset.wi);
  };

  // 快取每格中心點，pointermove 時就不必再讀版面
  const cache = () => {
    const gb = grid.getBoundingClientRect();
    cells.forEach(c => {
      const r = c.el.getBoundingClientRect();
      c.x = r.left - gb.left + r.width / 2;
      c.y = r.top  - gb.top  + r.height / 2;
    });
  };

  /* ── 觸碰時浮現的字：整個網格只用一個節點，跟著游標所在格移動 ──
     不做成 .cell::after，因為格子本身有 opacity 波動動畫，字會跟著忽明忽暗 */
  const wordEl = document.createElement('b');
  wordEl.className = 'cell-word';
  wordEl.setAttribute('aria-hidden', 'true');
  grid.appendChild(wordEl);

  /* ── 觸碰粒子 ── */
  ptLayer = document.createElement('div');
  ptLayer.className = 'cell-particles';
  grid.appendChild(ptLayer);
  let alive = 0, lastEmit = 0;
  const emit = (x, y) => {
    if (alive >= 34) return;                       // 同時存活上限，避免堆積
    const n = 1 + (Math.random() < .45 ? 1 : 0);
    for (let i = 0; i < n; i++){
      const pt = document.createElement('i');
      pt.className = 'pt';
      pt.style.left = (x - 2) + 'px';
      pt.style.top  = (y - 2) + 'px';
      ptLayer.appendChild(pt);
      alive++;
      const a = Math.random() * Math.PI * 2;
      const dist = 26 + Math.random() * 54;
      const anim = pt.animate([
        { transform:'translate(0,0) scale(1)',   opacity:.9 },
        { transform:`translate(${(Math.cos(a)*dist).toFixed(1)}px,`
                  + `${(Math.sin(a)*dist - 14).toFixed(1)}px) scale(.2)`, opacity:0 }
      ], { duration: 620 + Math.random() * 420, easing:'cubic-bezier(.16,1,.3,1)' });
      anim.onfinish = () => { pt.remove(); alive--; };
      anim.oncancel = () => { pt.remove(); alive--; };
    }
  };

  if (!REDUCED && !COARSE){
    const R = 170, R2 = R * R;
    let raf = 0, mx = -9999, my = -9999;
    const paint = () => {
      raf = 0;
      let best = 0, near = null;
      for (const c of cells){
        const dx = c.x - mx, dy = c.y - my;
        const d2 = dx * dx + dy * dy;
        let p = 0;
        if (d2 < R2){ const d = Math.sqrt(d2) / R; p = (1 - d) * (1 - d); }  // 二次衰減，邊緣更柔
        if (Math.abs(p - c.p) > .01){
          c.p = p;
          c.el.style.setProperty('--p', p.toFixed(3));
          // 昂貴的 color-mix / calc 只掛在附近這十幾格上
          const hot = p > .004;
          if (hot !== c.hot){ c.hot = hot; c.el.classList.toggle('hot', hot); }
        }
        if (c.p > best){ best = c.p; near = c; }
      }
      // 只認游標正下方那一格，避免一次跳出十幾個詞
      const say = best > .58 ? near : null;
      if (say !== said){
        said = say;
        if (say){
          wordEl.textContent = t('word.' + say.el.dataset.wi);
          wordEl.style.transform = `translate3d(${say.x.toFixed(1)}px,${say.y.toFixed(1)}px,0) translate(-50%,-50%)`;
          wordEl.classList.add('on');
        } else {
          wordEl.classList.remove('on');
        }
      }
    };
    host.addEventListener('pointermove', e => {
      const gb = grid.getBoundingClientRect();
      mx = e.clientX - gb.left; my = e.clientY - gb.top;
      if (!raf) raf = requestAnimationFrame(paint);
      const now = performance.now();
      if (now - lastEmit > 55){ lastEmit = now; emit(mx, my); }   // 節流，避免每幀都生
    });
    host.addEventListener('pointerleave', () => {
      mx = my = -9999;
      if (!raf) raf = requestAnimationFrame(paint);
    });
  }

  build();
  let rt = 0;
  addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(build, 220); });
}

/* ═════ 11 · 區塊 01 的遙測面板 ═════
   語意對應標題：階梯線＝「數學要準」(離散、可量)，平滑曲線＝「美術要動」(連續、流動)。
   波形一次畫兩倍寬、只位移一倍寬 → 走完剛好接回原點，無縫且零逐幀運算。
   數字是示意值，不是真實指標。 */
function aboutViz(){
  const viz = $('.viz'); if (!viz) return;
  const plot = $('.viz-plot', viz), cv = $('.viz-cv', viz);
  if (!cv) return;
  const ctx = cv.getContext('2d');
  const YEL = '#FFC700', GRY = '#9A9AA2';

  /* ── 畫布尺寸（跟語言寬度連動）── */
  let W = 0, H = 0;
  const size = () => {
    const dpr = Math.min(devicePixelRatio || 1, 2);
    W = plot.clientWidth; H = plot.clientHeight;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  };
  size();
  new ResizeObserver(() => { size(); prime(); if (REDUCED) draw(clock); }).observe(plot);

  /* ── 兩種物理，各自的節奏 ──
     A 彈跳球：重力 + 落地反彈（能量每次打八折），彈不動了就補一腳 → 弧線一次比一次矮，再突然拉高
     B 彈簧  ：欠阻尼振盪 a = -k·x - c·v，衰到快停時再激發一次 → 正弦慢慢收斂，再猛地張開 */
  const A = { y: 1, v: 0 };                       // 0 = 地面, 1 = 頂
  const B = { x: 0, v: 5.2 };                     // 位移（-1..1）
  const G = 4.6, REST = 0.80, KICK = 3.05;        // 重力／反彈係數／補力初速（單位：高度/秒）
  const K = 21, C = 0.62, SPRING_KICK = 5.2;
  const stepA = dt => {
    A.v -= G * dt; A.y += A.v * dt;
    if (A.y <= 0){ A.y = 0; A.v = -A.v * REST; if (A.v < 0.9) A.v = KICK; }
    if (A.y > 1){ A.y = 1; A.v = -Math.abs(A.v) * 0.5; }
  };
  const stepB = dt => {
    const acc = -K * B.x - C * B.v;
    B.v += acc * dt; B.x += B.v * dt;
    if (Math.abs(B.x) < 0.05 && Math.abs(B.v) < 0.45) B.v = SPRING_KICK * (B.v < 0 ? -1 : 1);
  };
  const PAD = 10;
  const yA = () => H - PAD - A.y * (H - PAD * 2);
  const yB = () => H / 2 - B.x * (H * 0.33);

  /* ── 軌跡：線頭固定在 70% 寬，舊樣本往左流 ── */
  const SPEED = 64;                               // px/s
  const headX = () => W * 0.70;
  const trA = [], trB = [];                       // {t, y}
  const keep = () => headX() / SPEED + 0.6;       // 線頭到左緣需要的秒數（多留一點給淡出區）

  /* ── 粒子 ── */
  const sparks = []; const rings = []; const hits = [];     // hits：留在軌跡上的命中標記 {t, y}
  let hitCount = 0, emoPeak = 0;
  const rd = { hit: $('[data-viz="hit"]', viz), emo: $('[data-viz="emo"]', viz), vol: $('[data-viz="vol"]', viz) };
  const burst = (x, y, big) => {
    const n = big ? 22 : 11;
    for (let i = 0; i < n; i++){
      const a = Math.random() * Math.PI * 2, sp = (big ? 90 : 60) * (0.35 + Math.random());
      sparks.push({ x, y, vx: Math.cos(a) * sp - SPEED * 0.6, vy: Math.sin(a) * sp - 20,
                    life: 0, ttl: 0.55 + Math.random() * 0.5, r: big ? 1.6 + Math.random() * 1.4 : 1 + Math.random(),
                    c: Math.random() < 0.72 ? YEL : '#FFFFFF' });
    }
    rings.push({ x, y, life: 0, ttl: big ? 0.6 : 0.42, big });
  };

  let last = 0, prevSign = 0, lastCross = -1, visible = false, raf = 0;
  let clock = 0, primed = false;                 // 模擬時鐘（ms）；primed＝已用真實寬度預跑過
  new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; if (visible) kick(); }),
    { threshold: 0 }).observe(viz);

  const draw = now => {
    if (!W || !H) return;
    ctx.clearRect(0, 0, W, H);
    const hx = headX();
    // 背景淡網格：跟著軌跡往左流，有「時間在走」的感覺
    ctx.save();
    ctx.strokeStyle = 'rgba(255,255,255,.055)'; ctx.lineWidth = 1; ctx.setLineDash([2, 6]);
    const gx = 44, off = (now / 1000 * SPEED) % gx;
    for (let x = -off; x <= W; x += gx){ ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, H); ctx.stroke(); }
    ctx.setLineDash([]);
    ctx.strokeStyle = 'rgba(255,255,255,.07)';
    [0.25, 0.5, 0.75].forEach(f => { ctx.beginPath(); ctx.moveTo(0, H * f); ctx.lineTo(W, H * f); ctx.stroke(); });
    ctx.restore();

    const path = (tr, style) => {
      ctx.save(); ctx.beginPath();
      let first = true;
      for (const s of tr){
        const x = hx - (now - s.t) / 1000 * SPEED;
        if (x < -4) continue;
        if (first){ ctx.moveTo(x, s.y); first = false; } else ctx.lineTo(x, s.y);
      }
      style(); ctx.stroke(); ctx.restore();
    };
    // 灰：虛線（離散）
    path(trA, () => { ctx.strokeStyle = GRY; ctx.lineWidth = 1.4; ctx.globalAlpha = .75; ctx.setLineDash([4, 5]); ctx.lineJoin = 'round'; });
    // 黃：實線＋光暈（連續）
    path(trB, () => { ctx.strokeStyle = YEL; ctx.lineWidth = 2.2; ctx.lineJoin = 'round'; ctx.shadowColor = 'rgba(255,199,0,.55)'; ctx.shadowBlur = 10; });

    // 線頭光點
    const ya = trA.length ? trA[trA.length - 1].y : yA(), yb = trB.length ? trB[trB.length - 1].y : yB();
    ctx.save();
    ctx.fillStyle = GRY; ctx.beginPath(); ctx.arc(hx, ya, 2.2, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = YEL; ctx.shadowColor = YEL; ctx.shadowBlur = 12; ctx.beginPath(); ctx.arc(hx, yb, 3, 0, Math.PI * 2); ctx.fill();
    ctx.restore();

    // 命中標記：留在交叉點上、跟著軌跡往左流、越舊越淡
    for (const h of hits){
      const x = hx - (now - h.t) / 1000 * SPEED; if (x < -6) continue;
      const age = (now - h.t) / 1000, k = Math.max(0.18, 1 - age / 7);
      ctx.save(); ctx.globalAlpha = k; ctx.strokeStyle = YEL; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.arc(x, h.y, 3.2, 0, Math.PI * 2); ctx.stroke();
      ctx.fillStyle = 'rgba(255,199,0,.35)'; ctx.beginPath(); ctx.arc(x, h.y, 1.4, 0, Math.PI * 2); ctx.fill();
      ctx.restore();
    }
    // 粒子與環
    for (const p of sparks){
      const k = 1 - p.life / p.ttl; ctx.globalAlpha = Math.max(0, k);
      ctx.fillStyle = p.c; ctx.beginPath(); ctx.arc(p.x, p.y, p.r * (0.5 + k * 0.5), 0, Math.PI * 2); ctx.fill();
    }
    ctx.globalAlpha = 1;
    for (const r of rings){
      const k = r.life / r.ttl; ctx.globalAlpha = (1 - k) * 0.9;
      ctx.strokeStyle = YEL; ctx.lineWidth = r.big ? 1.6 : 1.1;
      ctx.beginPath(); ctx.arc(r.x, r.y, 3 + k * (r.big ? 26 : 16), 0, Math.PI * 2); ctx.stroke();
    }
    ctx.globalAlpha = 1;
  };

  const setRead = (el, txt) => {
    if (!el || el.textContent === txt) return;
    el.textContent = txt; el.classList.remove('tick'); void el.offsetWidth; el.classList.add('tick');
  };
  const step = (now, fixedDt) => {
    let dt = fixedDt != null ? fixedDt : (last ? (now - last) / 1000 : 1 / 60); last = now;
    dt = Math.min(dt, 0.05);
    clock += dt * 1000;
    stepA(dt); stepB(dt);
    const a = yA(), b = yB();
    trA.push({ t: clock, y: a }); trB.push({ t: clock, y: b });
    const cut = clock - keep() * 1000;
    while (trA.length && trA[0].t < cut) trA.shift();
    while (trB.length && trB[0].t < cut) trB.shift();
    while (hits.length && hits[0].t < cut) hits.shift();
    emoPeak = Math.max(Math.abs(B.x), emoPeak * 0.985);   // 情緒峰值：慢慢回落的包絡
    if (fixedDt == null && (clock - (step.lastRead || 0)) > 160){
      step.lastRead = clock;
      setRead(rd.hit, String(hitCount));
      setRead(rd.emo, Math.round(Math.min(1, emoPeak) * 100) + '%');
      setRead(rd.vol, Math.round(A.y * 100) + '%');
    }

    // 交叉偵測：兩條線頭的高低關係翻轉的那一幀就是交叉瞬間
    const sign = Math.sign(a - b);
    if (prevSign && sign && sign !== prevSign && clock - lastCross > 420){
      lastCross = clock;
      const y = (a + b) / 2;
      burst(headX(), y, Math.abs(y - H / 2) < H * 0.12);   // 在正中央交會＝「完美交叉」，放大招
      hits.push({ t: clock, y }); hitCount++;
      cv.dataset.cross = String(hitCount);
    }
    prevSign = sign;

    // 粒子物理：微重力、阻力、跟著軌跡往左飄
    for (const p of sparks){ p.life += dt; p.vy += 110 * dt; p.vx *= 0.985; p.vy *= 0.985; p.x += p.vx * dt; p.y += p.vy * dt; }
    for (let i = sparks.length - 1; i >= 0; i--) if (sparks[i].life >= sparks[i].ttl) sparks.splice(i, 1);
    for (const r of rings) r.life += dt;
    for (let i = rings.length - 1; i >= 0; i--) if (rings[i].life >= rings[i].ttl) rings.splice(i, 1);
    draw(clock);
  };

  const preroll = () => {
    for (let t = 0; t < keep(); t += 1 / 60) step(0, 1 / 60);
    sparks.length = 0; rings.length = 0; last = 0;
  };
  const prime = () => { if (!primed && W > 0){ primed = true; preroll(); if (REDUCED) draw(clock); } };
  const loop = now => {
    raf = 0;
    if (!visible || document.hidden) { last = 0; return; }
    if (!primed){ size(); prime(); if (!primed){ raf = requestAnimationFrame(loop); return; } }
    step(now); raf = requestAnimationFrame(loop);
  };
  const kick = () => { if (!raf && !REDUCED) raf = requestAnimationFrame(loop); };
  document.addEventListener('visibilitychange', () => { if (!document.hidden) kick(); });

  prime();                                        // 一載入就量得到寬度的話，先把軌跡跑滿
  if (!REDUCED) kick();

}

/* ═════ 12 · 蜂窩底紋的觸碰效果 ═════
   底層持續平移；亮層是同一組蜂窩，用跟著游標的圓形遮罩讓附近的格子亮起來。
   兩層必須共用同一條時間軸，否則格子會對不齊 —— 用 startTime 明確對齊。 */
function combHover(){
  const pairs = $$('.banner-comb--hot').map(hot => ({
    hot, run: hot.querySelector('.comb-run'),
    base: hot.previousElementSibling, sec: hot.closest('.sec')
  })).filter(p => p.run && p.base && p.base.classList.contains('banner-comb') && p.sec);
  if (!pairs.length) return;

  for (const p of pairs){
    // 對齊兩層的動畫起點
    const [ba] = p.base.getAnimations(), [ha] = p.run.getAnimations();
    if (ba && ha && ba.startTime != null) ha.startTime = ba.startTime;

    if (REDUCED) continue;
    let raf = 0, x = 0, y = 0;
    const paint = () => {
      raf = 0;
      // 亮層外框與區塊同尺寸，座標可以直接用
      p.hot.style.setProperty('--hx', x.toFixed(0) + 'px');
      p.hot.style.setProperty('--hy', y.toFixed(0) + 'px');
    };
    p.sec.addEventListener('pointermove', e => {
      const r = p.sec.getBoundingClientRect();
      x = e.clientX - r.left; y = e.clientY - r.top;
      p.hot.classList.add('on');
      if (!raf) raf = requestAnimationFrame(paint);
    }, { passive:true });
    p.sec.addEventListener('pointerleave', () => {
      p.hot.classList.remove('on');
    }, { passive:true });
  }
}

/* ═════ 圖片預熱 ═════
   輪播卡片用 lazy 載入以免拖慢首屏，但輪播一直在跑，
   等首屏跑完再趁瀏覽器閒置把剩下的圖抓回來，避免轉到一半是空卡。 */
function warmImages(){
  const urls = [];
  HERO.forEach(g => { urls.push(g.bg, g.ch); });
  OFFER.forEach(g => { urls.push(g.bg, g.ch); });
  const uniq = [...new Set(urls)];
  let i = 0;
  const idle = window.requestIdleCallback || (fn => setTimeout(() => fn({timeRemaining:()=>8}), 200));
  const step = deadline => {
    while (i < uniq.length && (deadline.timeRemaining() > 4 || deadline.didTimeout)) {
      const im = new Image(); im.decoding = 'async'; im.src = uniq[i++];
    }
    if (i < uniq.length) idle(step, { timeout: 1500 });
  };
  idle(step, { timeout: 1500 });
}

/* ═════ 啟動 ═════ */
const boot = () => {
  LANG = pickInitialLang();
  langSwitcher();

  nav(); contactModal(); marquees(); hero(); lanes(); lists();
  arc(); soon(); soonCopy(); offer(); lineupMeta(); counters(); parallax(); aboutViz(); combHover();
  heroParallax(); spotlight(); magnetic(); chrome(); cellGrid();
  reveals(); heroChoreo();

  // 切換語系時要重建的區塊（內含由 JS 產生的文字）
  rebuilders = [() => { hero(); lists(); arc(); soon(); offer(); spotlight(); magnetic(); relabelCells(); }];

  applyI18n();
  requestAnimationFrame(() => document.body.classList.add('ready'));
  tick();

  // 首屏渲染完才開始預熱，不跟關鍵資源搶頻寬
  if (document.readyState === 'complete') setTimeout(warmImages, 900);
  else addEventListener('load', () => setTimeout(warmImages, 900), { once:true });
};
document.readyState === 'loading' ? addEventListener('DOMContentLoaded', boot) : boot();
})();

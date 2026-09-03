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

  $$('a[href^="#"]').forEach(a => a.addEventListener('click', e => {
    const id = a.getAttribute('href');
    if (id.length < 2) return;
    const t = $(id);
    if (!t) return;
    e.preventDefault();
    scrollTo({ top: t.getBoundingClientRect().top + scrollY - 96, behavior: REDUCED ? 'auto' : 'smooth' });
  }));

  /* scrollspy：標示目前所在區塊 */
  const links = $$('.nav-links a[href^="#"]');
  const targets = links.map(a => ({ a, el: $(a.getAttribute('href')) })).filter(x => x.el);
  if (targets.length) onFrame.push(y => {
    const mid = y + innerHeight * .35;
    let cur = null;
    for (const t of targets) {
      const top = t.el.getBoundingClientRect().top + y;
      if (top <= mid) cur = t.a;
    }
    links.forEach(a => a.classList.toggle('current', a === cur));
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

/* ═════ 5 · HERO 卡片 ═════ */
function hero(){
  const viewport = $('#heroCards');
  if (!viewport) return;

  const card = g => `
    <a class="hcard" href="#games" aria-label="${g.t}">
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
    <a class="gcard" href="#games" aria-label="${g.t}">
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

  const arcPx = () => (RADIUS * STEP * Math.PI) / 180;

  listen('arc', el, 'pointerdown', e => {
    dragging = true; startX = e.clientX; startGoal = goal;
    el.classList.add('drag', 'touched'); el.setPointerCapture(e.pointerId);
  });
  listen('arc', el, 'pointermove', e => {
    if (!dragging) return;
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
    // 目標格距 ~58px（框 54 + 間隙 4），並確保總數至少 240 格
    let gap = 58;
    do {
      cols = Math.max(8, Math.round(w / gap));
      rows = Math.max(6, Math.round(h / gap));
      if (cols * rows >= 240) break;
      gap -= 6;
    } while (gap > 34);

    grid.style.gridTemplateColumns = `repeat(${cols}, 1fr)`;
    grid.style.gridTemplateRows    = `repeat(${rows}, 1fr)`;

    const frag = document.createDocumentFragment();
    for (let r = 0; r < rows; r++){
      for (let c = 0; c < cols; c++){
        const cell = document.createElement('span');
        cell.className = 'cell';
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
  const plot = $('.viz-plot', viz), svg = $('.viz-svg', viz);
  const gGrid = $('.viz-grid', svg);
  const pArt  = $('.viz-run--art path', svg), pMath = $('.viz-run--math path', svg);
  const gArt  = $('.viz-run--art', svg),      gMath = $('.viz-run--math', svg);
  if (!pArt || !pMath) return;

  const H = 80;                       // 壓低高度，面板底部才不會蓋到區塊的分隔線
  let anims = [];

  // 連續：兩個成整數倍的正弦疊加，位移一個 w 剛好走完整數個週期
  const smooth = (W, P, amp, cy) => {
    let d = '';
    for (let x = 0; x <= W; x += 4){
      const y = cy
        + Math.sin((x / P) * Math.PI * 2) * amp
        + Math.sin((x / (P / 3)) * Math.PI * 2) * amp * 0.30;
      d += (x ? 'L' : 'M') + x.toFixed(1) + ' ' + y.toFixed(1);
    }
    return d;
  };

  // 離散：把同一條訊號量化成階梯，只走水平／垂直線段
  const stepped = (W, P, amp, cy, step) => {
    let d = '', prev = null;
    for (let x = 0; x <= W + 0.001; x += step){
      const raw = Math.sin((x / P) * Math.PI * 2) * amp
                + Math.sin((x / (P / 2)) * Math.PI * 2) * amp * 0.42;
      const y = +(cy + Math.round(raw / 7) * 7).toFixed(1);
      if (prev === null) d += `M${x} ${y}`;
      else d += `L${x} ${prev}L${x} ${y}`;
      prev = y;
    }
    return d + `L${W.toFixed(1)} ${prev}`;
  };

  const build = () => {
    anims.forEach(a => a.cancel()); anims = [];
    const w = Math.round(plot.clientWidth);
    if (!w) return;
    svg.setAttribute('viewBox', `0 0 ${w} ${H}`);
    svg.setAttribute('width', w);
    svg.setAttribute('height', H);

    // 基準格線
    gGrid.replaceChildren();
    [0.25, 0.5, 0.75].forEach(f => {
      const ln = document.createElementNS('http://www.w3.org/2000/svg', 'line');
      ln.setAttribute('x1', 0); ln.setAttribute('x2', w);
      ln.setAttribute('y1', (H * f).toFixed(1)); ln.setAttribute('y2', (H * f).toFixed(1));
      gGrid.appendChild(ln);
    });

    // 位移距離 D = P*2；所有週期與階寬都必須整除 D，否則接回原點時會跳一下
    const P = Math.max(90, w / 2);       // 主週期＝半個面板寬
    const W = P * 4;                     // 畫四個週期，位移一半就無縫
    pArt.setAttribute('d',  smooth(W, P, H * 0.20, H * 0.52));          // D/P=2, D/(P/3)=6
    pMath.setAttribute('d', stepped(W, P / 2, H * 0.16, H * 0.48, P / 16)); // D/(P/2)=4, D/(P/16)=32

    if (REDUCED) return;                 // 減少動態：畫出來但不跑
    const run = (g, dist, ms) => {
      const a = g.animate(
        [{ transform:'translateX(0)' }, { transform:`translateX(${-dist}px)` }],
        { duration: ms, iterations: Infinity, easing:'linear' });
      anims.push(a); return a;
    };
    run(gArt,  P * 2, 9000);             // 位移兩個週期 → 無縫
    run(gMath, P * 2, 13500);            // 不同速度，兩條線才不會黏在一起
  };

  build();
  // 面板寬度會因語言而變（中／泰 540、英 370），用 ResizeObserver 才抓得到
  let rt = 0, lastW = 0;
  new ResizeObserver(es => {
    const w = Math.round(es[0].contentRect.width);
    if (w === lastW) return;
    lastW = w;
    clearTimeout(rt); rt = setTimeout(build, 160);
  }).observe(plot);

  /* 示意讀數：小幅隨機游走，看起來像在跳但不會亂飄 */
  const reads = [
    { el: $('[data-viz="fps"]', viz), v: 60.0, lo: 59.4, hi: 60.0, d: 0.22, fmt: v => v.toFixed(1) },
    { el: $('[data-viz="rtp"]', viz), v: 96.3, lo: 96.0, hi: 96.6, d: 0.09, fmt: v => v.toFixed(1) + '%' },
    { el: $('[data-viz="lat"]', viz), v: 12,   lo: 9,    hi: 16,   d: 1.1,  fmt: v => Math.round(v) + 'ms' }
  ].filter(r => r.el);
  if (REDUCED || !reads.length) return;

  let visible = false;
  new IntersectionObserver(es => es.forEach(e => { visible = e.isIntersecting; }),
    { threshold: 0 }).observe(viz);

  setInterval(() => {
    if (!visible || document.hidden) return;       // 看不到就不動，不浪費
    for (const r of reads){
      r.v = clamp(r.v + (Math.random() - 0.5) * 2 * r.d, r.lo, r.hi);
      const next = r.fmt(r.v);
      if (r.el.textContent !== next){
        r.el.textContent = next;
        r.el.classList.remove('tick');
        void r.el.offsetWidth;                     // 重啟閃動動畫
        r.el.classList.add('tick');
      }
    }
  }, 1100);
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

  nav(); marquees(); hero(); lanes(); lists();
  arc(); soon(); soonCopy(); offer(); counters(); parallax(); aboutViz(); combHover();
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

/* ══════════════════════════════════════════════════════════════
   本機預覽專用的 Push 按鈕
   ──────────────────────────────────────────────────────────────
   這支檔案「只」由 tools/serve.py 在本機服務 index.html 時動態注入。
   index.html 原始碼裡沒有它，所以線上版（GitHub Pages）永遠不會有這顆按鈕。

   行為：偵測本機有無未推送的改動 → 按一下 → commit + push
        → 持續輪詢線上的 build.txt，真的生效了才顯示「已上線」。
   ══════════════════════════════════════════════════════════════ */
(() => {
  'use strict';
  if (window.__bbPush) return;               // 防重複注入
  window.__bbPush = true;

  const css = `
  .bb-push{position:fixed; z-index:2147483647; top:8px; right:8px;
    display:flex; align-items:center; gap:8px; height:32px; padding:0 12px;
    border-radius:999px; border:1px solid rgba(255,255,255,.14);
    background:rgba(12,12,14,.78); backdrop-filter:blur(10px);
    font:600 12px/1 'DM Sans',-apple-system,system-ui,sans-serif;
    letter-spacing:.02em; color:#fff; cursor:pointer; opacity:.5;
    transition:opacity .2s ease, border-color .2s ease, background .2s ease;
    -webkit-font-smoothing:antialiased}
  .bb-push:hover{opacity:1}
  .bb-push:focus-visible{outline:2px solid #FFC700; outline-offset:2px; opacity:1}
  .bb-push[data-state="dirty"]{opacity:1; border-color:rgba(255,199,0,.55);
    background:rgba(42,36,16,.88); color:#FFC700}
  .bb-push[data-state="busy"]{opacity:1; cursor:progress}
  .bb-push[data-state="done"]{opacity:1; border-color:rgba(80,220,140,.5); color:#6EE7A8}
  .bb-push[data-state="error"]{opacity:1; border-color:rgba(255,90,90,.6); color:#FF8A8A}
  .bb-push[data-state="off"]{cursor:not-allowed}
  .bb-push:disabled{cursor:not-allowed}
  .bb-dot{width:7px; height:7px; border-radius:50%; background:currentColor; flex:none}
  .bb-push[data-state="dirty"] .bb-dot{animation:bbPulse 1.6s ease-in-out infinite}
  .bb-push[data-state="busy"] .bb-dot{animation:bbSpin 1s linear infinite;
    border-radius:2px; background:none; box-shadow:inset 0 0 0 2px currentColor}
  @keyframes bbPulse{0%,100%{opacity:1}50%{opacity:.25}}
  @keyframes bbSpin{to{transform:rotate(360deg)}}
  .bb-push .bb-n{font-variant-numeric:tabular-nums}
  .bb-tip{position:fixed; z-index:2147483646; top:46px; right:8px; max-width:340px;
    padding:10px 12px; border-radius:10px; border:1px solid rgba(255,255,255,.12);
    background:rgba(12,12,14,.94); backdrop-filter:blur(10px);
    font:500 11px/1.55 'DM Sans',-apple-system,system-ui,sans-serif; color:#C9C9CE;
    white-space:pre-wrap; opacity:0; transform:translateY(-4px); pointer-events:none;
    transition:opacity .18s ease, transform .18s ease}
  .bb-tip.on{opacity:1; transform:none; pointer-events:auto}
  .bb-tip a{color:#FFC700}
  .bb-tip b{color:#fff}
  @media (prefers-reduced-motion:reduce){
    .bb-push *,.bb-push{animation:none !important; transition:none !important}}
  `;
  const style = document.createElement('style');
  style.textContent = css;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.className = 'bb-push';
  btn.type = 'button';
  btn.setAttribute('aria-live', 'polite');
  btn.innerHTML = '<i class="bb-dot"></i><span class="bb-label">檢查中…</span>';
  const tip = document.createElement('div');
  tip.className = 'bb-tip';
  document.body.append(btn, tip);

  const label = btn.querySelector('.bb-label');
  let last = null, timer = 0;

  const showTip = html => { tip.innerHTML = html; tip.classList.add('on'); };
  const hideTip = () => tip.classList.remove('on');
  btn.addEventListener('mouseenter', () => { if (tip.innerHTML) tip.classList.add('on'); });
  btn.addEventListener('mouseleave', () => { if (last && last.state !== 'error') hideTip(); });

  /* 依伺服器回報的狀態更新外觀 */
  function render(s) {
    last = s;
    const site = s.url ? `<a href="${s.url}" target="_blank" rel="noopener">${s.url}</a>` : '';

    if (!s.remote) {
      btn.dataset.state = 'off'; btn.disabled = true;
      label.textContent = '未接 GitHub';
      showTip(`<b>還沒接上 GitHub repo。</b>\n建好 repo 後執行：\ngit remote add origin &lt;repo 網址&gt;`);
      return;
    }
    btn.disabled = false;

    if (s.state === 'pushing' || s.state === 'waiting') {
      btn.dataset.state = 'busy'; btn.disabled = true;
      label.textContent = s.state === 'pushing' ? '推送中…' : '等待生效…';
      showTip(s.message || '');
      return;
    }
    if (s.state === 'error') {
      btn.dataset.state = 'error';
      label.textContent = '推送失敗';
      showTip(`<b>推送失敗</b>\n${(s.message || '').replace(/</g, '&lt;')}\n\n再按一次可重試。`);
      return;
    }
    if (s.state === 'done' && !s.dirty) {
      btn.dataset.state = 'done';
      label.textContent = '已上線';
      showTip(`<b>已更新到線上</b>\n${site}\n${s.message || ''}`);
      return;
    }
    if (s.dirty) {
      btn.dataset.state = 'dirty';
      label.innerHTML = `Push <span class="bb-n">${s.changed}</span>`;
      showTip(`<b>${s.changed} 個檔案有改動</b>\n${(s.files || []).slice(0, 8).join('\n')}` +
              (s.changed > 8 ? `\n…等 ${s.changed} 個` : '') +
              `\n\n按一下 commit + push，並等線上真的生效。`);
      hideTip();
      return;
    }
    btn.dataset.state = 'clean';
    label.textContent = '已同步';
    showTip(`<b>本機與線上一致</b>\n${site}` + (s.lastPush ? `\n上次推送：${s.lastPush}` : ''));
    hideTip();
  }

  async function poll() {
    try {
      const r = await fetch('/__dev/status', { cache: 'no-store' });
      const s = await r.json();
      render(s);
      // 忙碌時加快輪詢，閒置時放慢
      clearTimeout(timer);
      timer = setTimeout(poll, (s.state === 'pushing' || s.state === 'waiting') ? 1500 : 4000);
    } catch {
      btn.dataset.state = 'error';
      label.textContent = '伺服器沒回應';
      clearTimeout(timer);
      timer = setTimeout(poll, 5000);
    }
  }

  btn.addEventListener('click', async () => {
    if (btn.disabled) return;
    if (last && !last.dirty && last.state !== 'error') { showTip(tip.innerHTML); return; }
    btn.dataset.state = 'busy'; btn.disabled = true; label.textContent = '推送中…';
    try {
      await fetch('/__dev/push', { method: 'POST' });
    } catch { /* 交給輪詢回報 */ }
    clearTimeout(timer); timer = setTimeout(poll, 400);
  });

  poll();
})();

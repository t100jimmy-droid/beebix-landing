/* ═══════════════════════════════════════════════════════════
   BeeBix Landing — 內容資料
   -----------------------------------------------------------
   與 Figma「設計beebix」頁 1:1 對應。
   文字一律存 i18n key（見 i18n.js），三語連動。
   圖片路徑集中在此，之後換自有美術只改這支檔案。
   ═══════════════════════════════════════════════════════════ */
const G = 'assets/gen-img/';   // 本站自製美術（Magnific 生成）

/* ── 自製遊戲美術總表（29 款）──────────────────────────────
   標題刻意與圖上的 logo 一致，卡片文字和畫面才對得起來。
   作品集／橫幅跑道／即將上線都從這份表取用。 */
const GAMES = [
  { t:'Honey Vault',     f:'honey-vault'     }, { t:'Dragon Coin',    f:'dragon-coin'    },
  { t:'Pharaoh Hive',    f:'pharaoh-hive'    }, { t:'Neon Samurai',   f:'neon-samurai'   },
  { t:'Frost Queen',     f:'frost-queen'     }, { t:'Pirate Bounty',  f:'pirate-bounty'  },
  { t:'Jungle Beat',     f:'jungle-beat'     }, { t:'Cosmic Spin',    f:'cosmic-spin'    },
  { t:'Sweet Rush',      f:'sweet-rush'      }, { t:'Mahjong Gold',   f:'mahjong-gold'   },
  { t:'Zeus Thunder',    f:'zeus-thunder'    }, { t:'Fortune Cats',   f:'fortune-cats'   },
  { t:'Striker Fever',   f:'striker-fever'   }, { t:'Volcano Blaze',  f:'volcano-blaze'  },
  { t:'Golden Koi',      f:'golden-koi'      }, { t:'Bass Hunter',    f:'bass-hunter'    },
  { t:'Vault Break',     f:'vault-break'     }, { t:'Money Reels',    f:'money-reels'    },
  { t:'Vine of Plenty',  f:'vine-of-plenty'  }, { t:'Bronco Ranch',   f:'bronco-ranch'   },
  { t:'Deep Sea Cash',   f:'deep-sea-cash'   }, { t:'Splash Riches',  f:'splash-riches'  },
  { t:'Phoenix Reign',   f:'phoenix-reign'   }, { t:'Genie Wishes',   f:'genie-wishes'   },
  { t:'Moonlit Romance', f:'moonlit-romance' }, { t:'Choco Bomb',     f:'choco-bomb'     },
  { t:'Feather Fortune', f:'feather-fortune' }, { t:'Treasure Stacks',f:'treasure-stacks'},
  { t:'Nova Core',       f:'nova-core'       }
];
const gimg = g => G + g.f + '.webp';

/* ── Hero 角色卡（背景 + 去背角色兩層，前端做交錯視差）·自動輪播 12 張 ──
   角色圖上方留了透明帶，CSS 的 height:118% 裁掉頂端時才不會切到頭。 */
const HERO_SET = [
  { t:'Zeus Thunder',  f:'zeus-thunder', tag:'tag.slots'   },
  { t:'Honey Vault',   f:'honey-vault',  tag:'tag.slots'   },
  { t:'Neon Samurai',  f:'neon-samurai', tag:'tag.slots'   },
  { t:'Frost Queen',   f:'frost-queen',  tag:'tag.slots'   },
  { t:'Dragon Coin',   f:'dragon-coin',  tag:'tag.slots'   },
  { t:'Fortune Cats',  f:'fortune-cats', tag:'tag.slots'   },
  { t:'Velvet Table',  f:'velvet-table', tag:'tag.live'    },
  { t:'Dealer\u2019s Table', f:'dealer-table', tag:'tag.live' },
  { t:'Neon Cashout',  f:'neon-cashout', tag:'tag.instant' },
  { t:'Mine Pop',      f:'mine-pop',     tag:'tag.instant' },
  { t:'Hive Rewards',  f:'hive-rewards', tag:'tag.rewards' },
  { t:'Jungle Beat',   f:'jungle-beat',  tag:'tag.slots'   }
];
const HERO = HERO_SET.map(h => ({
  t:h.t, tag:h.tag, bg:G+'hero-'+h.f+'-bg.webp', ch:G+'hero-'+h.f+'-char.webp'
}));

/* ── 橫幅跑道縮圖（兩排反向捲動，交錯取樣避免兩排長得一樣）─── */
const LANE_A = GAMES.filter((_, i) => i % 2 === 0).map(gimg);
const LANE_B = GAMES.filter((_, i) => i % 2 === 1).map(gimg);

/* ── 精選作品（弧形輪播）───────────────────────────────── */
const FEATURED = GAMES.slice(0, 20).map(g => ({ t:g.t, tag:'tag.slots', img:gimg(g) }));

/* ── 即將上線 ─────────────────────────────────────────── */
const SOON_DATES = ['26 Aug 2026','16 Sep 2026','02 Oct 2026','21 Oct 2026','11 Nov 2026',
                    '25 Nov 2026','09 Dec 2026','23 Dec 2026','13 Jan 2027','27 Jan 2027'];
const SOON = GAMES.slice(19, 29).map((g, i) => ({ t:g.t, d:SOON_DATES[i], img:gimg(g) }));

/* ── 服務項目（左清單／右預覽卡）·沿用 Hero 的背景＋角色兩層 ──── */
const pick = f => HERO.find(h => h.bg.includes(f));
const OFFER = [
  { n:'01', t:'offer.1t', d:'offer.1d', cta:'offer.1c', ...pick('zeus-thunder') },
  { n:'02', t:'offer.2t', d:'offer.2d', cta:'offer.2c', ...pick('velvet-table') },
  { n:'03', t:'offer.3t', d:'offer.3d', cta:'offer.3c', ...pick('mine-pop')     },
  { n:'04', t:'offer.4t', d:'offer.4d', cta:'offer.4c', ...pick('hive-rewards') },
  { n:'05', t:'offer.5t', d:'offer.5d', cta:'offer.5c', ...pick('dealer-table') }
];

/* ── 能力對照（區塊 03 右側）──────────────────────────── */
const CAPS = [
  ['about.cap1k', 'about.cap1v'],
  ['about.cap2k', 'about.cap2v'],
  ['about.cap3k', 'about.cap3v']
];

/* ── 佐證清單（區塊 09 右側）──────────────────────────── */
const PROOF = [
  ['why.p1k', 'why.p1v'],
  ['why.p2k', 'why.p2v'],
  ['why.p3k', 'why.p3v']
];

/* ── 數據 ─────────────────────────────────────────────── */
const STATS = [
  { n:1000, suffix:'+', label:'why.s1', hero:true },
  { n:40,   suffix:'+', label:'why.s2' },
  { n:150,  suffix:'+', label:'why.s3' },
  { n:300,  suffix:'+', label:'why.s4' }
];

/* ── 聯絡方式（彈窗用）────────────────────────────────────
   帳號先用佔位，之後換真的只改這裡。url 留空就只顯示「複製」，不顯示「開啟」。 */
const CONTACTS = [
  { k:'email', label:'cm.email', handle:'partners@beebix.games', url:'mailto:partners@beebix.games' },
  { k:'tg',    label:'cm.tg',    handle:'@beebix_partners',      url:'' },
  { k:'wa',    label:'cm.wa',    handle:'+66 00 000 0000',       url:'' }
];

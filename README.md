# BeeBix — Wired to Win

iGaming 遊戲工作室形象首頁（單頁 demo）。純靜態，沒有建置步驟，
所有美術為本站自製，未使用任何借用素材。

**線上版：** https://t100jimmy-droid.github.io/beebix-landing/

## 本機預覽

```bash
python3 tools/serve.py        # → http://localhost:5193/index.html
```

這支伺服器做兩件內建 http.server 不做的事：

- **強制 no-store**：改完 CSS/JS 重整就一定是最新的，不會吃到啟發式快取。
- **注入右上角的 Push 按鈕**：偵測到本機有改動時亮起，按一下就
  `commit → push → 等 GitHub Pages 生效`，並且會實際抓線上的 `build.txt`
  比對時間戳，確認**真的上線**了才顯示「已上線」。

> 按鈕是伺服器在服務 index.html 時動態注入的，`index.html` 原始碼裡沒有它，
> 所以線上版永遠不會出現這顆按鈕。

## 結構

```
index.html              版面（唯一的 HTML）
assets/css/tokens.css   由 Figma 變數生成的色票，勿手改
assets/css/style.css    版面樣式
assets/js/i18n.js       繁中 / English / ไทย 三語字典
assets/js/data.js       所有內容的單一事實來源（遊戲、卡片、路線圖）
assets/js/main.js       全部互動與動態
assets/gen-img/         自製美術
tools/serve.py          預覽伺服器 + Push
tools/push.js           Push 按鈕（僅本機注入）
tools/setup-push.sh     一次性：把 GitHub token 存進 keychain 並首次推送
build.txt               上次推送的時間戳，用來驗證線上是否生效
```

內容要改的話改 `assets/js/data.js`，不要改 `main.js` 的邏輯。

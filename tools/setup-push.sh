#!/bin/bash
# ══════════════════════════════════════════════════════════════
#  一次性設定：把 GitHub token 存進 macOS keychain，然後推上線
#  ──────────────────────────────────────────────────────────────
#  你只需要做一件事：貼上 token，按 Enter。
#
#  token 只存在這支腳本的記憶體與 macOS keychain 裡，
#  不會寫進任何檔案、不會出現在終端機畫面、不會進 shell 歷史紀錄。
# ══════════════════════════════════════════════════════════════
set -uo pipefail

REPO="$HOME/beebix-landing"
USER_NAME="t100jimmy-droid"

cd "$REPO" || { echo "❌ 找不到 $REPO"; exit 1; }

printf '\n\033[1mBeeBix → GitHub 一次性設定\033[0m\n'
printf '  目標 repo : %s/beebix-landing\n' "$USER_NAME"
printf '  上線網址  : https://%s.github.io/beebix-landing/\n\n' "$USER_NAME"

# ── 1. 清掉舊的、沒有寫入權的憑證 ──────────────────────────
printf '清除舊憑證… '
printf 'protocol=https\nhost=github.com\n\n' | git credential-osxkeychain erase 2>/dev/null
echo '完成'

# ── 2. 請使用者貼上 token（不回顯、不留紀錄）──────────────
printf '\n\033[1;33m貼上你的 GitHub token，然後按 Enter：\033[0m\n'
printf '（畫面不會顯示任何字，這是正常的，貼完直接按 Enter）\n> '
IFS= read -rs TOKEN
printf '\n\n'

if [ -z "${TOKEN:-}" ]; then
  echo '❌ 沒有讀到 token，重跑一次這支腳本即可。'
  exit 1
fi
case "$TOKEN" in
  github_pat_*|ghp_*) ;;
  *) echo '⚠️  這看起來不像 GitHub token（正常會是 github_pat_ 或 ghp_ 開頭）。'
     echo '   還是繼續嘗試…' ;;
esac

# ── 3. 存進 keychain ───────────────────────────────────────
printf '存入 keychain… '
printf 'protocol=https\nhost=github.com\nusername=%s\npassword=%s\n\n' \
  "$USER_NAME" "$TOKEN" | git credential-osxkeychain store
unset TOKEN                     # 立刻從記憶體清掉
echo '完成'

# ── 4. 設定遠端並推送 ──────────────────────────────────────
git remote remove origin 2>/dev/null
git remote add origin "https://github.com/$USER_NAME/beebix-landing.git"

printf '\n推送 main… \n'
if ! GIT_TERMINAL_PROMPT=0 git push -u origin main 2>&1 | sed 's/^/    /'; then
  echo; echo '❌ 推送失敗（訊息在上面）。'
  echo '   如果是 403，代表 token 權限不足：'
  echo '   需要 Repository access = All repositories，且 Contents = Read and write。'
  exit 1
fi

printf '\n推送 gh-pages… \n'
GIT_TERMINAL_PROMPT=0 git push origin gh-pages 2>&1 | sed 's/^/    /'

# ── 5. 結果 ────────────────────────────────────────────────
if git ls-remote --heads origin main 2>/dev/null | grep -q main; then
  printf '\n\033[1;32m✅ 推送成功。\033[0m\n'
  printf '   回去跟 Claude 說一聲，剩下的（開 Pages、實測網址）他會處理。\n\n'
else
  printf '\n❌ 推上去了但確認不到，把上面的訊息貼給 Claude。\n\n'
fi

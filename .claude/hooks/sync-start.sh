#!/bin/bash
# SessionStart: lấy code mới từ origin. Chỉ pull khi working tree sạch và fast-forward được.
# Không bao giờ merge, rebase hay ghi đè thay đổi đang làm dở.
set -u
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && exit 0   # phiên cloud tự clone mới

say() { # in JSON cho Claude Code: systemMessage hiện cho người dùng, additionalContext cho Claude
  node -e 'const m=process.argv[1];console.log(JSON.stringify({systemMessage:m,hookSpecificOutput:{hookEventName:"SessionStart",additionalContext:m}}))' "$1"
}

export GIT_TERMINAL_PROMPT=0 GIT_SSH_COMMAND="ssh -o BatchMode=yes -o ConnectTimeout=10"
if ! git fetch --quiet --prune origin 2>/dev/null; then
  say "Đồng bộ: không fetch được origin (mất mạng hoặc chưa có SSH key). Chưa pull."
  exit 0
fi

branch=$(git symbolic-ref --quiet --short HEAD) || { say "Đồng bộ: đang ở detached HEAD, không pull."; exit 0; }
upstream=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null) || exit 0
behind=$(git rev-list --count "HEAD..$upstream")
ahead=$(git rev-list --count "$upstream..HEAD")
[ "$behind" -eq 0 ] && exit 0

if [ -n "$(git status --porcelain)" ]; then
  say "Đồng bộ: $upstream có $behind commit mới, nhưng $branch còn thay đổi chưa commit nên chưa pull. Commit hoặc stash rồi chạy: git pull --ff-only"
  exit 0
fi
if [ "$ahead" -gt 0 ]; then
  say "Đồng bộ: $branch và $upstream đã rẽ nhánh ($ahead commit chỉ có ở máy này, $behind chỉ có trên origin). Không tự pull; cần git pull --rebase hoặc merge."
  exit 0
fi

old=$(git rev-parse HEAD)
if ! git merge --ff-only --quiet "$upstream" 2>/dev/null; then
  say "Đồng bộ: pull fast-forward thất bại, kiểm tra bằng git status."
  exit 0
fi
msg="Đồng bộ: đã pull $behind commit mới từ $upstream: $(git log --format='%s' "$old..HEAD" | head -5 | paste -sd ';' -)"
if ! git diff --quiet "$old" HEAD -- package-lock.json; then
  if npm install --no-audit --no-fund --loglevel=error >/dev/null 2>&1; then
    msg="$msg. package-lock.json đổi, đã chạy npm install."
  else
    msg="$msg. package-lock.json đổi nhưng npm install lỗi, chạy lại bằng tay."
  fi
fi
say "$msg"

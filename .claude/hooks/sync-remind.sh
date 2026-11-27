#!/bin/bash
# Stop: nhắc khi còn commit chưa push hoặc thay đổi chưa commit, để máy kia có code.
# Chỉ nhắc một lần cho mỗi trạng thái (không lặp lại sau mỗi câu trả lời). Không tự commit hay push.
set -u
cd "${CLAUDE_PROJECT_DIR:-$(dirname "$0")/../..}" || exit 0
[ "${CLAUDE_CODE_REMOTE:-}" = "true" ] && exit 0

branch=$(git symbolic-ref --quiet --short HEAD) || exit 0
ahead=0
if upstream=$(git rev-parse --abbrev-ref --symbolic-full-name '@{u}' 2>/dev/null); then
  ahead=$(git rev-list --count "$upstream..HEAD")
else
  upstream=""
fi
dirty=$(git status --porcelain | wc -l | tr -d ' ')

stamp="$(git rev-parse --git-dir)/claude-sync-reminded"
if [ "$ahead" -eq 0 ] && [ "$dirty" -eq 0 ] && [ -n "$upstream" ]; then
  rm -f "$stamp"; exit 0
fi

state="$branch $(git rev-parse HEAD) $ahead $dirty"
[ -f "$stamp" ] && [ "$(cat "$stamp")" = "$state" ] && exit 0
echo "$state" > "$stamp"

parts=()
[ "$dirty" -gt 0 ] && parts+=("$dirty file chưa commit")
[ "$ahead" -gt 0 ] && parts+=("$ahead commit chưa push")
[ -z "$upstream" ] && parts+=("nhánh $branch chưa có trên origin")
msg="Nhắc đồng bộ: $(IFS=,; echo "${parts[*]}" | sed 's/,/, /g'). Push trước khi rời máy để máy kia có code."
node -e 'console.log(JSON.stringify({systemMessage:process.argv[1]}))' "$msg"

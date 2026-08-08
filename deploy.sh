#!/data/data/com.termux/files/usr/bin/sh
set -e

cd ~/nas/vitals
git pull origin main
pnpm install
pnpm build

tmux kill-session -t vitals 2>/dev/null || true
tmux new-session -d -s vitals 'cd ~/nas/vitals && pnpm start > ~/nas/vitals/server.log 2>&1'

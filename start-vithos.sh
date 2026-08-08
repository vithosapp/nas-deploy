#!/data/data/com.termux/files/usr/bin/sh

termux-wake-lock
sshd

tmux new-session -d -s vitals 'cd ~/nas/vitals && pnpm start > ~/nas/vitals/server.log 2>&1'
tmux new-session -d -s tunnel 'cloudflared tunnel run > ~/tunnel.log 2>&1'
tmux new-session -d -s webhook 'webhook -hooks ~/nas-deploy/hooks.json -port 9000 -verbose > ~/nas-deploy/webhook.log 2>&1'

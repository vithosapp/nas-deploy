#!/data/data/com.termux/files/usr/bin/sh

termux-wake-lock
sshd

. ~/nas/nas-deploy/.env

tmux new-session -d -s vitals 'cd ~/nas/vitals && pnpm start > ~/nas/vitals/server.log 2>&1'
tmux new-session -d -s tunnel 'cloudflared tunnel run > ~/tunnel.log 2>&1'
tmux new-session -d -s webhook "cd ~/nas/nas-deploy && DEPLOY_SECRET=$DEPLOY_SECRET node webhook-server.js > ~/nas/nas-deploy/webhook.log 2>&1"

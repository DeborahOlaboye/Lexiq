#!/bin/bash
# One-time setup for a fresh Hetzner Ubuntu 22.04 server.
# Run as root: bash setup-server.sh
set -e

# Install Docker
apt-get update -qq
apt-get install -y -qq ca-certificates curl gnupg
install -m 0755 -d /etc/apt/keyrings
curl -fsSL https://download.docker.com/linux/ubuntu/gpg | gpg --dearmor -o /etc/apt/keyrings/docker.gpg
chmod a+r /etc/apt/keyrings/docker.gpg
echo "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] \
  https://download.docker.com/linux/ubuntu $(. /etc/os-release && echo "$VERSION_CODENAME") stable" \
  > /etc/apt/sources.list.d/docker.list
apt-get update -qq
apt-get install -y -qq docker-ce docker-ce-cli containerd.io docker-compose-plugin git
systemctl enable --now docker

# Clone the repo
mkdir -p /opt/lexiq
cd /opt/lexiq
git clone https://github.com/DeborahOlaboye/Lexiq.git .

# Env file
cp .env.production.example .env.production
echo ""
echo "==========================================="
echo "  Edit /opt/lexiq/.env.production with your real values, then run:"
echo "  docker compose up -d --build"
echo "==========================================="

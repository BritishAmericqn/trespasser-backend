# CLI Superpower Setup for Trespasser Backend Scaling
# Maximum Development Leverage & System Control

## Overview
This document provides the essential CLI tools installation and configuration to give us maximum leverage for scaling Trespasser from single lobby to 10k+ CCU. These tools will enable rapid development, deployment, monitoring, and troubleshooting.

## Essential CLI Tools Installation

### 1. Core Development Tools

#### Node.js Development Ecosystem
```bash
# Essential Node.js CLI tools
npm install -g \
  nodemon \
  ts-node \
  typescript \
  @types/node \
  npm-check-updates \
  concurrently \
  cross-env

# Database management
npm install -g \
  prisma \
  sequelize-cli \
  knex
```

#### Modern Unix Replacements (Better Development Experience)
```bash
# macOS installation (using Homebrew)
brew install \
  exa \          # Better ls
  bat \          # Better cat with syntax highlighting
  fd \           # Better find
  ripgrep \      # Better grep (rg)
  htop \         # Better top
  jq \           # JSON processor
  httpie \       # Better curl
  fzf \          # Fuzzy finder
  tree \         # Directory tree view
  watch          # Monitor command output

# Set up aliases for better development
echo 'alias ls="exa -la"' >> ~/.zshrc
echo 'alias cat="bat"' >> ~/.zshrc
echo 'alias find="fd"' >> ~/.zshrc
echo 'alias grep="rg"' >> ~/.zshrc
```

### 2. Container & Orchestration Tools

#### Docker & Kubernetes Management
```bash
# Docker Compose (for local development)
brew install docker-compose

# Kubernetes CLI (for production)
brew install kubectl

# K9s - Kubernetes TUI (GAME CHANGER for managing clusters)
brew install k9s

# Helm - Kubernetes package manager
brew install helm

# Dive - Docker image analyzer
brew install dive

# ctop - Container metrics (like htop for containers)
brew install ctop
```

#### Container Development Helpers
```bash
# Lazydocker - TUI for Docker management
brew install lazydocker

# Docker-slim - Minimize container images
curl -sL https://raw.githubusercontent.com/docker-slim/docker-slim/master/scripts/install-dockerslim.sh | sudo -E bash
```

### 3. Database Management CLIs

#### PostgreSQL Tools
```bash
# PostgreSQL client
brew install postgresql

# pgcli - Better PostgreSQL CLI with autocomplete
pip3 install pgcli

# pg_top - PostgreSQL process monitor
brew install pg_top

# Connection example
echo 'alias pgdev="pgcli postgresql://user:pass@localhost:5432/trespasser_dev"' >> ~/.zshrc
```

#### Redis Tools
```bash
# Redis CLI
brew install redis

# redis-cli with better interface
npm install -g iredis

# Redis monitoring
brew install redis-stat
```

### 4. Cloud & Infrastructure Tools

#### Multi-Cloud CLI Tools
```bash
# AWS CLI v2
curl "https://awscli.amazonaws.com/AWSCLIV2.pkg" -o "AWSCLIV2.pkg"
sudo installer -pkg AWSCLIV2.pkg -target /

# Google Cloud SDK
brew install --cask google-cloud-sdk

# Azure CLI
brew install azure-cli

# DigitalOcean CLI
brew install doctl

# Linode CLI
brew install linode-cli
```

#### Infrastructure as Code
```bash
# Terraform
brew install terraform

# Terragrunt - Terraform wrapper
brew install terragrunt

# Ansible
brew install ansible

# Pulumi (alternative to Terraform)
brew install pulumi
```

### 5. Monitoring & Observability

#### Performance Monitoring
```bash
# Glances - System monitoring TUI
pip3 install glances

# Netdata - Real-time performance monitoring
bash <(curl -Ss https://my-netdata.io/kickstart.sh)

# Bandwhich - Network bandwidth monitor
brew install bandwhich

# Procs - Better ps
brew install procs
```

#### Application Monitoring
```bash
# Artillery - Load testing
npm install -g artillery

# Clinic.js - Node.js performance profiling
npm install -g clinic

# 0x - Flame graph profiler for Node.js
npm install -g 0x

# Autocannon - HTTP benchmarking
npm install -g autocannon
```

### 6. Development Productivity Tools

#### Git & Code Management
```bash
# Git extras
brew install git-extras

# GitHub CLI
brew install gh

# Git TUI
brew install tig

# Commitizen for consistent commits
npm install -g commitizen cz-conventional-changelog
```

#### API Development & Testing
```bash
# Insomnia CLI (for API testing)
npm install -g insomnia-inso

# Newman (Postman CLI)
npm install -g newman

# httpie (better curl)
brew install httpie

# Ngrok (expose local servers)
brew install ngrok

# JSON server (mock APIs)
npm install -g json-server
```

### 7. Security & Network Tools

#### Security Analysis
```bash
# Nmap - Network discovery
brew install nmap

# Nuclei - Vulnerability scanner
go install -v github.com/projectdiscovery/nuclei/v2/cmd/nuclei@latest

# SSH audit
pip3 install ssh-audit

# SSL labs scan
go install github.com/ssllabs/ssllabs-scan@latest
```

#### Network Debugging
```bash
# mtr - Network diagnostic
brew install mtr

# tcpdump - Packet analyzer
brew install tcpdump

# Wireshark CLI
brew install tshark
```

## Trespasser-Specific CLI Configuration

### 1. Development Shortcuts
```bash
# Add to ~/.zshrc
cat << 'EOF' >> ~/.zshrc

# Trespasser Development Aliases
alias tdev="cd /Users/benjaminroyston/trespasser-backend && npm run dev"
alias tbuild="cd /Users/benjaminroyston/trespasser-backend && npm run build"
alias ttest="cd /Users/benjaminroyston/trespasser-backend && npm test"
alias tlint="cd /Users/benjaminroyston/trespasser-backend && npm run lint"

# Database shortcuts
alias tdb="pgcli postgresql://localhost:5432/trespasser"
alias tredis="redis-cli"

# Docker shortcuts
alias tup="docker-compose up -d"
alias tdown="docker-compose down"
alias tlogs="docker-compose logs -f"
alias tstats="docker stats"

# Monitoring shortcuts
alias tmon="glances"
alias tnet="bandwhich"
alias tproc="procs"

# Load testing
alias tload="artillery run tests/load-test.yml"
alias tbench="autocannon http://localhost:3000"

EOF

source ~/.zshrc
```

### 2. Environment Management
```bash
# Create environment file management
cat << 'EOF' > ~/.trespasser-env

# Development Environment
export TRESPASSER_ENV=development
export DATABASE_URL=postgresql://localhost:5432/trespasser_dev
export REDIS_URL=redis://localhost:6379
export JWT_SECRET=dev-secret-key
export NODE_ENV=development

# Production shortcuts (add when ready)
alias tprod="export TRESPASSER_ENV=production"
alias tstaging="export TRESPASSER_ENV=staging"

EOF

echo 'source ~/.trespasser-env' >> ~/.zshrc
```

### 3. Kubernetes Monitoring Setup (for production)
```bash
# K9s configuration for Trespasser
mkdir -p ~/.k9s
cat << 'EOF' > ~/.k9s/config.yml
k9s:
  refreshRate: 2
  headless: false
  logoless: false
  crumbsless: false
  readOnly: false
  noExitOnCtrlC: false
  ui:
    enableMouse: true
    headless: false
    logoless: false
    crumbsless: false
    reactive: false
    noIcons: false
  skipLatestRevCheck: false
  disablePodCounting: false
  shellPod:
    image: busybox:1.35.0
    namespace: default
    limits:
      cpu: 100m
      memory: 100Mi
  imageScans:
    enable: false
    exclusions:
      namespaces: []
      labels: {}
  logger:
    tail: 100
    buffer: 5000
    sinceSeconds: -1
    textWrap: false
    showTime: false
  thresholds:
    cpu:
      critical: 90
      warn: 70
    memory:
      critical: 90
      warn: 70
EOF
```

## Essential Development Workflows

### 1. Local Development Setup
```bash
#!/bin/bash
# Create tdev command for complete local setup

cat << 'EOF' > /usr/local/bin/tdev
#!/bin/bash

echo "🚀 Starting Trespasser Development Environment..."

# Check if PostgreSQL is running
if ! pgrep -x "postgres" > /dev/null; then
    echo "🗄️ Starting PostgreSQL..."
    brew services start postgresql
fi

# Check if Redis is running
if ! pgrep -x "redis-server" > /dev/null; then
    echo "📦 Starting Redis..."
    brew services start redis
fi

# Navigate to project and start development
cd /Users/benjaminroyston/trespasser-backend

# Install dependencies if needed
if [ ! -d "node_modules" ]; then
    echo "📦 Installing dependencies..."
    npm install
fi

# Run database migrations
echo "🗄️ Running database migrations..."
npm run db:migrate

# Start development server with monitoring
echo "🎮 Starting Trespasser backend..."
concurrently \
  "npm run dev" \
  "glances -t 1" \
  "redis-cli monitor"

EOF

chmod +x /usr/local/bin/tdev
```

### 2. Production Deployment Helper
```bash
#!/bin/bash
# Create tdeploy command for production deployment

cat << 'EOF' > /usr/local/bin/tdeploy
#!/bin/bash

echo "🚀 Deploying Trespasser to Production..."

# Build and test
npm run build
npm run test

# Create Docker image
docker build -t trespasser:$(date +%s) .

# Deploy with zero downtime
kubectl apply -f k8s/

# Monitor deployment
echo "📊 Monitoring deployment..."
watch kubectl get pods -l app=trespasser-backend

EOF

chmod +x /usr/local/bin/tdeploy
```

### 3. Performance Monitoring Script
```bash
#!/bin/bash
# Create tmonitor command for comprehensive monitoring

cat << 'EOF' > /usr/local/bin/tmonitor
#!/bin/bash

echo "📊 Trespasser Performance Monitor"

# Server performance
echo "=== Server Performance ==="
glances --time 1 --quiet &
GLANCES_PID=$!

# Network monitoring  
echo "=== Network Usage ==="
bandwhich &
BANDWHICH_PID=$!

# Database monitoring
echo "=== Database Performance ==="
pg_top -d trespasser &
PGTOP_PID=$!

# Redis monitoring
echo "=== Redis Performance ==="
redis-stat &
REDIS_STAT_PID=$!

# Container monitoring (if using Docker)
if command -v docker &> /dev/null; then
    echo "=== Container Performance ==="
    ctop &
    CTOP_PID=$!
fi

# Cleanup on exit
trap "kill $GLANCES_PID $BANDWHICH_PID $PGTOP_PID $REDIS_STAT_PID $CTOP_PID 2>/dev/null" EXIT

wait

EOF

chmod +x /usr/local/bin/tmonitor
```

## Load Testing & Performance Analysis

### 1. Artillery Configuration
```yaml
# tests/load-test.yml
config:
  target: 'http://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
      name: "Warm up"
    - duration: 120  
      arrivalRate: 50
      name: "Sustained load"
    - duration: 60
      arrivalRate: 100
      name: "Peak load"
  socketio:
    timeout: 5000

scenarios:
  - name: "Lobby lifecycle"
    weight: 100
    engine: socketio
    flow:
      - emit:
          channel: "find_match"
          data: "deathmatch"
      - think: 1
      - loop:
          - emit:
              channel: "player:input"
              data:
                keys: { w: true, a: false, s: false, d: false }
                mouse: { x: 240, y: 135 }
                sequence: "{{ $randomInt(1, 1000) }}"
                timestamp: "{{ $timestamp }}"
          - think: 0.05
          count: 1200  # 1 minute of inputs
```

### 2. Database Performance Testing
```bash
#!/bin/bash
# Create tdbtest command for database performance testing

cat << 'EOF' > /usr/local/bin/tdbtest
#!/bin/bash

echo "🗄️ Testing Database Performance..."

# PostgreSQL performance test
echo "Testing PostgreSQL connection pool..."
pgbench -c 10 -j 2 -t 1000 trespasser

# Redis performance test
echo "Testing Redis performance..."
redis-benchmark -h localhost -p 6379 -c 50 -n 10000

# Monitor during test
echo "Monitoring database during load..."
pg_top -d trespasser

EOF

chmod +x /usr/local/bin/tdbtest
```

## Security & Monitoring Setup

### 1. Security Scanning
```bash
#!/bin/bash
# Create tsecurity command for security analysis

cat << 'EOF' > /usr/local/bin/tsecurity
#!/bin/bash

echo "🔒 Trespasser Security Scan"

# NPM security audit
echo "=== NPM Security Audit ==="
npm audit

# Docker image security scan
echo "=== Docker Security Scan ==="
if command -v docker &> /dev/null; then
    docker run --rm -v /var/run/docker.sock:/var/run/docker.sock \
        -v $(pwd):/src aquasec/trivy image trespasser:latest
fi

# Network security scan
echo "=== Network Security Scan ==="
nmap -sS -O localhost

# SSL/TLS check (for production)
if [ "$1" = "prod" ]; then
    echo "=== SSL/TLS Check ==="
    testssl.sh --fast https://api.trespasser.com
fi

EOF

chmod +x /usr/local/bin/tsecurity
```

## Installation Script

### Complete Setup Script
```bash
#!/bin/bash
# Run this script to install all CLI superpowers

cat << 'EOF' > install-cli-superpowers.sh
#!/bin/bash

echo "🚀 Installing Trespasser CLI Superpowers..."

# Install Homebrew if not present
if ! command -v brew &> /dev/null; then
    echo "📦 Installing Homebrew..."
    /bin/bash -c "$(curl -fsSL https://raw.githubusercontent.com/Homebrew/install/HEAD/install.sh)"
fi

# Install core tools
echo "🔧 Installing core development tools..."
brew install \
  exa bat fd ripgrep htop jq httpie fzf tree watch \
  docker-compose kubectl k9s helm dive ctop lazydocker \
  postgresql redis \
  terraform ansible \
  git-extras gh tig \
  nmap mtr

# Install Node.js tools
echo "📦 Installing Node.js tools..."
npm install -g \
  nodemon ts-node typescript @types/node npm-check-updates concurrently cross-env \
  artillery clinic 0x autocannon \
  commitizen cz-conventional-changelog \
  json-server

# Install Python tools
echo "🐍 Installing Python tools..."
pip3 install pgcli glances ssh-audit

# Create development shortcuts
echo "⚡ Setting up development shortcuts..."
# (All the alias and function definitions from above)

echo "✅ CLI Superpowers installed! Restart your terminal and run 'tdev' to start."

EOF

chmod +x install-cli-superpowers.sh
```

## Usage Examples

### Daily Development Workflow
```bash
# Start development environment
tdev

# Monitor performance
tmonitor

# Run load tests
tload

# Deploy to production
tdeploy

# Check security
tsecurity

# Database operations
tdb  # Connect to database
tredis  # Connect to Redis

# Container management
tup    # Start containers
tdown  # Stop containers
tlogs  # View logs
```

---

## Next Steps

**Run this installation:**
```bash
# 1. Save the install script
curl -o install-cli-superpowers.sh [script-url]

# 2. Make executable and run
chmod +x install-cli-superpowers.sh
./install-cli-superpowers.sh

# 3. Restart terminal and test
tdev
```

These CLI tools will give us **massive leverage** for rapid development, deployment, and scaling. With these superpowers, we can:

- **Develop faster** with better tools and shortcuts
- **Deploy confidently** with automated workflows  
- **Monitor effectively** with real-time insights
- **Scale efficiently** with container orchestration
- **Debug quickly** with powerful analysis tools

**Ready to install these superpowers and start scaling? 🚀**


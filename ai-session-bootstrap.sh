#!/bin/bash

# 🤖 AI Session Bootstrap Script
# Automatically prepares environment for AI autonomous development

echo "🤖 AI Session Bootstrap - Trespasser Backend"
echo "============================================="

# Load aliases and functions
source /Users/benjaminroyston/trespasser-backend/.trespasser-aliases
source ~/.zshrc 2>/dev/null || true

# Set working directory
cd /Users/benjaminroyston/trespasser-backend

echo "📁 Working Directory: $(pwd)"
echo "🤖 AI Agent: Ready for autonomous operation"
echo ""

# Quick system check
echo "🔍 System Status Check:"
echo "======================"

# Check if essential services are running
check_service() {
    local service_name=$1
    local process_name=$2
    
    if pgrep -x "$process_name" > /dev/null; then
        echo "✅ $service_name: Running"
        return 0
    else
        echo "❌ $service_name: Not running"
        return 1
    fi
}

# Service status
check_service "PostgreSQL" "postgres"
POSTGRES_STATUS=$?

check_service "Redis" "redis-server" 
REDIS_STATUS=$?

check_service "Node.js Dev Server" "node"
NODE_STATUS=$?

# Port check
if nc -z localhost 3000 2>/dev/null; then
    echo "✅ Port 3000: Available"
    PORT_STATUS=0
else
    echo "❌ Port 3000: Not accessible"
    PORT_STATUS=1
fi

echo ""

# Git status
echo "📋 Git Status:"
echo "=============="
git status --short
echo "🌿 Branch: $(git branch --show-current)"
echo "📈 Uncommitted files: $(git status --porcelain | wc -l | xargs)"
echo ""

# Project info
echo "📊 Project Information:"
echo "======================"
echo "📦 Node Version: $(node --version)"
echo "📋 NPM Version: $(npm --version)"
echo "🗄️ PostgreSQL Version: $(postgres --version | head -1)"
echo "📦 Redis Version: $(redis-server --version)"
echo ""

# Environment assessment
echo "🎯 Environment Assessment:"
echo "=========================="

TOTAL_ISSUES=0
((TOTAL_ISSUES += POSTGRES_STATUS))
((TOTAL_ISSUES += REDIS_STATUS))
((TOTAL_ISSUES += NODE_STATUS))
((TOTAL_ISSUES += PORT_STATUS))

if [ $TOTAL_ISSUES -eq 0 ]; then
    echo "🎉 Perfect! All systems operational - AI ready for full autonomy"
    AI_READINESS="FULL"
elif [ $TOTAL_ISSUES -le 2 ]; then
    echo "⚠️  Minor issues detected - AI can auto-recover"
    AI_READINESS="AUTO_RECOVERY"
else
    echo "🚨 Multiple issues - AI may need human assistance"
    AI_READINESS="ASSISTED"
fi

echo ""

# Auto-recovery attempt if needed
if [ "$AI_READINESS" = "AUTO_RECOVERY" ]; then
    echo "🔧 Attempting Auto-Recovery:"
    echo "============================"
    
    # Start missing services
    if [ $POSTGRES_STATUS -ne 0 ]; then
        echo "🗄️ Starting PostgreSQL..."
        brew services start postgresql@14
    fi
    
    if [ $REDIS_STATUS -ne 0 ]; then
        echo "📦 Starting Redis..."
        brew services start redis
    fi
    
    if [ $NODE_STATUS -ne 0 ] && [ $PORT_STATUS -ne 0 ]; then
        echo "🚀 Starting development server..."
        npm run dev &
        DEV_PID=$!
        sleep 3
    fi
    
    echo "✅ Auto-recovery complete"
    echo ""
fi

# Available AI capabilities summary
echo "🤖 AI Autonomous Capabilities:"
echo "=============================="
echo "✅ Code analysis and search (ripgrep, bat, eza)"
echo "✅ Database operations (pgcli, redis-cli)"
echo "✅ Performance monitoring (glances, bandwhich, procs)"
echo "✅ Load testing (artillery, autocannon)"
echo "✅ Code quality (eslint, prettier, typescript)"
echo "✅ Git operations (status, commit, push)"
echo "✅ Container management (docker-compose, k9s)"
echo "✅ Build and deployment validation"
echo ""

# Quick task suggestions
echo "💡 Suggested Next Actions:"
echo "=========================="

case $AI_READINESS in
    "FULL")
        echo "🚀 Environment ready! Consider:"
        echo "   • Run comprehensive tests: npm test"
        echo "   • Start development: tdev-full"
        echo "   • Begin multi-lobby implementation"
        echo "   • Run load tests: tload-test"
        ;;
    "AUTO_RECOVERY")
        echo "🔧 After auto-recovery, verify with:"
        echo "   • tinfo (project status)"
        echo "   • health_check (system health)"
        echo "   • npm test (test validation)"
        ;;
    "ASSISTED")
        echo "🆘 Consider requesting human assistance for:"
        echo "   • Service configuration issues"
        echo "   • Environment setup problems"
        echo "   • Permission or access issues"
        ;;
esac

echo ""

# Performance baseline
echo "📊 Performance Baseline:"
echo "======================="
echo "🖥️  CPU Cores: $(sysctl -n hw.ncpu)"
echo "💾 Memory: $(echo $(($(sysctl -n hw.memsize) / 1024 / 1024 / 1024))) GB"
echo "💿 Disk Space: $(df -h . | tail -1 | awk '{print $4}') available"
echo "🌐 Network: $(ifconfig en0 | grep inet | grep -v inet6 | awk '{print $2}')"
echo ""

# Create session log
SESSION_LOG="/tmp/ai-session-$(date +%Y%m%d-%H%M%S).log"
echo "📝 Session log: $SESSION_LOG"

cat > "$SESSION_LOG" <<EOF
AI Session Bootstrap - $(date)
========================================
Working Directory: $(pwd)
Git Branch: $(git branch --show-current)
AI Readiness: $AI_READINESS
System Issues: $TOTAL_ISSUES
Node Version: $(node --version)
Project Status: Ready for autonomous development

Available Tools:
- CLI Superpowers: Activated
- Development Aliases: Loaded  
- Monitoring Tools: Available
- Database Tools: Ready
- Load Testing: Configured
- Security Scanning: Available

Next Steps:
- AI can operate autonomously for development tasks
- Use tinfo for status checks
- Use tmonitor for performance monitoring
- Use tload-test for scaling validation
- Reference AI_AUTONOMOUS_WORKFLOW_GUIDE.md for detailed capabilities
EOF

echo "🎯 AI Bootstrap Complete!"
echo "========================"
echo "🤖 Status: $AI_READINESS autonomy mode"
echo "📚 Reference: cat AI_AUTONOMOUS_WORKFLOW_GUIDE.md"
echo "🔍 Quick commands: cat .ai-quick-reference"
echo "📝 Session log: $SESSION_LOG"
echo ""
echo "🚀 Ready for Trespasser scaling to 10k CCU! 💪"

# Set helpful environment variables for AI context
export AI_SESSION_LOG="$SESSION_LOG"
export AI_READINESS="$AI_READINESS"
export TRESPASSER_PROJECT_ROOT="$(pwd)"
export AI_AUTONOMOUS_MODE="true"

# Final readiness confirmation
if [ "$AI_READINESS" = "FULL" ]; then
    echo "✨ AI Agent: Fully autonomous - no human intervention needed for standard tasks"
else
    echo "⚠️ AI Agent: Limited autonomy - may need human assistance for some tasks"
fi

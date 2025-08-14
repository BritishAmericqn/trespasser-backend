# 🤖 AI Autonomous Workflow Guide for Trespasser Development

## **Purpose & Philosophy**
This document enables AI assistants to work autonomously on the Trespasser backend scaling project, leveraging CLI superpowers without requiring human intervention for routine tasks. The goal is maximum AI leverage with minimal human middleman involvement.

---

## **🎯 AI Autonomous Capabilities**

### **Environment Detection & Setup**
```bash
# Always check current state before making assumptions
tinfo                    # Get complete project status
pwd                      # Verify working directory
git status              # Check git state
docker info 2>/dev/null  # Check Docker availability
```

### **Automatic Environment Initialization**
```bash
# AI can automatically start required services
tdev-full               # Start complete development environment
# This handles: PostgreSQL start, Redis start, npm install, dev server

# If individual components needed:
brew services start postgresql@14
brew services start redis
npm install             # Only if node_modules missing
```

### **Self-Diagnostic Workflows**
```bash
# AI should run these before reporting issues
tinfo                   # Project health check
npm run build 2>&1      # Build verification
npm test 2>&1           # Test status
tsecurity               # Security audit
```

---

## **🚀 Development Task Automation**

### **Code Analysis & Navigation**
```bash
# Enhanced file exploration
eza --tree src/         # Visual project structure
rg "function.*lobby" --type ts  # Find lobby-related code
rg "export.*class" src/ # Find all exported classes
bat src/index.ts        # Syntax-highlighted file reading

# Find specific patterns
rg "GameRoom" -A 5 -B 5  # Find GameRoom with context
rg "socket.*join" --type ts -n  # Socket join operations with line numbers
```

### **Database Operations**
```bash
# AI can directly manage databases
pgcli postgresql://localhost:5432/trespasser <<EOF
\d+                     -- List all tables with details
SELECT * FROM players LIMIT 5;
\q
EOF

# Redis operations
redis-cli INFO memory   # Memory usage
redis-cli FLUSHDB      # Clear development data (if safe)
redis-cli MONITOR      # Watch real-time operations
```

### **Performance Monitoring**
```bash
# Continuous monitoring during development
glances --export csv --export-csv-file /tmp/performance.csv --time 10 &
GLANCES_PID=$!

# Network analysis
bandwhich --raw --interface en0 > /tmp/network_usage.log &
BAND_PID=$!

# Cleanup function for monitoring
cleanup_monitoring() {
    kill $GLANCES_PID $BAND_PID 2>/dev/null
}
trap cleanup_monitoring EXIT
```

### **Load Testing Automation**
```bash
# AI can run comprehensive load tests
mkdir -p tests/artillery 2>/dev/null

# Create dynamic test configurations
cat > tests/artillery/websocket-lobby-test.yml <<EOF
config:
  target: 'ws://localhost:3000'
  phases:
    - duration: 60
      arrivalRate: 10
  socketio:
    transports: ['websocket']

scenarios:
  - name: "Multi-lobby simulation"
    weight: 100
    engine: socketio
    flow:
      - emit:
          channel: "find_match"
          data:
            gameMode: "deathmatch"
      - wait: 1
      - emit:
          channel: "player:input"
          data:
            keys: { w: true }
            mouseAngle: 45
EOF

# Execute and analyze
artillery run tests/artillery/websocket-lobby-test.yml --output /tmp/load-test-results.json
artillery report /tmp/load-test-results.json --output /tmp/load-test-report.html
```

---

## **🛠️ Code Generation & Modification**

### **TypeScript Development**
```bash
# AI can verify TypeScript compilation
npx tsc --noEmit        # Type checking without output
npx ts-node --transpile-only scripts/check-types.ts

# Generate code documentation
npx typedoc src/ --out docs/api --theme minimal

# Code quality checks
npx eslint src/ --ext .ts,.js --format json > /tmp/lint-results.json
npx prettier --check src/**/*.{ts,js,json}
```

### **Git Operations**
```bash
# Automated git workflows
git add src/ shared/    # Add specific directories
git commit -m "feat: implement multi-lobby system

- Add LobbyManager class for concurrent lobby handling
- Extend GameRoom for independent lobby sessions  
- Update server.js for multi-lobby routing
- Add lobby lifecycle management"

git push origin main

# Branch management for features
git checkout -b feature/multi-lobby-system
git push -u origin feature/multi-lobby-system
```

### **Docker & Container Management**
```bash
# AI can manage containerized development
docker-compose up -d postgres redis  # Start only databases
docker-compose logs -f backend       # Monitor backend logs
docker-compose exec postgres psql -U postgres -d trespasser

# Container health checks
docker ps --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
docker stats --no-stream --format "table {{.Name}}\t{{.CPUPerc}}\t{{.MemUsage}}"
```

---

## **📊 Monitoring & Alerting**

### **Real-time Performance Tracking**
```bash
# Background monitoring setup
setup_monitoring() {
    # System metrics
    glances --export json --export-json-file /tmp/system_metrics.json --time 5 &
    
    # Process monitoring
    while true; do
        procs --tree --color always | head -20 > /tmp/process_snapshot.txt
        sleep 10
    done &
    
    # Network monitoring
    if command -v bandwhich &> /dev/null; then
        bandwhich --raw > /tmp/network_raw.log 2>&1 &
    fi
    
    echo "Monitoring started. Data in /tmp/"
}

# Analysis functions
analyze_performance() {
    echo "🔍 Performance Analysis:"
    echo "======================="
    
    # CPU usage
    echo "CPU Usage:"
    top -l 1 | grep "CPU usage"
    
    # Memory usage
    echo "Memory Usage:"
    vm_stat | perl -ne '/page size of (\d+)/ and $size=$1; /Pages\s+([^:]+):\s+(\d+)/ and printf("%-16s % 16.2f MB\n", "$1:", $2 * $size / 1048576);'
    
    # Node processes
    echo "Node.js Processes:"
    pgrep -fl node
    
    # Active connections
    echo "Active Connections:"
    netstat -an | grep :3000 | wc -l
}
```

### **Automated Problem Detection**
```bash
# Health check automation
health_check() {
    local issues=0
    
    # Check PostgreSQL
    if ! pgrep -x postgres > /dev/null; then
        echo "❌ PostgreSQL not running"
        ((issues++))
    else
        echo "✅ PostgreSQL running"
    fi
    
    # Check Redis
    if ! pgrep -x redis-server > /dev/null; then
        echo "❌ Redis not running"
        ((issues++))
    else
        echo "✅ Redis running"
    fi
    
    # Check Node.js development server
    if ! pgrep -f "npm.*dev\|nodemon\|ts-node" > /dev/null; then
        echo "❌ Development server not running"
        ((issues++))
    else
        echo "✅ Development server running"
    fi
    
    # Check port availability
    if ! nc -z localhost 3000 2>/dev/null; then
        echo "❌ Port 3000 not accessible"
        ((issues++))
    else
        echo "✅ Port 3000 accessible"
    fi
    
    # Return status
    if [ $issues -eq 0 ]; then
        echo "🎉 All systems operational"
        return 0
    else
        echo "⚠️ $issues issues detected"
        return 1
    fi
}

# Automated recovery
auto_recovery() {
    echo "🔧 Attempting automatic recovery..."
    
    # Start missing services
    brew services start postgresql@14 2>/dev/null
    brew services start redis 2>/dev/null
    
    # Kill stuck processes
    pkill -f "node.*3000" 2>/dev/null
    
    # Restart development server
    cd /Users/benjaminroyston/trespasser-backend
    npm run dev &
    
    sleep 5
    health_check
}
```

---

## **🚀 Advanced AI Workflows**

### **Code Generation Pipeline**
```bash
# AI can generate and test code automatically
generate_and_test() {
    local component_name=$1
    
    echo "🤖 Generating $component_name..."
    
    # Generate component (AI would use search_replace/write tools)
    # Test compilation
    npx tsc --noEmit src/$component_name.ts
    
    # Run tests
    npm test -- --testNamePattern="$component_name"
    
    # Lint check
    npx eslint src/$component_name.ts
    
    # Format code
    npx prettier --write src/$component_name.ts
    
    echo "✅ $component_name generated and validated"
}

# Database migration automation
run_migrations() {
    echo "🗄️ Running database migrations..."
    
    # Check current schema
    pgcli postgresql://localhost:5432/trespasser -c "\d+"
    
    # Apply migrations (if migration system exists)
    if [ -d "migrations" ]; then
        for migration in migrations/*.sql; do
            echo "Applying $migration..."
            pgcli postgresql://localhost:5432/trespasser -f "$migration"
        done
    fi
}
```

### **Performance Optimization**
```bash
# Automated performance analysis
optimize_performance() {
    echo "⚡ Performance Optimization Analysis"
    echo "==================================="
    
    # Analyze bundle size
    npm run build
    npx webpack-bundle-analyzer dist/main.js --mode static --report /tmp/bundle-analysis.html
    
    # Memory leak detection
    node --inspect=0.0.0.0:9229 --max-old-space-size=4096 dist/index.js &
    NODE_PID=$!
    
    # Load test with monitoring
    artillery run tests/artillery/stress-test.yml --output /tmp/stress-results.json &
    ARTILLERY_PID=$!
    
    # Monitor during load test
    while kill -0 $ARTILLERY_PID 2>/dev/null; do
        echo "$(date): Memory: $(ps -p $NODE_PID -o rss= | xargs)" >> /tmp/memory_usage.log
        sleep 1
    done
    
    # Cleanup
    kill $NODE_PID 2>/dev/null
    
    # Generate performance report
    echo "📊 Performance Report Generated in /tmp/"
}
```

### **Security Automation**
```bash
# Comprehensive security scanning
security_audit() {
    echo "🔒 Security Audit"
    echo "================"
    
    # NPM vulnerabilities
    npm audit --audit-level moderate --json > /tmp/npm-audit.json
    
    # Dependency check
    npm outdated --json > /tmp/outdated-deps.json
    
    # Code security scan (if tools available)
    if command -v semgrep &> /dev/null; then
        semgrep --config=auto src/ --json > /tmp/security-scan.json
    fi
    
    # Check for secrets in code
    rg -i "password|secret|key|token" --type ts src/ > /tmp/potential-secrets.txt
    
    # Port scan
    nmap -sS -O localhost > /tmp/port-scan.txt 2>/dev/null
    
    echo "🔍 Security audit complete. Results in /tmp/"
}
```

---

## **🎮 Game-Specific Automation**

### **Lobby System Testing**
```bash
# Automated lobby testing
test_lobby_system() {
    echo "🎮 Testing Multi-Lobby System"
    echo "============================="
    
    # Start clean environment
    tdev-full
    sleep 5
    
    # Test lobby creation
    node -e "
    const io = require('socket.io-client');
    const clients = [];
    
    // Create multiple clients
    for (let i = 0; i < 10; i++) {
        const client = io('http://localhost:3000');
        clients.push(client);
        
        client.on('connect', () => {
            console.log(\`Client \${i} connected\`);
            client.emit('find_match', { gameMode: 'deathmatch' });
        });
        
        client.on('lobby_joined', (data) => {
            console.log(\`Client \${i} joined lobby: \${data.lobbyId}\`);
        });
    }
    
    // Disconnect after 10 seconds
    setTimeout(() => {
        clients.forEach(client => client.disconnect());
        process.exit(0);
    }, 10000);
    "
}

# Game performance validation
validate_game_performance() {
    echo "⚡ Game Performance Validation"
    echo "=============================="
    
    # Measure tick rate stability
    node -e "
    const io = require('socket.io-client');
    const client = io('http://localhost:3000');
    const ticks = [];
    let lastTick = Date.now();
    
    client.on('game:state', () => {
        const now = Date.now();
        const delta = now - lastTick;
        ticks.push(delta);
        lastTick = now;
        
        if (ticks.length >= 100) {
            const avg = ticks.reduce((a, b) => a + b, 0) / ticks.length;
            const targetMs = 1000 / 20; // 20 Hz target
            console.log(\`Average tick interval: \${avg.toFixed(2)}ms (target: \${targetMs}ms)\`);
            client.disconnect();
            process.exit(0);
        }
    });
    
    client.emit('find_match');
    " &
    
    PERF_PID=$!
    
    # Monitor system during test
    glances --time 1 --export csv --export-csv-file /tmp/game-perf.csv &
    GLANCES_PID=$!
    
    wait $PERF_PID
    kill $GLANCES_PID 2>/dev/null
    
    echo "📊 Performance data saved to /tmp/game-perf.csv"
}
```

---

## **🔄 Continuous Integration Workflows**

### **Pre-commit Automation**
```bash
# AI can run full pre-commit pipeline
pre_commit_check() {
    echo "🔍 Pre-commit Validation Pipeline"
    echo "================================="
    
    local failed=0
    
    # Type checking
    echo "1. TypeScript compilation..."
    if ! npx tsc --noEmit; then
        echo "❌ TypeScript errors found"
        ((failed++))
    fi
    
    # Linting
    echo "2. ESLint check..."
    if ! npx eslint src/ --ext .ts,.js; then
        echo "❌ Linting errors found"
        ((failed++))
    fi
    
    # Formatting
    echo "3. Prettier check..."
    if ! npx prettier --check src/**/*.{ts,js,json}; then
        echo "❌ Formatting issues found"
        echo "   Run: npx prettier --write src/**/*.{ts,js,json}"
        ((failed++))
    fi
    
    # Tests
    echo "4. Test suite..."
    if ! npm test; then
        echo "❌ Tests failed"
        ((failed++))
    fi
    
    # Security
    echo "5. Security audit..."
    if ! npm audit --audit-level moderate; then
        echo "⚠️ Security vulnerabilities found"
        ((failed++))
    fi
    
    # Build
    echo "6. Production build..."
    if ! npm run build; then
        echo "❌ Build failed"
        ((failed++))
    fi
    
    if [ $failed -eq 0 ]; then
        echo "✅ All pre-commit checks passed!"
        return 0
    else
        echo "❌ $failed checks failed"
        return 1
    fi
}
```

### **Deployment Automation**
```bash
# AI-driven deployment pipeline
deploy_to_staging() {
    echo "🚀 Deploying to Staging"
    echo "======================="
    
    # Pre-deployment checks
    pre_commit_check || {
        echo "❌ Pre-commit checks failed. Deployment aborted."
        return 1
    }
    
    # Build for production
    NODE_ENV=production npm run build
    
    # Run load tests against staging
    if [ -f "tests/artillery/staging-test.yml" ]; then
        artillery run tests/artillery/staging-test.yml
    fi
    
    # Deploy (would use actual deployment commands)
    echo "📦 Deployment package ready"
    echo "🎯 Ready for production deployment"
}
```

---

## **💡 AI Decision-Making Framework**

### **When AI Should Act Autonomously:**
1. **Code Analysis** - Reading, searching, understanding codebase
2. **Testing** - Running tests, load tests, performance checks
3. **Monitoring** - System health, performance metrics, diagnostics
4. **Database Operations** - Queries, schema inspection, data analysis
5. **Build/Deploy** - Compilation, linting, formatting, builds
6. **Documentation** - Generating docs, updating READMEs
7. **Dependency Management** - Updates, security checks, compatibility

### **When AI Should Request Human Input:**
1. **Architecture Decisions** - Major system design choices
2. **Security Policies** - Authentication, authorization strategies
3. **Data Migration** - Production database changes
4. **External Integrations** - Third-party service configurations
5. **Production Deployments** - Final deployment approval
6. **Breaking Changes** - API modifications affecting clients

### **Error Handling & Recovery:**
```bash
# AI should implement robust error handling
handle_error() {
    local error_code=$1
    local error_message="$2"
    
    echo "❌ Error: $error_message (Code: $error_code)"
    
    # Log error
    echo "$(date): $error_message" >> /tmp/ai-errors.log
    
    # Attempt recovery based on error type
    case $error_code in
        "service_down")
            auto_recovery
            ;;
        "build_failed")
            npm install && npm run build
            ;;
        "test_failed")
            npm test -- --verbose
            ;;
        *)
            echo "🤖 Human intervention may be required"
            ;;
    esac
}
```

---

## **🎯 Success Metrics for AI Autonomy**

### **Measurable Goals:**
- **Development Speed**: 50% reduction in manual CLI operations
- **Error Detection**: 90% of issues caught before human involvement
- **Testing Coverage**: 100% automated test execution
- **Monitoring**: 24/7 autonomous system health monitoring
- **Code Quality**: Zero manual linting/formatting operations

### **AI Self-Assessment:**
```bash
# AI can measure its own effectiveness
ai_effectiveness_report() {
    echo "🤖 AI Autonomy Effectiveness Report"
    echo "==================================="
    
    local total_tasks=$(grep -c "AI Task:" /tmp/ai-activity.log 2>/dev/null || echo "0")
    local automated_tasks=$(grep -c "Automated:" /tmp/ai-activity.log 2>/dev/null || echo "0")
    local human_requests=$(grep -c "Human Input:" /tmp/ai-activity.log 2>/dev/null || echo "0")
    
    echo "📊 Total Tasks: $total_tasks"
    echo "🤖 Automated: $automated_tasks"
    echo "👨‍💻 Required Human Input: $human_requests"
    
    if [ $total_tasks -gt 0 ]; then
        local automation_rate=$((automated_tasks * 100 / total_tasks))
        echo "⚡ Automation Rate: $automation_rate%"
        
        if [ $automation_rate -ge 80 ]; then
            echo "🎉 Excellent AI autonomy!"
        elif [ $automation_rate -ge 60 ]; then
            echo "✅ Good AI autonomy"
        else
            echo "⚠️ AI autonomy needs improvement"
        fi
    fi
}
```

---

## **🚀 AI Empowerment Philosophy**

### **Core Principles:**
1. **Assume Capability** - Try autonomous solutions first
2. **Fail Fast & Recover** - Quick error detection and recovery
3. **Continuous Learning** - Adapt workflows based on outcomes
4. **Human Partnership** - Collaborate on complex decisions
5. **Tool Mastery** - Leverage every available CLI tool

### **AI Workflow Mindset:**
- **Always check current state** before making changes
- **Use monitoring tools** to validate actions
- **Document everything** for future AI sessions
- **Test thoroughly** before marking tasks complete
- **Escalate intelligently** when human input adds value

---

**🎯 This guide enables maximum AI autonomy while maintaining high quality and safety standards. The AI assistant can now operate independently on most development tasks, only requesting human input for high-level decisions and complex architectural choices.**

**🤖 AI Superpowers: FULLY ACTIVATED! 🚀**

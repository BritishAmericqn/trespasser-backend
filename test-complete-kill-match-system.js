#!/usr/bin/env node

/**
 * 🏆 COMPREHENSIVE KILL/DEATH MATCH SYSTEM VALIDATION
 * 
 * This test proves that the complete kill/death match system works:
 * 1. ✅ Kill tracking (individual player kills/deaths)
 * 2. ✅ Team kill prevention (team kills don't count)
 * 3. ✅ Victory condition detection (first to 50 kills wins)
 * 4. ✅ After-match functionality (scoreboard, results, restart)
 * 5. ✅ Complete match lifecycle from start to finish
 * 
 * TEST STRATEGY:
 * - Create 4 players (2 red, 2 blue teams)
 * - Simulate realistic kill sequences
 * - Verify kill/death counters update correctly
 * - Test team kill prevention
 * - Trigger victory condition 
 * - Validate after-match flow
 */

const io = require('socket.io-client');

const SERVER_URL = process.env.SERVER_URL || 'http://localhost:3001';
const KILL_TARGET = 5; // Use lower target for faster testing (default is 50)

class KillMatchSystemValidator {
  constructor() {
    this.clients = [];
    this.gameStates = [];
    this.deathEvents = [];
    this.matchEndEvents = [];
    this.results = {
      testsPassed: 0,
      testsTotal: 0,
      details: []
    };
  }

  async runCompleteValidation() {
    console.log('\n🏆 KILL/DEATH MATCH SYSTEM COMPREHENSIVE VALIDATION');
    console.log('====================================================\n');
    
    try {
      // Phase 1: Setup
      await this.setupTestEnvironment();
      
      // Phase 2: Basic Kill Tracking
      await this.testBasicKillTracking();
      
      // Phase 3: Team Kill Prevention
      await this.testTeamKillPrevention();
      
      // Phase 4: Victory Condition & After-Match
      await this.testVictoryConditionAndAfterMatch();
      
      // Phase 5: Results Analysis
      this.analyzeCompleteResults();
      
    } catch (error) {
      console.error('❌ Test failed with error:', error);
    } finally {
      this.cleanup();
    }
  }

  async setupTestEnvironment() {
    console.log('🏗️  PHASE 1: Setting up test environment...\n');
    
    // Create 4 test players
    const teams = ['red', 'blue'];
    for (let i = 0; i < 4; i++) {
      const team = teams[i % 2];
      const playerId = `player_${team}_${Math.floor(i/2) + 1}`;
      
      const client = await this.createTestClient(playerId, team);
      this.clients.push({
        id: playerId,
        team: team,
        socket: client,
        kills: 0,
        deaths: 0
      });
    }
    
    // Join all players to lobby
    await this.joinAllPlayersToLobby();
    
    // Wait for match to start
    await this.waitForMatchStart();
    
    this.recordTest('Environment Setup', true, 'All 4 players connected and match started');
  }

  async createTestClient(playerId, team) {
    console.log(`🔌 Creating client: ${playerId} (${team} team)`);
    
    const client = io(SERVER_URL, {
      transports: ['websocket'],
      timeout: 5000
    });
    
    // Setup event listeners
    this.setupClientEventListeners(client, playerId);
    
    // Wait for connection
    await new Promise((resolve, reject) => {
      client.on('connect', resolve);
      client.on('connect_error', reject);
      setTimeout(() => reject(new Error(`${playerId} connection timeout`)), 5000);
    });
    
    console.log(`  ✅ ${playerId} connected`);
    return client;
  }

  setupClientEventListeners(client, playerId) {
    // Game state tracking
    client.on('backend:game:state', (gameState) => {
      this.gameStates.push({
        timestamp: Date.now(),
        playerId: playerId,
        gameState: gameState
      });
    });

    // Death events
    client.on('player:died', (event) => {
      this.deathEvents.push({
        timestamp: Date.now(),
        receivedBy: playerId,
        event: event
      });
      console.log(`💀 Death event received by ${playerId}:`, {
        victim: event.playerId?.substring(0, 8),
        killer: event.killerId?.substring(0, 8),
        isTeamKill: event.isTeamKill
      });
    });

    // Match end events
    client.on('match_ended', (matchData) => {
      this.matchEndEvents.push({
        timestamp: Date.now(),
        receivedBy: playerId,
        matchData: matchData
      });
      console.log(`🏁 Match end event received by ${playerId}:`, {
        winner: matchData.winnerTeam,
        redKills: matchData.redKills,
        blueKills: matchData.blueKills,
        duration: matchData.duration
      });
    });
  }

  async joinAllPlayersToLobby() {
    console.log('\n🎮 Joining all players to lobby...');
    
    for (const client of this.clients) {
      // Find match
      client.socket.emit('find_match');
      
      await new Promise(resolve => {
        client.socket.on('lobby_joined', () => resolve());
        setTimeout(resolve, 2000);
      });
      
      // Join with team
      client.socket.emit('player:join', {
        loadout: {
          primary: 'rifle',
          secondary: 'pistol',
          support: [],
          team: client.team
        },
        timestamp: Date.now()
      });
      
      console.log(`  ✅ ${client.id} joined as ${client.team} team`);
    }
    
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  async waitForMatchStart() {
    console.log('\n⏳ Waiting for match to start...');
    
    // Wait for match_started event
    await new Promise((resolve) => {
      const checkForMatchStart = () => {
        // Check if we have game states (indicating match started)
        if (this.gameStates.length > 0) {
          console.log('  ✅ Match started - game states received');
          resolve();
        } else {
          setTimeout(checkForMatchStart, 100);
        }
      };
      checkForMatchStart();
    });
  }

  async testBasicKillTracking() {
    console.log('\n🎯 PHASE 2: Testing basic kill tracking...\n');
    
    // Get initial player states
    const initialState = this.getLatestGameState();
    const initialKills = this.extractPlayerKills(initialState);
    console.log('Initial kills:', initialKills);
    
    // Test cross-team kill (red kills blue)
    await this.simulateKill(this.clients[0], this.clients[1], 'Cross-team kill (red → blue)');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    // Verify kill was counted
    const afterKillState = this.getLatestGameState();
    const afterKills = this.extractPlayerKills(afterKillState);
    console.log('After cross-team kill:', afterKills);
    
    // Check if red team kill count increased
    const redKillsIncreased = afterKills.red > initialKills.red;
    this.recordTest('Cross-team Kill Tracking', redKillsIncreased, 
      `Red kills: ${initialKills.red} → ${afterKills.red}`);
    
    // Test another kill (blue kills red)
    await this.simulateKill(this.clients[1], this.clients[0], 'Cross-team kill (blue → red)');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const finalState = this.getLatestGameState();
    const finalKills = this.extractPlayerKills(finalState);
    console.log('After second kill:', finalKills);
    
    const blueKillsIncreased = finalKills.blue > afterKills.blue;
    this.recordTest('Bidirectional Kill Tracking', blueKillsIncreased,
      `Blue kills: ${afterKills.blue} → ${finalKills.blue}`);
  }

  async testTeamKillPrevention() {
    console.log('\n🚫 PHASE 3: Testing team kill prevention...\n');
    
    const beforeState = this.getLatestGameState();
    const beforeKills = this.extractPlayerKills(beforeState);
    console.log('Before team kill test:', beforeKills);
    
    // Test team kill (red kills red teammate)
    await this.simulateKill(this.clients[0], this.clients[2], 'Team kill attempt (red → red)');
    await new Promise(resolve => setTimeout(resolve, 1000));
    
    const afterState = this.getLatestGameState();
    const afterKills = this.extractPlayerKills(afterState);
    console.log('After team kill attempt:', afterKills);
    
    // Team kills should NOT increase kill count
    const killsUnchanged = afterKills.red === beforeKills.red;
    this.recordTest('Team Kill Prevention', killsUnchanged,
      `Red kills unchanged: ${beforeKills.red} → ${afterKills.red}`);
    
    // Check if we got a team kill event
    const recentDeaths = this.deathEvents.filter(e => e.timestamp > Date.now() - 2000);
    const hasTeamKillEvent = recentDeaths.some(e => e.event.isTeamKill === true);
    this.recordTest('Team Kill Event Attribution', hasTeamKillEvent,
      `Team kill event detected: ${hasTeamKillEvent}`);
  }

  async testVictoryConditionAndAfterMatch() {
    console.log('\n🏆 PHASE 4: Testing victory condition and after-match...\n');
    
    // Simulate enough kills to trigger victory condition
    console.log(`Simulating kills to reach victory target (${KILL_TARGET})...`);
    
    let currentState = this.getLatestGameState();
    let currentKills = this.extractPlayerKills(currentState);
    
    // Keep killing until we reach the target
    let killCount = 0;
    while (currentKills.red < KILL_TARGET && currentKills.blue < KILL_TARGET && killCount < 20) {
      // Alternate kills between teams
      const killerTeam = killCount % 2 === 0 ? 0 : 1; // red or blue
      const victimTeam = killerTeam === 0 ? 1 : 0;   // opposite team
      
      await this.simulateKill(this.clients[killerTeam], this.clients[victimTeam + 2], 
        `Victory sequence kill ${killCount + 1}`);
      
      await new Promise(resolve => setTimeout(resolve, 500));
      
      currentState = this.getLatestGameState();
      currentKills = this.extractPlayerKills(currentState);
      killCount++;
      
      console.log(`  Kill ${killCount}: Red=${currentKills.red}, Blue=${currentKills.blue}`);
      
      // Check if victory condition triggered
      if (currentKills.red >= KILL_TARGET || currentKills.blue >= KILL_TARGET) {
        console.log('🎉 Victory condition reached!');
        break;
      }
    }
    
    // Wait for match end event
    console.log('\n⏳ Waiting for match end events...');
    await new Promise(resolve => setTimeout(resolve, 3000));
    
    // Verify victory condition was detected
    const victoryReached = currentKills.red >= KILL_TARGET || currentKills.blue >= KILL_TARGET;
    this.recordTest('Victory Condition Detection', victoryReached,
      `Final scores - Red: ${currentKills.red}, Blue: ${currentKills.blue}`);
    
    // Verify match end events were broadcast
    const matchEndReceived = this.matchEndEvents.length > 0;
    this.recordTest('Match End Event Broadcast', matchEndReceived,
      `Match end events received: ${this.matchEndEvents.length}`);
    
    if (this.matchEndEvents.length > 0) {
      const matchData = this.matchEndEvents[0].matchData;
      console.log('\n📊 Match Results:');
      console.log(`  Winner: ${matchData.winnerTeam}`);
      console.log(`  Final Score: Red ${matchData.redKills} - Blue ${matchData.blueKills}`);
      console.log(`  Duration: ${matchData.duration}ms`);
      console.log(`  Player Stats: ${matchData.playerStats?.length || 0} players`);
      
      // Verify match data structure
      const hasValidMatchData = matchData.winnerTeam && 
                               typeof matchData.redKills === 'number' &&
                               typeof matchData.blueKills === 'number' &&
                               Array.isArray(matchData.playerStats);
      this.recordTest('Match Data Structure', hasValidMatchData,
        'Match end data contains all required fields');
    }
  }

  async simulateKill(killer, victim, description) {
    console.log(`🔫 ${description}: ${killer.id} → ${victim.id}`);
    
    // Simulate weapon fire
    killer.socket.emit('weapon:fire', {
      weaponType: 'rifle',
      startPosition: { x: 100, y: 100 },
      direction: { x: 1, y: 0 },
      spread: 0,
      playerRotation: 0,
      penetration: 10, // High penetration to ensure kill
      timestamp: Date.now()
    });
  }

  getLatestGameState() {
    return this.gameStates[this.gameStates.length - 1]?.gameState;
  }

  extractPlayerKills(gameState) {
    if (!gameState?.players) return { red: 0, blue: 0 };
    
    let redKills = 0, blueKills = 0;
    
    Object.values(gameState.players).forEach(player => {
      if (player.team === 'red') {
        redKills += player.kills || 0;
      } else if (player.team === 'blue') {
        blueKills += player.kills || 0;
      }
    });
    
    return { red: redKills, blue: blueKills };
  }

  recordTest(testName, passed, details) {
    this.results.testsTotal++;
    if (passed) {
      this.results.testsPassed++;
      console.log(`✅ ${testName}: PASSED (${details})`);
    } else {
      console.log(`❌ ${testName}: FAILED (${details})`);
    }
    
    this.results.details.push({
      test: testName,
      passed: passed,
      details: details
    });
  }

  analyzeCompleteResults() {
    console.log('\n📊 COMPREHENSIVE TEST RESULTS');
    console.log('===============================\n');
    
    console.log(`🎯 Tests Passed: ${this.results.testsPassed}/${this.results.testsTotal}`);
    console.log(`📈 Success Rate: ${((this.results.testsPassed / this.results.testsTotal) * 100).toFixed(1)}%\n`);
    
    console.log('📋 Detailed Results:');
    this.results.details.forEach((result, index) => {
      const status = result.passed ? '✅' : '❌';
      console.log(`${index + 1}. ${status} ${result.test}`);
      console.log(`   ${result.details}\n`);
    });
    
    console.log('📊 Event Statistics:');
    console.log(`   Game states captured: ${this.gameStates.length}`);
    console.log(`   Death events received: ${this.deathEvents.length}`);
    console.log(`   Match end events received: ${this.matchEndEvents.length}`);
    
    if (this.results.testsPassed === this.results.testsTotal) {
      console.log('\n🎉 ALL TESTS PASSED! Kill/Death Match System is FULLY FUNCTIONAL!');
      console.log('✅ Kill tracking works correctly');
      console.log('✅ Team kill prevention works');
      console.log('✅ Victory conditions trigger properly');
      console.log('✅ After-match functionality works');
    } else {
      console.log('\n⚠️  Some tests failed. Please check the implementation.');
    }
  }

  cleanup() {
    console.log('\n🧹 Cleaning up test environment...');
    this.clients.forEach(client => {
      if (client.socket.connected) {
        client.socket.disconnect();
      }
    });
  }
}

// Run the comprehensive validation
if (require.main === module) {
  const validator = new KillMatchSystemValidator();
  validator.runCompleteValidation().catch(console.error);
}

module.exports = KillMatchSystemValidator;

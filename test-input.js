const io = require('socket.io-client');

class InputTester {
    constructor() {
        this.socket = null;
        this.sequence = 0;
        this.testResults = [];
        this.playerState = null;
    }

    async connect() {
        return new Promise((resolve, reject) => {
            this.socket = io('http://localhost:3000');
            
            this.socket.on('connect', () => {
                console.log('✅ Connected to server');
                resolve();
            });
            
            this.socket.on('connect_error', (error) => {
                console.error('❌ Connection failed:', error.message);
                reject(error);
            });
            
            this.socket.on('game:state', (gameState) => {
                if (gameState.players && typeof gameState.players === 'object') {
                    for (const [playerId, playerState] of Object.entries(gameState.players)) {
                        if (playerId === this.socket.id) {
                            this.playerState = playerState;
                        }
                    }
                }
            });
            
            this.socket.on('player:joined', (playerState) => {
                console.log(`🎮 Player joined: ${playerState.id}`);
            });
        });
    }

    sendInput(keys, mouse = { x: 240, y: 135, buttons: 0 }) {
        if (!this.socket || !this.socket.connected) {
            console.error('❌ Not connected to server');
            return;
        }

        const input = {
            keys: {
                w: false,
                a: false,
                s: false,
                d: false,
                shift: false,
                ctrl: false,
                ...keys
            },
            mouse,
            sequence: ++this.sequence,
            timestamp: Date.now()
        };

        this.socket.emit('player:input', input);
        
        const pressedKeys = Object.keys(keys).filter(k => keys[k]);
        const keyStr = pressedKeys.length > 0 ? pressedKeys.join('+') : 'none';
        console.log(`📤 Input sent: keys=${keyStr} mouse=(${mouse.x}, ${mouse.y}) seq=${input.sequence}`);
    }

    async waitForState(timeout = 1000) {
        return new Promise((resolve) => {
            const startTime = Date.now();
            const checkState = () => {
                if (this.playerState || Date.now() - startTime > timeout) {
                    resolve(this.playerState);
                } else {
                    setTimeout(checkState, 50);
                }
            };
            checkState();
        });
    }

    async testMovement(testName, keys, expectedMovementState) {
        console.log(`\n🧪 Testing: ${testName}`);
        
        const initialState = { ...this.playerState };
        this.sendInput(keys);
        
        // Wait for state update
        await new Promise(resolve => setTimeout(resolve, 200));
        
        const finalState = this.playerState;
        
        if (finalState && finalState.movementState === expectedMovementState) {
            console.log(`✅ ${testName} - Movement state: ${finalState.movementState}`);
            this.testResults.push({ test: testName, passed: true });
        } else {
            console.log(`❌ ${testName} - Expected: ${expectedMovementState}, Got: ${finalState?.movementState || 'null'}`);
            this.testResults.push({ test: testName, passed: false });
        }
        
        // Show position change
        if (initialState && finalState) {
            const dx = finalState.transform.position.x - initialState.transform.position.x;
            const dy = finalState.transform.position.y - initialState.transform.position.y;
            const distance = Math.sqrt(dx * dx + dy * dy);
            console.log(`   Position change: (${dx.toFixed(2)}, ${dy.toFixed(2)}) - Distance: ${distance.toFixed(2)}`);
        }
    }

    async testRotation() {
        console.log(`\n🧪 Testing: Mouse rotation`);
        
        const testPositions = [
            { x: 340, y: 135, expectedAngle: 0 },      // Right
            { x: 240, y: 35, expectedAngle: -Math.PI/2 }, // Up
            { x: 140, y: 135, expectedAngle: Math.PI },   // Left
            { x: 240, y: 235, expectedAngle: Math.PI/2 }  // Down
        ];
        
        for (const pos of testPositions) {
            this.sendInput({}, { x: pos.x, y: pos.y, buttons: 0 });
            await new Promise(resolve => setTimeout(resolve, 100));
            
            if (this.playerState) {
                const actualAngle = this.playerState.transform.rotation;
                const angleDiff = Math.abs(actualAngle - pos.expectedAngle);
                const tolerance = 0.1;
                
                if (angleDiff < tolerance || Math.abs(angleDiff - 2*Math.PI) < tolerance) {
                    console.log(`✅ Mouse at (${pos.x}, ${pos.y}) - Angle: ${actualAngle.toFixed(2)} rad`);
                } else {
                    console.log(`❌ Mouse at (${pos.x}, ${pos.y}) - Expected: ${pos.expectedAngle.toFixed(2)}, Got: ${actualAngle.toFixed(2)}`);
                }
            }
        }
    }

    async testBoundaries() {
        console.log(`\n🧪 Testing: Boundary clamping`);
        
        // Move to edge and try to go beyond
        this.sendInput({ a: true }); // Move left
        await new Promise(resolve => setTimeout(resolve, 2000)); // Wait 2 seconds
        
        if (this.playerState) {
            const x = this.playerState.transform.position.x;
            const minX = 6; // PLAYER_SIZE / 2
            
            if (x >= minX) {
                console.log(`✅ Left boundary respected - X position: ${x.toFixed(2)}`);
            } else {
                console.log(`❌ Left boundary violated - X position: ${x.toFixed(2)}`);
            }
        }
        
        // Stop movement
        this.sendInput({});
    }

    async testInputValidation() {
        console.log(`\n🧪 Testing: Input validation`);
        
        // Test invalid sequence (going backward)
        const currentSeq = this.sequence;
        this.sequence = 1; // Reset to old sequence
        
        this.sendInput({ w: true });
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log(`   Sent old sequence number - Server should reject`);
        this.sequence = currentSeq; // Restore sequence
        
        // Test invalid mouse position
        this.sendInput({}, { x: -100, y: -100, buttons: 0 });
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log(`   Sent invalid mouse position - Server should reject`);
        
        // Test valid input again
        this.sendInput({ w: true });
        await new Promise(resolve => setTimeout(resolve, 100));
        
        console.log(`   Sent valid input - Server should accept`);
    }

    async runAllTests() {
        console.log('🚀 Starting comprehensive input tests...\n');
        
        try {
            await this.connect();
            await this.waitForState();
            
            if (!this.playerState) {
                console.error('❌ Failed to receive initial player state');
                return;
            }
            
            console.log(`🎮 Initial player state received - Position: (${this.playerState.transform.position.x.toFixed(2)}, ${this.playerState.transform.position.y.toFixed(2)})`);
            
            // Test different movement states
            await this.testMovement('Idle state', {}, 'idle');
            await this.testMovement('Walking forward', { w: true }, 'walking');
            await this.testMovement('Walking backward', { s: true }, 'walking');
            await this.testMovement('Walking left', { a: true }, 'walking');
            await this.testMovement('Walking right', { d: true }, 'walking');
            await this.testMovement('Diagonal walking', { w: true, d: true }, 'walking');
            await this.testMovement('Running', { w: true, shift: true }, 'running');
            await this.testMovement('Sneaking', { w: true, ctrl: true }, 'sneaking');
            
            // Test rotation
            await this.testRotation();
            
            // Test boundaries
            await this.testBoundaries();
            
            // Test input validation
            await this.testInputValidation();
            
            // Summary
            console.log('\n📊 Test Results Summary:');
            const passed = this.testResults.filter(r => r.passed).length;
            const total = this.testResults.length;
            
            console.log(`✅ Passed: ${passed}/${total}`);
            console.log(`❌ Failed: ${total - passed}/${total}`);
            
            if (passed === total) {
                console.log('🎉 All tests passed! Input system is working correctly.');
            } else {
                console.log('⚠️  Some tests failed. Check the implementation.');
            }
            
        } catch (error) {
            console.error('❌ Test failed:', error.message);
        } finally {
            if (this.socket) {
                this.socket.disconnect();
                console.log('\n👋 Disconnected from server');
            }
        }
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    const tester = new InputTester();
    tester.runAllTests().catch(console.error);
}

module.exports = InputTester; 
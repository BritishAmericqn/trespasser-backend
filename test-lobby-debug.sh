#!/bin/bash

# Start server in background and capture output
echo "Starting server with debug output..."
npm start 2>&1 | tee server-debug.log &
SERVER_PID=$!

# Wait for server to start
sleep 3

# Run the test
echo -e "\n\n=== Running 8-player test ===\n"
node test-manual-8-players.js

# Kill the server
kill $SERVER_PID 2>/dev/null

# Show relevant logs
echo -e "\n\n=== Server Debug Logs ===\n"
grep -E "Checking lobby|Found existing|Created new" server-debug.log | tail -20

# Clean up
rm server-debug.log

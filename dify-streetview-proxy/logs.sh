#!/bin/bash

echo "📖 Viewing Dify Proxy Server Logs"
echo "=================================="
echo "Press Ctrl+C to stop viewing logs"
echo ""

if [ -f "proxy.log" ]; then
    tail -f proxy.log
else
    echo "❌ No log file found. Start the server first with: ./start.sh"
fi
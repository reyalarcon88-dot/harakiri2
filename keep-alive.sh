#!/bin/bash
cd /home/z/my-project
while true; do
  echo "Starting server at $(date)" >> /home/z/my-project/server.log
  bun run dev >> /home/z/my-project/server.log 2>&1
  echo "Server died, restarting in 1s..." >> /home/z/my-project/server.log
  sleep 1
done

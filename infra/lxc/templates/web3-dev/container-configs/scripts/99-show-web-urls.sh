#!/bin/bash
# Display web service URLs on boot

# Get container IP address
CONTAINER_IP=$(hostname -I | awk '{print $1}')

cat << EOF

═══════════════════════════════════════════════════════════
        Web3 Development Container - Access URLs
═══════════════════════════════════════════════════════════

🌐 Web-Based Development Tools:
   
   VS Code Server:  http://${CONTAINER_IP}:8080
                    Password: coder
                    
   FileBrowser:     http://${CONTAINER_IP}:8081
                    Username: admin
                    Password: coder
   
   OpenCode:        http://${CONTAINER_IP}:8082
                    (if installed)

📦 Development Environment:
   
   SSH Access:      ssh coder@${CONTAINER_IP}
   Docker:          docker ps
   Node.js:         node --version
   Foundry:         forge --version

🔧 Management:
   
   Config Sync:     sudo systemctl restart config-manager
   View Logs:       journalctl -u config-manager -f
   Rollback:        config-rollback list

═══════════════════════════════════════════════════════════

Tip: Open VS Code at http://${CONTAINER_IP}:8080 to start coding!

═══════════════════════════════════════════════════════════

EOF

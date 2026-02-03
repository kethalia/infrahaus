#!/bin/bash
# Display web service URLs and welcome message for web3-dev template

# Get container IP address
CONTAINER_IP=$(hostname -I | awk '{print $1}')

cat << EOF

═══════════════════════════════════════════════════════════
        Web3 Development Container - Ready!
═══════════════════════════════════════════════════════════

👤 User Account:
   Username: coder
   UID: 1000
   Groups: sudo, docker
   Shell: bash with Starship prompt

🌐 Web-Based Development:
   
   VS Code Server:  http://${CONTAINER_IP}:8080
                    Password: coder
                    Extensions: Solidity, Tailwind, Prisma, GitLens,
                               Docker, Terraform, GraphQL, and more
                    
   FileBrowser:     http://${CONTAINER_IP}:8081
                    Username: admin
                    Password: coder
   
   OpenCode:        http://${CONTAINER_IP}:8082
                    Alternative web editor

🔌 Terminal Access:
   
   SSH:             ssh coder@${CONTAINER_IP}
   Console:         pct enter <container-id>

📦 Development Stack:
   
   ✓ Docker + Docker Compose (Docker-in-Docker enabled)
   ✓ Node.js with npm and pnpm
   ✓ Foundry (forge, cast, anvil, chisel)
   ✓ GitHub CLI (gh) and act
   ✓ PostgreSQL client tools
   ✓ Git with signing configured

🔧 Configuration Management:
   
   Auto-sync:       Enabled on boot
   Manual sync:     sudo systemctl restart config-manager
   View logs:       journalctl -u config-manager -f
   Rollback:        config-rollback list
   Status:          config-rollback status

💡 Quick Start:
   
   1. Open http://${CONTAINER_IP}:8080 in your browser
   2. Enter password: coder
   3. Open folder: /home/coder/projects
   4. Start coding!

📚 Repository:
   https://github.com/kethalia/pve-home-lab

═══════════════════════════════════════════════════════════

Happy coding! 🚀

═══════════════════════════════════════════════════════════

EOF

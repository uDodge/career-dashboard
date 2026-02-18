# Aria User Manual

Comprehensive deployment and operations guide for the Aria AI ecosystem running on Raspberry Pi 5.

**Version:** 1.0
**Last updated:** 2026-02-18

---

## Table of Contents

1. [System Overview](#1-system-overview)
2. [Prerequisites](#2-prerequisites)
3. [Installation](#3-installation)
4. [Features Guide](#4-features-guide)
5. [Data Model](#5-data-model)
6. [Maintenance & Operations](#6-maintenance--operations)
7. [Troubleshooting](#7-troubleshooting)
8. [Security Reference](#8-security-reference)
9. [Configuration Reference](#9-configuration-reference)
10. [Quick Reference Cheat Sheet](#10-quick-reference-cheat-sheet)

---

## 1. System Overview

### 1.1 Architecture

Aria is a personal AI assistant ecosystem consisting of three Docker containers on a shared bridge network, with Tailscale providing secure remote access.

```
                         +---------------------------+
                         |    Raspberry Pi 5 Host     |
                         |   (192.168.1... / LAN)    |
                         |   ( ..../ Tailscale)|
                         +---------------------------+
                                     |
                    +----------------+----------------+
                    |        agent-zero-net           |
                    |      (Docker bridge network)    |
                    +----------------+----------------+
                    |                |                |
          +---------+----+  +-------+------+  +------+--------+
          | Agent Zero   |  | Career       |  | Telegram      |
          | (Aria)       |  | Dashboard    |  | Bridge        |
          | Port: ....  |  | Port: ....  |  | Port: ....    |
          | Image:       |  | Image:       |  | Image:        |
          | agent0ai/    |  | custom build |  | custom build  |
          | agent-zero   |  | (Flask)      |  | (Python)      |
          +--------------+  +--------------+  +---------------+
```

**Data flows:**

- **Browser -> Dashboard -> Agent Zero:** User opens the dashboard at port 50002. The embedded Aria chat widget sends messages to `/api/chat` on the dashboard, which proxies them to Agent Zero's `/api_message` endpoint over the Docker network.
- **Telegram -> Bridge -> Agent Zero:** User sends a message in Telegram. The bridge container polls the Telegram API, receives the message, and forwards it to Agent Zero's `/api_message` endpoint via HTTP POST. The response is sent back to the Telegram chat.
- **Browser -> Agent Zero direct:** The Agent Zero web UI is accessible at port 50001 for direct interaction and configuration.

### 1.2 Hardware & OS

| Component | Specification |
|-----------|---------------|
| Hardware | Raspberry Pi 5 |
| Architecture | aarch64 (64-bit ARM) |
| OS | Debian 13 (Trixie) / Raspberry Pi OS |
| Kernel | 6.12.62+rpt-rpi-2712 |
| RAM | 16 GB |
| Storage | 234 GB microSD |
| Network | Ethernet (192.168.1.... on LAN) |
| Hostname | a-zero |

**Minimum system requirements:**
- Raspberry Pi 5 with 8 GB RAM (16 GB recommended)
- 32 GB+ microSD card (64 GB+ recommended)
- Wired Ethernet connection (recommended for reliability)
- Internet access (for API calls to OpenRouter, Telegram, etc.)

### 1.3 Component Summary

| Component | Container Name | Image | Host Port | Container Port | Purpose |
|-----------|---------------|-------|-----------|----------------|---------|
| Agent Zero (Aria) | `agent-zero` | `agent0ai/agent-zero` | 192.168.1.... | 80 | AI agent framework |
| Career Dashboard | `career-dashboard` | Custom build | 192.168.1.... | 5000 | Web dashboard for career tracking |
| Telegram Bridge | `telegram-bridge` | Custom build | 0.0.0.0:8080 | 8080 | Telegram bot relay to Agent Zero |

---

## 2. Prerequisites

### 2.1 Hardware

- Raspberry Pi 5 (8 GB or 16 GB RAM)
- microSD card (32 GB minimum, 64 GB+ recommended)
- Ethernet cable and connection to your LAN router
- Power supply (official Pi 5 PSU recommended)

### 2.2 Software

Install these on the Raspberry Pi before proceeding:

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com | sh
sudo usermod -aG docker $USER

# Log out and back in for group change to take effect
# Then verify:
docker --version
docker compose version

# Install git
sudo apt install -y git curl
```

### 2.3 Accounts Needed

You will need accounts and API keys from the following services:

| Service | What You Need | Where to Get It |
|---------|---------------|-----------------|
| **OpenRouter** | API key | https://openrouter.ai/keys |
| **Telegram** | Bot token | Message @BotFather on Telegram |
| **GitHub** | Personal access token | GitHub Settings > Developer settings > Personal access tokens |
| **Brave Search** | API key | https://brave.com/search/api/ |
| **Tailscale** | Account | https://tailscale.com/ |

**Telegram bot setup:**
1. Open Telegram and search for `@BotFather`
2. Send `/newbot` and follow the prompts to name your bot
3. Copy the bot token (format: `123456789:ABCdef........`)
4. Send `/setdescription` to add a description

**Finding your Telegram user ID:**
1. Search for `@userinfobot` on Telegram
2. Send it any message
3. It will reply with your numeric user ID

**GitHub personal access token:**
1. Go to GitHub Settings > Developer settings > Personal access tokens > Tokens (classic)
2. Generate new token with scopes: `repo`, `read:user`
3. Copy the token (format: `ghp_...`)

---

## 3. Installation

### 3.1 Create Docker Network

All three containers communicate over a shared Docker bridge network. Create it first:

```bash
docker network create agent-zero-net
```

Verify:
```bash
docker network ls | grep agent-zero
```

### 3.2 Agent Zero Deployment

#### Directory structure

Create the required directories:

```bash
mkdir -p /home/$USER/claude-workspace/agent-zero
mkdir -p /home/$USER/agent-zero-data
mkdir -p /home/$USER/agent-zero-projects
mkdir -p /home/$USER/agent-zero-logs
```

Agent Zero will use these directories:

| Host Path | Container Mount | Purpose |
|-----------|----------------|---------|
| `/home/$USER/agent-zero-data/` | `/a0` | Persistent data (prompts, knowledge, memory) |
| `/home/$USER/agent-zero-projects/` | `/a0/usr` | User config (settings.json, .env), workdir |
| `/home/$USER/agent-zero-logs/` | `/a0/logs` | Log files |

#### docker-compose.yml

Create `/home/$USER/claude-workspace/agent-zero/docker-compose.yml`:

```yaml
services:
  agent-zero:
    image: agent0ai/agent-zero
    container_name: agent-zero
    hostname: agent-zero
    restart: unless-stopped

    # Bind to LAN interface only - not 0.0.0.0
    ports:
      - "192.168.1.95:50001:80"

    # Persistent volumes
    volumes:
      - /home/udodge/agent-zero-data:/a0
      - /home/udodge/agent-zero-projects:/a0/usr
      - /home/udodge/agent-zero-logs:/a0/logs

    # Read-only root filesystem with targeted tmpfs for runtime dirs
    read_only: true
    tmpfs:
      - /tmp:size=256m
      - /run:size=64m
      - /run/sshd:size=1m,mode=0755,uid=0,gid=0
      - /var/tmp:size=128m
      - /var/log:size=128m
      - /var/cache:size=256m
      - /root:size=64m

    # Drop all capabilities, add back only what's needed
    cap_drop:
      - ALL
    cap_add:
      - NET_BIND_SERVICE
      - SETUID
      - SETGID
      - CHOWN
      - SYS_CHROOT
      - KILL

    # Prevent privilege escalation
    security_opt:
      - no-new-privileges:true

    # Resource limits
    deploy:
      resources:
        limits:
          cpus: "3"
          memory: 8g
          pids: 512
        reservations:
          memory: 4g

    # Environment
    environment:
      - TZ=Europe/Dublin
      - HF_HOME=/a0/usr/hf_cache
      - SENTENCE_TRANSFORMERS_HOME=/a0/usr/hf_cache

    # Isolated network
    networks:
      agent-zero-net:
        aliases:
          - agent-zero

networks:
  agent-zero-net:
    driver: bridge
    name: agent-zero-net
```

> **Important:** Replace `192.168.1...` with your Pi's LAN IP address. Replace `/home/udodge/` with your actual home directory if different.

**Key security features in this configuration:**
- `read_only: true` — Container filesystem is read-only; only mounted volumes and tmpfs are writable
- `cap_drop: ALL` + selective `cap_add` — Drops all Linux capabilities, adds back only essentials
- `no-new-privileges` — Prevents processes from gaining additional privileges
- Resource limits — 3 CPUs, 8 GB RAM, 512 PIDs maximum
- Port binding to LAN IP only — Not exposed on 0.0.0.0

#### First launch

```bash
cd /home/$USER/claude-workspace/agent-zero
docker compose up -d
```

Check it started:
```bash
docker ps | grep agent-zero
docker logs agent-zero --tail 20
```

Access the web UI at `http://192.168.1.....` in your browser.

### 3.3 Agent Zero Configuration

#### .env file

Create `/home/$USER/agent-zero-projects/.env`:

```bash
A0_PERSISTENT_RUNTIME_ID=your_runtime_id_here
ROOT_PASSWORD=your_password_here
OPENROUTER_API_KEY=sk-or-v1-your_openrouter_key_here
```

- `A0_PERSISTENT_RUNTIME_ID` — A fixed string that keeps the API key stable across restarts. Choose any random string.
- `ROOT_PASSWORD` — Password for the Agent Zero web UI and container root user.
- `OPENROUTER_API_KEY` — Your OpenRouter API key for LLM access.

#### settings.json

Create `/home/$USER/agent-zero-projects/settings.json`:

```json
{
    "chat_model_provider": "openrouter",
    "chat_model_name": "google/gemini-2.5-pro",
    "chat_model_api_base": "",
    "chat_model_kwargs": {"temperature": "0"},
    "chat_model_ctx_length": 1000000,
    "chat_model_ctx_history": 0.7,
    "chat_model_vision": true,
    "chat_model_rl_requests": 0,
    "chat_model_rl_input": 0,
    "chat_model_rl_output": 0,

    "util_model_provider": "openrouter",
    "util_model_name": "deepseek/deepseek-chat-v3-0324",
    "util_model_api_base": "",
    "util_model_kwargs": {"temperature": "0"},
    "util_model_ctx_length": 100000,
    "util_model_ctx_input": 0.7,
    "util_model_rl_requests": 0,
    "util_model_rl_input": 0,
    "util_model_rl_output": 0,

    "embed_model_provider": "huggingface",
    "embed_model_name": "sentence-transformers/all-MiniLM-L6-v2",
    "embed_model_api_base": "",
    "embed_model_kwargs": {},
    "embed_model_rl_requests": 0,
    "embed_model_rl_input": 0,

    "browser_model_provider": "openrouter",
    "browser_model_name": "google/gemini-2.5-flash",
    "browser_model_api_base": "",
    "browser_model_vision": true,
    "browser_model_rl_requests": 0,
    "browser_model_rl_input": 0,
    "browser_model_rl_output": 0,
    "browser_model_kwargs": {"temperature": "0"},
    "browser_http_headers": {},

    "agent_profile": "agent0",
    "agent_memory_subdir": "default",
    "agent_knowledge_subdir": "custom",

    "mcp_servers": "{\n    \"mcpServers\": {\n        \"filesystem\": {\n            \"command\": \"npx\",\n            \"args\": [\"-y\", \"@modelcontextprotocol/server-filesystem\", \"/a0/usr/workdir\", \"/a0/knowledge\", \"/a0/usr\"]\n        },\n        \"brave-search\": {\n            \"command\": \"npx\",\n            \"args\": [\"-y\", \"@modelcontextprotocol/server-brave-search\"],\n            \"env\": {\n                \"BRAVE_API_KEY\": \"your_brave_api_key_here\"\n            }\n        },\n        \"github\": {\n            \"command\": \"npx\",\n            \"args\": [\"-y\", \"@modelcontextprotocol/server-github\"],\n            \"env\": {\n                \"GITHUB_PERSONAL_ACCESS_TOKEN\": \"ghp_your_github_token_here\"\n            }\n        }\n    }\n}",

    "memory_recall_enabled": true,
    "memory_recall_delayed": false,
    "memory_recall_interval": 3,
    "memory_recall_history_len": 10000,
    "memory_recall_memories_max_search": 12,
    "memory_recall_solutions_max_search": 8,
    "memory_recall_memories_max_result": 5,
    "memory_recall_solutions_max_result": 3,
    "memory_recall_similarity_threshold": 0.7,
    "memory_recall_query_prep": false,
    "memory_recall_post_filter": false,
    "memory_memorize_enabled": true,
    "memory_memorize_consolidation": true,
    "memory_memorize_replace_threshold": 0.9
}
```

**Model configuration explained:**

| Model | Provider | Model Name | Purpose |
|-------|----------|------------|---------|
| Chat | OpenRouter | google/gemini-2.5-pro | Main conversation model (1M context) |
| Utility | OpenRouter | deepseek/deepseek-chat-v3-0324 | Background tasks, tool use (100K context) |
| Browser | OpenRouter | google/gemini-2.5-flash | Web browsing with vision |
| Embedding | HuggingFace (local) | all-MiniLM-L6-v2 | Memory search, similarity matching |

**MCP Servers explained:**

| Server | Purpose | Access |
|--------|---------|--------|
| Filesystem | Read/write files on the container | `/a0/usr/workdir`, `/a0/knowledge`, `/a0/usr` |
| Brave Search | Web search capability | Requires Brave API key |
| GitHub | Repository access, issues, PRs | Requires GitHub personal access token |

> **Note:** The `mcp_servers` value in settings.json is a JSON string (escaped). Edit it carefully or use the Agent Zero web UI settings panel to modify it.

#### Deriving the API key

Agent Zero generates an API key at startup using this formula:

```
API_KEY = SHA256(runtime_id + ":" + username + ":" + password)[:16]
```

Where:
- `runtime_id` = value of `A0_PERSISTENT_RUNTIME_ID` from .env
- `username` = `"admin"` (default)
- `password` = value of `ROOT_PASSWORD` from .env

To compute it manually:

```bash
echo -n "your_runtime_id:admin:your_password" | sha256sum | cut -c1-16
```

This API key is used as the `X-API-KEY` header when calling `/api_message`. You will need it for the Dashboard and Telegram Bridge configurations.

#### Create required directories

Agent Zero needs writable directories for memory, chats, and knowledge:

```bash
cd /home/$USER/agent-zero-projects
mkdir -p memory chats knowledge uploads workdir skills scheduler agents hf_cache
chmod 777 memory chats knowledge uploads workdir skills scheduler agents hf_cache
```

### 3.4 Aria Persona Configuration

Aria's personality and knowledge are defined by prompt files and knowledge base documents.

#### Role prompt

Edit `/home/$USER/agent-zero-data/prompts/agent.system.main.role.md`:

```bash
sudo nano /home/$USER/agent-zero-data/prompts/agent.system.main.role.md
```

> **Note:** These files are owned by root (created by Docker). Use `sudo` to edit them.

Example content:

```markdown
## Your role
You are Aria -- your user's personal AI career coach and assistant.

Your primary mission: Help your user achieve their career goals.

### What you do:
- **Career coaching**: Break down roadmaps into actionable weekly/monthly tasks
- **Technical mentoring**: Explain concepts in practical terms
- **Accountability partner**: Check in on progress, celebrate wins, course-correct
- **Personal assistant**: Help with scheduling, research, project planning
- **Confidence builder**: Remind of strengths and progress

### How you operate:
- You are an autonomous JSON AI agent
- Solve tasks using tools and subordinates
- Follow behavioral rules and instructions
- Execute code and actions yourself
```

#### Behaviour prompt

Edit `/home/$USER/agent-zero-data/prompts/agent.system.behaviour_default.md`:

```bash
sudo nano /home/$USER/agent-zero-data/prompts/agent.system.behaviour_default.md
```

Example content:

```markdown
- Be friendly, encouraging, and practical
- Break down complex topics into digestible pieces with real-world analogies
- Always give actionable next steps, not just theory
- Celebrate progress and wins, no matter how small
- If the user seems overwhelmed, help prioritize and simplify
- Use casual, conversational tone -- supportive coach, not lecturer
- Proactively suggest relevant resources, projects, or skills
```

#### Knowledge base

Add knowledge files that Aria can reference:

```bash
sudo nano /home/$USER/agent-zero-data/knowledge/main/your_profile.md
sudo nano /home/$USER/agent-zero-data/knowledge/main/your_roadmap.md
```

These files are automatically indexed by the embedding model and recalled when relevant to the conversation.

After editing any prompt or knowledge file, restart Agent Zero:

```bash
cd /home/$USER/claude-workspace/agent-zero
docker compose restart
```

### 3.5 Career Dashboard Deployment

#### Clone the repository

```bash
cd /home/$USER
git clone https://github.com/uDodge/career-dashboard.git
cd career-dashboard
```

#### Create environment file

```bash
cp .env.example .env
```

Edit `.env` and add your Agent Zero API key (the one derived in section 3.3):

```
AGENT_ZERO_API_KEY=your_api_key_here
```

#### Create data file

```bash
cp data/career_data.example.json data/career_data.json
```

Edit `data/career_data.json` with your own career profile, goals, skills, and resources. See [Section 5: Data Model](#5-data-model) for the full schema.

#### docker-compose.yml

The repository includes a `docker-compose.yml`:

```yaml
services:
  career-dashboard:
    build: .
    container_name: career-dashboard
    ports:
      - "192.168.1....:5000"
    volumes:
      - ./data:/app/data
    environment:
      - DATA_FILE=/app/data/career_data.json
      - AGENT_ZERO_WS=ws://agent-zero:80/ws
      - AGENT_ZERO_HTTP=http://agent-zero:80
      - AGENT_ZERO_API_KEY=${AGENT_ZERO_API_KEY}
    networks:
      - agent-zero-net
    restart: unless-stopped

networks:
  agent-zero-net:
    external: true
```

> **Important:** Replace `192.168....` with your Pi's LAN IP.

**Key configuration:**
- Port 50002 on the LAN IP maps to Flask's port 5000 inside the container
- The `data` directory is mounted as a volume so `career_data.json` persists
- `AGENT_ZERO_HTTP` uses the Docker network hostname `agent-zero` (not the host IP)
- `AGENT_ZERO_API_KEY` is loaded from the `.env` file

#### Build and launch

```bash
cd /home/$USER/career-dashboard
docker compose up -d --build
```

Verify:
```bash
docker ps | grep career-dashboard
```

Access at `http://192.168.1....`.

### 3.6 Telegram Bridge Deployment

#### Directory structure

```
/home/$USER/telegram-bridge/
  config.yaml            # Bridge configuration
  docker-compose.yml     # Container definition
  Dockerfile             # Build instructions
  requirements.txt       # Python dependencies
  src/
    main.py              # Application entry point
    telegram_bot.py      # Telegram bot handlers
    agent_zero_client.py # Agent Zero REST API client
    config.py            # Configuration loader
    rate_limiter.py      # Rate limiting
    chunker.py           # Message chunking
  logs/                  # Log files
```

#### config.yaml

```yaml
# Agent Zero Connection (REST API)
agent_zero:
  host: "agent-zero"
  port: 80
  api_key: "${AGENT_ZERO_API_KEY}"
  reconnect_delay: 5
  connect_timeout: 120

# Telegram Bot Configuration
telegram:
  bot_token: "your_bot_token_here"
  polling_interval: 1
  max_connections: 1
  webhook_enabled: false

# Message Processing
messages:
  chunk_size: 4000
  typing_duration: 0.5
  rate_limit: 20
  burst_limit: 30
  max_retries: 3
  retry_delay: 2

# Security
security:
  enabled: true
  allowed_users: [your_telegram_user_id]
  admin_user_id: "your_telegram_user_id"
  rate_limit_per_user: 5
  audit_log_enabled: true

# Logging
logging:
  level: "INFO"
  format: "%(asctime)s - %(name)s - %(levelname)s - %(message)s"
  file: "logs/bridge.log"
  max_size: 10485760
  backup_count: 5

# Health Check
health:
  enabled: true
  port: 8080
  path: "/health"
```

#### docker-compose.yml

```yaml
services:
  telegram-bridge:
    build:
      context: .
      dockerfile: Dockerfile
    container_name: telegram-bridge
    restart: unless-stopped
    ports:
      - "8080:8080"
    environment:
      - TELEGRAM_BOT_TOKEN=your_bot_token_here
      - AGENT_ZERO_API_KEY=your_api_key_here
      - SECURITY_ENABLED=true
      - ALLOWED_USERS=your_telegram_user_id
      - LOG_LEVEL=INFO
    volumes:
      - ./logs:/app/logs
      - ./config.yaml:/app/config.yaml:ro
    networks:
      - agent-zero-net
    healthcheck:
      test: ["CMD", "python", "-c", "import urllib.request; urllib.request.urlopen('http://localhost:8080/health')"]
      interval: 30s
      timeout: 10s
      retries: 3
      start_period: 10s
    deploy:
      resources:
        limits:
          cpus: '0.5'
          memory: 256M
        reservations:
          cpus: '0.1'
          memory: 64M

networks:
  agent-zero-net:
    external: true
```

#### Build and launch

```bash
cd /home/$USER/telegram-bridge
docker compose up -d --build
```

Verify:
```bash
docker ps | grep telegram-bridge
docker logs telegram-bridge --tail 20
```

Test by sending a message to your bot on Telegram.

### 3.7 Firewall (UFW)

Configure the firewall to restrict access:

```bash
# Set defaults
sudo ufw default deny incoming
sudo ufw default allow outgoing

# Allow SSH from anywhere
sudo ufw allow 22/tcp

# Allow Agent Zero from LAN only
sudo ufw allow from 192.168.1.0/24 to any port 50001 proto tcp

# Allow Career Dashboard from LAN only
sudo ufw allow from 192.168.1.0/24 to any port 50002 proto tcp

# Enable the firewall
sudo ufw enable

# Verify rules
sudo ufw status numbered
```

Expected output:
```
Status: active

     To                         Action      From
     --                         ------      ----
[ 1] 22/tcp                     ALLOW IN    Anywhere
[ 2] 50001/tcp                  ALLOW IN    192.168.1.0/24
[ 3] 50002/tcp                  ALLOW IN    192.168.1.0/24
[ 4] 22/tcp (v6)                ALLOW IN    Anywhere (v6)
```

> **Note:** Tailscale traffic bypasses UFW by default because it uses a separate network interface (`tails...`), so no additional firewall rules are needed for remote access via Tailscale.

### 3.8 Tailscale

Tailscale provides encrypted remote access to your Pi from any device without port forwarding.

#### Install on Raspberry Pi

```bash
curl -fsSL https://tailscale.com/install.sh | sh
sudo tailscale up
```

This will print an authentication URL. Open it in a browser and log in to your Tailscale account to authorize the device.

#### Verify

```bash
tailscale status
```

You should see your Pi listed with a Tailscale IP (e.g., `100.x.y.z`).

#### Access services remotely

From any device on your Tailscale network:

| Service | URL |
|---------|-----|
| Agent Zero | `http://100.x.y.z:50001` |
| Career Dashboard | `http://100.x.y.z:50002` |

> **Note:** Replace `100.x.y.z` with your Pi's actual Tailscale IP from `tailscale status`.

#### Set up on other devices

Install the Tailscale app on your MacBook, tablet, or phone:
- **macOS:** Download from https://tailscale.com/download or `brew install tailscale`
- **iOS/Android:** Install from the App Store / Google Play
- Log in with the same Tailscale account

---

## 4. Features Guide

### 4.1 Agent Zero Web UI

Access at `http://192.168.1....` (LAN) or `http://[tailscale-ip]:50001` (remote).

The web UI provides:
- **Chat interface** — Direct conversation with Aria
- **Settings panel** — Configure models, MCP servers, memory settings
- **Context management** — Multiple conversation contexts

**Available tools** that Aria can use autonomously:

| Tool | Purpose |
|------|---------|
| `code_execution` | Run Python, bash, or other code |
| `search_engine` | Web search (via MCP Brave Search) |
| `browser_agent` | Browse websites with vision |
| `document_query` | Query uploaded documents |
| `memory` | Store and recall information across sessions |
| `scheduler` | Schedule tasks for later execution |
| `call_subordinate` | Delegate tasks to sub-agents |
| `skills` | Execute pre-built skill scripts |
| `notify_user` | Send notifications |
| `a2a_chat` | Agent-to-agent communication |
| `behaviour_adjustment` | Modify own behaviour for a conversation |

### 4.2 Career Dashboard Pages

Access at `http://192.168.1.....` (LAN) or `http://[tailscale-ip]:50002` (remote).

#### Dashboard Home (`/`)
- **Stats row** — Days since transition start, current phase name, total achievements, total study hours, pending milestones
- **Weekly focus** — Three columns: Study, Build, Connect with current week's tasks
- **Active milestones** — Checklist of milestones for the current phase with toggleable status
- **Recent achievements** — Latest achievements with category badges
- **Quick actions** — Buttons to log time, add achievement, add learning entry

#### Goals & Roadmap (`/goals`)
- **Phase cards** — All 5 phases displayed as cards with status badges (active/upcoming/complete)
- **Milestones** — Each phase shows its milestones with clickable status toggles (pending/in_progress/complete)

#### Achievements (`/achievements`)
- **Add form** — Title, category (course/project/certification/skill/general), date, description
- **Achievement cards** — Grid of all achievements sorted by date with category badges

#### Timeline (`/timeline`)
- **Vertical timeline** — Visual representation of all 5 phases with dates, descriptions, and status indicators

#### Skills & Learning (`/skills`)
- **Radar chart** — Chart.js radar visualization of 8 core skills (current level vs target)
- **Skill bars** — Progress bars for each skill with current/target values and update buttons
- **Learning log** — Timestamped journal entries with tags, add new entries via form

#### Resources (`/resources`)
- **Filter bar** — Filter by category (course/book/certification/reference/practice) and phase
- **Resource cards** — Title, URL link, category badge, phase badge, status badge
- **Add form** — Add new resources with title, URL, category, phase, status

#### Portfolio (`/portfolio`)
- **Project cards** — Grid of portfolio projects with status (planned/in_progress/complete), descriptions, GitHub links, phase badges
- **Update** — Change project status and add GitHub links
- **Certification roadmap** — Target certifications with month targets and status

#### Monthly Review (`/review`)
- **Self-assessment prompts** — Guided reflection questions for the current phase
- **Confidence journal** — Log wins and breakthroughs with mood/feeling
- **Time tracker** — Log study hours by category (study/build/networking), view weekly totals
- **Networking log** — Track events, contacts, and community involvement

#### Settings (`/settings`)
- **Weekly study target** — Set target hours per week
- **Theme** — Dark/light mode
- **Aria connection status** — Test if Aria is reachable
- **System info** — Current configuration values

### 4.3 Aria Chat Widget

The chat widget appears in the bottom-right corner of every dashboard page.

- Click the chat icon to expand the widget
- Type a message and press Enter or click Send
- Aria responds with markdown-formatted text (headings, lists, code blocks, bold, etc.)
- Conversation context is preserved within the session
- Messages are proxied server-side through `/api/chat` to avoid CORS issues

**How it works internally:**
1. Browser sends POST to dashboard's `/api/chat` with `{message, context_id}`
2. Dashboard Flask app forwards to `http://agent-zero:80/api_message` with `X-API-KEY` header
3. Agent Zero processes the message and returns a response
4. Dashboard returns the response to the browser
5. Response is rendered as HTML using marked.js for markdown parsing

### 4.4 Telegram Bot

Send messages to your Telegram bot to interact with Aria from anywhere.

**Commands:**

| Command | Description |
|---------|-------------|
| `/start` | Welcome message and command list |
| `/help` | Help text with tips |
| `/stats` | Bridge statistics (connection status, rate limiting) |
| `/status` | Agent Zero connection status |
| `/reset` | Reset conversation context |
| `/shutdown` | (Admin only) Shut down the bridge |
| `/reload` | (Admin only) Reload configuration |

**Message flow:**
1. You send a text message in Telegram
2. The bridge container polls Telegram API and receives it
3. Bridge checks user authentication (allowed_users list)
4. Bridge checks rate limit
5. Bridge sends HTTP POST to `http://agent-zero:80/api_message` with `X-API-KEY`
6. Agent Zero processes and responds
7. Bridge sends the response back to your Telegram chat
8. Long responses are automatically chunked into multiple messages (4000 char limit)

**Security features:**
- User whitelist — Only allowed Telegram user IDs can interact
- Rate limiting — Prevents message flooding (default: 5 per user per minute)
- Audit logging — All interactions are logged
- Admin-only commands — Shutdown and reload restricted to admin user

### 4.5 Dashboard API Reference

All POST endpoints accept JSON bodies and return `{"ok": true}` on success.

| Method | Endpoint | Description | Request Body |
|--------|----------|-------------|--------------|
| GET | `/` | Dashboard home page | — |
| GET | `/goals` | Goals & roadmap page | — |
| GET | `/achievements` | Achievement tracker page | — |
| GET | `/timeline` | Visual timeline page | — |
| GET | `/skills` | Skills & learning log page | — |
| GET | `/resources` | Resource library page | — |
| GET | `/portfolio` | Portfolio tracker page | — |
| GET | `/review` | Monthly review page | — |
| GET | `/settings` | Settings page | — |
| GET | `/api/data` | Full career data as JSON | — |
| POST | `/api/achievement` | Add achievement | `{title, category?, date?, description?}` |
| POST | `/api/learning_log` | Add learning log entry | `{entry, date?, tags?}` |
| POST | `/api/time_entry` | Log study hours | `{hours, date?, category?, notes?}` |
| POST | `/api/skill` | Update skill level | `{name, level}` |
| POST | `/api/milestone` | Update milestone status | `{phase_id, title, status}` |
| POST | `/api/confidence` | Add confidence entry | `{win, date?, feeling?}` |
| POST | `/api/resource` | Add resource | `{title, url?, category?, phase?, status?}` |
| POST | `/api/networking` | Add networking entry | `{title, date?, type?, notes?}` |
| POST | `/api/weekly_focus` | Update weekly focus | `{week_of?, study?, build?, connect?}` |
| POST | `/api/portfolio/<id>` | Update portfolio project | `{status?, github?}` |
| POST | `/api/settings` | Update settings | `{key: value, ...}` |
| POST | `/api/chat` | Proxy message to Aria | `{message, context_id?}` |

---

## 5. Data Model

All career data is stored in a single JSON file: `data/career_data.json`.

### Top-level structure

```json
{
  "profile": { ... },
  "phases": [ ... ],
  "skills": [ ... ],
  "achievements": [ ... ],
  "learning_log": [ ... ],
  "resources": [ ... ],
  "portfolio": [ ... ],
  "certifications": [ ... ],
  "time_entries": [ ... ],
  "networking": [ ... ],
  "confidence_journal": [ ... ],
  "weekly_focus": { ... },
  "settings": { ... }
}
```

### Field reference

#### profile
```json
{
  "name": "string",
  "current_role": "string",
  "target_role": "string",
  "industry": "string",
  "experience_years": 12,
  "transition_start": "YYYY-MM-DD",
  "timeline_years": "2-5"
}
```

#### phases[]
```json
{
  "id": 1,
  "name": "Foundation",
  "months": "1-6",
  "status": "active | upcoming | complete",
  "start_date": "YYYY-MM-DD",
  "description": "string",
  "milestones": [
    {
      "title": "string",
      "status": "pending | in_progress | complete",
      "quarter": "Q1"
    }
  ]
}
```

#### skills[]
```json
{
  "name": "Python",
  "level": 25,
  "target": 90,
  "color": "#3776ab"
}
```
- `level` — Current skill level (0-100)
- `target` — Target skill level (0-100)
- `color` — Hex color for chart visualization

#### achievements[]
```json
{
  "id": 1,
  "title": "string",
  "category": "course | project | certification | skill | general",
  "date": "YYYY-MM-DD",
  "description": "string"
}
```

#### learning_log[]
```json
{
  "date": "YYYY-MM-DD",
  "entry": "string",
  "tags": ["tag1", "tag2"]
}
```

#### resources[]
```json
{
  "title": "string",
  "url": "https://...",
  "category": "course | book | certification | reference | practice",
  "phase": 1,
  "status": "pending | in_progress | complete | bookmarked"
}
```

#### portfolio[]
```json
{
  "id": 1,
  "title": "string",
  "status": "planned | in_progress | complete",
  "github": "https://github.com/...",
  "description": "string",
  "phase": 1
}
```

#### certifications[]
```json
{
  "name": "string",
  "target_month": 4,
  "status": "pending | in_progress | complete",
  "phase": 1
}
```

#### time_entries[]
```json
{
  "date": "YYYY-MM-DD",
  "hours": 2.5,
  "category": "study | build | networking",
  "notes": "string"
}
```

#### networking[]
```json
{
  "date": "YYYY-MM-DD",
  "type": "event | meetup | online | contact",
  "title": "string",
  "notes": "string"
}
```

#### confidence_journal[]
```json
{
  "date": "YYYY-MM-DD",
  "win": "string",
  "feeling": "string"
}
```

#### weekly_focus
```json
{
  "week_of": "YYYY-MM-DD",
  "study": ["task 1", "task 2"],
  "build": ["task 1", "task 2"],
  "connect": ["task 1", "task 2"]
}
```

#### settings
```json
{
  "weekly_study_target_hours": 15,
  "agent_zero_url": "ws://agent-zero:80/ws",
  "theme": "dark | light"
}
```

---

## 6. Maintenance & Operations

### 6.1 Container Management

**View all containers:**
```bash
docker ps
```

**Start all services:**
```bash
cd /home/$USER/claude-workspace/agent-zero && docker compose up -d
cd /home/$USER/career-dashboard && docker compose up -d --build
cd /home/$USER/telegram-bridge && docker compose up -d --build
```

**Stop a service:**
```bash
docker compose -f /home/$USER/claude-workspace/agent-zero/docker-compose.yml down
docker compose -f /home/$USER/career-dashboard/docker-compose.yml down
docker compose -f /home/$USER/telegram-bridge/docker-compose.yml down
```

**Restart a service:**
```bash
docker compose -f /home/$USER/claude-workspace/agent-zero/docker-compose.yml restart
docker compose -f /home/$USER/career-dashboard/docker-compose.yml restart
docker compose -f /home/$USER/telegram-bridge/docker-compose.yml restart
```

**View logs:**
```bash
docker logs agent-zero --tail 50
docker logs career-dashboard --tail 50
docker logs telegram-bridge --tail 50

# Follow logs in real-time:
docker logs -f agent-zero
```

**Rebuild after code changes:**
```bash
cd /home/$USER/career-dashboard && docker compose up -d --build
cd /home/$USER/telegram-bridge && docker compose up -d --build
```

> **Note:** Agent Zero uses a pre-built image, so it doesn't need `--build`. The dashboard and telegram bridge are built from local Dockerfiles.

**Check resource usage:**
```bash
docker stats --no-stream
```

### 6.2 Backups

**Critical files to back up:**

| File/Directory | Content |
|----------------|---------|
| `/home/$USER/career-dashboard/data/career_data.json` | All career tracking data |
| `/home/$USER/career-dashboard/.env` | Dashboard API key |
| `/home/$USER/agent-zero-data/prompts/` | Aria persona prompts |
| `/home/$USER/agent-zero-data/knowledge/main/` | Knowledge base documents |
| `/home/$USER/agent-zero-projects/settings.json` | Model and MCP configuration |
| `/home/$USER/agent-zero-projects/.env` | Agent Zero credentials and API keys |
| `/home/$USER/telegram-bridge/config.yaml` | Telegram bridge configuration |
| `/home/$USER/telegram-bridge/docker-compose.yml` | Telegram bridge container definition |
| `/home/$USER/claude-workspace/agent-zero/docker-compose.yml` | Agent Zero container definition |

**Quick backup script:**
```bash
BACKUP_DIR="/home/$USER/backups/$(date +%Y-%m-%d)"
mkdir -p "$BACKUP_DIR"

cp /home/$USER/career-dashboard/data/career_data.json "$BACKUP_DIR/"
cp /home/$USER/career-dashboard/.env "$BACKUP_DIR/dashboard.env"
cp -r /home/$USER/agent-zero-data/prompts/ "$BACKUP_DIR/prompts/"
cp -r /home/$USER/agent-zero-data/knowledge/main/ "$BACKUP_DIR/knowledge/"
cp /home/$USER/agent-zero-projects/settings.json "$BACKUP_DIR/"
cp /home/$USER/agent-zero-projects/.env "$BACKUP_DIR/agent-zero.env"
cp /home/$USER/telegram-bridge/config.yaml "$BACKUP_DIR/"
cp /home/$USER/telegram-bridge/docker-compose.yml "$BACKUP_DIR/telegram-docker-compose.yml"
cp /home/$USER/claude-workspace/agent-zero/docker-compose.yml "$BACKUP_DIR/agent-zero-docker-compose.yml"

echo "Backup saved to $BACKUP_DIR"
```

### 6.3 Updating Agent Zero

```bash
cd /home/$USER/claude-workspace/agent-zero

# Pull the latest image
docker pull agent0ai/agent-zero

# Restart with the new image
docker compose up -d
```

After updating, verify:
- Web UI loads at port 50001
- Settings.json is still being read (check Settings in the UI)
- Prompts are still applied (ask Aria "who are you?")
- Chat works from the dashboard

### 6.4 Updating the Career Dashboard

```bash
cd /home/$USER/career-dashboard

# Pull latest code
git pull

# Rebuild and restart
docker compose up -d --build
```

### 6.5 Log Locations

| Service | How to Access |
|---------|---------------|
| Agent Zero | `docker logs agent-zero` |
| Career Dashboard | `docker logs career-dashboard` |
| Telegram Bridge | `docker logs telegram-bridge` |
| Telegram Bridge (file) | `/home/$USER/telegram-bridge/logs/bridge.log` |
| System logs | `journalctl -xe` |
| UFW firewall | `/var/log/ufw.log` |

### 6.6 Monitoring

**Docker resource usage:**
```bash
docker stats --no-stream
```

**System resources:**
```bash
htop          # Interactive process viewer
free -h       # Memory usage
df -h         # Disk usage
```

**Service health checks:**
```bash
# Telegram bridge health
curl http://localhost:8080/health

# Agent Zero (should return the web UI)
curl -s http://192.168.1.... | head -5

# Dashboard
curl -s http://192.168.1.... | head -5
```

---

## 7. Troubleshooting

### 7.1 Agent Zero Won't Start

**Symptoms:** Container exits immediately or keeps restarting.

**Check logs:**
```bash
docker logs agent-zero --tail 50
```

**Common causes:**
- Missing `.env` file — Ensure `/home/$USER/agent-zero-projects/.env` exists with `A0_PERSISTENT_RUNTIME_ID` and `ROOT_PASSWORD`
- Port conflict — Check if another process uses port 50001: `ss -tlnp | grep 50001`
- Permission issues — Ensure volume directories exist and are writable

### 7.2 Embedding Model Download Fails (No Space Left on Device)

**Symptom:** Agent Zero logs show `OSError: No space left on device` when downloading the sentence-transformers model.

**Cause:** The `/root` directory inside the container is a 64 MB tmpfs mount. HuggingFace tries to cache models there by default.

**Fix:** Set environment variables in the Agent Zero docker-compose.yml:
```yaml
environment:
  - HF_HOME=/a0/usr/hf_cache
  - SENTENCE_TRANSFORMERS_HOME=/a0/usr/hf_cache
```

Then create the cache directory on the host:
```bash
mkdir -p /home/$USER/agent-zero-projects/hf_cache
chmod 777 /home/$USER/agent-zero-projects/hf_cache
```

Restart the container:
```bash
cd /home/$USER/claude-workspace/agent-zero && docker compose restart
```

### 7.3 Dashboard Chat Says "Could Not Reach Aria"

**Symptoms:** The Aria chat widget shows "Could not reach Aria" or similar error.

**Diagnosis steps:**

1. Is Agent Zero running?
   ```bash
   docker ps | grep agent-zero
   ```

2. Can the dashboard container reach Agent Zero?
   ```bash
   docker exec career-dashboard python -c "from urllib.request import urlopen; print(urlopen('http://agent-zero:80').status)"
   ```

3. Is the API key correct? Compare the key in `/home/$USER/career-dashboard/.env` with the derived key:
   ```bash
   echo -n "your_runtime_id:admin:your_password" | sha256sum | cut -c1-16
   ```

4. Are both containers on the same network?
   ```bash
   docker network inspect agent-zero-net
   ```
   Both `agent-zero` and `career-dashboard` should be listed.

### 7.4 Telegram Bot Not Responding

**Symptoms:** Messages sent to the bot in Telegram get no reply.

**Diagnosis steps:**

1. Is the container running?
   ```bash
   docker ps | grep telegram-bridge
   ```

2. Check logs for errors:
   ```bash
   docker logs telegram-bridge --tail 50
   ```

3. Is the bot token valid?
   ```bash
   curl https://api.telegram.org/bot<YOUR_TOKEN>/getMe
   ```
   Should return bot info JSON.

4. Is your user ID in the allowed list? Check `config.yaml` `security.allowed_users`.

5. Is the `AGENT_ZERO_API_KEY` set in `docker-compose.yml`?

6. Can the bridge reach Agent Zero? Check logs for connection errors to `http://agent-zero:80`.

### 7.5 CORS Issues with Chat Widget

**Symptom:** Browser console shows CORS errors when sending chat messages.

**Cause:** The browser on port 50002 cannot directly call Agent Zero on port 50001 due to cross-origin restrictions.

**Fix:** This is already handled by the `/api/chat` proxy endpoint in the dashboard. The browser calls the dashboard, which proxies to Agent Zero server-side. If you see CORS errors, ensure `chat.js` is sending to `/api/chat` (relative URL), not directly to Agent Zero's URL.

### 7.6 Permission Errors in Agent Zero

**Symptom:** Agent Zero logs show `PermissionError` or `Permission denied` when writing to memory, chats, or knowledge directories.

**Fix:** Create and set permissions on the required directories:
```bash
cd /home/$USER/agent-zero-projects
mkdir -p memory chats knowledge uploads workdir skills scheduler agents
chmod 777 memory chats knowledge uploads workdir skills scheduler agents
```

Then restart:
```bash
cd /home/$USER/claude-workspace/agent-zero && docker compose restart
```

### 7.7 Container Shows "Unhealthy"

**Symptom:** `docker ps` shows a container as `(unhealthy)`.

**Diagnosis:**
```bash
# Check what the health check is doing
docker inspect telegram-bridge | grep -A 10 Health

# Test the health endpoint manually
curl http://localhost:8080/health
```

**Common causes:**
- Health check endpoint not responding (service crashed internally)
- Health check timeout too short
- For the Telegram bridge: the health check server may not be implemented or started

**Fix:** Check the container logs for errors and restart:
```bash
docker compose restart
```

### 7.8 Agent Zero Prompts Not Taking Effect

**Symptom:** Aria doesn't respond according to the custom prompts you set.

**Cause:** Prompt files in `/home/$USER/agent-zero-data/prompts/` are owned by root (Docker writes them). They may not have been saved correctly.

**Fix:**
1. Verify file contents:
   ```bash
   sudo cat /home/$USER/agent-zero-data/prompts/agent.system.main.role.md
   ```

2. Edit with sudo:
   ```bash
   sudo nano /home/$USER/agent-zero-data/prompts/agent.system.main.role.md
   ```

3. Restart Agent Zero:
   ```bash
   cd /home/$USER/claude-workspace/agent-zero && docker compose restart
   ```

4. Verify by asking Aria "who are you?" — the response should reflect the role prompt.

---

## 8. Security Reference

### 8.1 Network Security

- **LAN binding** — Agent Zero and Dashboard ports are bound to the LAN IP (`192.168.1.95`) only, not `0.0.0.0`
- **UFW firewall** — Default deny incoming; SSH allowed from anywhere; ports 50001 and 50002 allowed from LAN subnet (`192.168.1.0/24`) only
- **Tailscale** — Encrypted WireGuard tunnel for remote access; no port forwarding or public exposure needed; Tailscale traffic bypasses UFW via the `tailscale0` interface
- **Docker network** — `agent-zero-net` is a bridge network; inter-container communication uses internal hostnames (e.g., `agent-zero`), not exposed ports

### 8.2 Docker Security

Agent Zero uses comprehensive container hardening:

| Feature | Setting | Purpose |
|---------|---------|---------|
| Read-only filesystem | `read_only: true` | Prevents writes to container filesystem |
| Tmpfs mounts | `/tmp`, `/run`, `/var/log`, etc. | Targeted writable areas that reset on restart |
| Capability dropping | `cap_drop: ALL` | Removes all Linux capabilities |
| Selective capabilities | `cap_add: [NET_BIND_SERVICE, ...]` | Adds back only required capabilities |
| No new privileges | `no-new-privileges:true` | Prevents privilege escalation |
| Resource limits | 3 CPUs, 8 GB RAM, 512 PIDs | Prevents resource exhaustion |
| Non-root user | Telegram bridge runs as `appuser` (UID 1000) | Reduces attack surface |

### 8.3 API Security

| Component | Mechanism | Details |
|-----------|-----------|---------|
| Agent Zero API | `X-API-KEY` header | Required for `/api_message` endpoint; derived from SHA256 of credentials |
| Dashboard proxy | Server-side proxy | API key is never sent to the browser; `/api/chat` forwards requests server-side |
| Telegram bridge | User whitelist | Only specified Telegram user IDs can interact |
| Telegram bridge | Rate limiting | Per-user rate limiting (default 5/min) and global rate limiting (20/sec) |
| Telegram bridge | Audit logging | All interactions logged to file |

### 8.4 Secrets Management

**Files containing secrets (never commit to git):**

| File | Secrets | Protected By |
|------|---------|--------------|
| `/home/$USER/agent-zero-projects/.env` | Runtime ID, root password, OpenRouter key | Not in any repo |
| `/home/$USER/agent-zero-projects/settings.json` | Brave Search key, GitHub PAT | Not in any repo |
| `/home/$USER/career-dashboard/.env` | Agent Zero API key | `.gitignore` |
| `/home/$USER/career-dashboard/data/career_data.json` | Personal career data | `.gitignore` |
| `/home/$USER/telegram-bridge/config.yaml` | Bot token (via env var) | Not in any public repo |
| `/home/$USER/telegram-bridge/docker-compose.yml` | Bot token, API key | Not in any public repo |

**Safe for git:**
- `.env.example` files with placeholder values
- `career_data.example.json` with sample data
- All application code, templates, and static assets

---

## 9. Configuration Reference

### 9.1 Agent Zero Environment Variables

File: `/home/$USER/agent-zero-projects/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `A0_PERSISTENT_RUNTIME_ID` | Yes | Fixed string for stable API key generation across restarts |
| `ROOT_PASSWORD` | Yes | Root/admin password for the Agent Zero web UI and container |
| `OPENROUTER_API_KEY` | Yes | API key from OpenRouter for LLM access |

### 9.2 Agent Zero Docker Environment

Set in `docker-compose.yml` under `environment`:

| Variable | Default | Description |
|----------|---------|-------------|
| `TZ` | `UTC` | Timezone (e.g., `Europe/Dublin`) |
| `HF_HOME` | `/root/.cache/huggingface` | HuggingFace model cache directory |
| `SENTENCE_TRANSFORMERS_HOME` | `/root/.cache/...` | Sentence transformers cache directory |

### 9.3 Agent Zero Settings (settings.json)

File: `/home/$USER/agent-zero-projects/settings.json`

**Chat model settings:**

| Field | Type | Description |
|-------|------|-------------|
| `chat_model_provider` | string | LLM provider (`openrouter`, `openai`, `anthropic`, `google`, etc.) |
| `chat_model_name` | string | Model identifier (e.g., `google/gemini-2.5-pro`) |
| `chat_model_api_base` | string | Custom API base URL (leave empty for default) |
| `chat_model_kwargs` | object | Extra model parameters (e.g., `{"temperature": "0"}`) |
| `chat_model_ctx_length` | int | Maximum context length in tokens |
| `chat_model_ctx_history` | float | Fraction of context to use for history (0.0-1.0) |
| `chat_model_vision` | bool | Whether the model supports vision/images |
| `chat_model_rl_requests` | int | Rate limit: max requests per minute (0 = unlimited) |
| `chat_model_rl_input` | int | Rate limit: max input tokens per minute (0 = unlimited) |
| `chat_model_rl_output` | int | Rate limit: max output tokens per minute (0 = unlimited) |

> The same `_provider`, `_name`, `_api_base`, `_kwargs`, `_rl_*` pattern applies to `util_model_*`, `browser_model_*`, and `embed_model_*`.

**Memory settings:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `memory_recall_enabled` | bool | true | Enable memory recall during conversations |
| `memory_recall_delayed` | bool | false | Delay recall to reduce latency |
| `memory_recall_interval` | int | 3 | Messages between automatic recall checks |
| `memory_recall_history_len` | int | 10000 | Characters of history to consider for recall |
| `memory_recall_memories_max_search` | int | 12 | Max memories to search |
| `memory_recall_memories_max_result` | int | 5 | Max memories to return |
| `memory_recall_solutions_max_search` | int | 8 | Max solutions to search |
| `memory_recall_solutions_max_result` | int | 3 | Max solutions to return |
| `memory_recall_similarity_threshold` | float | 0.7 | Minimum similarity score (0.0-1.0) |
| `memory_memorize_enabled` | bool | true | Allow Aria to memorize new information |
| `memory_memorize_consolidation` | bool | true | Consolidate similar memories |
| `memory_memorize_replace_threshold` | float | 0.9 | Similarity threshold for replacing memories |

**MCP servers:**

The `mcp_servers` field contains a JSON string defining MCP (Model Context Protocol) servers. See section 3.3 for the full configuration.

### 9.4 Career Dashboard Environment Variables

File: `/home/$USER/career-dashboard/.env`

| Variable | Required | Description |
|----------|----------|-------------|
| `AGENT_ZERO_API_KEY` | Yes | API key for Agent Zero's `/api_message` endpoint |

Docker compose environment (set in `docker-compose.yml`):

| Variable | Default | Description |
|----------|---------|-------------|
| `DATA_FILE` | `/app/data/career_data.json` | Path to career data JSON file inside container |
| `AGENT_ZERO_WS` | `ws://agent-zero:80/ws` | Agent Zero WebSocket URL (legacy, kept for config) |
| `AGENT_ZERO_HTTP` | `http://agent-zero:80` | Agent Zero HTTP URL for API proxy |

### 9.5 Telegram Bridge Configuration

#### Environment variables (docker-compose.yml)

| Variable | Required | Description |
|----------|----------|-------------|
| `TELEGRAM_BOT_TOKEN` | Yes | Bot token from @BotFather |
| `AGENT_ZERO_API_KEY` | Yes | API key for Agent Zero's `/api_message` endpoint |
| `SECURITY_ENABLED` | No | Enable user whitelist (`true`/`false`) |
| `ALLOWED_USERS` | No | Comma-separated Telegram user IDs |
| `LOG_LEVEL` | No | Logging level (`DEBUG`, `INFO`, `WARNING`, `ERROR`) |

#### config.yaml fields

**agent_zero section:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `host` | string | `agent-zero` | Agent Zero hostname (Docker network name) |
| `port` | int | `80` | Agent Zero HTTP port |
| `api_key` | string | — | API key (supports `${ENV_VAR}` substitution) |
| `reconnect_delay` | int | `5` | Seconds between reconnection attempts |
| `connect_timeout` | int | `120` | Request timeout in seconds |

**telegram section:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `bot_token` | string | — | Telegram bot token |
| `polling_interval` | int | `1` | Seconds between poll requests |
| `max_connections` | int | `1` | Max concurrent connections |
| `webhook_enabled` | bool | `false` | Use webhook instead of polling |
| `webhook_url` | string | — | HTTPS URL for webhook mode |
| `secret_token` | string | — | Secret for webhook verification |

**messages section:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `chunk_size` | int | `4000` | Max characters per Telegram message |
| `typing_duration` | float | `0.5` | Seconds between typing indicators |
| `rate_limit` | int | `20` | Global max messages per second |
| `burst_limit` | int | `30` | Global max burst messages |
| `max_retries` | int | `3` | Max retry attempts for failed sends |
| `retry_delay` | int | `2` | Seconds between retries |

**security section:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | `false` | Enable user authentication |
| `allowed_users` | list | `[]` | List of allowed Telegram user IDs |
| `admin_user_id` | string | — | Admin user ID for management commands |
| `rate_limit_per_user` | int | `5` | Max messages per user per minute |
| `audit_log_enabled` | bool | `false` | Enable audit logging |

**logging section:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `level` | string | `INFO` | Log level |
| `format` | string | (see config) | Log format string |
| `file` | string | `logs/bridge.log` | Log file path |
| `max_size` | int | `10485760` | Max log file size in bytes (10 MB) |
| `backup_count` | int | `5` | Number of rotated log files to keep |

**health section:**

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `enabled` | bool | `true` | Enable health check endpoint |
| `port` | int | `8080` | Health check server port |
| `path` | string | `/health` | Health check URL path |

---

## 10. Quick Reference Cheat Sheet

### Start all services
```bash
cd /home/$USER/claude-workspace/agent-zero && docker compose up -d
cd /home/$USER/career-dashboard && docker compose up -d --build
cd /home/$USER/telegram-bridge && docker compose up -d --build
```

### Stop all services
```bash
docker stop agent-zero career-dashboard telegram-bridge
```

### Restart a service
```bash
docker restart agent-zero
docker restart career-dashboard
docker restart telegram-bridge
```

### View logs
```bash
docker logs agent-zero --tail 50
docker logs career-dashboard --tail 50
docker logs telegram-bridge --tail 50
```

### Rebuild after code changes
```bash
cd /home/$USER/career-dashboard && docker compose up -d --build
cd /home/$USER/telegram-bridge && docker compose up -d --build
```

### Check status
```bash
docker ps                          # All containers
docker stats --no-stream           # Resource usage
tailscale status                   # Tailscale devices
sudo ufw status                    # Firewall rules
```

### Access URLs

| Service | LAN | Tailscale |
|---------|-----|-----------|
| Agent Zero (Aria) | http://192.168.1.95:50001 | http://100.91.22.52:50001 |
| Career Dashboard | http://192.168.1.95:50002 | http://100.91.22.52:50002 |
| Telegram Bridge Health | http://localhost:8080/health | — |

### Backup
```bash
BACKUP_DIR="/home/$USER/backups/$(date +%Y-%m-%d)" && mkdir -p "$BACKUP_DIR"
cp /home/$USER/career-dashboard/data/career_data.json "$BACKUP_DIR/"
cp /home/$USER/agent-zero-projects/settings.json "$BACKUP_DIR/"
cp /home/$USER/agent-zero-projects/.env "$BACKUP_DIR/agent-zero.env"
sudo cp -r /home/$USER/agent-zero-data/prompts/ "$BACKUP_DIR/prompts/"
sudo cp -r /home/$USER/agent-zero-data/knowledge/main/ "$BACKUP_DIR/knowledge/"
```

### Derive Agent Zero API key
```bash
echo -n "runtime_id:admin:password" | sha256sum | cut -c1-16
```

### Update Agent Zero
```bash
cd /home/$USER/claude-workspace/agent-zero
docker pull agent0ai/agent-zero && docker compose up -d
```

### Edit Aria prompts
```bash
sudo nano /home/$USER/agent-zero-data/prompts/agent.system.main.role.md
sudo nano /home/$USER/agent-zero-data/prompts/agent.system.behaviour_default.md
docker restart agent-zero
```

---

*Generated from the Aria ecosystem deployed on Raspberry Pi 5.*
*Manual spec: /home/udodge/templates/specs/aria-user-manual.md*

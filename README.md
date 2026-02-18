# Career Development Dashboard

A web dashboard for tracking a career transition from IT Infrastructure/Support to AI Solutions Architect over 2-5 years. Built with Flask, deployed on Docker alongside [Agent Zero](https://github.com/frdel/agent-zero) on a Raspberry Pi 5.

## Features

- **Dashboard Home** — Overview of current phase, milestones, weekly focus, and recent achievements
- **Goals & Roadmap** — Year-by-year plan with quarterly milestones across 5 career phases
- **Achievements** — Track completed courses, projects, certifications, and skills
- **Timeline** — Visual timeline showing progress through each phase
- **Skills & Learning** — Radar chart of 8 core skills, learning log with tags
- **Resources** — Curated library of courses, books, certifications, and references with filtering
- **Portfolio** — Project tracker with status, GitHub links, and certification roadmap
- **Monthly Review** — Self-assessment prompts, confidence journal, time tracking, networking log
- **Aria Chat** — Embedded AI career coach powered by Agent Zero via REST API proxy

## Screenshots

The dashboard uses a dark theme with responsive layout for desktop and mobile.

## Tech Stack

- **Backend:** Python / Flask
- **Frontend:** HTML, CSS, vanilla JavaScript, Chart.js
- **AI Chat:** Agent Zero with OpenRouter (Gemini 2.5 Pro, DeepSeek V3.2)
- **Data:** JSON file storage
- **Deployment:** Docker on `agent-zero-net` network
- **Remote Access:** Tailscale

## Quick Start

### Prerequisites

- Docker and Docker Compose
- Agent Zero running on the same Docker network
- An Agent Zero API key (from the MCP server token)

### Setup

1. Clone the repo:
   ```bash
   git clone https://github.com/uDodge/career-dashboard.git
   cd career-dashboard
   ```

2. Create your environment file:
   ```bash
   cp .env.example .env
   # Edit .env and add your Agent Zero API key
   ```

3. Create your data file:
   ```bash
   cp data/career_data.example.json data/career_data.json
   # Edit career_data.json with your own career profile
   ```

4. Build and run:
   ```bash
   docker compose up -d --build
   ```

5. Open `http://localhost:50002` in your browser.

### Configuration

| Environment Variable | Description |
|---|---|
| `AGENT_ZERO_API_KEY` | API key for Agent Zero's `/api_message` endpoint |
| `AGENT_ZERO_HTTP` | Agent Zero HTTP URL (default: `http://agent-zero:80`) |
| `DATA_FILE` | Path to career data JSON file (default: `/app/data/career_data.json`) |

### Docker Network

The dashboard expects to be on the same Docker network as Agent Zero for the chat proxy to work:

```yaml
networks:
  agent-zero-net:
    external: true
```

## API Endpoints

| Method | Endpoint | Description |
|---|---|---|
| GET | `/` | Dashboard home |
| GET | `/goals` | Goals & roadmap |
| GET | `/achievements` | Achievement tracker |
| GET | `/timeline` | Visual timeline |
| GET | `/skills` | Skills & learning log |
| GET | `/resources` | Resource library |
| GET | `/portfolio` | Portfolio tracker |
| GET | `/review` | Monthly review |
| GET | `/settings` | Settings page |
| GET | `/api/data` | Full career data JSON |
| POST | `/api/achievement` | Add achievement |
| POST | `/api/learning_log` | Add learning log entry |
| POST | `/api/time_entry` | Log study hours |
| POST | `/api/skill` | Update skill level |
| POST | `/api/milestone` | Update milestone status |
| POST | `/api/confidence` | Add confidence journal entry |
| POST | `/api/resource` | Add resource |
| POST | `/api/networking` | Add networking entry |
| POST | `/api/weekly_focus` | Update weekly focus |
| POST | `/api/portfolio/<id>` | Update portfolio project |
| POST | `/api/settings` | Update settings |
| POST | `/api/chat` | Proxy message to Agent Zero |

## Project Structure

```
career-dashboard/
├── app.py                    # Flask application
├── config.py                 # App configuration
├── Dockerfile
├── docker-compose.yml
├── requirements.txt
├── templates/
│   ├── base.html             # Base template with nav + Aria chat widget
│   ├── dashboard.html        # Home overview
│   ├── goals.html            # Goals & roadmap
│   ├── achievements.html     # Achievement tracker
│   ├── timeline.html         # Visual timeline
│   ├── skills.html           # Skill radar + learning log
│   ├── resources.html        # Resource library
│   ├── portfolio.html        # Portfolio tracker
│   ├── review.html           # Monthly review
│   └── settings.html         # Settings page
├── static/
│   ├── css/style.css         # Dark theme styles
│   └── js/
│       ├── app.js            # Form handlers and utilities
│       ├── chat.js           # Aria chat widget (REST API)
│       └── charts.js         # Skill radar + time tracking charts
└── data/
    └── career_data.json      # Persistent data store
```

## License

MIT

import os

class Config:
    SECRET_KEY = os.environ.get('SECRET_KEY', 'pj-career-dashboard-2026')
    DATA_FILE = os.environ.get('DATA_FILE', '/app/data/career_data.json')
    AGENT_ZERO_WS = os.environ.get('AGENT_ZERO_WS', 'ws://agent-zero:80/ws')
    AGENT_ZERO_HTTP = os.environ.get('AGENT_ZERO_HTTP', 'http://agent-zero:80')
    HOST = os.environ.get('HOST', '0.0.0.0')
    PORT = int(os.environ.get('PORT', 5000))

import json
import os
from datetime import datetime, date
from urllib.request import urlopen, Request
from urllib.error import URLError
from flask import Flask, render_template, request, jsonify
from config import Config

app = Flask(__name__)
app.config.from_object(Config)


def load_data():
    with open(app.config['DATA_FILE'], 'r') as f:
        return json.load(f)


def save_data(data):
    with open(app.config['DATA_FILE'], 'w') as f:
        json.dump(data, f, indent=2)


def days_since_start(data):
    start = datetime.strptime(data['profile']['transition_start'], '%Y-%m-%d').date()
    return (date.today() - start).days


def current_phase(data):
    for phase in data['phases']:
        if phase['status'] == 'active':
            return phase
    return data['phases'][0]


# --- Pages ---

@app.route('/')
def dashboard():
    data = load_data()
    phase = current_phase(data)
    days = days_since_start(data)
    total_achievements = len(data['achievements'])
    total_hours = sum(e.get('hours', 0) for e in data['time_entries'])
    pending_milestones = sum(
        1 for p in data['phases'] for m in p['milestones'] if m['status'] != 'complete'
    )
    return render_template('dashboard.html',
                           data=data, phase=phase, days=days,
                           total_achievements=total_achievements,
                           total_hours=total_hours,
                           pending_milestones=pending_milestones)


@app.route('/goals')
def goals():
    data = load_data()
    return render_template('goals.html', data=data)


@app.route('/achievements')
def achievements():
    data = load_data()
    return render_template('achievements.html', data=data)


@app.route('/timeline')
def timeline():
    data = load_data()
    return render_template('timeline.html', data=data)


@app.route('/skills')
def skills():
    data = load_data()
    return render_template('skills.html', data=data)


@app.route('/resources')
def resources():
    data = load_data()
    return render_template('resources.html', data=data)


@app.route('/portfolio')
def portfolio():
    data = load_data()
    return render_template('portfolio.html', data=data)


@app.route('/review')
def review():
    data = load_data()
    phase = current_phase(data)
    return render_template('review.html', data=data, phase=phase)


@app.route('/settings')
def settings():
    data = load_data()
    return render_template('settings.html', data=data)


# --- API Endpoints ---

@app.route('/api/data')
def api_data():
    return jsonify(load_data())


@app.route('/api/achievement', methods=['POST'])
def add_achievement():
    data = load_data()
    body = request.json
    new_id = max((a['id'] for a in data['achievements']), default=0) + 1
    data['achievements'].append({
        'id': new_id,
        'title': body['title'],
        'category': body.get('category', 'general'),
        'date': body.get('date', date.today().isoformat()),
        'description': body.get('description', '')
    })
    save_data(data)
    return jsonify({'ok': True, 'id': new_id})


@app.route('/api/learning_log', methods=['POST'])
def add_learning_log():
    data = load_data()
    body = request.json
    data['learning_log'].append({
        'date': body.get('date', date.today().isoformat()),
        'entry': body['entry'],
        'tags': body.get('tags', [])
    })
    save_data(data)
    return jsonify({'ok': True})


@app.route('/api/time_entry', methods=['POST'])
def add_time_entry():
    data = load_data()
    body = request.json
    data['time_entries'].append({
        'date': body.get('date', date.today().isoformat()),
        'hours': float(body['hours']),
        'category': body.get('category', 'study'),
        'notes': body.get('notes', '')
    })
    save_data(data)
    return jsonify({'ok': True})


@app.route('/api/skill', methods=['POST'])
def update_skill():
    data = load_data()
    body = request.json
    for skill in data['skills']:
        if skill['name'] == body['name']:
            skill['level'] = int(body['level'])
            break
    save_data(data)
    return jsonify({'ok': True})


@app.route('/api/milestone', methods=['POST'])
def update_milestone():
    data = load_data()
    body = request.json
    phase_id = int(body['phase_id'])
    milestone_title = body['title']
    new_status = body['status']
    for phase in data['phases']:
        if phase['id'] == phase_id:
            for m in phase['milestones']:
                if m['title'] == milestone_title:
                    m['status'] = new_status
                    break
            break
    save_data(data)
    return jsonify({'ok': True})


@app.route('/api/confidence', methods=['POST'])
def add_confidence():
    data = load_data()
    body = request.json
    data['confidence_journal'].append({
        'date': body.get('date', date.today().isoformat()),
        'win': body['win'],
        'feeling': body.get('feeling', '')
    })
    save_data(data)
    return jsonify({'ok': True})


@app.route('/api/resource', methods=['POST'])
def add_resource():
    data = load_data()
    body = request.json
    data['resources'].append({
        'title': body['title'],
        'url': body.get('url', ''),
        'category': body.get('category', 'reference'),
        'phase': int(body.get('phase', 1)),
        'status': body.get('status', 'bookmarked')
    })
    save_data(data)
    return jsonify({'ok': True})


@app.route('/api/networking', methods=['POST'])
def add_networking():
    data = load_data()
    body = request.json
    data['networking'].append({
        'date': body.get('date', date.today().isoformat()),
        'type': body.get('type', 'event'),
        'title': body['title'],
        'notes': body.get('notes', '')
    })
    save_data(data)
    return jsonify({'ok': True})


@app.route('/api/weekly_focus', methods=['POST'])
def update_weekly_focus():
    data = load_data()
    body = request.json
    data['weekly_focus'] = {
        'week_of': body.get('week_of', date.today().isoformat()),
        'study': body.get('study', []),
        'build': body.get('build', []),
        'connect': body.get('connect', [])
    }
    save_data(data)
    return jsonify({'ok': True})


@app.route('/api/portfolio/<int:project_id>', methods=['POST'])
def update_portfolio(project_id):
    data = load_data()
    body = request.json
    for proj in data['portfolio']:
        if proj['id'] == project_id:
            if 'status' in body:
                proj['status'] = body['status']
            if 'github' in body:
                proj['github'] = body['github']
            break
    save_data(data)
    return jsonify({'ok': True})


@app.route('/api/settings', methods=['POST'])
def update_settings():
    data = load_data()
    body = request.json
    data['settings'].update(body)
    save_data(data)
    return jsonify({'ok': True})


@app.route('/api/chat', methods=['POST'])
def chat_proxy():
    """Proxy chat messages to Aria API to avoid CORS issues."""
    body = request.json
    agent_url = app.config['AGENT_ZERO_HTTP'] + '/api_message'
    payload = json.dumps({
        'message': body.get('message', ''),
        'context_id': body.get('context_id', ''),
    }).encode('utf-8')

    req = Request(agent_url, data=payload, method='POST')
    req.add_header('Content-Type', 'application/json')
    req.add_header('X-API-KEY', os.environ.get('AGENT_ZERO_API_KEY', ''))

    try:
        with urlopen(req, timeout=120) as resp:
            result = json.loads(resp.read().decode('utf-8'))
            return jsonify(result)
    except URLError as e:
        return jsonify({'error': f'Could not reach Aria: {e}'}), 502
    except Exception as e:
        return jsonify({'error': str(e)}), 500


if __name__ == '__main__':
    app.run(host=app.config['HOST'], port=app.config['PORT'], debug=False)

// === Utility Functions ===

function showToast(message) {
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.textContent = message;
    document.body.appendChild(toast);
    setTimeout(() => toast.remove(), 2600);
}

async function apiPost(url, data) {
    const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data)
    });
    return res.json();
}

// === Achievement Form ===
async function addAchievement(form) {
    const data = {
        title: form.querySelector('[name="title"]').value,
        category: form.querySelector('[name="category"]').value,
        description: form.querySelector('[name="description"]').value,
        date: form.querySelector('[name="date"]')?.value || new Date().toISOString().slice(0, 10)
    };
    if (!data.title) return;
    await apiPost('/api/achievement', data);
    showToast('Achievement added!');
    setTimeout(() => location.reload(), 500);
}

// === Learning Log ===
async function addLearningLog(form) {
    const entry = form.querySelector('[name="entry"]').value;
    const tagsStr = form.querySelector('[name="tags"]')?.value || '';
    if (!entry) return;
    const tags = tagsStr.split(',').map(t => t.trim()).filter(Boolean);
    await apiPost('/api/learning_log', { entry, tags });
    showToast('Learning logged!');
    setTimeout(() => location.reload(), 500);
}

// === Time Entry ===
async function addTimeEntry(form) {
    const data = {
        hours: form.querySelector('[name="hours"]').value,
        category: form.querySelector('[name="category"]').value,
        notes: form.querySelector('[name="notes"]')?.value || '',
        date: form.querySelector('[name="date"]')?.value || new Date().toISOString().slice(0, 10)
    };
    if (!data.hours) return;
    await apiPost('/api/time_entry', data);
    showToast('Time logged!');
    setTimeout(() => location.reload(), 500);
}

// === Milestone Toggle ===
async function updateMilestone(phaseId, title, currentStatus) {
    const statusOrder = ['pending', 'in_progress', 'complete'];
    const idx = statusOrder.indexOf(currentStatus);
    const newStatus = statusOrder[(idx + 1) % statusOrder.length];
    await apiPost('/api/milestone', { phase_id: phaseId, title, status: newStatus });
    showToast('Milestone updated!');
    setTimeout(() => location.reload(), 500);
}

// === Skill Update ===
async function updateSkill(name, level) {
    await apiPost('/api/skill', { name, level });
    showToast(name + ' updated to ' + level + '%');
}

function toggleSkillSlider(el) {
    const slider = el.closest('.skill-bar-container').querySelector('.skill-slider-row');
    if (slider) slider.classList.toggle('hidden');
}

// === Confidence Journal ===
async function addConfidence(form) {
    const data = {
        win: form.querySelector('[name="win"]').value,
        feeling: form.querySelector('[name="feeling"]')?.value || ''
    };
    if (!data.win) return;
    await apiPost('/api/confidence', data);
    showToast('Win recorded!');
    setTimeout(() => location.reload(), 500);
}

// === Resource ===
async function addResource(form) {
    const data = {
        title: form.querySelector('[name="title"]').value,
        url: form.querySelector('[name="url"]')?.value || '',
        category: form.querySelector('[name="category"]').value,
        phase: form.querySelector('[name="phase"]').value
    };
    if (!data.title) return;
    await apiPost('/api/resource', data);
    showToast('Resource added!');
    setTimeout(() => location.reload(), 500);
}

// === Networking ===
async function addNetworking(form) {
    const data = {
        title: form.querySelector('[name="title"]').value,
        type: form.querySelector('[name="type"]').value,
        notes: form.querySelector('[name="notes"]')?.value || ''
    };
    if (!data.title) return;
    await apiPost('/api/networking', data);
    showToast('Networking entry added!');
    setTimeout(() => location.reload(), 500);
}

// === Portfolio Status ===
async function updatePortfolioStatus(projectId, status) {
    await apiPost('/api/portfolio/' + projectId, { status });
    showToast('Project status updated!');
}

// === Settings ===
async function saveSettings(form) {
    const data = {
        weekly_study_target_hours: parseInt(form.querySelector('[name="weekly_study_target_hours"]').value),
        agent_zero_url: form.querySelector('[name="agent_zero_url"]').value,
        theme: form.querySelector('[name="theme"]').value
    };
    await apiPost('/api/settings', data);
    document.documentElement.setAttribute('data-theme', data.theme);
    showToast('Settings saved!');
}

// === Filter ===
function filterCards(attribute, value, btnEl) {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    if (btnEl) btnEl.classList.add('active');
    document.querySelectorAll('[data-' + attribute + ']').forEach(card => {
        if (value === 'all' || card.dataset[attribute] === value) {
            card.style.display = '';
        } else {
            card.style.display = 'none';
        }
    });
}

// === Form Submit Prevention ===
document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('form[data-api]').forEach(form => {
        form.addEventListener('submit', e => {
            e.preventDefault();
            const handler = form.dataset.api;
            if (window[handler]) window[handler](form);
        });
    });
});

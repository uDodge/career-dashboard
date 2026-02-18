// Aria Chat Widget — via Flask proxy
let chatContextId = null;
let chatReady = false;

function toggleChat() {
    const panel = document.getElementById('chat-panel');
    panel.classList.toggle('hidden');
    if (!panel.classList.contains('hidden') && !chatReady) {
        initChat();
    }
}

function addChatMessage(text, role) {
    const messages = document.getElementById('chat-messages');
    const msg = document.createElement('div');
    msg.className = 'chat-msg ' + role;

    if (role === 'assistant') {
        // Render markdown for agent responses
        msg.innerHTML = marked.parse(text);
    } else {
        msg.textContent = text;
    }

    messages.appendChild(msg);
    messages.scrollTop = messages.scrollHeight;
}

function initChat() {
    chatReady = true;
    addChatMessage('Connected to Aria. Ask me anything about your career journey!', 'system');
}

function setInputEnabled(enabled) {
    const input = document.getElementById('chat-input');
    const btn = document.querySelector('#chat-form button[type="submit"]');
    if (input) input.disabled = !enabled;
    if (btn) btn.disabled = !enabled;
}

async function sendMessage(event) {
    event.preventDefault();
    const input = document.getElementById('chat-input');
    const text = input.value.trim();
    if (!text) return;

    addChatMessage(text, 'user');
    input.value = '';
    setInputEnabled(false);
    addChatMessage('Thinking...', 'system');

    try {
        const payload = { message: text };
        if (chatContextId) {
            payload.context_id = chatContextId;
        }

        const res = await fetch('/api/chat', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(payload)
        });

        // Remove "Thinking..." message
        const messages = document.getElementById('chat-messages');
        const lastMsg = messages.lastElementChild;
        if (lastMsg && lastMsg.textContent === 'Thinking...') {
            messages.removeChild(lastMsg);
        }

        const data = await res.json();

        if (data.error) {
            addChatMessage('Error: ' + data.error, 'system');
            return;
        }

        if (data.context_id) {
            chatContextId = data.context_id;
        }

        if (data.response) {
            addChatMessage(data.response, 'assistant');
        }
    } catch (e) {
        const messages = document.getElementById('chat-messages');
        const lastMsg = messages.lastElementChild;
        if (lastMsg && lastMsg.textContent === 'Thinking...') {
            messages.removeChild(lastMsg);
        }
        addChatMessage('Could not reach Aria. Please try again.', 'system');
    } finally {
        setInputEnabled(true);
        document.getElementById('chat-input').focus();
    }
}

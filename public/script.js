document.addEventListener('DOMContentLoaded', () => {
    const fileInput = document.getElementById('file-input');
    const uploadBtn = document.getElementById('upload-btn');
    const dropArea = document.getElementById('drop-area');
    const fileNameDisplay = document.getElementById('file-name');
    const uploadStatus = document.getElementById('upload-status');
    const sourceList = document.getElementById('source-list');
    
    const chatForm = document.getElementById('chat-form');
    const queryInput = document.getElementById('query-input');
    const sendBtn = document.getElementById('send-btn');
    const chatHistory = document.getElementById('chat-history');
    const appStatus = document.getElementById('app-status');

    let isDocumentLoaded = false;

    // --- File Upload Logic ---

    // Handle drag and drop
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, preventDefaults, false);
    });

    function preventDefaults(e) {
        e.preventDefault();
        e.stopPropagation();
    }

    ['dragenter', 'dragover'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.add('dragover'), false);
    });

    ['dragleave', 'drop'].forEach(eventName => {
        dropArea.addEventListener(eventName, () => dropArea.classList.remove('dragover'), false);
    });

    dropArea.addEventListener('drop', handleDrop, false);

    function handleDrop(e) {
        const dt = e.dataTransfer;
        const files = dt.files;
        if (files.length) {
            fileInput.files = files;
            updateFileName();
        }
    }

    fileInput.addEventListener('change', updateFileName);

    function updateFileName() {
        if (fileInput.files.length > 0) {
            fileNameDisplay.textContent = fileInput.files[0].name;
            uploadBtn.disabled = false;
        } else {
            fileNameDisplay.textContent = 'Click to upload or drag & drop';
            uploadBtn.disabled = true;
        }
    }

    uploadBtn.addEventListener('click', async () => {
        if (fileInput.files.length === 0) return;

        const file = fileInput.files[0];
        const formData = new FormData();
        formData.append('file', file);

        uploadBtn.disabled = true;
        uploadBtn.textContent = 'Processing...';
        showStatus('Uploading and chunking document...', 'success');

        try {
            const response = await fetch('/api/upload', {
                method: 'POST',
                body: formData
            });

            const result = await response.json();

            if (response.ok) {
                showStatus(`Success! Created ${result.chunkCount} chunks.`, 'success');
                isDocumentLoaded = true;
                
                // Add to sources list
                sourceList.innerHTML = `
                    <div style="display:flex; align-items:center; gap:8px; margin-top:10px; padding:10px; background:rgba(255,255,255,0.05); border-radius:6px; border:1px solid var(--border-color);">
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--accent-color)" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"></path><polyline points="14 2 14 8 20 8"></polyline><line x1="16" y1="13" x2="8" y2="13"></line><line x1="16" y1="17" x2="8" y2="17"></line><polyline points="10 9 9 9 8 9"></polyline></svg>
                        <span style="font-size:13px; color:var(--text-primary); text-overflow:ellipsis; overflow:hidden; white-space:nowrap;">${file.name}</span>
                    </div>
                `;

                // Enable chat
                queryInput.disabled = false;
                sendBtn.disabled = false;
                appStatus.textContent = 'Ready to chat';
                appStatus.classList.add('ready');

                // Clear chat welcome message if it's the first doc
                const welcome = document.querySelector('.welcome-message');
                if (welcome) {
                    welcome.innerHTML = `
                        <div class="sparkle-icon">📚</div>
                        <h2>Document Ready</h2>
                        <p>I've read "${file.name}". You can now ask me questions about it.</p>
                    `;
                }

            } else {
                throw new Error(result.error || 'Upload failed');
            }
        } catch (error) {
            showStatus(error.message, 'error');
            uploadBtn.disabled = false;
        } finally {
            uploadBtn.textContent = 'Process Document';
        }
    });

    function showStatus(message, type) {
        uploadStatus.textContent = message;
        uploadStatus.className = `status-msg ${type}`;
        uploadStatus.classList.remove('hidden');
    }

    // --- Chat Logic ---

    chatForm.addEventListener('submit', async (e) => {
        e.preventDefault();
        
        const query = queryInput.value.trim();
        if (!query || !isDocumentLoaded) return;

        // Add user message
        appendMessage('user', query);
        queryInput.value = '';
        
        // Add loading indicator
        const loadingId = 'loading-' + Date.now();
        appendLoadingIndicator(loadingId);
        
        // Scroll to bottom
        scrollToBottom();

        try {
            const response = await fetch('/api/chat', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({ query })
            });

            const result = await response.json();
            
            // Remove loading indicator
            document.getElementById(loadingId).remove();

            if (response.ok) {
                appendMessage('ai', result.answer, result.sources);
            } else {
                appendMessage('ai', `Error: ${result.error}`);
            }
        } catch (error) {
            document.getElementById(loadingId).remove();
            appendMessage('ai', `Connection error: ${error.message}`);
        }
        
        scrollToBottom();
    });

    function appendMessage(role, content, sources = []) {
        // Clear welcome message if present
        const welcome = document.querySelector('.welcome-message');
        if (welcome) welcome.remove();

        const messageDiv = document.createElement('div');
        messageDiv.className = `message ${role}`;
        
        let html = `<div class="message-content">${formatText(content)}</div>`;
        
        // Add source pills if sources exist and it's AI
        if (role === 'ai' && sources && sources.length > 0) {
            html += `<div class="source-references">`;
            // Get unique sources
            const uniqueSources = [...new Set(sources.map(s => s.metadata.source))];
            uniqueSources.forEach(source => {
                html += `<div class="source-pill">📄 ${source}</div>`;
            });
            html += `</div>`;
        }

        messageDiv.innerHTML = html;
        chatHistory.appendChild(messageDiv);
    }

    function appendLoadingIndicator(id) {
        const messageDiv = document.createElement('div');
        messageDiv.className = 'message ai';
        messageDiv.id = id;
        messageDiv.innerHTML = `
            <div class="message-content">
                <div class="typing-indicator">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
            </div>
        `;
        chatHistory.appendChild(messageDiv);
    }

    function scrollToBottom() {
        chatHistory.scrollTop = chatHistory.scrollHeight;
    }

    function formatText(text) {
        // Simple formatting to handle basic newlines and bold
        let formatted = text
            .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
            .replace(/\*(.*?)\*/g, '<em>$1</em>')
            .replace(/\n\n/g, '</p><p>')
            .replace(/\n/g, '<br>');
        return `<p>${formatted}</p>`;
    }

    // Enable/disable send button based on input
    queryInput.addEventListener('input', () => {
        sendBtn.disabled = !queryInput.value.trim() || !isDocumentLoaded;
    });
});

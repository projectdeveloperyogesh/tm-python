/* TaskPulse AI - Master Single-Page Application Controller */
(function() {
    'use strict';

    // Application State
    const state = {
        activeTab: 'recorderTab',
        isRecording: false,
        isPaused: false,
        isMicMuted: false,
        isSpeakerMuted: false,
        statusPollInterval: null,
        currentMeetingId: null,
        meetings: [],
        tasks: [],
        aiLogs: [],
        jobsPollInterval: null,
        isLocalAgentOnline: false
    };

    // DOM Elements Cache
    const tabs = document.querySelectorAll('.nav-tab');
    const tabContents = document.querySelectorAll('.tab-content');

    const startRecordBtn = document.getElementById('startRecordBtn');
    const pauseRecordBtn = document.getElementById('pauseRecordBtn');
    const stopRecordBtn = document.getElementById('stopRecordBtn');
    const recordingTimer = document.getElementById('recordingTimer');
    const timerStatusLabel = document.getElementById('timerStatusLabel');
    const recordingStatusPill = document.getElementById('recordingStatusPill');

    const micSelect = document.getElementById('micSelect');
    const speakerSelect = document.getElementById('speakerSelect');
    const recorderLanguageSelect = document.getElementById('recorderLanguageSelect');
    const meetingTitleInput = document.getElementById('meetingTitleInput');

    const micLevelBar = document.getElementById('micLevelBar');
    const speakerLevelBar = document.getElementById('speakerLevelBar');
    const micLevelVal = document.getElementById('micLevelVal');
    const speakerLevelVal = document.getElementById('speakerLevelVal');
    const liveTranscriptContainer = document.getElementById('liveTranscriptContainer');

    const uploadDropzone = document.getElementById('uploadDropzone');
    const fileInput = document.getElementById('fileInput');
    const uploadTitleInput = document.getElementById('uploadTitleInput');
    const uploadLanguageSelect = document.getElementById('uploadLanguageSelect');
    const processUploadBtn = document.getElementById('processUploadBtn');
    const uploadProgressContainer = document.getElementById('uploadProgressContainer');
    const uploadProgressBar = document.getElementById('uploadProgressBar');
    const uploadStatusText = document.getElementById('uploadStatusText');

    const meetingHistoryList = document.getElementById('meetingHistoryList');
    const meetingDetailsContainer = document.getElementById('meetingDetailsContainer');

    const taskKanbanBoard = document.getElementById('taskKanbanBoard');
    const addTaskBtn = document.getElementById('addTaskBtn');

    const aiLogsTableBody = document.getElementById('aiLogsTableBody');
    const refreshLogsBtn = document.getElementById('refreshLogsBtn');
    const clearLogsBtn = document.getElementById('clearLogsBtn');
    const viewLogModal = document.getElementById('viewLogModal');
    const logModalContent = document.getElementById('logModalContent');
    const closeLogModalBtn = document.getElementById('closeLogModalBtn');

    const openSettingsBtn = document.getElementById('openSettingsBtn');
    const settingsModal = document.getElementById('settingsModal');
    const closeSettingsModalBtn = document.getElementById('closeSettingsModalBtn');
    const saveSettingsBtn = document.getElementById('saveSettingsBtn');

    const LOCAL_AGENT_URL = "http://127.0.0.1:18514";

    // --- Initialization ---
    init();

    async function init() {
        setupTabNavigation();
        try { await loadAudioDevices(); } catch(e) { console.warn('loadAudioDevices notice:', e); }
        try { await loadMeetings(); } catch(e) { console.warn('loadMeetings notice:', e); }
        try { await loadTasks(); } catch(e) { console.warn('loadTasks notice:', e); }
        try { await loadSettings(); } catch(e) { console.warn('loadSettings notice:', e); }
        setupRecorderEvents();
        setupUploaderEvents();
        setupTaskBoardEvents();
        setupInsightsEvents();
        setupModalEvents();
        setupJobsEvents();
        setupAiLogsEvents();
        initCanvasWaveform();
        loadAiLogs();

        checkLocalAgentHealth();
        setInterval(checkLocalAgentHealth, 4000);
    }

    async function checkLocalAgentHealth() {
        const badge = document.getElementById('localAgentBadge');
        const icon = document.getElementById('localAgentIcon');
        const text = document.getElementById('localAgentText');
        const helpBtn = document.getElementById('localAgentHelpBtn');
        if (!badge || !text) return;

        try {
            const controller = new AbortController();
            const timeoutId = setTimeout(() => controller.abort(), 2000);
            const res = await fetch(`${LOCAL_AGENT_URL}/health`, { signal: controller.signal });
            clearTimeout(timeoutId);
            const data = await res.json();

            if (data.status === 'running') {
                state.isLocalAgentOnline = true;
                badge.style.background = 'rgba(52, 211, 153, 0.12)';
                badge.style.borderColor = 'rgba(52, 211, 153, 0.3)';
                if (icon) icon.style.color = '#34d399';
                text.innerHTML = '🟢 Local Soundcard Agent Connected (<span style="font-family: monospace;">127.0.0.1:18514</span>)';
                if (helpBtn) helpBtn.style.display = 'none';
            } else {
                throw new Error('Agent offline');
            }
        } catch (e) {
            state.isLocalAgentOnline = false;
            badge.style.background = 'rgba(248, 113, 113, 0.12)';
            badge.style.borderColor = 'rgba(248, 113, 113, 0.3)';
            if (icon) icon.style.color = '#f87171';
            text.innerHTML = '🔴 Local Soundcard Agent Offline (<span style="font-family: monospace;">127.0.0.1:18514</span>)';
            if (helpBtn) helpBtn.style.display = 'inline-block';
        }
    }

    // --- Navigation Tabs ---
    function activateTab(tabName) {
        tabs.forEach(t => t.classList.remove('active'));
        tabContents.forEach(c => c.classList.remove('active'));

        const tabBtn = document.querySelector(`.nav-tab[data-tab="${tabName}"]`);
        const tabContent = document.getElementById(tabName);

        if (tabBtn) tabBtn.classList.add('active');
        if (tabContent) tabContent.classList.add('active');
        state.activeTab = tabName;
        if (tabName === 'aiLogsTab') {
            loadAiLogs();
        }
        lucide.createIcons();
    }

    function setupTabNavigation() {
        tabs.forEach(tab => {
            tab.addEventListener('click', () => {
                const targetTab = tab.getAttribute('data-tab');
                activateTab(targetTab);
            });
        });
    }

    // --- Audio Device Selectors ---
    async function loadAudioDevices() {
        try {
            const res = await fetch('/api/devices');
            const data = await res.json();

            micSelect.innerHTML = '';
            speakerSelect.innerHTML = '';

            if (data.microphones && data.microphones.length > 0) {
                data.microphones.forEach(m => {
                    const opt = document.createElement('option');
                    opt.value = m.id;
                    opt.textContent = m.name;
                    if (m.is_default) opt.selected = true;
                    micSelect.appendChild(opt);
                });
            } else {
                micSelect.innerHTML = '<option value="">Default Microphone</option>';
            }

            if (data.speakers && data.speakers.length > 0) {
                data.speakers.forEach(s => {
                    const opt = document.createElement('option');
                    opt.value = s.id;
                    opt.textContent = s.name;
                    if (s.is_default) opt.selected = true;
                    speakerSelect.appendChild(opt);
                });
            } else {
                speakerSelect.innerHTML = '<option value="">Default System Audio (WASAPI Loopback)</option>';
            }
        } catch (e) {
            console.error('Error loading audio devices:', e);
        }
    }

    // --- Live Recording ---
    function setupRecorderEvents() {
        const engineSelect = document.getElementById('recordingEngineSelect');
        const deviceSelectorsContainer = document.querySelector('.device-selectors');
        const muteMicBtn = document.getElementById('muteMicBtn');
        const muteSpeakerBtn = document.getElementById('muteSpeakerBtn');

        startRecordBtn.addEventListener('click', async () => {
            const title = meetingTitleInput.value.trim() || 'Live Recorded Meeting';
            const lang = recorderLanguageSelect ? recorderLanguageSelect.value : 'English';
            const serverUrl = window.location.origin;

            if (state.isLocalAgentOnline) {
                try {
                    const res = await fetch(`${LOCAL_AGENT_URL}/start`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            server_url: serverUrl,
                            meeting_title: title,
                            target_language: lang
                        })
                    });
                    const data = await res.json();
                    if (data.status === 'recording_started' || data.status === 'already_recording') {
                        state.isRecording = true;
                        state.isPaused = false;
                        startRecordBtn.disabled = true;
                        pauseRecordBtn.disabled = false;
                        stopRecordBtn.disabled = false;
                        timerStatusLabel.textContent = 'Recording Live (Local Soundcard Agent)';
                        recordingStatusPill.textContent = 'Recording';
                        startStatusPolling();
                        lucide.createIcons();
                        return;
                    }
                } catch (err) {
                    console.warn('Local agent start notice:', err);
                }
            }

            const formData = new FormData();
            formData.append('mic_id', micSelect.value || '');
            formData.append('speaker_id', speakerSelect.value || '');
            formData.append('meeting_title', title);
            formData.append('target_language', lang);

            try {
                const res = await fetch('/api/record/start', { method: 'POST', body: formData });
                const data = await res.json();
                if (data.status === 'recording_started' || data.status === 'already_recording') {
                    state.isRecording = true;
                    state.isPaused = false;
                    startRecordBtn.disabled = true;
                    pauseRecordBtn.disabled = false;
                    stopRecordBtn.disabled = false;
                    timerStatusLabel.textContent = 'Recording Live (Server Soundcard)';
                    recordingStatusPill.textContent = 'Recording';
                    startStatusPolling();
                    lucide.createIcons();
                } else {
                    alert('🎙️ Soundcard Recording Notice: ' + (data.message || 'Please launch start_local_agent.bat on your PC.'));
                }
            } catch (e) {
                alert('Failed to start recording: ' + (e.message || e));
            }
        });

        pauseRecordBtn.addEventListener('click', async () => {
            try {
                let data = null;
                if (state.isLocalAgentOnline) {
                    const res = await fetch(`${LOCAL_AGENT_URL}/pause`, { method: 'POST' });
                    data = await res.json();
                } else {
                    const res = await fetch('/api/record/pause', { method: 'POST' });
                    data = await res.json();
                }

                if (data.status === 'paused') {
                    state.isPaused = true;
                    pauseRecordBtn.innerHTML = '<i data-lucide="play"></i> Resume';
                    timerStatusLabel.textContent = 'Recording Paused';
                    recordingStatusPill.textContent = 'Paused';
                } else if (data.status === 'resumed') {
                    state.isPaused = false;
                    pauseRecordBtn.innerHTML = '<i data-lucide="pause"></i> Pause';
                    timerStatusLabel.textContent = 'Recording Live';
                    recordingStatusPill.textContent = 'Recording';
                }
                lucide.createIcons();
            } catch (e) {
                console.error(e);
            }
        });

        if (muteMicBtn) {
            muteMicBtn.addEventListener('click', async () => {
                state.isMicMuted = !state.isMicMuted;
                if (state.isMicMuted) {
                    muteMicBtn.innerHTML = '<i data-lucide="mic-off"></i> Mic Muted';
                    muteMicBtn.classList.remove('btn-secondary');
                    muteMicBtn.classList.add('btn-danger');
                } else {
                    muteMicBtn.innerHTML = '<i data-lucide="mic"></i> Mic On';
                    muteMicBtn.classList.remove('btn-danger');
                    muteMicBtn.classList.add('btn-secondary');
                }
                
                try {
                    const formData = new FormData();
                    formData.append('target', 'mic');
                    await fetch('/api/record/mute', { method: 'POST', body: formData });
                } catch (e) {
                    console.error(e);
                }
                lucide.createIcons();
            });
        }

        if (muteSpeakerBtn) {
            muteSpeakerBtn.addEventListener('click', async () => {
                state.isSpeakerMuted = !state.isSpeakerMuted;
                if (state.isSpeakerMuted) {
                    muteSpeakerBtn.innerHTML = '<i data-lucide="volume-x"></i> Speaker Muted';
                    muteSpeakerBtn.classList.remove('btn-secondary');
                    muteSpeakerBtn.classList.add('btn-danger');
                } else {
                    muteSpeakerBtn.innerHTML = '<i data-lucide="volume-2"></i> Speaker On';
                    muteSpeakerBtn.classList.remove('btn-danger');
                    muteSpeakerBtn.classList.add('btn-secondary');
                }

                try {
                    const formData = new FormData();
                    formData.append('target', 'speaker');
                    await fetch('/api/record/mute', { method: 'POST', body: formData });
                } catch (e) {
                    console.error(e);
                }
                lucide.createIcons();
            });
        }

        stopRecordBtn.addEventListener('click', async () => {
            if (!state.isRecording) {
                alert('No active recording session is currently running. Please click "Start Recording" first.');
                return;
            }

            const title = meetingTitleInput.value.trim() || 'Live Recorded Meeting';
            const lang = recorderLanguageSelect ? recorderLanguageSelect.value : 'English';

            stopRecordBtn.disabled = true;
            timerStatusLabel.textContent = 'Transcribing & Processing by Cloud AI...';

            try {
                let data = null;
                if (state.isLocalAgentOnline) {
                    const res = await fetch(`${LOCAL_AGENT_URL}/stop`, { method: 'POST' });
                    data = await res.json();
                } else {
                    const formData = new FormData();
                    formData.append('meeting_title', title);
                    formData.append('target_language', lang);

                    const res = await fetch('/api/record/stop', {
                        method: 'POST',
                        body: formData
                    });
                    data = await res.json();
                }

                state.isRecording = false;
                state.isPaused = false;
                stopStatusPolling();

                startRecordBtn.disabled = false;
                pauseRecordBtn.disabled = true;
                pauseRecordBtn.innerHTML = '<i data-lucide="pause"></i> Pause';
                recordingTimer.textContent = '00:00:00';
                timerStatusLabel.textContent = 'Standby';
                recordingStatusPill.textContent = 'Ready';
                micLevelBar.style.width = '0%';
                speakerLevelBar.style.width = '0%';
                micLevelVal.textContent = '0%';
                speakerLevelVal.textContent = '0%';

                if (data && (data.status === 'success' || data.meeting)) {
                    const meeting = data.meeting || data;
                    if (meeting.id) {
                        state.currentMeetingId = meeting.id;
                        await loadMeetings();
                        await loadTasks();
                        switchMeetingSession(meeting.id);
                        activateTab('insightsTab');
                    }
                } else if (data && data.error) {
                    alert('Error processing recording: ' + data.error);
                    startRecordBtn.disabled = false;
                }
            } catch (e) {
                alert('Error processing recording: ' + (e.message || e));
                startRecordBtn.disabled = false;
                stopRecordBtn.disabled = false;
                timerStatusLabel.textContent = 'Standby';
            }
            lucide.createIcons();
        });
    }

    function startStatusPolling() {
        if (state.statusPollInterval) clearInterval(state.statusPollInterval);

        state.statusPollInterval = setInterval(async () => {
            if (!state.isRecording) return;

            try {
                let data = null;
                if (state.isLocalAgentOnline) {
                    const res = await fetch(`${LOCAL_AGENT_URL}/status`);
                    data = await res.json();
                } else {
                    const res = await fetch('/api/record/status');
                    data = await res.json();
                }

                if (data) {
                    const secs = data.elapsed_seconds || 0;
                    const hrs = String(Math.floor(secs / 3600)).padStart(2, '0');
                    const mins = String(Math.floor((secs % 3600) / 60)).padStart(2, '0');
                    const scs = String(secs % 60).padStart(2, '0');
                    recordingTimer.textContent = `${hrs}:${mins}:${scs}`;

                    const rawMic = data.mic_level || 0;
                    const rawSpk = data.speaker_level || 0;

                    const micLvl = Math.min(100, Math.max(0, Math.round(rawMic)));
                    const spkLvl = Math.min(100, Math.max(0, Math.round(rawSpk)));

                    micLevelBar.style.width = `${micLvl}%`;
                    speakerLevelBar.style.width = `${spkLvl}%`;
                    micLevelVal.textContent = `${micLvl}%`;
                    speakerLevelVal.textContent = `${spkLvl}%`;

                    updateWaveform(micLvl, spkLvl);
                }
            } catch (e) {
                console.warn('Status poll notice:', e);
            }
        }, 1000);
    }

    function stopStatusPolling() {
        if (state.statusPollInterval) {
            clearInterval(state.statusPollInterval);
            state.statusPollInterval = null;
        }
    }

    // --- Canvas Waveform Animation ---
    let canvasCtx = null;
    let canvasWidth = 0;
    let canvasHeight = 0;
    let waveformPoints = [];

    function initCanvasWaveform() {
        const canvas = document.getElementById('waveformCanvas');
        if (!canvas) return;
        canvasCtx = canvas.getContext('2d');
        canvasWidth = canvas.width = canvas.parentElement.clientWidth || 400;
        canvasHeight = canvas.height = canvas.parentElement.clientHeight || 120;

        for (let i = 0; i < 40; i++) {
            waveformPoints.push(5);
        }
        drawWaveform();
    }

    function updateWaveform(micLvl, spkLvl) {
        const val = Math.max(5, (micLvl + spkLvl) / 2);
        waveformPoints.push(val);
        if (waveformPoints.length > 50) waveformPoints.shift();
        drawWaveform();
    }

    function drawWaveform() {
        if (!canvasCtx) return;
        canvasCtx.clearRect(0, 0, canvasWidth, canvasHeight);

        const step = canvasWidth / (waveformPoints.length - 1);
        canvasCtx.beginPath();
        canvasCtx.strokeStyle = '#38bdf8';
        canvasCtx.lineWidth = 2;

        for (let i = 0; i < waveformPoints.length; i++) {
            const x = i * step;
            const h = (waveformPoints[i] / 100) * (canvasHeight / 2);
            const y = (canvasHeight / 2) - h;

            if (i === 0) canvasCtx.moveTo(x, y);
            else canvasCtx.lineTo(x, y);
        }
        canvasCtx.stroke();
    }

    // --- Media Upload ---
    function setupUploaderEvents() {
        if (!uploadDropzone || !fileInput) return;

        uploadDropzone.addEventListener('click', () => fileInput.click());
        uploadDropzone.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadDropzone.classList.add('dragover');
        });
        uploadDropzone.addEventListener('dragleave', () => uploadDropzone.classList.remove('dragover'));
        uploadDropzone.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadDropzone.classList.remove('dragover');
            if (e.dataTransfer.files.length > 0) {
                fileInput.files = e.dataTransfer.files;
                updateSelectedFileName();
            }
        });

        fileInput.addEventListener('change', updateSelectedFileName);

        processUploadBtn.addEventListener('click', async () => {
            if (!fileInput.files || fileInput.files.length === 0) {
                alert('Please select an audio or video file first.');
                return;
            }

            const file = fileInput.files[0];
            const title = uploadTitleInput.value.trim() || file.name.replace(/\.[^/.]+$/, "");
            const lang = uploadLanguageSelect.value;

            processUploadBtn.disabled = true;
            uploadProgressContainer.style.display = 'block';
            uploadProgressBar.style.width = '20%';
            uploadStatusText.textContent = 'Uploading media file to server...';

            const formData = new FormData();
            formData.append('file', file);
            formData.append('meeting_title', title);
            formData.append('target_language', lang);

            try {
                uploadProgressBar.style.width = '50%';
                uploadStatusText.textContent = 'Transcribing speech & analyzing with AI...';

                const res = await fetch('/api/upload', {
                    method: 'POST',
                    body: formData
                });
                const data = await res.json();

                uploadProgressBar.style.width = '100%';
                uploadStatusText.textContent = 'Complete!';

                if (data.status === 'success' && data.meeting) {
                    state.currentMeetingId = data.meeting.id;
                    await loadMeetings();
                    await loadTasks();
                    switchMeetingSession(data.meeting.id);
                    activateTab('insightsTab');
                } else {
                    alert('Error: ' + (data.detail || 'Upload failed.'));
                }
            } catch (e) {
                alert('Error uploading file: ' + (e.message || e));
            } finally {
                processUploadBtn.disabled = false;
                setTimeout(() => {
                    uploadProgressContainer.style.display = 'none';
                    uploadProgressBar.style.width = '0%';
                }, 2000);
            }
        });
    }

    function updateSelectedFileName() {
        if (fileInput.files.length > 0) {
            const f = fileInput.files[0];
            uploadDropzone.querySelector('.dropzone-text').textContent = `Selected: ${f.name} (${(f.size / (1024*1024)).toFixed(2)} MB)`;
        }
    }

    // --- Meetings Data Loading ---
    async function loadMeetings() {
        try {
            const res = await fetch('/api/meetings');
            state.meetings = await res.json();
            renderMeetingHistory();
            if (state.meetings.length > 0 && !state.currentMeetingId) {
                switchMeetingSession(state.meetings[0].id);
            }
        } catch (e) {
            console.error('Error loading meetings:', e);
        }
    }

    function renderMeetingHistory() {
        if (!meetingHistoryList) return;
        meetingHistoryList.innerHTML = '';

        if (state.meetings.length === 0) {
            meetingHistoryList.innerHTML = '<div class="empty-state">No recorded meetings yet.</div>';
            return;
        }

        state.meetings.forEach(m => {
            const item = document.createElement('div');
            item.className = `history-item ${m.id === state.currentMeetingId ? 'active' : ''}`;
            item.innerHTML = `
                <div class="history-item-header">
                    <h4>${escapeHtml(m.title)}</h4>
                    <span class="badge badge-sm">${escapeHtml(m.language || 'EN')}</span>
                </div>
                <div class="history-item-meta">
                    <span><i data-lucide="clock"></i> ${escapeHtml(m.created_at || 'Just now')}</span>
                    <span><i data-lucide="check-square"></i> ${m.task_count || 0} Tasks</span>
                </div>
            `;
            item.addEventListener('click', () => switchMeetingSession(m.id));
            meetingHistoryList.appendChild(item);
        });
        lucide.createIcons();
    }

    function switchMeetingSession(id) {
        state.currentMeetingId = id;
        renderMeetingHistory();
        renderMeetingDetails(id);
    }

    function renderMeetingDetails(id) {
        if (!meetingDetailsContainer) return;
        const meeting = state.meetings.find(m => m.id === id);
        if (!meeting) {
            meetingDetailsContainer.innerHTML = '<div class="empty-state">Select a meeting session from the sidebar history to view insights.</div>';
            return;
        }

        const tasksForMeeting = state.tasks.filter(t => t.meeting_id === id);

        meetingDetailsContainer.innerHTML = `
            <div class="glass-card">
                <div class="card-header flex-between">
                    <div>
                        <h2>${escapeHtml(meeting.title)}</h2>
                        <p style="color: var(--text-muted); font-size: 13px;">Recorded: ${escapeHtml(meeting.created_at || 'Recently')}</p>
                    </div>
                    <button class="btn btn-danger btn-sm" id="deleteMeetingBtn"><i data-lucide="trash-2"></i> Delete Session</button>
                </div>

                ${meeting.audio_url ? `
                    <div style="margin: 16px 0;">
                        <audio controls style="width: 100%;">
                            <source src="${escapeHtml(meeting.audio_url)}" type="audio/wav">
                        </audio>
                    </div>
                ` : ''}

                <div class="section-block">
                    <h3><i data-lucide="file-text"></i> Executive Summary</h3>
                    <div class="summary-box">${escapeHtml(meeting.summary || 'No summary available.')}</div>
                </div>

                <div class="section-block margin-top-20">
                    <h3><i data-lucide="check-square"></i> Extracted Action Tasks (${tasksForMeeting.length})</h3>
                    <div class="task-list-simple">
                        ${tasksForMeeting.length > 0 ? tasksForMeeting.map(t => `
                            <div class="task-card-mini priority-${(t.priority || 'medium').toLowerCase()}">
                                <strong>${escapeHtml(t.title)}</strong>
                                <span>Assignee: ${escapeHtml(t.assignee || 'Unassigned')} | Due: ${escapeHtml(t.due_date || 'N/A')}</span>
                            </div>
                        `).join('') : '<p class="text-muted">No action items extracted for this session.</p>'}
                    </div>
                </div>

                <div class="section-block margin-top-20">
                    <h3><i data-lucide="align-left"></i> Full Transcript</h3>
                    <div class="transcript-box">${escapeHtml(meeting.transcript || 'No transcript text available.')}</div>
                </div>
            </div>
        `;

        document.getElementById('deleteMeetingBtn').addEventListener('click', async () => {
            if (confirm(`Are you sure you want to delete "${meeting.title}"?`)) {
                try {
                    await fetch(`/api/meetings/${id}`, { method: 'DELETE' });
                    state.currentMeetingId = null;
                    await loadMeetings();
                    await loadTasks();
                } catch (e) {
                    alert('Error deleting meeting: ' + e);
                }
            }
        });

        lucide.createIcons();
    }

    // --- Action Tasks Data Loading ---
    async function loadTasks() {
        try {
            const res = await fetch('/api/tasks');
            state.tasks = await res.json();
            renderTaskBoard();
        } catch (e) {
            console.error('Error loading tasks:', e);
        }
    }

    function renderTaskBoard() {
        if (!taskKanbanBoard) return;
        taskKanbanBoard.innerHTML = '';

        const statuses = ['todo', 'in_progress', 'completed'];
        const statusTitles = { 'todo': '📋 To Do', 'in_progress': '⏳ In Progress', 'completed': '✅ Completed' };

        statuses.forEach(st => {
            const tasksInCol = state.tasks.filter(t => (t.status || 'todo') === st);
            const col = document.createElement('div');
            col.className = 'kanban-column glass-card';
            col.innerHTML = `
                <div class="column-header">
                    <h3>${statusTitles[st]} (${tasksInCol.length})</h3>
                </div>
                <div class="column-tasks">
                    ${tasksInCol.map(t => `
                        <div class="kanban-task-card priority-${(t.priority || 'medium').toLowerCase()}" data-id="${t.id}">
                            <div class="task-title">${escapeHtml(t.title)}</div>
                            <div class="task-meta">
                                <span>👤 ${escapeHtml(t.assignee || 'Unassigned')}</span>
                                <span>📅 ${escapeHtml(t.due_date || 'No Date')}</span>
                            </div>
                        </div>
                    `).join('')}
                </div>
            `;
            taskKanbanBoard.appendChild(col);
        });
    }

    function setupTaskBoardEvents() {
        if (addTaskBtn) {
            addTaskBtn.addEventListener('click', async () => {
                const title = prompt('Enter Action Task Title:');
                if (!title) return;
                const assignee = prompt('Assignee Name:', 'Alex') || 'Alex';

                try {
                    await fetch('/api/tasks', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            title,
                            assignee,
                            priority: 'High',
                            status: 'todo'
                        })
                    });
                    await loadTasks();
                } catch (e) {
                    alert('Error adding task: ' + e);
                }
            });
        }
    }

    function setupInsightsEvents() {}

    // --- AI Audit Logs ---
    async function loadAiLogs() {
        if (!aiLogsTableBody) return;
        try {
            const res = await fetch('/api/ai/logs');
            state.aiLogs = await res.json();

            aiLogsTableBody.innerHTML = '';
            if (state.aiLogs.length === 0) {
                aiLogsTableBody.innerHTML = '<tr><td colspan="6" class="text-center">No AI audit logs recorded yet.</td></tr>';
                return;
            }

            state.aiLogs.forEach(log => {
                const tr = document.createElement('tr');
                tr.innerHTML = `
                    <td>${escapeHtml(log.timestamp || 'N/A')}</td>
                    <td><span class="badge badge-info">${escapeHtml(log.provider || 'AI Engine')}</span></td>
                    <td><strong>${escapeHtml(log.meeting_title || 'Session')}</strong></td>
                    <td>${log.duration_ms ? log.duration_ms + ' ms' : 'N/A'}</td>
                    <td><span class="badge badge-success">${escapeHtml(log.status || 'OK')}</span></td>
                    <td><button class="btn btn-secondary btn-xs view-log-btn" data-id="${log.id}">Inspect Payload</button></td>
                `;
                aiLogsTableBody.appendChild(tr);
            });

            document.querySelectorAll('.view-log-btn').forEach(btn => {
                btn.addEventListener('click', (e) => {
                    const id = e.target.getAttribute('data-id');
                    const log = state.aiLogs.find(l => String(l.id) === String(id));
                    if (log) showLogModal(log);
                });
            });
        } catch (e) {
            console.error('Error loading AI logs:', e);
        }
    }

    function setupAiLogsEvents() {
        if (refreshLogsBtn) refreshLogsBtn.addEventListener('click', loadAiLogs);
        if (clearLogsBtn) {
            clearLogsBtn.addEventListener('click', async () => {
                if (confirm('Clear all AI audit execution logs?')) {
                    try {
                        await fetch('/api/ai/logs', { method: 'DELETE' });
                        await loadAiLogs();
                    } catch (e) {
                        alert('Error clearing logs: ' + e);
                    }
                }
            });
        }
    }

    function showLogModal(log) {
        if (!viewLogModal || !logModalContent) return;
        logModalContent.innerHTML = `
            <h3>AI Audit Log #${log.id}</h3>
            <p><strong>Provider:</strong> ${escapeHtml(log.provider)}</p>
            <p><strong>Endpoint:</strong> <code>${escapeHtml(log.endpoint)}</code></p>
            <hr style="border-color: rgba(255,255,255,0.1); margin: 12px 0;">
            <h4>Prompt Sent:</h4>
            <pre class="code-block">${escapeHtml(log.prompt || 'N/A')}</pre>
            <h4>cURL Command:</h4>
            <pre class="code-block">${escapeHtml(log.curl_command || 'N/A')}</pre>
            <h4>Raw Response Output:</h4>
            <pre class="code-block">${escapeHtml(log.response_raw || 'N/A')}</pre>
        `;
        viewLogModal.classList.remove('hidden');
    }

    function setupModalEvents() {
        if (closeLogModalBtn && viewLogModal) {
            closeLogModalBtn.addEventListener('click', () => viewLogModal.classList.add('hidden'));
        }
        if (openSettingsBtn && settingsModal) {
            openSettingsBtn.addEventListener('click', () => settingsModal.classList.remove('hidden'));
        }
        if (closeSettingsModalBtn && settingsModal) {
            closeSettingsModalBtn.addEventListener('click', () => settingsModal.classList.add('hidden'));
        }
        if (saveSettingsBtn) {
            saveSettingsBtn.addEventListener('click', async () => {
                const ai_provider = document.getElementById('aiProviderSelect').value;
                const gemini_api_key = document.getElementById('geminiApiKeyInput').value;
                const groq_api_key = document.getElementById('groqApiKeyInput').value;

                try {
                    await fetch('/api/settings', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ ai_provider, gemini_api_key, groq_api_key })
                    });
                    alert('Settings updated successfully!');
                    settingsModal.classList.add('hidden');
                } catch (e) {
                    alert('Error saving settings: ' + e);
                }
            });
        }
    }

    // --- Background Jobs Modal ---
    function setupJobsEvents() {}

    function startJobsPolling() {
        if (state.jobsPollInterval) clearInterval(state.jobsPollInterval);
        state.jobsPollInterval = setInterval(async () => {
            try {
                const res = await fetch('/api/jobs');
                const jobs = await res.json();
                renderJobsModal(jobs);
            } catch (e) {
                console.error(e);
            }
        }, 2000);
    }

    function renderJobsModal(jobs) {
        const container = document.getElementById('bgJobsList');
        if (!container) return;
        container.innerHTML = '';

        if (!jobs || jobs.length === 0) {
            container.innerHTML = '<p class="text-muted">No background jobs active.</p>';
            return;
        }

        jobs.forEach(j => {
            const div = document.createElement('div');
            div.className = 'job-item glass-card margin-top-10';
            div.innerHTML = `
                <div class="flex-between">
                    <strong>${escapeHtml(j.meeting_title || 'Background Session')}</strong>
                    <span class="badge badge-info">${escapeHtml(j.stage)}</span>
                </div>
                <div class="progress-bar-container margin-top-10">
                    <div class="progress-bar" style="width: ${j.progress || 0}%"></div>
                </div>
                <p style="font-size: 11px; color: var(--text-muted); margin-top: 4px;">${escapeHtml(j.status_message || '')}</p>
            `;
            container.appendChild(div);
        });
    }

    async function loadSettings() {
        try {
            const res = await fetch('/api/settings');
            const data = await res.json();
            if (data) {
                if (data.ai_provider) document.getElementById('aiProviderSelect').value = data.ai_provider;
                if (data.gemini_api_key) document.getElementById('geminiApiKeyInput').value = data.gemini_api_key;
                if (data.groq_api_key) document.getElementById('groqApiKeyInput').value = data.groq_api_key;
            }
        } catch (e) {
            console.error('Error loading settings:', e);
        }
    }

    function escapeHtml(str) {
        if (!str) return '';
        return String(str)
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;')
            .replace(/"/g, '&quot;')
            .replace(/'/g, '&#039;');
    }
})();

/**
 * MNEMONIC FORGE: P-REALM ACCELERATOR
 * Cognitive State Entrainment & Audio Matrix Engine
 */

// --- STATE MANAGEMENT ---
let audioCtx = null;
let currentAudioNodes = [];
let timerInterval = null;
let timeRemaining = 300; // Default 5 minutes (300 seconds)
let isTimerRunning = false;
let activeFrequency = null;

// --- DOM ELEMENTS (Will hook into p-realm.html) ---
const timerDisplay = document.getElementById('timer-display');
const timeSlider = document.getElementById('time-slider');
const toggleTimerBtn = document.getElementById('toggle-timer-btn');
const heartbeatOverlay = document.getElementById('heartbeat-overlay');

// --- AUDIO SYNTHESIS ENGINE ---
// Initializes the browser's audio engine (must be done after a user click due to browser policies)
function initAudio() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Stops all currently playing frequencies/noise
function stopAllAudio() {
    currentAudioNodes.forEach(node => {
        try { node.stop(); } catch (e) {}
        try { node.disconnect(); } catch (e) {}
    });
    currentAudioNodes = [];
    activeFrequency = null;
    document.querySelectorAll('.freq-btn').forEach(btn => btn.classList.remove('active-glow'));
}

// Generates Isochronic Tones (A base frequency pulsing at a specific brainwave Hz)
function playIsochronicTone(baseFreq, pulseHz) {
    initAudio();
    stopAllAudio();

    // The core sound
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'sine';
    oscillator.frequency.value = baseFreq;

    // The volume modulator (creates the pulsing effect)
    const gainNode = audioCtx.createGain();
    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = pulseHz; // e.g., 40Hz for Gamma

    // Routing: LFO -> Gain Node -> Audio Destination
    lfo.connect(gainNode.gain);
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    lfo.start();

    currentAudioNodes.push(oscillator, lfo, gainNode);
}

// Generates procedural noise (Brown/Pink) using buffer manipulation
function playNoise(type) {
    initAudio();
    stopAllAudio();

    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        let white = Math.random() * 2 - 1;
        if (type === 'brown') {
            output[i] = (lastOut + (0.02 * white)) / 1.02; // Brown noise algorithm
            lastOut = output[i];
            output[i] *= 3.5; // Compensate volume
        } else if (type === 'pink') {
            // Approximation of Pink Noise
            let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            output[i] *= 0.11; // Compensate volume
            b6 = white * 0.115926;
        }
    }

    const whiteNoise = audioCtx.createBufferSource();
    whiteNoise.buffer = noiseBuffer;
    whiteNoise.loop = true;
    
    // Master volume for noise (it can be loud)
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.5;

    whiteNoise.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    whiteNoise.start();

    currentAudioNodes.push(whiteNoise, gainNode);
}

// --- FREQUENCY ROUTING ---
function activateState(stateId, buttonElement) {
    if (activeFrequency === stateId) {
        // Toggle off if already active
        stopAllAudio();
        return;
    }

    // Mathematical mappings for cognitive states
    switch(stateId) {
        case 'gamma': playIsochronicTone(200, 40); break;  // 40Hz peak focus
        case 'alpha': playIsochronicTone(200, 10); break;  // 10Hz relaxed focus
        case 'theta': playIsochronicTone(150, 6); break;   // 6Hz deep meditation
        case 'brown': playNoise('brown'); break;           // Deep masking
        case 'pink': playNoise('pink'); break;             // Balanced masking
    }

    activeFrequency = stateId;
    
    // UI Updates
    document.querySelectorAll('.freq-btn').forEach(btn => btn.classList.remove('active-glow'));
    buttonElement.classList.add('active-glow');
}

// --- TEMPORAL ENGINE (TIMER & SYNC) ---
function updateTimerDisplay() {
    let minutes = Math.floor(timeRemaining / 60);
    let seconds = timeRemaining % 60;
    if (timerDisplay) {
        timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
    }
}

function toggleTimer() {
    if (isTimerRunning) {
        clearInterval(timerInterval);
        isTimerRunning = false;
        if(toggleTimerBtn) toggleTimerBtn.innerHTML = "<span>⚡</span> IGNITE SESSION";
        if(heartbeatOverlay) heartbeatOverlay.classList.remove('pulse-active');
    } else {
        isTimerRunning = true;
        if(toggleTimerBtn) toggleTimerBtn.innerHTML = "<span>⏸</span> PAUSE MATRIX";
        if(heartbeatOverlay) heartbeatOverlay.classList.add('pulse-active'); // Starts visual entrainment

        timerInterval = setInterval(() => {
            if (timeRemaining > 0) {
                timeRemaining--;
                updateTimerDisplay();
            } else {
                completeSession();
            }
        }, 1000);
    }
}

function completeSession() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    stopAllAudio();
    if(toggleTimerBtn) toggleTimerBtn.innerHTML = "<span>↺</span> RESET";
    if(heartbeatOverlay) heartbeatOverlay.classList.remove('pulse-active');
    
    // Fire completion alarm (high frequency chime)
    initAudio();
    const chime = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(880, audioCtx.currentTime); // A5 note
    gain.gain.setValueAtTime(1, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 2);
    
    chime.connect(gain);
    gain.connect(audioCtx.destination);
    chime.start();
    chime.stop(audioCtx.currentTime + 2);
}

// Listen for slider changes to update time
if(timeSlider) {
    timeSlider.addEventListener('input', (e) => {
        timeRemaining = parseInt(e.target.value) * 60;
        updateTimerDisplay();
    });
    }

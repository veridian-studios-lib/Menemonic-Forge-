/**
 * OMNI-DIRECTOR BUILD: P-REALM ACCELERATOR (ULTIMATE PERSISTENCE)
 * Features: Inline Web Worker Timer, MediaSession API, Non-Zero Heartbeat, 
 * Timestamp Sync, Solfeggio Carriers, Anti-Clip Noise.
 */

let audioCtx = null;
let currentAudioNodes = [];
let isTimerRunning = false;
let activeFrequency = null;
let heartbeat = null;
let wakeLock = null;
let timeRemaining = 300; 

// DOM Elements
const timerDisplay = document.getElementById('timer-display');
const timeSlider = document.getElementById('time-slider');
const toggleTimerBtn = document.getElementById('toggle-timer-btn');
const heartbeatOverlay = document.getElementById('heartbeat-overlay');

// --- 1. THE INLINE WEB WORKER (Bulletproof Background Timer) ---
// We create a worker from a string so no external file is needed.
const workerCode = `
    let timerId = null;
    self.onmessage = function(e) {
        if (e.data.command === 'start') {
            const endTime = Date.now() + (e.data.duration * 1000);
            timerId = setInterval(() => {
                const remaining = Math.max(0, Math.round((endTime - Date.now()) / 1000));
                if (remaining <= 0) {
                    clearInterval(timerId);
                    self.postMessage({ status: 'done', remaining: 0 });
                } else {
                    self.postMessage({ status: 'tick', remaining: remaining });
                }
            }, 1000);
        } else if (e.data.command === 'stop') {
            clearInterval(timerId);
        }
    };
`;
const workerBlob = new Blob([workerCode], { type: 'application/javascript' });
const timerWorker = new Worker(URL.createObjectURL(workerBlob));

timerWorker.onmessage = function(e) {
    timeRemaining = e.data.remaining;
    updateTimerDisplay();
    if (e.data.status === 'done') {
        completeSession();
    }
};

// --- 2. THE WAKE LOCK & MEDIA SESSION API ---
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log("P-Realm: Hardware Screen Lock Engaged");
        } catch (err) {
            console.log("Wake Lock constrained by battery saver:", err.message);
        }
    }
}

function setupMediaSession() {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: 'Neural Injection Active',
            artist: 'P-Realm Accelerator',
            album: 'Veridian Sanctum'
        });
        // Dummy handlers to convince the OS this is a real media player
        navigator.mediaSession.setActionHandler('play', () => { resumeContext(); });
        navigator.mediaSession.setActionHandler('pause', () => { /* Prevent pause */ });
    }
}

document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && isTimerRunning) {
        if (wakeLock === null) await requestWakeLock();
        updateTimerDisplay(); // Force UI resync on wake
    }
});

// --- 3. AUDIO CONTEXT & NON-ZERO HEARTBEAT ---
function resumeContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        setupMediaSession();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

window.addEventListener('touchstart', resumeContext, { passive: true });
window.addEventListener('mousedown', resumeContext, { passive: true });

function startHeartbeat() {
    if (!audioCtx) return;
    stopHeartbeat(); 
    
    // METHOD 4: Non-Zero White Noise Heartbeat
    // Browsers kill pure silence. We use 0.0001 volume noise.
    const bufferSize = audioCtx.sampleRate * 2; // 2 seconds
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1; 
    }

    heartbeat = audioCtx.createBufferSource();
    heartbeat.buffer = noiseBuffer;
    heartbeat.loop = true;
    
    const hbGain = audioCtx.createGain();
    hbGain.gain.value = 0.0001; // Imperceptible, but keeps the audio thread alive

    heartbeat.connect(hbGain);
    hbGain.connect(audioCtx.destination);
    heartbeat.start();
}

function stopHeartbeat() {
    if (heartbeat) { 
        try { heartbeat.stop(); heartbeat.disconnect(); } catch(e) {}
        heartbeat = null; 
    }
}

function stopAllAudio() {
    currentAudioNodes.forEach(node => {
        try { node.stop(); } catch (e) {}
        try { node.disconnect(); } catch (e) {}
    });
    currentAudioNodes = [];
    activeFrequency = null;
    document.querySelectorAll('.freq-btn').forEach(btn => btn.classList.remove('active-glow'));
}

// --- 4. NEURAL AUDIO GENERATION ---
function playIsochronicTone(baseFreq, pulseHz) {
    resumeContext(); 
    stopAllAudio();
    startHeartbeat(); 

    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'triangle'; // High-penetration for mobile speakers
    oscillator.frequency.value = baseFreq;

    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = pulseHz; 

    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.5; 

    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.5; 
    
    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain); 
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    oscillator.start();
    lfo.start();

    currentAudioNodes.push(oscillator, lfo, gainNode, lfoGain);
}

function playNoise(type) {
    resumeContext();
    stopAllAudio();
    startHeartbeat(); 

    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        let white = Math.random() * 2 - 1;
        if (type === 'brown') {
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 2.0; 
        } else {
            output[i] = (lastOut * 0.9) + (white * 0.1);
            lastOut = output[i];
            output[i] *= 2.5; 
        }
    }

    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = noiseBuffer;
    noiseNode.loop = true;
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.6; 

    noiseNode.connect(gainNode);
    gainNode.connect(audioCtx.destination);
    noiseNode.start();

    currentAudioNodes.push(noiseNode, gainNode);
}

function activateState(stateId, buttonElement) {
    resumeContext(); 
    if (activeFrequency === stateId) {
        stopAllAudio();
        stopHeartbeat();
        return;
    }

    switch(stateId) {
        case 'gamma': playIsochronicTone(639, 40); break; 
        case 'alpha': playIsochronicTone(528, 10); break; 
        case 'theta': playIsochronicTone(432, 6); break;  
        case 'brown': playNoise('brown'); break;
        case 'pink': playNoise('pink'); break;
    }

    activeFrequency = stateId;
    document.querySelectorAll('.freq-btn').forEach(btn => btn.classList.remove('active-glow'));
    buttonElement.classList.add('active-glow');
}

// --- 5. TEMPORAL ENGINE CONTROL ---
function updateTimerDisplay() {
    let minutes = Math.floor(timeRemaining / 60);
    let seconds = timeRemaining % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function toggleTimer() {
    resumeContext();
    if (isTimerRunning) {
        // Stop Sequence
        timerWorker.postMessage({ command: 'stop' });
        isTimerRunning = false;
        toggleTimerBtn.innerHTML = "<span>⚡</span> IGNITE SESSION";
        heartbeatOverlay.classList.remove('pulse-active');
        if (wakeLock) { wakeLock.release(); wakeLock = null; }
    } else {
        // Start Sequence
        isTimerRunning = true;
        requestWakeLock(); 
        
        // Delegate timing to the Web Worker
        timerWorker.postMessage({ command: 'start', duration: timeRemaining });
        
        toggleTimerBtn.innerHTML = "<span>⏸</span> PAUSE MATRIX";
        heartbeatOverlay.classList.add('pulse-active');
    }
}

function completeSession() {
    isTimerRunning = false;
    stopAllAudio();
    stopHeartbeat();
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
    
    toggleTimerBtn.innerHTML = "<span>↺</span> RESET";
    heartbeatOverlay.classList.remove('pulse-active');
    
    // Completion Chime
    const chime = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    chime.type = 'sine';
    chime.frequency.setValueAtTime(880, audioCtx.currentTime);
    gain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.001, audioCtx.currentTime + 1.5);
    chime.connect(gain);
    gain.connect(audioCtx.destination);
    chime.start();
    chime.stop(audioCtx.currentTime + 1.5);
}

// Slider controls time ONLY when paused/stopped
if(timeSlider) {
    timeSlider.addEventListener('input', (e) => {
        if (!isTimerRunning) {
            timeRemaining = parseInt(e.target.value) * 60;
            updateTimerDisplay(); 
        }
    });
}

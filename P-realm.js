/**
 * OMNI-DIRECTOR BUILD: P-REALM ACCELERATOR (ANDROID/CHROME OPTIMIZED)
 * Features: Native AudioContext, Delta-Time Sync, Solfeggio Tones
 */

let audioCtx = null;
let currentAudioNodes = [];
let timerInterval = null;
let endTime = null; // Used for Delta-Time tracking
let timeRemaining = 300; 
let isTimerRunning = false;
let activeFrequency = null;
let heartbeat = null;
let wakeLock = null;

// DOM Elements
const timerDisplay = document.getElementById('timer-display');
const timeSlider = document.getElementById('time-slider');
const toggleTimerBtn = document.getElementById('toggle-timer-btn');
const heartbeatOverlay = document.getElementById('heartbeat-overlay');

// --- 1. ANDROID WAKE LOCK ---
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log("P-Realm: Android Screen Lock Engaged");
        } catch (err) {
            console.error("Wake Lock failed:", err);
        }
    }
}

document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible' && isTimerRunning) {
        if (wakeLock === null) await requestWakeLock();
    }
});

// --- 2. AUDIO CONTEXT (PURE NATIVE) ---
function resumeContext() {
    // If context doesn't exist, create it. 
    // Android Chrome requires this to happen inside a user gesture (like the Unlock button).
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        console.log("Audio Context Created");
    }
    
    // If it's suspended, wake it up.
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            console.log("Audio Context Resumed");
        });
    }
}

// Ensure touching the screen keeps the context alive
window.addEventListener('touchstart', resumeContext, { passive: true });
window.addEventListener('mousedown', resumeContext, { passive: true });

// --- 3. THE NOISE HEARTBEAT ---
function startHeartbeat() {
    if (!audioCtx) return;
    stopHeartbeat(); 
    
    // Create actual noise, but make it virtually silent (0.001)
    // Android Chrome will not suspend an active noise buffer.
    const bufferSize = audioCtx.sampleRate * 2; 
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        output[i] = Math.random() * 2 - 1; 
    }

    heartbeat = audioCtx.createBufferSource();
    heartbeat.buffer = noiseBuffer;
    heartbeat.loop = true;
    
    const hbGain = audioCtx.createGain();
    hbGain.gain.value = 0.001; 

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

// --- 4. NEURAL AUDIO GENERATION (ANDROID OPTIMIZED) ---
function playIsochronicTone(baseFreq, pulseHz) {
    resumeContext(); 
    stopAllAudio();
    startHeartbeat(); 

    // Oscillator 1: The Carrier (What you hear)
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'triangle'; // Triangle wave is louder on Android speakers
    oscillator.frequency.value = baseFreq;

    // Oscillator 2: The Modulator (The beat)
    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = pulseHz; 

    // Master Volume
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.5; 

    // Pulse Depth
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.5; 
    
    // Connect them up
    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain); 
    oscillator.connect(gainNode);
    gainNode.connect(audioCtx.destination);

    // Ignite
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

// --- 5. DELTA-TIME TEMPORAL ENGINE ---
// This guarantees the timer doesn't drift if Chrome throttles the tab
function updateTimerDisplay() {
    let minutes = Math.floor(timeRemaining / 60);
    let seconds = timeRemaining % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function toggleTimer() {
    resumeContext();
    if (isTimerRunning) {
        clearInterval(timerInterval);
        isTimerRunning = false;
        toggleTimerBtn.innerHTML = "<span>⚡</span> IGNITE SESSION";
        heartbeatOverlay.classList.remove('pulse-active');
        if (wakeLock) { wakeLock.release(); wakeLock = null; }
    } else {
        isTimerRunning = true;
        requestWakeLock(); 
        toggleTimerBtn.innerHTML = "<span>⏸</span> PAUSE MATRIX";
        heartbeatOverlay.classList.add('pulse-active');
        
        // Calculate the absolute End Time in the future
        endTime = Date.now() + (timeRemaining * 1000);
        
        timerInterval = setInterval(() => {
            // Check current time against absolute end time
            const now = Date.now();
            timeRemaining = Math.max(0, Math.round((endTime - now) / 1000));
            
            updateTimerDisplay();
            
            if (timeRemaining <= 0) {
                completeSession();
            }
        }, 1000);
    }
}

function completeSession() {
    clearInterval(timerInterval);
    isTimerRunning = false;
    stopAllAudio();
    stopHeartbeat();
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
    
    toggleTimerBtn.innerHTML = "<span>↺</span> RESET";
    heartbeatOverlay.classList.remove('pulse-active');
    
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

// Allow slider manipulation only when paused
if(timeSlider) {
    timeSlider.addEventListener('input', (e) => {
        if (!isTimerRunning) {
            timeRemaining = parseInt(e.target.value) * 60;
            updateTimerDisplay(); 
        }
    });
}

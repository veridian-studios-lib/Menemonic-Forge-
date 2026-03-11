/**
 * OMNI-DIRECTOR BUILD: P-REALM ACCELERATOR
 * Features: Math-based Isochronic Tones, Persistent Wake-Lock, 
 * Background Audio Heartbeat, and Universal Touch-Wake.
 */

let audioCtx = null;
let currentAudioNodes = [];
let timerInterval = null;
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

// --- 1. THE WAKE LOCK (Prevents Screen Sleep) ---
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log("P-Realm: Cognitive Lock Active (Screen Stay-Awake)");
            wakeLock.addEventListener('release', () => {
                console.log("P-Realm: Cognitive Lock Released");
                wakeLock = null;
            });
        } catch (err) {
            console.error(`P-Realm Wake Lock Error: ${err.name}, ${err.message}`);
        }
    }
}

// Re-request if app is minimized and restored
document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible' && isTimerRunning) {
        await requestWakeLock();
    }
});

// --- 2. THE AUDIO ENGINE & MASTER WAKE-UP ---
function resumeContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume().then(() => {
            console.log("Neural Audio Engine: ONLINE");
        });
    }
}

// Attach wake-up to ANY touch on the screen (Silent Bypass)
window.addEventListener('touchstart', resumeContext, { passive: true });
window.addEventListener('mousedown', resumeContext, { passive: true });

// --- 3. THE HEARTBEAT (Prevents OS Audio Suspension) ---
function startHeartbeat() {
    if (!audioCtx) return;
    stopHeartbeat(); // Clear existing
    const silence = audioCtx.createBuffer(1, 44100, 44100);
    heartbeat = audioCtx.createBufferSource();
    heartbeat.buffer = silence;
    heartbeat.loop = true;
    heartbeat.connect(audioCtx.destination);
    heartbeat.start();
    console.log("P-Realm: Background Persistence Heartbeat Started");
}

function stopHeartbeat() {
    if (heartbeat) { 
        try { heartbeat.stop(); } catch(e) {}
        try { heartbeat.disconnect(); } catch(e) {}
        heartbeat = null; 
    }
}

// --- 4. NEURAL AUDIO GENERATION ---
function stopAllAudio() {
    currentAudioNodes.forEach(node => {
        try { node.stop(); } catch (e) {}
        try { node.disconnect(); } catch (e) {}
    });
    currentAudioNodes = [];
    activeFrequency = null;
    document.querySelectorAll('.freq-btn').forEach(btn => btn.classList.remove('active-glow'));
}

function playIsochronicTone(baseFreq, pulseHz) {
    resumeContext(); 
    stopAllAudio();
    startHeartbeat(); // Keep thread alive

    const oscillator = audioCtx.createOscillator();
    const gainNode = audioCtx.createGain();
    const lfo = audioCtx.createOscillator();

    oscillator.type = 'sine';
    oscillator.frequency.value = baseFreq;

    lfo.type = 'sine';
    lfo.frequency.value = pulseHz; 

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
    startHeartbeat(); // Keep thread alive

    const bufferSize = 2 * audioCtx.sampleRate;
    const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;

    for (let i = 0; i < bufferSize; i++) {
        let white = Math.random() * 2 - 1;
        if (type === 'brown') {
            let lastOut = i > 0 ? output[i-1] : 0;
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            output[i] *= 3.5; 
        } else {
            b0 = 0.99886 * b0 + white * 0.0555179;
            b1 = 0.99332 * b1 + white * 0.0750759;
            b2 = 0.96900 * b2 + white * 0.1538520;
            b3 = 0.86650 * b3 + white * 0.3104856;
            b4 = 0.55000 * b4 + white * 0.5329522;
            b5 = -0.7616 * b5 - white * 0.0168980;
            output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
            output[i] *= 0.11;
            b6 = white * 0.115926;
        }
    }

    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = noiseBuffer;
    noiseNode.loop = true;
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.4; 

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
        case 'gamma': playIsochronicTone(200, 40); break;
        case 'alpha': playIsochronicTone(200, 10); break;
        case 'theta': playIsochronicTone(150, 6); break;
        case 'brown': playNoise('brown'); break;
        case 'pink': playNoise('pink'); break;
    }

    activeFrequency = stateId;
    document.querySelectorAll('.freq-btn').forEach(btn => btn.classList.remove('active-glow'));
    buttonElement.classList.add('active-glow');
}

// --- 5. THE TEMPORAL ENGINE ---
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
        requestWakeLock(); // Lock the screen awake
        toggleTimerBtn.innerHTML = "<span>⏸</span> PAUSE MATRIX";
        heartbeatOverlay.classList.add('pulse-active');
        
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

if(timeSlider) {
    timeSlider.addEventListener('input', (e) => {
        timeRemaining = parseInt(e.target.value) * 60;
        updateTimerDisplay();
    });
            }

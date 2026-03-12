/**
 * OMNI-DIRECTOR BUILD: P-REALM ACCELERATOR
 * PHYSICS PATCH: Frequency Optimization & Anti-Clip Noise Engine
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

// --- 1. WAKE LOCK ---
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            console.log("P-Realm: Cognitive Lock Active");
        } catch (err) {
            console.error("Wake Lock Error:", err);
        }
    }
}

document.addEventListener('visibilitychange', async () => {
    if (wakeLock !== null && document.visibilityState === 'visible' && isTimerRunning) {
        await requestWakeLock();
    }
});

// --- 2. AUDIO CONTEXT MASTER CONTROL ---
function resumeContext() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    }
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// Binds to all touches to force audio unlock
window.addEventListener('touchstart', resumeContext, { passive: true });
window.addEventListener('mousedown', resumeContext, { passive: true });

// --- 3. BACKGROUND PERSISTENCE ---
function startHeartbeat() {
    if (!audioCtx) return;
    stopHeartbeat(); 
    const silence = audioCtx.createBuffer(1, 44100, 44100);
    heartbeat = audioCtx.createBufferSource();
    heartbeat.buffer = silence;
    heartbeat.loop = true;
    heartbeat.connect(audioCtx.destination);
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

// --- 4. NEURAL AUDIO GENERATION (PHYSICS FIXED) ---
function playIsochronicTone(baseFreq, pulseHz) {
    resumeContext(); 
    stopAllAudio();
    startHeartbeat(); 

    // Using a 'triangle' wave alongside sine makes it vastly easier to hear on mobile speakers
    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'triangle'; 
    oscillator.frequency.value = baseFreq;

    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = pulseHz; 

    // Master Volume of the Tone
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.5; // Base Volume

    // LFO Amplitude Modulation Depth
    const lfoGain = audioCtx.createGain();
    lfoGain.gain.value = 0.5; // Swings the volume up and down perfectly
    
    // Connect Modulation
    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain); 
    
    // Connect Audio to Output
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

    // ANTI-CLIP NOISE ALGORITHM
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        let white = Math.random() * 2 - 1;
        
        if (type === 'brown') {
            // Safe leaky integrator for Brown Noise
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 2.0; // Reduced from 3.5 to prevent clipping
        } else {
            // Safe Pink Noise approximation
            output[i] = (lastOut * 0.9) + (white * 0.1);
            lastOut = output[i];
            output[i] *= 2.5; 
        }
    }

    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = noiseBuffer;
    noiseNode.loop = true;
    
    const gainNode = audioCtx.createGain();
    gainNode.gain.value = 0.6; // Safe Master Volume

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

    // THE FREQUENCY FIX: Shifted to Solfeggio frequencies so phone speakers can project them.
    // 432Hz, 528Hz, and 639Hz are highly audible, while maintaining the exact cognitive pulse (6, 10, 40)
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

// --- 5. TEMPORAL ENGINE (SLIDER FIXED) ---
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

// SLIDER LOGIC FIX: Instant UI updates while dragging
if(timeSlider) {
    timeSlider.addEventListener('input', (e) => {
        timeRemaining = parseInt(e.target.value) * 60;
        updateTimerDisplay(); 
    });
}

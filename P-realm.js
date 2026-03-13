/**
 * OMNI-DIRECTOR BUILD: P-REALM ACCELERATOR (TITANIUM ANDROID V2)
 * Integrating: User Gesture Sync Fix, Hot-Pipe Stream, and 10-Point Persistence
 */

let audioCtx = null;
let currentAudioNodes = [];
let isTimerRunning = false;
let activeFrequency = null;
let wakeLock = null;
let timeRemaining = 300; 

// The Anchor Elements
let anchorAudioElement = null;
let mediaStreamDest = null;
let hotOscillator = null; // The permanent cold-pipe fix

// DOM Elements
const timerDisplay = document.getElementById('timer-display');
const timeSlider = document.getElementById('time-slider');
const toggleTimerBtn = document.getElementById('toggle-timer-btn');
const heartbeatOverlay = document.getElementById('heartbeat-overlay');

// --- DATA URI WEB WORKER (Timer logic isolated from main thread) ---
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
const workerUri = 'data:application/javascript,' + encodeURIComponent(workerCode);
const timerWorker = new Worker(workerUri);

timerWorker.onmessage = function(e) {
    timeRemaining = e.data.remaining;
    updateTimerDisplay();
    if (e.data.status === 'done') completeSession();
};

// --- BATTERY STATUS CHECK ---
if ('getBattery' in navigator) {
    navigator.getBattery().then(battery => {
        console.log(`System Power: ${Math.round(battery.level * 100)}%`);
        battery.addEventListener('levelchange', () => {
            if (battery.level <= 0.20 && !battery.charging) {
                console.warn("WARNING: Battery critical. OS may terminate audio.");
            }
        });
    });
}

// --- WAKE LOCK ---
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
        } catch (err) {
            console.warn("Wake Lock Denied:", err.message);
        }
    }
}

// --- MEDIA SESSION API ---
function setupMediaSession() {
    if ('mediaSession' in navigator) {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: 'Neural Injection Active',
            artist: 'P-Realm Accelerator',
            album: 'Phase ' + (activeFrequency ? activeFrequency.toUpperCase() : 'STANDBY')
        });
        
        navigator.mediaSession.setActionHandler('play', () => { 
            if(!isTimerRunning) toggleTimer(); 
        });
        navigator.mediaSession.setActionHandler('pause', () => { 
            if(isTimerRunning) toggleTimer(); 
        });
    }
}

// --- MAIN AUDIO ENGINE INIT ---
function initAudioEngine() {
    if (!audioCtx) {
        audioCtx = new (window.AudioContext || window.webkitAudioContext)();
        
        // THE AUDIO/VIDEO ANCHOR HACK
        mediaStreamDest = audioCtx.createMediaStreamDestination();
        anchorAudioElement = new Audio();
        anchorAudioElement.srcObject = mediaStreamDest.stream;
        anchorAudioElement.loop = true;
        anchorAudioElement.playsInline = true;

        // FIX 2: THE HOT PIPE GENERATOR
        // This permanent oscillator ensures the stream is NEVER empty.
        hotOscillator = audioCtx.createOscillator();
        const hotGain = audioCtx.createGain();
        hotOscillator.type = 'sine';
        hotOscillator.frequency.value = 440; // Standard pitch
        hotGain.gain.setValueAtTime(0.0001, audioCtx.currentTime); // Imperceptible volume
        
        hotOscillator.connect(hotGain);
        hotGain.connect(mediaStreamDest);       // Keep the anchor stream hot
        hotGain.connect(audioCtx.destination);  // Keep main output hot
        hotOscillator.start();
        
        // ONSTATECHANGE (Handling phone calls)
        audioCtx.onstatechange = () => {
            console.log("Audio Engine State:", audioCtx.state);
            if (audioCtx.state === 'interrupted' || audioCtx.state === 'suspended') {
                if (isTimerRunning) {
                    let retry = setInterval(() => {
                        if (audioCtx.state === 'running') clearInterval(retry);
                        else audioCtx.resume();
                    }, 2000);
                }
            }
        };
        setupMediaSession();
    }
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
}

// --- FIX 1: SYNCHRONOUS GESTURE UNLOCK ---
// This guarantees the .play() command happens immediately on the first tap
function unlockAudioContext() {
    initAudioEngine();
    if (anchorAudioElement && anchorAudioElement.paused) {
        anchorAudioElement.play().catch(e => console.warn("Anchor play blocked:", e));
    }
    // Remove listeners once unlocked to prevent memory leaks
    window.removeEventListener('touchstart', unlockAudioContext);
    window.removeEventListener('mousedown', unlockAudioContext);
    document.removeEventListener('click', unlockAudioContext);
}

// Attach the aggressive unlockers
window.addEventListener('touchstart', unlockAudioContext, { once: true });
window.addEventListener('mousedown', unlockAudioContext, { once: true });
document.addEventListener('click', unlockAudioContext, { once: true });


// --- RE-RESUMING ON VISIBILITY ---
document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState === 'visible') {
        if (audioCtx && audioCtx.state === 'suspended') audioCtx.resume();
        if (isTimerRunning && wakeLock === null) await requestWakeLock();
        updateTimerDisplay(); 
    }
});

function stopAllAudio() {
    currentAudioNodes.forEach(node => {
        try { node.stop(); } catch (e) {}
        try { node.disconnect(); } catch (e) {}
    });
    currentAudioNodes = [];
    document.querySelectorAll('.freq-btn').forEach(btn => btn.classList.remove('active-glow'));
}

// --- NEURAL AUDIO GENERATION ---
function playIsochronicTone(baseFreq, pulseHz) {
    initAudioEngine(); 
    stopAllAudio();

    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'triangle'; 
    oscillator.frequency.value = baseFreq;

    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = pulseHz; 

    const gainNode = audioCtx.createGain();
    // LOW-LEVEL GAIN TRICK 
    gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.5, audioCtx.currentTime + 0.1); 

    const lfoGain = audioCtx.createGain();
    lfoGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    
    // Routing
    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain); 
    oscillator.connect(gainNode);
    
    // Connect to BOTH the normal speakers and the Anchor stream
    gainNode.connect(audioCtx.destination);
    gainNode.connect(mediaStreamDest);

    oscillator.onended = () => {
        if (isTimerRunning) console.warn("Oscillator killed unexpectedly!");
    };

    oscillator.start();
    lfo.start();

    currentAudioNodes.push(oscillator, lfo, gainNode, lfoGain);
    setupMediaSession(); 
}

function activateState(stateId, buttonElement) {
    // Ensure gesture is caught immediately here as a fallback
    unlockAudioContext(); 
    
    if (activeFrequency === stateId) {
        stopAllAudio();
        activeFrequency = null;
        return;
    }

    switch(stateId) {
        case 'gamma': playIsochronicTone(639, 40); break; 
        case 'alpha': playIsochronicTone(528, 10); break; 
        case 'theta': playIsochronicTone(432, 6); break;  
    }

    activeFrequency = stateId;
    document.querySelectorAll('.freq-btn').forEach(btn => btn.classList.remove('active-glow'));
    buttonElement.classList.add('active-glow');
}

// --- TEMPORAL ENGINE ---
function updateTimerDisplay() {
    let minutes = Math.floor(timeRemaining / 60);
    let seconds = timeRemaining % 60;
    timerDisplay.textContent = `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}`;
}

function toggleTimer() {
    // FIX 1 CONTINUED: Ensure absolute synchronous playback on Ignite
    unlockAudioContext();

    if (isTimerRunning) {
        timerWorker.postMessage({ command: 'stop' });
        isTimerRunning = false;
        toggleTimerBtn.innerHTML = "<span>⚡</span> IGNITE SESSION";
        heartbeatOverlay.classList.remove('pulse-active');
        if (wakeLock) { wakeLock.release(); wakeLock = null; }
    } else {
        isTimerRunning = true;
        requestWakeLock(); 
        timerWorker.postMessage({ command: 'start', duration: timeRemaining });
        toggleTimerBtn.innerHTML = "<span>⏸</span> PAUSE MATRIX";
        heartbeatOverlay.classList.add('pulse-active');
    }
}

function completeSession() {
    isTimerRunning = false;
    stopAllAudio();
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
    
    toggleTimerBtn.innerHTML = "<span>↺</span> RESET";
    heartbeatOverlay.classList.remove('pulse-active');
    
    // Chime
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
        if (!isTimerRunning) {
            timeRemaining = parseInt(e.target.value) * 60;
            updateTimerDisplay(); 
        }
    });
    }

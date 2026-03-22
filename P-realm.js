/**
 * OMNI-DIRECTOR BUILD: P-REALM ACCELERATOR (TITANIUM ANDROID V3.1)
 * Integrating: Perfect DOM Anchor Sync & Complete Noise Matrix
 */

let audioCtx = null;
let currentAudioNodes = [];
let isTimerRunning = false;
let activeFrequency = null;
let wakeLock = null;
let timeRemaining = 300; 
let mainTimerInterval = null; 

// The Anchor Elements
let anchorAudioElement = null;
let mediaStreamDest = null;
let hotOscillator = null; 

// DOM Elements
const timerDisplay = document.getElementById('timer-display');
const timeSlider = document.getElementById('time-slider');
const toggleTimerBtn = document.getElementById('toggle-timer-btn');
const heartbeatOverlay = document.getElementById('heartbeat-overlay');

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

// --- MAIN AUDIO ENGINE INIT ---
function initAudioEngine() {
    if (!audioCtx) {
        const AudioContextClass = window.AudioContext || window.webkitAudioContext;
        audioCtx = new AudioContextClass();
        
        mediaStreamDest = audioCtx.createMediaStreamDestination();
        
        // FIX 1: HOOK INTO THE PHYSICAL HTML DOM ELEMENT
        anchorAudioElement = document.getElementById('hidden-anchor');
        if(anchorAudioElement) {
            anchorAudioElement.srcObject = mediaStreamDest.stream;
            anchorAudioElement.loop = true;
            anchorAudioElement.playsInline = true;
        }

        hotOscillator = audioCtx.createOscillator();
        const hotGain = audioCtx.createGain();
        hotOscillator.type = 'sine';
        hotOscillator.frequency.value = 440; 
        hotGain.gain.setValueAtTime(0.0001, audioCtx.currentTime); 
        
        hotOscillator.connect(hotGain);
        hotGain.connect(mediaStreamDest);       
        hotGain.connect(audioCtx.destination);  
        hotOscillator.start();
        
        audioCtx.onstatechange = () => {
            console.log("Audio Engine State:", audioCtx.state);
        };
    }
    
    if (audioCtx.state === 'suspended') {
        audioCtx.resume();
    }
    
    if (anchorAudioElement && anchorAudioElement.paused) {
        anchorAudioElement.play().catch(e => console.warn("Anchor play blocked:", e));
    }
}

// Global Unlocker
window.unlockAudioContext = function() {
    initAudioEngine();
};

function stopAllAudio() {
    currentAudioNodes.forEach(node => {
        try { node.stop(); } catch (e) {}
        try { node.disconnect(); } catch (e) {}
    });
    currentAudioNodes = [];
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
    gainNode.gain.setValueAtTime(0.001, audioCtx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.5, audioCtx.currentTime + 0.1); 

    const lfoGain = audioCtx.createGain();
    lfoGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    
    lfo.connect(lfoGain);
    lfoGain.connect(gainNode.gain); 
    oscillator.connect(gainNode);
    
    gainNode.connect(audioCtx.destination);
    gainNode.connect(mediaStreamDest);

    oscillator.start();
    lfo.start();

    if(!isTimerRunning){
         gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
    }

    currentAudioNodes.push({osc: oscillator, lfo: lfo, mainGain: gainNode, lfoGain: lfoGain});
}

// FIX 2: ADDING THE MISSING NOISE GENERATORS
function playNoise(type) {
    initAudioEngine();
    stopAllAudio();

    const bufferSize = audioCtx.sampleRate * 2; // 2 seconds of noise
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    
    // Noise Generation Algorithms
    if (type === 'pink') {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
            let white = Math.random() * 2 - 1;
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
    } else if (type === 'brown') {
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            let white = Math.random() * 2 - 1;
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 3.5; 
        }
    }

    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = buffer;
    noiseNode.loop = true;

    const gainNode = audioCtx.createGain();
    // --- NEURAL AUDIO GENERATION (V4 ARCHITECTURE) ---
function playIsochronicTone(baseFreq, pulseHz) {
    initAudioEngine(); 
    stopAllAudio();

    const oscillator = audioCtx.createOscillator();
    oscillator.type = 'triangle'; 
    oscillator.frequency.value = baseFreq;

    const lfo = audioCtx.createOscillator();
    lfo.type = 'sine';
    lfo.frequency.value = pulseHz; 

    // The Base Gain (Handles the LFO pulsing)
    const baseGain = audioCtx.createGain();
    baseGain.gain.setValueAtTime(0.5, audioCtx.currentTime);

    const lfoGain = audioCtx.createGain();
    lfoGain.gain.setValueAtTime(0.5, audioCtx.currentTime);
    
    // The Master Gain (Handles Mute/Unmute safely)
    const masterGain = audioCtx.createGain();
    
    // Set initial mute state WITHOUT overlapping ramps
    if (!isTimerRunning) {
        masterGain.gain.value = 0; 
    } else {
        masterGain.gain.value = 1;
    }

    // Routing
    lfo.connect(lfoGain);
    lfoGain.connect(baseGain.gain); 
    oscillator.connect(baseGain);
    
    // Route base through master, then to outputs
    baseGain.connect(masterGain);
    masterGain.connect(audioCtx.destination);
    masterGain.connect(mediaStreamDest);

    oscillator.start();
    lfo.start();

    // Store the MASTER gain for the Ignite button to control
    currentAudioNodes.push({osc: oscillator, lfo: lfo, mainGain: masterGain, lfoGain: lfoGain});
}

function playNoise(type) {
    initAudioEngine();
    stopAllAudio();

    const bufferSize = audioCtx.sampleRate * 2; 
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const output = buffer.getChannelData(0);
    
    if (type === 'pink') {
        let b0 = 0, b1 = 0, b2 = 0, b3 = 0, b4 = 0, b5 = 0, b6 = 0;
        for (let i = 0; i < bufferSize; i++) {
            let white = Math.random() * 2 - 1;
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
    } else if (type === 'brown') {
        let lastOut = 0;
        for (let i = 0; i < bufferSize; i++) {
            let white = Math.random() * 2 - 1;
            output[i] = (lastOut + (0.02 * white)) / 1.02;
            lastOut = output[i];
            output[i] *= 3.5; 
        }
    }

    const noiseNode = audioCtx.createBufferSource();
    noiseNode.buffer = buffer;
    noiseNode.loop = true;

    // Master Gain isolation
    const masterGain = audioCtx.createGain();
    if (!isTimerRunning) {
        masterGain.gain.value = 0;
    } else {
        masterGain.gain.value = 1;
    }

    noiseNode.connect(masterGain);
    masterGain.connect(audioCtx.destination);
    masterGain.connect(mediaStreamDest);

    noiseNode.start();
    currentAudioNodes.push({osc: noiseNode, mainGain: masterGain});
}

// --- TEMPORAL ENGINE UPDATES ---
function toggleTimer() {
    unlockAudioContext();

    if (isTimerRunning) {
        // PAUSE
        clearInterval(mainTimerInterval);
        isTimerRunning = false;
        toggleTimerBtn.innerHTML = "<span>⚡</span> IGNITE";
        heartbeatOverlay.classList.remove('pulse-active');
        if (wakeLock) { wakeLock.release(); wakeLock = null; }
        
        // Mute safely
        if(currentAudioNodes.length > 0 && currentAudioNodes[0].mainGain) {
            currentAudioNodes[0].mainGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.05);
        }

    } else {
        // IGNITE
        if (!activeFrequency) {
            alert("Please select a Neural Matrix frequency first.");
            return;
        }

        isTimerRunning = true;
        requestWakeLock(); 
        
        // Unmute safely
        if(currentAudioNodes.length > 0 && currentAudioNodes[0].mainGain) {
            currentAudioNodes[0].mainGain.gain.setTargetAtTime(1, audioCtx.currentTime, 0.05);
        } else {
            activateState(activeFrequency, document.querySelector('.active-glow'));
             if(currentAudioNodes.length > 0 && currentAudioNodes[0].mainGain) {
                currentAudioNodes[0].mainGain.gain.setTargetAtTime(1, audioCtx.currentTime, 0.05);
            }
        }

        toggleTimerBtn.innerHTML = "<span>⏸</span> PAUSE MATRIX";
        heartbeatOverlay.classList.add('pulse-active');

        mainTimerInterval = setInterval(() => {
            timeRemaining--;
            updateTimerDisplay();
            if (timeRemaining <= 0) completeSession();
        }, 1000);
    }
}

    currentAudioNodes.push({osc: noiseNode, mainGain: gainNode});
}

function activateState(stateId, buttonElement) {
    unlockAudioContext(); 
    
    if (activeFrequency === stateId) {
        stopAllAudio();
        activeFrequency = null;
        document.querySelectorAll('.freq-btn').forEach(btn => btn.classList.remove('active-glow'));
        return;
    }

    switch(stateId) {
        case 'gamma': playIsochronicTone(639, 40); break; 
        case 'alpha': playIsochronicTone(528, 10); break; 
        case 'theta': playIsochronicTone(432, 6); break;  
        case 'pink': playNoise('pink'); break;
        case 'brown': playNoise('brown'); break;
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
    unlockAudioContext();

    if (isTimerRunning) {
        // PAUSE
        clearInterval(mainTimerInterval);
        isTimerRunning = false;
        toggleTimerBtn.innerHTML = "<span>⚡</span> IGNITE";
        heartbeatOverlay.classList.remove('pulse-active');
        if (wakeLock) { wakeLock.release(); wakeLock = null; }
        
        if(currentAudioNodes.length > 0 && currentAudioNodes[0].mainGain) {
            currentAudioNodes[0].mainGain.gain.setTargetAtTime(0, audioCtx.currentTime, 0.1);
        }

    } else {
        // IGNITE
        if (!activeFrequency) {
            alert("Please select a Neural Matrix frequency first.");
            return;
        }

        isTimerRunning = true;
        requestWakeLock(); 
        
        if(currentAudioNodes.length > 0 && currentAudioNodes[0].mainGain) {
            currentAudioNodes[0].mainGain.gain.setTargetAtTime(0.5, audioCtx.currentTime, 0.1);
        } else {
            activateState(activeFrequency, document.querySelector('.active-glow'));
             if(currentAudioNodes.length > 0 && currentAudioNodes[0].mainGain) {
                currentAudioNodes[0].mainGain.gain.setTargetAtTime(0.5, audioCtx.currentTime, 0.1);
            }
        }

        toggleTimerBtn.innerHTML = "<span>⏸</span> PAUSE MATRIX";
        heartbeatOverlay.classList.add('pulse-active');

        mainTimerInterval = setInterval(() => {
            timeRemaining--;
            updateTimerDisplay();
            
            if (timeRemaining <= 0) {
                completeSession();
            }
        }, 1000);
    }
}

function completeSession() {
    clearInterval(mainTimerInterval);
    isTimerRunning = false;
    stopAllAudio();
    if (wakeLock) { wakeLock.release(); wakeLock = null; }
    
    toggleTimerBtn.innerHTML = "<span>↺</span> RESET";
    heartbeatOverlay.classList.remove('pulse-active');
    activeFrequency = null;
    
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
        

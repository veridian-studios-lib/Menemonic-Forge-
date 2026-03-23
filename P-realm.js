/**
 * P-REALM ACCELERATOR - TITANIUM V3.1 LOGIC CORE
 * Handles Real-time Web Audio API Synthesis, State Management, and Chrono-Tracking.
 */

const AppState = {
    audioCtx: null,
    masterGain: null,
    isRunning: false,
    timerInterval: null,
    remainingSeconds: 0,
    
    // Currently active selections
    activeBeat: null,  // 'theta', 'alpha', 'gamma'
    activeNoise: null, // 'brown', 'pink'
    
    // Audio Node References for dynamic adjustments
    nodes: {
        leftOsc: null,
        rightOsc: null,
        beatGain: null,
        noiseSrc: null,
        noiseFilter: null,
        noiseGain: null
    },

    // The Carrier Frequency for Binaural Beats (Deep, resonant tone)
    carrierFreq: 210.42 // Solfeggio-adjacent tuning
};

const FREQUENCIES = {
    theta: 6,
    alpha: 10,
    gamma: 40
};

// ==========================================
// 1. THE MASTER HANDSHAKE (Hardware Unlock)
// ==========================================
function unlockAudioContext() {
    if (!AppState.audioCtx) {
        // Fallback for older webkit browsers
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        AppState.audioCtx = new AudioContext();
    }
    
    // Force resume if suspended by browser policies
    if (AppState.audioCtx.state === 'suspended') {
        AppState.audioCtx.resume();
    }

    // Ping the hidden anchor to bypass strict iOS/Android auto-play policies
    const anchor = document.getElementById('hidden-anchor');
    if (anchor) {
        anchor.play().catch(e => console.warn("Anchor silent failure (expected):", e));
    }

    // Establish the Master Output
    if (!AppState.masterGain) {
        AppState.masterGain = AppState.audioCtx.createGain();
        AppState.masterGain.gain.value = 0; // Start at 0 to prevent hardware pop
        AppState.masterGain.connect(AppState.audioCtx.destination);
    }
    
    console.log("System: Audio Context Unlocked & Routed.");
}

// ==========================================
// 2. NEURAL INJECTION MATRIX (Selection Logic)
// ==========================================
function activateState(type, element) {
    const isBeat = ['theta', 'alpha', 'gamma'].includes(type);
    const isNoise = ['brown', 'pink'].includes(type);

    if (isBeat) {
        // Toggle off other beats
        document.querySelectorAll('.freq-btn').forEach(btn => {
            const name = btn.querySelector('.freq-name').innerText.toLowerCase();
            if (['theta', 'alpha', 'gamma'].includes(name) && btn !== element) {
                btn.classList.remove('active-glow');
            }
        });

        // Toggle current beat
        if (AppState.activeBeat === type) {
            AppState.activeBeat = null;
            element.classList.remove('active-glow');
        } else {
            AppState.activeBeat = type;
            element.classList.add('active-glow');
        }
    } else if (isNoise) {
        // Toggle off other noises
        document.querySelectorAll('.freq-btn').forEach(btn => {
            const hzText = btn.querySelector('.freq-hz').innerText.toLowerCase();
            if (hzText.includes('noise') && btn !== element) {
                btn.classList.remove('active-glow');
            }
        });

        // Toggle current noise
        if (AppState.activeNoise === type) {
            AppState.activeNoise = null;
            element.classList.remove('active-glow');
        } else {
            AppState.activeNoise = type;
            element.classList.add('active-glow');
        }
    }

    // If session is live, dynamically rebuild the audio nodes
    if (AppState.isRunning) {
        rebuildAudioStream();
    }
}

// ==========================================
// 3. CORE AUDIO SYNTHESIS ENGINE
// ==========================================
function rebuildAudioStream() {
    const ctx = AppState.audioCtx;
    const now = ctx.currentTime;

    // 1. Cleanup existing nodes smoothly
    if (AppState.nodes.beatGain) {
        AppState.nodes.beatGain.gain.linearRampToValueAtTime(0, now + 0.5);
        setTimeout(killBeatNodes, 500);
    }
    if (AppState.nodes.noiseGain) {
        AppState.nodes.noiseGain.gain.linearRampToValueAtTime(0, now + 0.5);
        setTimeout(killNoiseNodes, 500);
    }

    // 2. Re-instantiate based on selections
    setTimeout(() => {
        if (AppState.isRunning) {
            if (AppState.activeBeat) synthesizeBinaural(AppState.activeBeat);
            if (AppState.activeNoise) synthesizeNoise(AppState.activeNoise);
        }
    }, 550);
}

function synthesizeBinaural(type) {
    const ctx = AppState.audioCtx;
    const diff = FREQUENCIES[type];
    
    // Create Nodes
    AppState.nodes.leftOsc = ctx.createOscillator();
    AppState.nodes.rightOsc = ctx.createOscillator();
    AppState.nodes.beatGain = ctx.createGain();
    const merger = ctx.createChannelMerger(2); // Hard pan left/right

    // Frequencies: Carrier ± (Diff / 2)
    AppState.nodes.leftOsc.frequency.value = AppState.carrierFreq - (diff / 2);
    AppState.nodes.rightOsc.frequency.value = AppState.carrierFreq + (diff / 2);

    // Routing
    AppState.nodes.leftOsc.connect(merger, 0, 0); // Left ear
    AppState.nodes.rightOsc.connect(merger, 0, 1); // Right ear
    merger.connect(AppState.nodes.beatGain);
    AppState.nodes.beatGain.connect(AppState.masterGain);

    // Smooth Fade In
    AppState.nodes.beatGain.gain.setValueAtTime(0, ctx.currentTime);
    AppState.nodes.beatGain.gain.linearRampToValueAtTime(0.6, ctx.currentTime + 2); // 60% volume max

    AppState.nodes.leftOsc.start();
    AppState.nodes.rightOsc.start();
}

function synthesizeNoise(type) {
    const ctx = AppState.audioCtx;
    const bufferSize = 2 * ctx.sampleRate; // 2 seconds of buffer
    const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const output = noiseBuffer.getChannelData(0);

    // Procedural Noise Generation Algorithms
    let lastOut = 0;
    for (let i = 0; i < bufferSize; i++) {
        let white = Math.random() * 2 - 1;
        if (type === 'brown') {
            output[i] = (lastOut + (0.02 * white)) / 1.02; // Deep, rumbling
            lastOut = output[i];
            output[i] *= 3.5; // Gain compensation for Brown noise
        } else { // Pink
            output[i] = white * 0.3; // Simplified Pink for performance
        }
    }

    AppState.nodes.noiseSrc = ctx.createBufferSource();
    AppState.nodes.noiseSrc.buffer = noiseBuffer;
    AppState.nodes.noiseSrc.loop = true;

    AppState.nodes.noiseFilter = ctx.createBiquadFilter();
    AppState.nodes.noiseFilter.type = 'lowpass';
    AppState.nodes.noiseFilter.frequency.value = type === 'brown' ? 400 : 1200; // Muffle it

    AppState.nodes.noiseGain = ctx.createGain();
    
    // Routing
    AppState.nodes.noiseSrc.connect(AppState.nodes.noiseFilter);
    AppState.nodes.noiseFilter.connect(AppState.nodes.noiseGain);
    AppState.nodes.noiseGain.connect(AppState.masterGain);

    // Smooth Fade In
    AppState.nodes.noiseGain.gain.setValueAtTime(0, ctx.currentTime);
    AppState.nodes.noiseGain.gain.linearRampToValueAtTime(0.4, ctx.currentTime + 3); // 40% volume max

    AppState.nodes.noiseSrc.start();
}

function killBeatNodes() {
    if (AppState.nodes.leftOsc) {
        AppState.nodes.leftOsc.stop(); AppState.nodes.leftOsc.disconnect();
        AppState.nodes.rightOsc.stop(); AppState.nodes.rightOsc.disconnect();
        AppState.nodes.beatGain.disconnect();
        AppState.nodes.leftOsc = null; AppState.nodes.rightOsc = null; AppState.nodes.beatGain = null;
    }
}

function killNoiseNodes() {
    if (AppState.nodes.noiseSrc) {
        AppState.nodes.noiseSrc.stop(); AppState.nodes.noiseSrc.disconnect();
        AppState.nodes.noiseFilter.disconnect(); AppState.nodes.noiseGain.disconnect();
        AppState.nodes.noiseSrc = null; AppState.nodes.noiseFilter = null; AppState.nodes.noiseGain = null;
    }
}

// ==========================================
// 4. IGNITION & CHRONO-TRACKING (The Timer)
// ==========================================
function toggleTimer() {
    const btn = document.getElementById('toggle-timer-btn');
    const overlay = document.getElementById('heartbeat-overlay');
    const slider = document.getElementById('time-slider');
    const display = document.getElementById('timer-display');

    if (AppState.isRunning) {
        // ABORT SEQUENCE
        AppState.isRunning = false;
        clearInterval(AppState.timerInterval);
        
        // Visual Reset
        btn.innerHTML = '<span>⚡</span> IGNITE';
        btn.style.color = 'var(--cyan)';
        btn.style.borderColor = 'rgba(0, 242, 255, 0.4)';
        btn.style.textShadow = '0 0 15px rgba(0, 242, 255, 0.5)';
        overlay.classList.remove('pulse-active');
        slider.disabled = false; // Re-enable slider
        
        // Reset Timer Display visually to slider value
        let val = parseInt(slider.value);
        display.innerText = (val < 10 ? '0' + val : val) + ':00';

        // Audio Fade Out
        if (AppState.audioCtx) {
            AppState.masterGain.gain.linearRampToValueAtTime(0, AppState.audioCtx.currentTime + 2);
            setTimeout(() => {
                killBeatNodes();
                killNoiseNodes();
            }, 2100);
        }

    } else {
        // IGNITE SEQUENCE
        if (!AppState.activeBeat && !AppState.activeNoise) {
            alert("Matrix Error: Please select at least one Neural Injection Frequency (Beat or Noise).");
            return;
        }

        AppState.isRunning = true;
        slider.disabled = true; // Lock the slider
        AppState.remainingSeconds = parseInt(slider.value) * 60;
        
        // Visual Update
        btn.innerHTML = '<span>⏏</span> ABORT';
        btn.style.color = '#ff3366'; // Danger/Abort red
        btn.style.borderColor = '#ff3366';
        btn.style.textShadow = '0 0 15px rgba(255, 51, 102, 0.5)';
        overlay.classList.add('pulse-active');

        // Audio Fade In & Start
        if (AppState.audioCtx && AppState.audioCtx.state === 'suspended') AppState.audioCtx.resume();
        AppState.masterGain.gain.linearRampToValueAtTime(1, AppState.audioCtx.currentTime + 2);
        rebuildAudioStream();

        // Start Chronometer
        updateDisplay();
        AppState.timerInterval = setInterval(() => {
            AppState.remainingSeconds--;
            updateDisplay();

            if (AppState.remainingSeconds <= 0) {
                // Time's up
                toggleTimer(); // Triggers abort logic smoothly
                display.innerText = "DONE";
            }
        }, 1000);
    }
}

function updateDisplay() {
    const display = document.getElementById('timer-display');
    const mins = Math.floor(AppState.remainingSeconds / 60);
    const secs = AppState.remainingSeconds % 60;
    
    const formattedMins = mins < 10 ? '0' + mins : mins;
    const formattedSecs = secs < 10 ? '0' + secs : secs;
    
    display.innerText = `${formattedMins}:${formattedSecs}`;
}

/**
 * P-REALM ACCELERATOR - TITANIUM V3.2 LOGIC CORE (MAXIMUM POWER)
 * Handles Real-time Web Audio API Synthesis, State Management, and Chrono-Tracking.
 * OS-Level Throttling Bypassed | Main Thread Optimized | Race Conditions Eliminated
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

    // Pre-computed Noise Buffers (Prevents Main Thread Stutter)
    noiseBuffers: {
        brown: null,
        pink: null
    },

    // Timeout Tracker (Prevents Race Conditions)
    transitionTimers: [],

    // The Carrier Frequency for Binaural Beats (Deep, resonant tone)
    carrierFreq: 210.42 // Solfeggio-adjacent tuning
};

const FREQUENCIES = {
    theta: 6,
    alpha: 10,
    gamma: 40
};

// ==========================================
// 1. THE MASTER HANDSHAKE (Hardware Unlock & Buffer Prep)
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

    const anchor = document.getElementById('hidden-anchor');

    // Establish the Master Output
    if (!AppState.masterGain) {
        AppState.masterGain = AppState.audioCtx.createGain();
        // FIX 1: Anchor the ramp starting point
        AppState.masterGain.gain.setValueAtTime(0, AppState.audioCtx.currentTime); 
        
        // FIX 2: The Missing Link (MediaStreamDestination for OS Keep-Alive)
        if (anchor) {
            const streamDest = AppState.audioCtx.createMediaStreamDestination();
            anchor.srcObject = streamDest.stream;
            AppState.masterGain.connect(streamDest); // Pipe to dummy audio element
            
            // Note: We MUST also connect to the actual hardware destination to hear it, 
            // since the HTML anchor is muted to prevent echoing/feedback.
            AppState.masterGain.connect(AppState.audioCtx.destination); 
            
            anchor.play().catch(e => console.warn("Anchor silent failure (expected):", e));
        } else {
            AppState.masterGain.connect(AppState.audioCtx.destination);
        }

        // FIX 3: Pre-compute Noise Buffers on Startup
        generateNoiseBuffers();
    }
    
    console.log("System: Audio Context Unlocked, Routed, and Buffered.");
}

function generateNoiseBuffers() {
    const ctx = AppState.audioCtx;
    const bufferSize = 2 * ctx.sampleRate; // 2 seconds of buffer

    ['brown', 'pink'].forEach(type => {
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        let lastOut = 0;
        
        for (let i = 0; i < bufferSize; i++) {
            let white = Math.random() * 2 - 1;
            if (type === 'brown') {
                output[i] = (lastOut + (0.02 * white)) / 1.02; 
                lastOut = output[i];
                output[i] *= 3.5; // Gain compensation
            } else { // Pink
                output[i] = white * 0.3; 
            }
        }
        AppState.noiseBuffers[type] = noiseBuffer;
    });
}

// ==========================================
// 2. NEURAL INJECTION MATRIX (Selection Logic)
// ==========================================
function activateState(type, element) {
    const isBeat = ['theta', 'alpha', 'gamma'].includes(type);
    const isNoise = ['brown', 'pink'].includes(type);

    if (isBeat) {
        document.querySelectorAll('.freq-btn').forEach(btn => {
            const name = btn.querySelector('.freq-name').innerText.toLowerCase();
            if (['theta', 'alpha', 'gamma'].includes(name) && btn !== element) {
                btn.classList.remove('active-glow');
            }
        });

        if (AppState.activeBeat === type) {
            AppState.activeBeat = null;
            element.classList.remove('active-glow');
        } else {
            AppState.activeBeat = type;
            element.classList.add('active-glow');
        }
    } else if (isNoise) {
        document.querySelectorAll('.freq-btn').forEach(btn => {
            const hzText = btn.querySelector('.freq-hz').innerText.toLowerCase();
            if (hzText.includes('noise') && btn !== element) {
                btn.classList.remove('active-glow');
            }
        });

        if (AppState.activeNoise === type) {
            AppState.activeNoise = null;
            element.classList.remove('active-glow');
        } else {
            AppState.activeNoise = type;
            element.classList.add('active-glow');
        }
    }

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

    // FIX 4: Clear pending teardown timers to prevent Race Conditions
    AppState.transitionTimers.forEach(clearTimeout);
    AppState.transitionTimers = [];

    // 1. Cleanup existing nodes smoothly
    if (AppState.nodes.beatGain) {
        // Anchor the current gain value before ramping down
        AppState.nodes.beatGain.gain.setValueAtTime(AppState.nodes.beatGain.gain.value, now);
        AppState.nodes.beatGain.gain.linearRampToValueAtTime(0, now + 0.5);
        AppState.transitionTimers.push(setTimeout(killBeatNodes, 500));
    }
    if (AppState.nodes.noiseGain) {
        AppState.nodes.noiseGain.gain.setValueAtTime(AppState.nodes.noiseGain.gain.value, now);
        AppState.nodes.noiseGain.gain.linearRampToValueAtTime(0, now + 0.5);
        AppState.transitionTimers.push(setTimeout(killNoiseNodes, 500));
    }

    // 2. Re-instantiate based on selections
    AppState.transitionTimers.push(setTimeout(() => {
        if (AppState.isRunning) {
            if (AppState.activeBeat) synthesizeBinaural(AppState.activeBeat);
            if (AppState.activeNoise) synthesizeNoise(AppState.activeNoise);
        }
    }, 550));
}

function synthesizeBinaural(type) {
    const ctx = AppState.audioCtx;
    const diff = FREQUENCIES[type];
    const now = ctx.currentTime;
    
    AppState.nodes.leftOsc = ctx.createOscillator();
    AppState.nodes.rightOsc = ctx.createOscillator();
    AppState.nodes.beatGain = ctx.createGain();
    const merger = ctx.createChannelMerger(2); 

    AppState.nodes.leftOsc.frequency.value = AppState.carrierFreq - (diff / 2);
    AppState.nodes.rightOsc.frequency.value = AppState.carrierFreq + (diff / 2);

    AppState.nodes.leftOsc.connect(merger, 0, 0); 
    AppState.nodes.rightOsc.connect(merger, 0, 1); 
    merger.connect(AppState.nodes.beatGain);
    AppState.nodes.beatGain.connect(AppState.masterGain);

    // Fade In Anchor
    AppState.nodes.beatGain.gain.setValueAtTime(0, now);
    AppState.nodes.beatGain.gain.linearRampToValueAtTime(0.6, now + 2); 

    AppState.nodes.leftOsc.start();
    AppState.nodes.rightOsc.start();
}

function synthesizeNoise(type) {
    const ctx = AppState.audioCtx;
    const now = ctx.currentTime;

    AppState.nodes.noiseSrc = ctx.createBufferSource();
    // Use the Pre-computed Buffer (No Main Thread Stutter)
    AppState.nodes.noiseSrc.buffer = AppState.noiseBuffers[type]; 
    AppState.nodes.noiseSrc.loop = true;

    AppState.nodes.noiseFilter = ctx.createBiquadFilter();
    AppState.nodes.noiseFilter.type = 'lowpass';
    AppState.nodes.noiseFilter.frequency.value = type === 'brown' ? 400 : 1200; 

    AppState.nodes.noiseGain = ctx.createGain();
    
    AppState.nodes.noiseSrc.connect(AppState.nodes.noiseFilter);
    AppState.nodes.noiseFilter.connect(AppState.nodes.noiseGain);
    AppState.nodes.noiseGain.connect(AppState.masterGain);

    // Fade In Anchor
    AppState.nodes.noiseGain.gain.setValueAtTime(0, now);
    AppState.nodes.noiseGain.gain.linearRampToValueAtTime(0.4, now + 3); 

    AppState.nodes.noiseSrc.start();
}

function killBeatNodes() {
    // Try-Catch block bulletproofs against rapid toggle race conditions
    if (AppState.nodes.leftOsc) {
        try { AppState.nodes.leftOsc.stop(); } catch(e){}
        AppState.nodes.leftOsc.disconnect();
        AppState.nodes.leftOsc = null;
    }
    if (AppState.nodes.rightOsc) {
        try { AppState.nodes.rightOsc.stop(); } catch(e){}
        AppState.nodes.rightOsc.disconnect();
        AppState.nodes.rightOsc = null;
    }
    if (AppState.nodes.beatGain) {
        AppState.nodes.beatGain.disconnect();
        AppState.nodes.beatGain = null;
    }
}

function killNoiseNodes() {
    if (AppState.nodes.noiseSrc) {
        try { AppState.nodes.noiseSrc.stop(); } catch(e){}
        AppState.nodes.noiseSrc.disconnect();
        AppState.nodes.noiseSrc = null;
    }
    if (AppState.nodes.noiseFilter) {
        AppState.nodes.noiseFilter.disconnect();
        AppState.nodes.noiseFilter = null;
    }
    if (AppState.nodes.noiseGain) {
        AppState.nodes.noiseGain.disconnect();
        AppState.nodes.noiseGain = null;
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
        
        btn.innerHTML = '<span>⚡</span> IGNITE';
        btn.style.color = 'var(--cyan)';
        btn.style.borderColor = 'rgba(0, 242, 255, 0.4)';
        btn.style.textShadow = '0 0 15px rgba(0, 242, 255, 0.5)';
        overlay.classList.remove('pulse-active');
        slider.disabled = false; 
        
        let val = parseInt(slider.value);
        display.innerText = (val < 10 ? '0' + val : val) + ':00';

        if (AppState.audioCtx) {
            const now = AppState.audioCtx.currentTime;
            // Anchor the current volume before ramping to 0
            AppState.masterGain.gain.setValueAtTime(AppState.masterGain.gain.value, now);
            AppState.masterGain.gain.linearRampToValueAtTime(0, now + 2);
            
            // Push to tracker to prevent conflicts
            AppState.transitionTimers.push(setTimeout(() => {
                killBeatNodes();
                killNoiseNodes();
            }, 2100));
        }

    } else {
        // IGNITE SEQUENCE
        if (!AppState.activeBeat && !AppState.activeNoise) {
            alert("Matrix Error: Please select at least one Neural Injection Frequency (Beat or Noise).");
            return;
        }

        AppState.isRunning = true;
        slider.disabled = true; 
        AppState.remainingSeconds = parseInt(slider.value) * 60;
        
        btn.innerHTML = '<span>⏏</span> ABORT';
        btn.style.color = '#ff3366'; 
        btn.style.borderColor = '#ff3366';
        btn.style.textShadow = '0 0 15px rgba(255, 51, 102, 0.5)';
        overlay.classList.add('pulse-active');

        if (AppState.audioCtx) {
            if (AppState.audioCtx.state === 'suspended') AppState.audioCtx.resume();
            const now = AppState.audioCtx.currentTime;
            // Force anchor at 0 before ramping to 1 (Fixes the Dead Master Gain)
            AppState.masterGain.gain.setValueAtTime(0, now);
            AppState.masterGain.gain.linearRampToValueAtTime(1, now + 2);
            rebuildAudioStream();
        }

        updateDisplay();
        AppState.timerInterval = setInterval(() => {
            AppState.remainingSeconds--;
            updateDisplay();

            if (AppState.remainingSeconds <= 0) {
                toggleTimer(); 
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
    

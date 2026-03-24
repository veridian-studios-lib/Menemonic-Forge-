/**
 * P-REALM ACCELERATOR - TITANIUM V3.3 LOGIC CORE (MAXIMUM POWER)
 * Zero-Latency Ignition | Voss-McCartney Pink Noise | Hardware-Level Crossfading
 */

const AppState = {
    audioCtx: null,
    masterGain: null,
    isRunning: false,
    timerInterval: null,
    remainingSeconds: 0,
    
    activeBeat: null,
    activeNoise: null,
    
    // Audio Node References
    nodes: {
        leftOsc: null,
        rightOsc: null,
        beatGain: null,
        noiseSrc: null,
        noiseFilter: null,
        noiseGain: null
    },

    noiseBuffers: {
        brown: null,
        pink: null
    },

    carrierFreq: 210.42 
};

const FREQUENCIES = { theta: 6, alpha: 10, gamma: 40 };

// ==========================================
// 1. THE MASTER HANDSHAKE
// ==========================================
function unlockAudioContext() {
    if (!AppState.audioCtx) {
        const AudioContext = window.AudioContext || window.webkitAudioContext;
        AppState.audioCtx = new AudioContext();
    }
    
    if (AppState.audioCtx.state === 'suspended') {
        AppState.audioCtx.resume();
    }

    const anchor = document.getElementById('hidden-anchor');

    if (!AppState.masterGain) {
        AppState.masterGain = AppState.audioCtx.createGain();
        AppState.masterGain.gain.setValueAtTime(0, AppState.audioCtx.currentTime); 
        
        // The Missing Link: OS Keep-Alive via muted HTML5 Audio
        if (anchor) {
            const streamDest = AppState.audioCtx.createMediaStreamDestination();
            anchor.srcObject = streamDest.stream;
            AppState.masterGain.connect(streamDest); 
            AppState.masterGain.connect(AppState.audioCtx.destination); 
            
            anchor.play().catch(e => console.warn("Anchor silent failure:", e));
        } else {
            AppState.masterGain.connect(AppState.audioCtx.destination);
        }

        generateNoiseBuffers();
    }
    
    console.log("System: Master Handshake Complete. Engine Armed.");
}

// ==========================================
// 2. TRUE PROCEDURAL NOISE (Voss-McCartney)
// ==========================================
function generateNoiseBuffers() {
    const ctx = AppState.audioCtx;
    const bufferSize = 2 * ctx.sampleRate; // 2 seconds

    ['brown', 'pink'].forEach(type => {
        const noiseBuffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        
        if (type === 'brown') {
            let lastOut = 0;
            for (let i = 0; i < bufferSize; i++) {
                let white = Math.random() * 2 - 1;
                output[i] = (lastOut + (0.02 * white)) / 1.02; 
                lastOut = output[i];
                output[i] *= 3.5; // Gain compensation
            }
        } else {
            // FIX: True Voss-McCartney Pink Noise Algorithm
            let b0=0, b1=0, b2=0, b3=0, b4=0, b5=0, b6=0;
            for (let i = 0; i < bufferSize; i++) {
                let white = Math.random() * 2 - 1;
                b0 = 0.99886 * b0 + white * 0.0555179;
                b1 = 0.99332 * b1 + white * 0.0750759;
                b2 = 0.96900 * b2 + white * 0.1538520;
                b3 = 0.86650 * b3 + white * 0.3104856;
                b4 = 0.55000 * b4 + white * 0.5329522;
                b5 = -0.7616 * b5 - white * 0.0168980;
                output[i] = b0 + b1 + b2 + b3 + b4 + b5 + b6 + white * 0.5362;
                output[i] *= 0.11; // Normalize gain
                b6 = white * 0.115926;
            }
        }
        AppState.noiseBuffers[type] = noiseBuffer;
    });
}

// ==========================================
// 3. NEURAL INJECTION MATRIX
// ==========================================
function activateState(type, element) {
    const isBeat = ['theta', 'alpha', 'gamma'].includes(type);
    const isNoise = ['brown', 'pink'].includes(type);

    // FIX: Titanium String Logic using dataset attributes
    if (isBeat) {
        document.querySelectorAll('.freq-btn').forEach(btn => {
            const btnType = btn.dataset.type;
            if (['theta', 'alpha', 'gamma'].includes(btnType) && btn !== element) {
                btn.classList.remove('active-glow');
            }
        });
        AppState.activeBeat = AppState.activeBeat === type ? null : type;
    } else if (isNoise) {
        document.querySelectorAll('.freq-btn').forEach(btn => {
            const btnType = btn.dataset.type;
            if (['brown', 'pink'].includes(btnType) && btn !== element) {
                btn.classList.remove('active-glow');
            }
        });
        AppState.activeNoise = AppState.activeNoise === type ? null : type;
    }

    element.classList.toggle('active-glow');

    if (AppState.isRunning) {
        rebuildAudioStream();
    }
}

// ==========================================
// 4. SYNCHRONOUS HARDWARE ROUTING
// ==========================================
function rebuildAudioStream() {
    const ctx = AppState.audioCtx;
    const now = ctx.currentTime;

    // FIX: No setTimeout. Schedule deaths on the hardware clock directly.
    if (AppState.nodes.beatGain) {
        AppState.nodes.beatGain.gain.setValueAtTime(AppState.nodes.beatGain.gain.value, now);
        AppState.nodes.beatGain.gain.linearRampToValueAtTime(0, now + 0.5);
        
        AppState.nodes.leftOsc.stop(now + 0.6);
        AppState.nodes.rightOsc.stop(now + 0.6);
        
        // Detach references so GC can clean them up, making room for new ones instantly
        AppState.nodes.leftOsc = null;
        AppState.nodes.rightOsc = null;
        AppState.nodes.beatGain = null;
    }

    if (AppState.nodes.noiseGain) {
        AppState.nodes.noiseGain.gain.setValueAtTime(AppState.nodes.noiseGain.gain.value, now);
        AppState.nodes.noiseGain.gain.linearRampToValueAtTime(0, now + 0.5);
        
        AppState.nodes.noiseSrc.stop(now + 0.6);
        
        AppState.nodes.noiseSrc = null;
        AppState.nodes.noiseFilter = null;
        AppState.nodes.noiseGain = null;
    }

    // IGNITE NEW NODES SYNCHRONOUSLY
    if (AppState.isRunning) {
        if (AppState.activeBeat) synthesizeBinaural(AppState.activeBeat);
        if (AppState.activeNoise) synthesizeNoise(AppState.activeNoise);
    }
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

    // Keep silent at creation, fade in mathematically
    AppState.nodes.beatGain.gain.setValueAtTime(0, now);
    AppState.nodes.beatGain.gain.linearRampToValueAtTime(0.6, now + 1.0); 

    // Synchronous execution satisfies iOS/Android tap-bubble rules
    AppState.nodes.leftOsc.start(now);
    AppState.nodes.rightOsc.start(now);
}

function synthesizeNoise(type) {
    const ctx = AppState.audioCtx;
    const now = ctx.currentTime;

    AppState.nodes.noiseSrc = ctx.createBufferSource();
    AppState.nodes.noiseSrc.buffer = AppState.noiseBuffers[type]; 
    AppState.nodes.noiseSrc.loop = true;

    AppState.nodes.noiseFilter = ctx.createBiquadFilter();
    AppState.nodes.noiseFilter.type = 'lowpass';
    AppState.nodes.noiseFilter.frequency.value = type === 'brown' ? 400 : 1200; 

    AppState.nodes.noiseGain = ctx.createGain();
    
    AppState.nodes.noiseSrc.connect(AppState.nodes.noiseFilter);
    AppState.nodes.noiseFilter.connect(AppState.nodes.noiseGain);
    AppState.nodes.noiseGain.connect(AppState.masterGain);

    // Keep silent at creation, fade in mathematically
    AppState.nodes.noiseGain.gain.setValueAtTime(0, now);
    AppState.nodes.noiseGain.gain.linearRampToValueAtTime(0.4, now + 1.5); 

    // Synchronous execution
    AppState.nodes.noiseSrc.start(now);
}

// ==========================================
// 5. IGNITION & CHRONO-TRACKING
// ==========================================
function toggleTimer() {
    const btn = document.getElementById('toggle-timer-btn');
    const overlay = document.getElementById('heartbeat-overlay');
    const slider = document.getElementById('time-slider');
    const display = document.getElementById('timer-display');
    const now = AppState.audioCtx ? AppState.audioCtx.currentTime : 0;

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
            AppState.masterGain.gain.setValueAtTime(AppState.masterGain.gain.value, now);
            AppState.masterGain.gain.linearRampToValueAtTime(0, now + 1.0);
            
            // Cleanly stop via hardware clock
            setTimeout(() => {
                rebuildAudioStream(); // Calling this while isRunning=false cleans up active nodes natively
            }, 1100);
        }

    } else {
        // IGNITE SEQUENCE
        if (!AppState.activeBeat && !AppState.activeNoise) {
            alert("Matrix Error: Please select at least one Neural Injection Frequency.");
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
            
            // Synchronous rebuild + hardware crossfade
            AppState.masterGain.gain.setValueAtTime(0, now);
            AppState.masterGain.gain.linearRampToValueAtTime(1, now + 1.0);
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

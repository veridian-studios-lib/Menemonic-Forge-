/**
 * THE MNEMOSYNE ENGINE - OMNI-SEARCH HUD (v2.1 Mobile Stabilized)
 * Features: Hardware Touch Shield (750ms Dilation), Direct Pointer Event Hijack,
 * Zero-Latency Trie Search, Cold-State History, and Viewport-Settled Spatial Folding.
 */

(function () {
    'use strict';

    let overlayOpenTime = 0; // SHIELD: Tracks timestamp when HUD opens

    // Safe retrieval of active global orbs
    function getGlobalOrbs() {
        if (typeof window.orbs !== 'undefined' && Array.isArray(window.orbs)) return window.orbs;
        if (typeof orbs !== 'undefined' && Array.isArray(orbs)) return orbs;
        return [];
    }

    // ==========================================
    // 1. TRIE INDEXING & ALGORITHM
    // ==========================================
    class TrieNode {
        constructor() {
            this.children = {};
            this.orbIds = new Set();
        }
    }

    class MnemonicTrie {
        constructor() {
            this.root = new TrieNode();
        }

        insert(text, orbId) {
            if (!text || typeof text !== 'string') return;
            const words = text.toLowerCase().replace(/[^a-z0-9\s]/g, '').split(/\s+/);
            words.forEach(word => {
                if (!word) return;
                let node = this.root;
                for (let char of word) {
                    if (!node.children[char]) node.children[char] = new TrieNode();
                    node = node.children[char];
                    node.orbIds.add(orbId);
                }
            });
        }

        searchPrefix(prefix) {
            let node = this.root;
            const cleanPrefix = prefix.toLowerCase().trim();
            if (!cleanPrefix) return [];
            for (let char of cleanPrefix) {
                if (!node.children[char]) return [];
                node = node.children[char];
            }
            return Array.from(node.orbIds);
        }
    }

    let omniTrie = new MnemonicTrie();

    function rebuildTrieIndex() {
        omniTrie = new MnemonicTrie();
        const currentOrbs = getGlobalOrbs();
        currentOrbs.forEach(orb => {
            omniTrie.insert(orb.title, orb.id);
            omniTrie.insert(orb.content, orb.id);
        });
    }

    // ==========================================
    // 2. HUD INJECTION & AESTHETICS
    // ==========================================
    function injectSearchDOM() {
        if (document.getElementById('omni-search-overlay')) return;

        const style = document.createElement('style');
        style.innerHTML = `
            .sentient-core { pointer-events: auto !important; cursor: pointer; touch-action: none; }
            
            #omni-search-overlay {
                position: fixed; inset: 0; z-index: 9999;
                background: rgba(5, 5, 5, 0.92); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
                display: none; flex-direction: column; align-items: center; padding-top: 8vh;
                opacity: 0; transition: opacity 0.2s ease;
            }
            #omni-search-overlay.active { display: flex; opacity: 1; }

            .search-box-container { width: 92%; max-width: 600px; position: relative; pointer-events: auto; }

            #omni-search-input {
                width: 100%; background: #111; border: 1px solid #333; color: #E0E0E0;
                padding: 16px 20px 16px 48px; font-family: 'JetBrains Mono', monospace; font-size: 16px;
                border-radius: 30px; outline: none; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                transition: border-color 0.3s, box-shadow 0.3s;
            }
            #omni-search-input:focus { border-color: #00F2FF; box-shadow: 0 0 25px rgba(0, 242, 255, 0.25); }
            
            .search-icon-static {
                position: absolute; left: 18px; top: 50%; transform: translateY(-50%);
                color: #555; font-size: 18px; font-family: sans-serif; pointer-events: none;
            }

            #omni-results-list {
                width: 92%; max-width: 600px; margin-top: 12px; max-height: 55vh;
                overflow-y: auto; display: flex; flex-direction: column; gap: 6px;
                pointer-events: auto;
            }

            .search-result-card {
                padding: 14px 18px; border-radius: 12px; cursor: pointer; background: rgba(255, 255, 255, 0.02);
                display: flex; align-items: center; gap: 14px; border: 1px solid rgba(255, 255, 255, 0.05);
                transition: background 0.15s, border-color 0.15s; touch-action: manipulation;
            }
            .search-result-card:active, .search-result-card:hover { 
                background: rgba(0, 242, 255, 0.08); 
                border-color: rgba(0, 242, 255, 0.3);
            }
            
            .result-icon { font-size: 16px; color: #888; width: 20px; text-align: center; }
            .result-text-stack { display: flex; flex-direction: column; gap: 2px; }
            .result-title { font-family: 'Cinzel', serif; color: #FFF; font-size: 14px; letter-spacing: 0.5px; }
            .result-path { font-family: 'JetBrains Mono', monospace; color: #00F2FF; font-size: 10px; opacity: 0.7; }
        `;
        document.head.appendChild(style);

        const overlay = document.createElement('div');
        overlay.id = 'omni-search-overlay';
        overlay.innerHTML = `
            <div class="search-box-container">
                <span class="search-icon-static">🔍</span>
                <input id="omni-search-input" type="text" placeholder="Search the Void..." autocomplete="off" spellcheck="false">
            </div>
            <div id="omni-results-list"></div>
        `;
        document.body.appendChild(overlay);

        const input = document.getElementById('omni-search-input');
        input.addEventListener('input', (e) => handleSearchInput(e.target.value));

        // SHIELD IMPLEMENTED: 750ms Guard against ghost taps and touch-releases
        overlay.addEventListener('pointerdown', (e) => {
            if (Date.now() - overlayOpenTime < 750) return; 
            if (e.target === overlay) closeSearchHUD();
        });
    }

    // ==========================================
    // 3. SEARCH LOGIC & COLD STATE
    // ==========================================
    function handleSearchInput(query) {
        const cleanQuery = query.trim().toLowerCase();
        if (!cleanQuery) {
            renderColdState();
            return;
        }

        const list = document.getElementById('omni-results-list');
        list.innerHTML = '';
        const allOrbs = getGlobalOrbs();
        
        const trieMatchedIds = omniTrie.searchPrefix(cleanQuery);
        const matchedOrbs = allOrbs.filter(orb => {
            return trieMatchedIds.includes(orb.id) || 
                   (orb.title && orb.title.toLowerCase().includes(cleanQuery));
        });

        if (matchedOrbs.length === 0) {
            list.innerHTML = `
                <div class="search-result-card" style="border-color: rgba(255, 26, 26, 0.4);">
                    <span class="result-icon">⚡</span>
                    <div class="result-text-stack">
                        <span class="result-title" style="color:#FF1A1A;">Summon Grand Conclave</span>
                        <span class="result-path">GENERATE NEW AXIOM</span>
                    </div>
                </div>`;
            return;
        }

        matchedOrbs.forEach(orb => renderResultCard(orb, '🔍'));
    }

    function renderColdState() {
        const list = document.getElementById('omni-results-list');
        list.innerHTML = '';
        const allOrbs = getGlobalOrbs();
        
        const recentOrbs = allOrbs.slice(-5).reverse(); 
        recentOrbs.forEach(orb => renderResultCard(orb, '🕒'));
    }

    function renderResultCard(orb, iconSymbol) {
        const list = document.getElementById('omni-results-list');
        const card = document.createElement('div');
        card.className = 'search-result-card';
        
        let parentName = "MAIN VOID";
        const allOrbs = getGlobalOrbs();
        if (orb.parentId) {
            const parent = allOrbs.find(p => p.id === orb.parentId);
            if (parent) parentName = parent.title;
        }

        card.innerHTML = `
            <span class="result-icon">${iconSymbol}</span>
            <div class="result-text-stack">
                <span class="result-title">${orb.title || 'Untitled'}</span>
                <span class="result-path">IN: ${parentName}</span>
            </div>
        `;

        // POINTER INTERCEPT: Double-Tap mechanic to prevent scroll conflicts
        let lastTap = 0;
        card.addEventListener('pointerup', (e) => {
            const currentTime = new Date().getTime();
            const tapLength = currentTime - lastTap;
            
            if (tapLength < 500 && tapLength > 0) {
                // DOUBLE TAP DETECTED - Execute spatial fold
                e.preventDefault();
                e.stopPropagation();
                foldToOrb(orb);
            } else {
                // SINGLE TAP - Visually lock target, allow scroll to continue safely
                // Reset all other cards to default styling first
                document.querySelectorAll('.search-result-card').forEach(c => {
                    c.style.borderColor = 'rgba(255, 255, 255, 0.05)';
                    c.style.background = 'rgba(255, 255, 255, 0.02)';
                });
                // Highlight the currently tapped card
                card.style.borderColor = 'rgba(0, 242, 255, 0.8)';
                card.style.background = 'rgba(0, 242, 255, 0.15)';
            }
            lastTap = currentTime;
        });

        list.appendChild(card);
    } // End of renderResultCard function

    
    // ==========================================
    // 4. SPATIAL FOLDING & CAMERA SNAP
    // ==========================================

    function foldToOrb(targetOrb) {
        // OMNI-DIRECTOR SAFEGUARD
        if (!targetOrb) return; 
        
        closeSearchHUD();

        // 1. Update Sub-Void Spatial Context
        const targetParent = targetOrb.parentId || null;
        if (typeof window.setCurrentParentId === 'function') {
            window.setCurrentParentId(targetParent);
        } else {
            window.currentParentId = targetParent;
        }

        const backBtn = document.getElementById('backBtn');
        if (backBtn) {
            const currentParent = typeof window.getCurrentParentId === 'function' 
                ? window.getCurrentParentId() 
                : window.currentParentId;
            backBtn.style.display = currentParent ? 'block' : 'none';
        }

        // 2. Trigger the Engine's Visual Re-render
        if (typeof window.renderWeb === 'function') {
            window.renderWeb();
        } else if (typeof renderWeb === 'function') {
            renderWeb();
        }

        // 3. The Omni-Seeker Protocol (Active Tracking Loop)
        // Tracks the target node for 2 seconds while kinetic physics settle
        let trackingFrames = 0;
        const maxFrames = 120; // Approx 2 seconds at 60fps
        
        function trackTargetNode() {
            trackingFrames++;
            const activeCamera = window.camera || (typeof camera !== 'undefined' ? camera : null);
            const liveOrbs = typeof getGlobalOrbs === 'function' ? getGlobalOrbs() : (window.orbs || []);
            const liveTarget = liveOrbs.find(o => o.id === targetOrb.id);

            if (activeCamera && liveTarget && typeof liveTarget.x === 'number' && !isNaN(liveTarget.x)) {
                const scale = activeCamera.z || 1;
                
                // Continuously update camera to follow the migrating node
                activeCamera.x = (window.innerWidth / 2) - (liveTarget.x * scale);
                activeCamera.y = (window.innerHeight / 2) - (liveTarget.y * scale);
                
                if (typeof window.applyCamera === 'function') {
                    window.applyCamera();
                } else if (typeof applyCamera === 'function') {
                    applyCamera();
                }
            }

            // Continue tracking until the physics have definitively settled
            if (trackingFrames < maxFrames) {
                requestAnimationFrame(trackTargetNode);
            }
        }
        
        // Initiate tracking immediately
        trackTargetNode();

        // 4. Trigger the Perceptual Architect / Open Info Box Instantly
        if (typeof window.openOrbInfo === 'function') {
            window.openOrbInfo(targetOrb.id);
        } else if (typeof openOrbInfo === 'function') {
            openOrbInfo(targetOrb.id);
        }
                   }
    
    
    // ==========================================
    // 5. TRIGGERS & HARDWARE TOUCH SHIELD
    // ==========================================
    let lastCoreTap = 0;

    function setupTriggers() {
        const core = document.querySelector('.sentient-core');
        if (core) {
            core.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                e.preventDefault();
                const now = Date.now();
                if (now - lastCoreTap < 350 && now - lastCoreTap > 0) {
                    openSearchHUD();
                    lastCoreTap = 0;
                } else {
                    lastCoreTap = now;
                }
            });
        }

        window.addEventListener('keydown', (e) => {
            if (e.key === '/' && !document.getElementById('omni-search-overlay').classList.contains('active')) {
                if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    openSearchHUD();
                }
            }
            if (e.key === 'Escape') closeSearchHUD();
        });
    }

    function openSearchHUD() {
        overlayOpenTime = Date.now();
        rebuildTrieIndex();
        const overlay = document.getElementById('omni-search-overlay');
        const input = document.getElementById('omni-search-input');
        
        // Disable pointer interactions briefly during activation transition
        overlay.style.pointerEvents = 'none';
        overlay.classList.add('active');
        input.value = '';
        renderColdState(); 

        setTimeout(() => {
            overlay.style.pointerEvents = 'auto';
            input.focus();
        }, 300);
    }

    function closeSearchHUD() {
        const overlay = document.getElementById('omni-search-overlay');
        const input = document.getElementById('omni-search-input');
        if (input) input.blur();
        if (overlay) overlay.classList.remove('active');
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { injectSearchDOM(); setupTriggers(); });
    } else {
        injectSearchDOM(); setupTriggers();
    }
})();

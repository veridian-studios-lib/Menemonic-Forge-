/**
 * THE MNEMOSYNE ENGINE - OMNI-SEARCH HUD
 * Features: Zero-Latency Trie Search, Mobile Keyboard Hijack, 
 * Cold-State History, and Spatial Void Folding.
 */

(function () {
    'use strict';

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
        if (typeof window.orbs !== 'undefined' && Array.isArray(window.orbs)) {
            window.orbs.forEach(orb => {
                omniTrie.insert(orb.title, orb.id);
                omniTrie.insert(orb.content, orb.id);
            });
        }
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
                background: rgba(5, 5, 5, 0.90); backdrop-filter: blur(15px); -webkit-backdrop-filter: blur(15px);
                display: none; flex-direction: column; align-items: center; padding-top: 10vh;
                opacity: 0; transition: opacity 0.2s ease; pointer-events: auto;
            }
            #omni-search-overlay.active { display: flex; opacity: 1; }

            .search-box-container { width: 92%; max-width: 600px; position: relative; }

            /* Google Mobile Style Input but Cyberpunk */
            #omni-search-input {
                width: 100%; background: #111; border: 1px solid #333; color: #E0E0E0;
                padding: 18px 24px 18px 50px; font-family: 'JetBrains Mono', monospace; font-size: 16px;
                border-radius: 30px; outline: none; box-shadow: 0 4px 20px rgba(0,0,0,0.5);
                transition: border-color 0.3s, box-shadow 0.3s;
            }
            #omni-search-input:focus { border-color: #00F2FF; box-shadow: 0 0 30px rgba(0, 242, 255, 0.2); }
            
            .search-icon-static {
                position: absolute; left: 18px; top: 50%; transform: translateY(-50%);
                color: #555; font-size: 20px; font-family: sans-serif; pointer-events: none;
            }

            #omni-results-list {
                width: 92%; max-width: 600px; margin-top: 12px; max-height: 60vh;
                overflow-y: auto; display: flex; flex-direction: column; gap: 4px;
            }

            .search-result-card {
                padding: 16px 20px; border-radius: 12px; cursor: pointer;
                display: flex; align-items: center; gap: 15px;
                transition: background 0.15s;
            }
            .search-result-card:active, .search-result-card:hover { background: rgba(255, 255, 255, 0.05); }
            
            .result-icon { font-size: 18px; color: #777; width: 20px; text-align: center; }
            .result-text-stack { display: flex; flex-direction: column; }
            .result-title { font-family: 'Cinzel', serif; color: #FFF; font-size: 15px; }
            .result-path { font-family: 'JetBrains Mono', monospace; color: #00F2FF; font-size: 11px; opacity: 0.6; }
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

        // Close on background tap
        overlay.addEventListener('pointerdown', (e) => {
            if (e.target === overlay) closeSearchHUD();
        });
    }

    // ==========================================
    // 3. SEARCH LOGIC & COLD STATE
    // ==========================================
    function handleSearchInput(query) {
        const cleanQuery = query.trim().toLowerCase();
        if (!cleanQuery) {
            renderColdState(); // Show recent history/core axioms if empty
            return;
        }

        const list = document.getElementById('omni-results-list');
        list.innerHTML = '';
        const allOrbs = window.orbs || [];
        
        const trieMatchedIds = omniTrie.searchPrefix(cleanQuery);
        const matchedOrbs = allOrbs.filter(orb => {
            return trieMatchedIds.includes(orb.id) || 
                   (orb.title && orb.title.toLowerCase().includes(cleanQuery));
        });

        if (matchedOrbs.length === 0) {
            list.innerHTML = `<div class="search-result-card"><span class="result-icon">⚡</span>
                              <div class="result-text-stack"><span class="result-title" style="color:#FF1A1A;">Summon Grand Conclave</span>
                              <span class="result-path">GENERATE NEW AXIOM</span></div></div>`;
            return;
        }

        matchedOrbs.forEach(orb => renderResultCard(orb, '🔍'));
    }

    function renderColdState() {
        const list = document.getElementById('omni-results-list');
        list.innerHTML = '';
        const allOrbs = window.orbs || [];
        
        // Grab the 5 most recently created/accessed Orbs (Simulation of History)
        const recentOrbs = allOrbs.slice(-5).reverse(); 
        
        recentOrbs.forEach(orb => renderResultCard(orb, '🕒')); // Clock icon for history
    }

    function renderResultCard(orb, iconSymbol) {
        const list = document.getElementById('omni-results-list');
        const card = document.createElement('div');
        card.className = 'search-result-card';
        
        let parentName = "MAIN VOID";
        if (orb.parentId && window.orbs) {
            const parent = window.orbs.find(p => p.id === orb.parentId);
            if (parent) parentName = parent.title;
        }

        card.innerHTML = `
            <span class="result-icon">${iconSymbol}</span>
            <div class="result-text-stack">
                <span class="result-title">${orb.title || 'Untitled'}</span>
                <span class="result-path">IN: ${parentName}</span>
            </div>
        `;
        card.addEventListener('click', () => foldToOrb(orb));
        list.appendChild(card);
    }

    // ==========================================
    // 4. SPATIAL FOLDING & CAMERA SNAP
    // ==========================================
    function foldToOrb(targetOrb) {
        closeSearchHUD();
        window.currentParentId = targetOrb.parentId || null;
        
        const backBtn = document.getElementById('backBtn');
        if (backBtn) backBtn.style.display = window.currentParentId ? 'block' : 'none';

        if (typeof window.renderWeb === 'function') window.renderWeb();

        const scale = window.camera.z || 1;
        const targetX = (window.innerWidth / 2) - (targetOrb.x * scale);
        const targetY = (window.innerHeight / 2) - (targetOrb.y * scale);

        let frame = 0;
        const startX = window.camera.x;
        const startY = window.camera.y;

        function animateFold() {
            frame++;
            const ease = 1 - Math.pow(1 - (frame / 25), 3);
            window.camera.x = startX + (targetX - startX) * ease;
            window.camera.y = startY + (targetY - startY) * ease;
            if (typeof window.applyCamera === 'function') window.applyCamera();
            if (frame < 25) requestAnimationFrame(animateFold);
        }
        animateFold();
    }

    // ==========================================
    // 5. TRIGGERS: DOUBLE-TAP & GHOST KEYSTROKE
    // ==========================================
    let lastCoreTap = 0;

    function setupTriggers() {
        // 1. Red Giant Double Tap
        const core = document.querySelector('.sentient-core');
        if (core) {
            core.addEventListener('pointerdown', (e) => {
                e.stopPropagation();
                const now = Date.now();
                if (now - lastCoreTap < 350 && now - lastCoreTap > 0) {
                    e.preventDefault();
                    openSearchHUD();
                    lastCoreTap = 0;
                } else {
                    lastCoreTap = now;
                }
            });
        }

        // 2. Ghost Keystroke (Press '/' to search)
        window.addEventListener('keydown', (e) => {
            if (e.key === '/' && !document.getElementById('omni-search-overlay').classList.contains('active')) {
                // Ensure user isn't already typing in a different input (like an orb editor)
                if (document.activeElement.tagName !== 'INPUT' && document.activeElement.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    openSearchHUD();
                }
            }
            if (e.key === 'Escape') closeSearchHUD();
        });
    }

    function openSearchHUD() {
        rebuildTrieIndex();
        const overlay = document.getElementById('omni-search-overlay');
        const input = document.getElementById('omni-search-input');
        
        overlay.classList.add('active');
        input.value = '';
        renderColdState(); // Initialize with recent/history view
        
        // Force mobile keyboard deployment
        setTimeout(() => {
            input.focus();
            input.click();
        }, 10);
    }

    function closeSearchHUD() {
        const overlay = document.getElementById('omni-search-overlay');
        const input = document.getElementById('omni-search-input');
        if (input) input.blur();
        if (overlay) overlay.classList.remove('active');
    }

    // Initialize module
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { injectSearchDOM(); setupTriggers(); });
    } else {
        injectSearchDOM(); setupTriggers();
    }
})();
      

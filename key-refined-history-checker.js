// ==UserScript==
// @name        Backpack.tf Key/Refined History Checker
// @namespace   https://github.com/williambrooks84/key-refined-history-checker
// @version     1.0.0
// @description Check key/refined history matches for a username in backpack.tf compare.
// @author      William Brooks (Strange Fry on Steam)
// @updateURL   https://raw.githubusercontent.com/williambrooks84/key-refined-history-checker/main/key-refined-history-checker.js
// @downloadURL https://raw.githubusercontent.com/williambrooks84/key-refined-history-checker/main/key-refined-history-checker.js
// @grant       GM_xmlhttpRequest
// @grant       GM_addStyle
// @run-at      document-end
// @include     /^https?:\/\/(.*\.)?backpack\.tf(:\d+)?\/(?:id|profiles)\/.*/
// @connect     backpack.tf
// ==/UserScript==

(function() {
    'use strict';
    
    GM_addStyle(`
        #bulk-key-checker {
            display: inline-block;
            margin-left: 10px;
            margin-right: 10px;
            padding: 8px 15px;
            background: #27ae60;
            color: white;
            border: none;
            border-radius: 4px;
            cursor: pointer;
            font-weight: bold;
        }
        
        #bulk-key-checker:hover {
            background: #229954;
        }
        
        .key-checker-modal {
            position: fixed;
            top: 50%;
            left: 50%;
            transform: translate(-50%, -50%);
            background: white;
            padding: 25px;
            border-radius: 8px;
            box-shadow: 0 4px 20px rgba(0,0,0,0.5);
            z-index: 999999;
            min-width: 400px;
            max-width: 500px;
        }
        
        .key-checker-overlay {
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.7);
            z-index: 999998;
        }
        
        .key-checker-modal h3 {
            margin: 0 0 20px 0;
            color: #2c3e50;
            font-size: 20px;
        }
        
        .key-checker-modal button {
            width: 100%;
            padding: 12px;
            margin: 10px 0 5px 0;
            border: none;
            border-radius: 4px;
            font-size: 16px;
            font-weight: bold;
            cursor: pointer;
            background: #e74c3c;
            color: white;
        }
        
        .key-checker-modal button:hover {
            background: #c0392b;
        }
        
        .progress-section {
            margin: 20px 0;
            padding: 15px;
            background: #ecf0f1;
            border-radius: 4px;
        }
        
        .progress-bar {
            width: 100%;
            height: 25px;
            background: #bdc3c7;
            border-radius: 4px;
            overflow: hidden;
            margin: 10px 0;
        }
        
        .progress-fill {
            height: 100%;
            background: #3498db;
            transition: width 0.3s ease;
            display: flex;
            align-items: center;
            justify-content: center;
            color: white;
            font-weight: bold;
            font-size: 12px;
        }
        
        .result-section {
            margin: 20px 0;
            padding: 20px;
            background: #d4edda;
            border: 2px solid #27ae60;
            border-radius: 4px;
            text-align: center;
        }
        
        .result-count {
            font-size: 48px;
            color: #27ae60;
            font-weight: bold;
            margin: 10px 0;
        }
        
        .result-text {
            font-size: 18px;
            color: #2c3e50;
            margin: 5px 0;
        }
        
        .status-text {
            color: #7f8c8d;
            font-size: 14px;
            margin: 5px 0;
        }
        
        .matched-keys-list {
            max-height: 200px;
            overflow-y: auto;
            margin: 15px 0;
            padding: 10px;
            background: white;
            border-radius: 4px;
            text-align: left;
        }
        
        .matched-key-item {
            padding: 5px;
            margin: 3px 0;
            font-size: 12px;
            color: #2c3e50;
        }
        
        .matched-key-item a {
            color: #3498db;
            text-decoration: none;
        }
        
        .matched-key-item a:hover {
            text-decoration: underline;
        }
    `);
    
    let isChecking = false;
    let checkCancelled = false;
    
    async function fetchItemHistory(itemId) {
        return new Promise((resolve, reject) => {
            GM_xmlhttpRequest({
                method: 'GET',
                url: `https://backpack.tf/item/${itemId}`,
                timeout: 10000,
                onload: function(response) {
                    console.log(`Fetch response for ${itemId}: status ${response.status}`);
                    if (response.status === 200) {
                        resolve(response.responseText);
                    } else {
                        reject(new Error(`HTTP ${response.status} for item ${itemId}`));
                    }
                },
                onerror: function() {
                    reject(new Error(`Network error for item ${itemId}`));
                },
                ontimeout: function() {
                    reject(new Error(`Timeout for item ${itemId}`));
                }
            });
        });
    }
    
    function userInHistory(html, username) {
        return html.toLowerCase().includes(username.toLowerCase());
    }
    
    function getKeyItemIds(parentEl) {
        const keysList = parentEl.querySelectorAll('li.item[data-name="Mann Co. Supply Crate Key"], li.item[data-name="Refined Metal"]');
        return Array.from(keysList).map((itemEl) => {
            return {
                id: itemEl.dataset.original_id,
                type: itemEl.dataset.name === 'Mann Co. Supply Crate Key' ? 'key' : 'refined'
            };
        });
    }
    
    async function checkAllKeys(itemIds, username, updateCallback) {
        let matchedKeys = 0;
        let matchedRefined = 0;
        const matchedKeysItems = [];
        const matchedRefinedItems = [];
        
        for (let i = 0; i < itemIds.length; i++) {
            if (checkCancelled) {
                break;
            }
            
            const item = itemIds[i];
            const itemId = item.id;
            
            updateCallback({
                current: i + 1,
                total: itemIds.length,
                status: `Checking item ${i + 1} of ${itemIds.length}...`,
                matchedKeys,
                matchedRefined
            });
            
            try {
                const html = await fetchItemHistory(itemId);
                
                const hasUser = userInHistory(html, username);
                                
                if (hasUser) {
                    if (item.type === 'key') {
                        matchedKeys++;
                        matchedKeysItems.push({
                            id: itemId,
                            user: username
                        });
                    } else {
                        matchedRefined++;
                        matchedRefinedItems.push({
                            id: itemId,
                            user: username
                        });
                    }
                    
                    updateCallback({
                        current: i + 1,
                        total: itemIds.length,
                        status: `✓ Match found in item ${i + 1}!`,
                        matchedKeys,
                        matchedRefined
                    });
                }
                
                await new Promise(resolve => setTimeout(resolve, 1500));
                
            } catch (error) {
                console.error(`Error checking item ${itemId}:`, error.message);
                updateCallback({
                    current: i + 1,
                    total: itemIds.length,
                    status: `Skipped item ${i + 1} (error)`,
                    matchedKeys,
                    matchedRefined
                });
            }
        }
        
        return {
            matchedKeys,
            matchedRefined,
            matchedKeysItems,
            matchedRefinedItems
        };
    }
    
    function createProgressPanel() {
        const panel = document.createElement('div');
        panel.id = 'progress-panel';
        panel.className = 'key-checker-modal';
        panel.style.cssText = 'position: fixed; top: 20px; right: 20px; left: auto; transform: none; z-index: 999999; min-width: 350px;';
        
        panel.innerHTML = `
            <h3>Checking Items</h3>
            <div class="progress-section">
                <p class="status-text" id="status-text">Preparing to check...</p>
                <div class="progress-bar">
                    <div class="progress-fill" id="progress-fill">0%</div>
                </div>
                <p class="status-text">Matches found:</p>
                <p class="status-text" style="margin-top: 5px;">
                    Keys: <span id="match-keys">0</span> | Refined: <span id="match-refined">0</span>
                </p>
            </div>
            <button class="cancel-btn" id="stop-check">Stop Checking</button>
        `;
        
        document.body.appendChild(panel);
        
        panel.querySelector('#stop-check').addEventListener('click', () => {
            checkCancelled = true;
            panel.remove();
            isChecking = false;
        });
        
        return panel;
    }
    
    function showResults(matchedKeys, matchedRefined, matchedKeysItems, matchedRefinedItems) {
        const panel = document.createElement('div');
        panel.className = 'key-checker-modal';
        panel.style.cssText = 'position: fixed; top: 50%; left: 50%; transform: translate(-50%, -50%); z-index: 999999; max-height: 80vh; overflow-y: auto;';
        
        const overlay = document.createElement('div');
        overlay.className = 'key-checker-overlay';
        overlay.style.cssText = 'position: fixed; top: 0; left: 0; right: 0; bottom: 0; background: rgba(0,0,0,0.7); z-index: 999998;';
        
        const totalMatches = matchedKeys + matchedRefined;
        
        panel.innerHTML = `
            <div class="result-section">
                <div class="result-count">${totalMatches}</div>
                <div class="result-text">items matched!</div>
                <div style="font-size: 14px; color: #2c3e50; margin: 10px 0;">
                    Keys: <strong>${matchedKeys}</strong> | Refined: <strong>${matchedRefined}</strong>
                </div>
                <div class="matched-keys-list" id="result-list"></div>
            </div>
            <button class="cancel-btn" id="close-results">Close</button>
        `;
        
        document.body.appendChild(overlay);
        document.body.appendChild(panel);
        
        const resultList = panel.querySelector('#result-list');
        let resultHTML = '';
        
        if (matchedKeys > 0) {
            resultHTML += '<div style="margin-bottom: 15px; padding-bottom: 10px; border-bottom: 1px solid #e0e0e0;"><strong style="color: #3498db;">Keys:</strong>';
            resultHTML += matchedKeysItems.map(item => 
                `<div class="matched-key-item">
                    <a href="https://backpack.tf/item/${item.id}" target="_blank">Item #${item.id}</a>
                </div>`
            ).join('');
            resultHTML += '</div>';
        }
        
        if (matchedRefined > 0) {
            resultHTML += '<div style="margin-bottom: 15px;"><strong style="color: #e67e22;">Refined Metal:</strong>';
            resultHTML += matchedRefinedItems.map(item => 
                `<div class="matched-key-item">
                    <a href="https://backpack.tf/item/${item.id}" target="_blank">Item #${item.id}</a>
                </div>`
            ).join('');
            resultHTML += '</div>';
        }
        
        if (resultHTML) {
            resultList.innerHTML = resultHTML;
        } else {
            resultList.innerHTML = '<p style="text-align: center; color: #7f8c8d;">No matches found</p>';
        }
        
        const closeBtn = panel.querySelector('#close-results');
        const closeAll = () => {
            overlay.remove();
            panel.remove();
        };
        
        closeBtn.addEventListener('click', closeAll);
        overlay.addEventListener('click', closeAll);
    }
    
    async function showCheckerModal(itemIds) {

        const keyCount = itemIds.filter(item => item.type === 'key').length;
        const refinedCount = itemIds.filter(item => item.type === 'refined').length;
        
        const username = prompt(`Enter username to search for\n\n Keys: ${keyCount}\n Refined Metal: ${refinedCount}\n\nTotal: ${itemIds.length} items to check:`);
        if (!username) {
            isChecking = false;
            return;
        }

        const progressPanel = createProgressPanel();
        checkCancelled = false;
        
        const result = await checkAllKeys(itemIds, username, (progress) => {
            const percent = Math.round((progress.current / progress.total) * 100);
            progressPanel.querySelector('#progress-fill').style.width = percent + '%';
            progressPanel.querySelector('#progress-fill').textContent = percent + '%';
            progressPanel.querySelector('#status-text').textContent = progress.status;
            progressPanel.querySelector('#match-keys').textContent = progress.matchedKeys;
            progressPanel.querySelector('#match-refined').textContent = progress.matchedRefined;
        });
        
        progressPanel.remove();
        
        if (!checkCancelled) {
            showResults(result.matchedKeys, result.matchedRefined, result.matchedKeysItems, result.matchedRefinedItems);
        }
        
        isChecking = false;
    }
    
    function onCompareModal(modalEl) {
        try {
            let modalFooterEl = modalEl.querySelector('.modal-footer');
            
            if (!modalFooterEl) {
                setTimeout(() => {
                    modalFooterEl = modalEl.querySelector('.modal-footer');
                    if (modalFooterEl) {
                        addButtonToFooter(modalFooterEl, modalEl);
                    } else {
                        console.error('❌ Modal footer still not found after wait');
                    }
                }, 200);
                return;
            }
            
            addButtonToFooter(modalFooterEl, modalEl);
        } catch (error) {
            console.error('Error adding check button:', error.message);
        }
    }
    
    function addButtonToFooter(modalFooterEl, modalEl) {
        if (modalFooterEl.querySelector('#bulk-key-checker')) {
            return;
        }
        
        const bulkCheckBtn = document.createElement('button');
        bulkCheckBtn.id = 'bulk-key-checker';
        bulkCheckBtn.textContent = 'Check the sale';
        
        modalFooterEl.insertBefore(bulkCheckBtn, modalFooterEl.firstChild);
        
        bulkCheckBtn.addEventListener('click', () => {
            if (isChecking) {
                alert('Already checking items...');
                return;
            }
            
            const removedBinEl = modalEl.getElementsByClassName('inventory-cmp-bin')[1];
            if (!removedBinEl) {
                alert('Could not find removed items section');
                return;
            }
            
            const itemIds = getKeyItemIds(removedBinEl);
            
            if (itemIds.length === 0) {
                alert('No items found to check');
                return;
            }
            
            isChecking = true;
            showCheckerModal(itemIds);
        });
    }
    
    function onPageContentChange(mutations) {
        for (const mutation of mutations) {
            for (const node of mutation.addedNodes) {
                if (node.nodeType !== 1) continue;
                
                if (node.id === 'active-modal') {
                    onCompareModal(node);
                    return;
                }
            }
        }
    }
    
    const observer = new MutationObserver(onPageContentChange);
    const pageContentEl = document.getElementById('page-content');
    
    if (pageContentEl) {
        observer.observe(pageContentEl, {
            childList: true
        });
    } else {
        console.warn('⚠️ page-content element not found');
    }
        const existingModal = document.getElementById('active-modal');
    if (existingModal && existingModal.querySelector && existingModal.querySelector('.inventory-cmp-bins')) {
        onCompareModal(existingModal);
    }
})();

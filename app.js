'use strict';

const REGISTRY_URL = 'https://raw.githubusercontent.com/Chijioke12/Open-KaiStore-Registry/refs/heads/main/apps.json';

const AppStore = {
    apps: [],
    currentIndex: 0,
    requestTimeoutMs: 15000,
    _lastAlertKey: '',

    alertOnce: function(title, detail) {
        try {
            const msg = detail ? `${title}\n\n${detail}` : title;
            const key = msg.slice(0, 300);
            if (key === this._lastAlertKey) return;
            this._lastAlertKey = key;
            alert(msg);
        } catch (e) {}
    },

    fetchText: function(url) {
        const timeoutMs = this.requestTimeoutMs;

        // Prefer XHR with mozSystem when available (KaiOS systemXHR permission).
        const canUseXhr = (typeof XMLHttpRequest === 'function');
        if (canUseXhr) {
            return new Promise((resolve, reject) => {
                let xhr;
                try {
                    xhr = new XMLHttpRequest();
                } catch (e) {
                    reject(e);
                    return;
                }

                try {
                    xhr.mozSystem = true;
                    xhr.mozAnon = true;
                } catch (e) {}

                xhr.open('GET', url, true);
                xhr.timeout = timeoutMs;
                xhr.responseType = 'text';
                xhr.onload = () => {
                    const ok = xhr.status >= 200 && xhr.status < 300;
                    if (!ok) {
                        reject(new Error(`HTTP ${xhr.status} for ${url}`));
                        return;
                    }
                    resolve(xhr.responseText || '');
                };
                xhr.onerror = () => reject(new Error(`Network error for ${url}`));
                xhr.ontimeout = () => reject(new Error(`Timeout for ${url}`));
                try {
                    xhr.send();
                } catch (e) {
                    reject(e);
                }
            });
        }

        // Fallback to fetch in modern browsers.
        if (typeof fetch === 'function') {
            const controller = (typeof AbortController === 'function') ? new AbortController() : null;
            const timer = controller ? setTimeout(() => controller.abort(), timeoutMs) : null;
            return fetch(url, { cache: 'no-store', signal: controller ? controller.signal : undefined })
                .then((response) => {
                    if (!response.ok) throw new Error(`HTTP ${response.status} for ${url}`);
                    return response.text();
                })
                .finally(() => {
                    if (timer) clearTimeout(timer);
                });
        }

        return Promise.reject(new Error('No HTTP client available'));
    },

    fetchJson: async function(url) {
        const text = await this.fetchText(url);
        try {
            return JSON.parse(text);
        } catch (e) {
            throw new Error(`Invalid JSON from ${url}`);
        }
    },

    init: function() {
        this.appList = document.getElementById('app-list');
        if (!this.appList) return;
        this.fetchApps();
        this.setupEventListeners();
    },

    fetchApps: async function() {
        if (this.appList) {
            this.appList.innerHTML = '<div class="loading">Loading apps...</div>';
        }

        const candidates = [
            './apps.json',
            '/open-kaistore-registry/apps.json',
            '../open-kaistore-registry/apps.json',
            REGISTRY_URL,
        ];

        let lastError = null;
        const failures = [];
        for (const url of candidates) {
            try {
                const data = await this.fetchJson(url);
                const apps = (data && Array.isArray(data.apps)) ? data.apps : [];
                if (apps.length === 0 && url !== candidates[candidates.length - 1]) {
                    console.warn('Registry returned 0 apps from', url, '- trying next source');
                    continue;
                }
                this.apps = apps;
                this.renderApps();
                return;
            } catch (err) {
                lastError = err;
                console.warn('Failed to fetch apps from', url, err);
                failures.push(`${url}: ${err && err.message ? err.message : 'Unknown error'}`);
            }
        }

        console.error('Failed to fetch apps:', lastError);
        const detail = lastError && lastError.message ? ` (${lastError.message})` : '';
        this.appList.innerHTML = `<div class="error">Failed to load apps. Check connection.${detail}</div>`;
        if (failures.length) {
            this.alertOnce('Failed to load apps', failures.slice(0, 4).join('\n'));
        } else {
            this.alertOnce('Failed to load apps', lastError && lastError.message ? lastError.message : '');
        }
    },

    renderApps: function() {
        if (this.apps.length === 0) {
            this.appList.innerHTML = '<div class="error">No apps found in registry.</div>';
            return;
        }

        this.appList.innerHTML = '';
        this.apps.forEach((app, index) => {
            const item = document.createElement('div');
            item.className = 'app-item';
            item.setAttribute('tabindex', '0');
            item.innerHTML = `
                <img class="app-icon" src="${app.icon || 'placeholder.png'}">
                <div class="app-info">
                    <div class="app-name">${app.name}</div>
                    <div class="app-author">${app.author}</div>
                </div>
            `;
            item.addEventListener('click', () => this.installApp(app));
            this.appList.appendChild(item);
        });

        this.focusItem(0);
    },

    focusItem: function(index) {
        const items = this.appList.querySelectorAll('.app-item');
        if (items[index]) {
            items[index].focus();
            items[index].scrollIntoView({ block: 'center' });
            this.currentIndex = index;
        }
    },

    setupEventListeners: function() {
        window.addEventListener('keydown', (e) => {
            switch(e.key) {
                case 'ArrowDown':
                    this.focusItem(Math.min(this.currentIndex + 1, this.apps.length - 1));
                    e.preventDefault();
                    break;
                case 'ArrowUp':
                    this.focusItem(Math.max(this.currentIndex - 1, 0));
                    e.preventDefault();
                    break;
                case 'Enter':
                    this.installApp(this.apps[this.currentIndex]);
                    break;
            }
        });
    },

    installApp: function(app) {
        if (!app) return;
        
        console.log('Installing:', app.name);
        
        if (navigator.mozApps && navigator.mozApps.mgmt) {
            const request = app.type === 'packaged' 
                ? navigator.mozApps.mgmt.installPackage(app.download_url)
                : navigator.mozApps.install(app.manifest_url);
                
            request.onsuccess = function() {
                alert('Installation started for ' + app.name);
            };
            
            request.onerror = function() {
                alert('Installation failed: ' + this.error.name);
            };
        } else {
            alert('App management API not available. This app must be privileged.');
        }
    }
};

window.onerror = function(message, source, lineno, colno, error) {
    try {
        const el = document.getElementById('app-list');
        if (!el) return;
        const msg = error && error.message ? error.message : (message || 'Unknown error');
        el.innerHTML = `<div class="error">App error: ${msg}</div>`;
        try {
            AppStore.alertOnce('App error', `${msg}\n${source || ''}:${lineno || 0}`);
        } catch (e) {}
    } catch (e) {}
};

window.onload = () => {
    try {
        AppStore.init();
    } catch (e) {
        const el = document.getElementById('app-list');
        if (el) el.innerHTML = `<div class="error">Init failed: ${e && e.message ? e.message : 'Unknown error'}</div>`;
        try {
            AppStore.alertOnce('Init failed', e && e.message ? e.message : 'Unknown error');
        } catch (e2) {}
    }
};

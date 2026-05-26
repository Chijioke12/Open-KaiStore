'use strict';

const REGISTRY_URL = 'https://raw.githubusercontent.com/Chijioke12/Open-KaiStore-Registry/main/apps.json';

const AppStore = {
    apps: [],
    currentIndex: 0,

    init: function() {
        this.appList = document.getElementById('app-list');
        this.fetchApps();
        this.setupEventListeners();
    },

    fetchApps: function() {
        // For development, we can mock if needed, but we'll try fetch
        fetch(REGISTRY_URL)
            .then(response => response.json())
            .then(data => {
                this.apps = data.apps;
                this.renderApps();
            })
            .catch(err => {
                console.error('Failed to fetch apps:', err);
                this.appList.innerHTML = '<div class="error">Failed to load apps. Check connection.</div>';
            });
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

window.onload = () => AppStore.init();

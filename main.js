const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const os = require('os');

// Create the main window
function createWindow() {
    const win = new BrowserWindow({
        width: 800,
        height: 600,
        webPreferences: {
            preload: path.join(__dirname, 'preload.js'),
            nodeIntegration: true,
            contextIsolation: false,
            enableRemoteModule: true,
        },
    });

    win.loadFile('index.html');
}

// Setup event listeners for Electron app
app.whenReady().then(() => {
    createWindow();

    app.on('activate', function () {
        if (BrowserWindow.getAllWindows().length === 0) createWindow();
    });
});

app.on('window-all-closed', function () {
    if (process.platform !== 'darwin') app.quit();
});

// IPC Handlers to communicate with the Renderer process (frontend)

// Path management for game settings
ipcMain.handle('get-game-settings-path', (event, game) => {
    return getSettingsPath(game);
});

ipcMain.handle('update-game-settings-path', (event, game) => {
    return updatePath(game);
});

// Handle key bind updates
ipcMain.on('update-key-bind', (event, game, keybind, newValue) => {
    updateKeyBind(game, keybind, newValue);
    event.reply('key-bind-updated', `Keybind for ${keybind} updated to ${newValue}`);
});

// Function to get the game settings path from settings.txt or by searching the filesystem
function getSettingsPath(game) {
    const settingsFilePath = path.join(__dirname, 'paths', 'settings.txt');
    let settingsPaths = {};

    try {
        const data = fs.readFileSync(settingsFilePath, 'utf8');
        const lines = data.split('\n');
        lines.forEach(line => {
            const [key, value] = line.split('=');
            settingsPaths[key.trim()] = value.trim();
        });

        if (settingsPaths[game]) {
            return settingsPaths[game];
        } else {
            return searchForSettings(game);
        }
    } catch (err) {
        console.error('Error reading settings file:', err);
    }
}

// Function to update the game settings path by scanning the drive for configuration files
function updatePath(game) {
    const newPath = searchForSettings(game);
    if (newPath) {
        // Append new path to settings.txt file
        const settingsFilePath = path.join(__dirname, 'paths', 'settings.txt');
        fs.appendFileSync(settingsFilePath, `${game}=${newPath}\n`);
        return newPath;
    }
    return null;
}

// Search function that scans for game settings file in the drives
function searchForSettings(game) {
    const drives = os.platform() === 'win32' ? ['C:', 'D:'] : ['/'];
    const searchTerms = {
        'Apex Legends': 'settings.cfg',
        'PUBG': 'GameUserSettings.ini',
        'CS:GO': 'config.cfg'
    };
    let foundPath = null;

    drives.forEach(drive => {
        foundPath = searchDrive(drive, searchTerms[game]);
        if (foundPath) return false; // Break the loop once found
    });

    return foundPath;
}

function searchDrive(drive, searchTerm) {
    const files = fs.readdirSync(drive);
    for (const file of files) {
        const filePath = path.join(drive, file);
        if (fs.statSync(filePath).isDirectory()) {
            return searchDrive(filePath, searchTerm);
        } else if (file.includes(searchTerm)) {
            return filePath;
        }
    }
    return null;
}

// Update the keybinds in the settings file for a specific game
function updateKeyBind(game, keybind, newValue) {
    const settingsPath = getSettingsPath(game);

    if (!settingsPath) {
        console.error('Settings file not found for game:', game);
        return;
    }

    try {
        let fileContent = fs.readFileSync(settingsPath, 'utf8');
        const configMappings = translateConfig(game);

        if (configMappings[keybind]) {
            const bindTerm = configMappings[keybind];
            const currentBindLocation = fileContent.indexOf(bindTerm);

            if (currentBindLocation !== -1) {
                const bindLength = bindTerm.length;
                const beforeBind = fileContent.slice(0, currentBindLocation + bindLength);
                const afterBind = fileContent.slice(currentBindLocation + bindLength + newValue.length);

                fileContent = beforeBind + newValue + afterBind;

                // Write updated content to the settings file
                fs.writeFileSync(settingsPath, fileContent);
                console.log(`Updated ${keybind} to ${newValue} in ${game}`);
            }
        }
    } catch (err) {
        console.error(`Error updating keybind: ${err}`);
    }
}

// Translate the game-specific configuration to universal terms
function translateConfig(game) {
    const configFilePath = path.join(__dirname, 'configtranslations', `${game}.txt`);
    let configMap = {};

    try {
        const data = fs.readFileSync(configFilePath, 'utf8');
        const lines = data.split('\n');
        lines.forEach(line => {
            const [key, value] = line.split(':');
            configMap[key.trim()] = value.trim();
        });
    } catch (err) {
        console.error('Error reading config file:', err);
    }

    return configMap;
}

// Translate keys for a specific game
function translateKeyList(game) {
    const keyFilePath = path.join(__dirname, 'keytranslations', `${game}.txt`);
    let keyMap = {};

    try {
        const data = fs.readFileSync(keyFilePath, 'utf8');
        const lines = data.split('\n');
        lines.forEach(line => {
            const [key, value] = line.split(':');
            keyMap[key.trim()] = value.trim();
        });
    } catch (err) {
        console.error('Error reading key file:', err);
    }

    return keyMap;
}


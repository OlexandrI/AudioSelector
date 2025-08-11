const API = (typeof browser !== "undefined") ? browser : chrome; // For compatibility with Chrome and Firefox
const IS_CHROME_ENV = typeof chrome !== "undefined" && typeof browser === "undefined";
const DATA_PATTERNS = "patterns";


const AudioDevicePatternStatic = {
    useSelectList: () => {
        return navigator.mediaDevices?.selectAudioOutput ? false : true;
    },

    showDefaultOption: () => {
        return !IS_CHROME_ENV;
    }
};

const AudioDevicePatternSchema = new TableDataSchema({
    urlPattern: {
        label: "URL Pattern",
        type: "input",
        tooltip: "URL pattern for the audio device",
        default: "*://example.com/*",
    },
    audioOutputId: {
        label: "Audio Output",
        type: AudioDevicePatternStatic.useSelectList() ? "select" : "input-readonly",
        tooltip: "Audio output device",
        default: AudioDevicePatternStatic.showDefaultOption() ? "Default" : "",
        options: function (data) {
            return AudioDevicePatternManager.getInstance().devices.audiooutput.map((device) => {
                return { value: device.deviceId, label: device.label || device.deviceId };
            });
        },
        getter: function (data) {
            return AudioDevicePatternStatic.useSelectList() ? data.audioOutputId : data.audioOutput || (AudioDevicePatternStatic.showDefaultOption() ? "Default" : "");
        },
        setter: function (data, value) {
            const device = AudioDevicePatternManager.getInstance().devices.audiooutput.find((device) => {
                return device.deviceId === value || device.label === value;
            });
            if (device) {
                data.audioOutputId = device.deviceId;
                data.audioOutput = device.label || (AudioDevicePatternStatic.showDefaultOption() ? "Default" : "");
            } else {
                data.audioOutputId = value;
            }
        },
    }
});

class AudioDevicePatternRow extends TableRow {
    constructor(pattern, devices) {
        super(pattern, AudioDevicePatternSchema);
        this.devices = devices || {audiooutput: []};
        this.permission = {
            origins: [this.get("urlPattern")]
        };
        this.autoSave = true;
        this._requested = false;
    }

    onChanged(elem, event, key, value) {
        if (key === "urlPattern") {
            this.permission.origins = [value];
            this.checkPermission();
        } else if (key === "audioOutputId") {
            const selectedDevice = this.devices.audiooutput.find((device) => device.deviceId === value || device.label === value);
            if (selectedDevice) {
                this.data.audioOutputId = selectedDevice.deviceId;
                this.data.audioOutput = selectedDevice.label || (AudioDevicePatternStatic.showDefaultOption() ? "Default" : "");
            } else {
                this.data.audioOutputId = null;
                this.data.audioOutput = AudioDevicePatternStatic.showDefaultOption() ? "Default" : "";
            }
        }

        super.onChanged(elem, event, key, value);
    }

    onFocused(elem, event, key) {
        if (this._requested) return;
        this._requested = true;
        const self = this;
        if (key === "audioOutputId" && !AudioDevicePatternStatic.useSelectList()) {
            navigator.mediaDevices.selectAudioOutput().then((device) => {
                if (device) {
                    AUDIO_EnumerateDevices().then((devices) => {
                        if (devices.audiooutput.length > 0) AudioDevicePatternManager.getInstance().devices = devices;
                        self.onChanged(elem, event, key, device.deviceId);
                        self._requested = false;
                    });
                }
            }).catch((error) => {
                console.warn("Error selecting audio output device:", error);
                self._requested = false;
            });
        }
        super.onFocused(elem, event, key);
    }
}

class AudioDevicePatternManager extends TableHelper {
    static getInstance() {
        if (!AudioDevicePatternManager.instance) {
            AudioDevicePatternManager.instance = new AudioDevicePatternManager();
        }
        return AudioDevicePatternManager.instance;
    }

    constructor(tableElement) {
        super(AudioDevicePatternSchema, tableElement);
        this.autoSave = true;
        this.genStateCell = true;
        this.genActionsCell = true;
    }

    makeRow(data, schema) {
        return new AudioDevicePatternRow(data, this.devices);
    }

    addNewPattern() {
        const newPattern = this.makeRow({});
        newPattern.reset();
        newPattern.init(this.tbodyElement);
        this.rows.push(newPattern);
        this.updateState();
    }

    loadAll() {
        const self = this;
        return new Promise((resolve) => {
            const cb = () => {
                API.storage.local.get(DATA_PATTERNS).then((data) => {
                    data = data.patterns || [];
                    self.setData(data, false);
                    self.updateState();
                    resolve();
                }).catch((error) => {
                    console.warn("Error loading data:", error);
                    self.updateState();
                    resolve();
                });
            };
            AUDIO_EnumerateDevices().then((devices) => {
                self.devices = devices;
                cb();
            }).catch((error) => {
                console.error("Error loading devices:", error);
                self.devices = {audiooutput: []};
                cb();
            });
        });
    }

    saveAll() {
        const self = this;
        return this.requestPermission().then(async (result) => {
            const setData = {};
            setData[DATA_PATTERNS] = self.getData();
            await API.storage.local.set(setData).then(() => {
                self._isDirty = false;
                self.rows = self.rows.filter((row) => !row._remove);
                self.rows.forEach((row) => {
                    row._isDirty = false;
                    row.updateState();
                });
            }).catch((error) => {
                console.error("Error saving data:", error);
            });
            this.updateState();
            return !self._isDirty;
        }).catch((error) => {
            console.error("Error requesting permission:", error);
            this.updateState();
            return false;
        });
    }
}

const MeetSupportSchema = new TableDataSchema({
    enabled: {
        label: "Enabled",
        type: "checkbox",
        tooltip: "Enable this meeting type",
        default: true,
    },
    name: {
        label: "Name",
        type: "label",
        tooltip: "Name of the meeting type"
    },
    urlPattern: {
        label: "URL Pattern",
        type: "input",
        tooltip: "URL pattern for the meeting type",
    },
});

class MeetSupportRow extends TableRow {
    constructor(data) {
        super(data, MeetSupportSchema);
        this.permission = {
            origins: [this.get("urlPattern")]
        };
        this.autoSave = true;
        this.bGenStateCell = true;
        this.bGenActionsCell = false;
    }

    key() {
        return "enable" + this.data.name + "Tabs";
    }

    save_implementation() {
        const key = this.key();
        const self = this;
        const cb = () => {
            return API.storage.local.set({ [key]: self.data.enabled });
        };

        if (this.hasPermission()) {
            return cb();
        } else {
            return this.requestPermission().then(async (result) => {
                if (!result) {
                    self.data.enabled = false;
                }
                return cb();
            });
        }
    }

    load_implementation() {
        const key = this.key();
        const self = this;
        return API.storage.local.get(key).then((data) => {
            if (data && data[key] !== undefined) {
                self.data.enabled = data[key];
                self.updateState();
                return true;
            }
        }).catch((error) => {
            console.error("Error loading data:", error);
            self.updateState();
            return false;
        });
    }
}

class MeetSupportManager extends TableHelper {
    static getInstance() {
        if (!MeetSupportManager.instance) {
            MeetSupportManager.instance = new MeetSupportManager();
        }
        return MeetSupportManager.instance;
    }

    constructor(tableElement) {
        super(MeetSupportSchema, tableElement);
        this.autoSave = true;
        this.genStateCell = true;
        this.genActionsCell = false;
    }

    makeRow(data, schema) {
        return new MeetSupportRow(data);
    }
}

async function ShowAllShortcuts() {
    // shorcuts - array of Command objects: {name, description, shortcut}
    const shortcuts = await API.commands.getAll();
    const shortcutsTable = document.querySelector("#keyboard-shortcut-table");
    if (shortcutsTable) {
        while (shortcutsTable.firstChild) {
            shortcutsTable.removeChild(shortcutsTable.lastChild);
        }
        shortcuts.forEach((shortcut) => {
            const row = document.createElement("tr");
            const shortcutCell = document.createElement("td");
            shortcutCell.className = "shortcut-name";
            shortcutCell.textContent = shortcut.shortcut || "None";
            row.appendChild(shortcutCell);
            const descriptionCell = document.createElement("td");
            descriptionCell.className = "shortcut-description";
            descriptionCell.textContent = shortcut.description;
            row.appendChild(descriptionCell);
            shortcutsTable.appendChild(row);
        });
    }
}

/**
 * Resets all shortcuts to their default settings by retrieving the list of 
 * available shortcuts and resetting each one. After resetting, it updates 
 * the displayed shortcuts.
 * 
 * @async
 * @function ResetAllShortcuts
 * @returns {Promise<void>} Resolves when all shortcuts have been reset and displayed.
 * @throws {Error} Logs an error to the console if resetting shortcuts fails.
 */
async function ResetAllShortcuts() {
    try {
        const shortcuts = await API.commands.getAll();
        const resetPromises = shortcuts.map((shortcut) => {
            return API.commands.reset(shortcut.name);
        });
        await Promise.all(resetPromises);
        ShowAllShortcuts();
    } catch (error) {
        console.error("Error resetting shortcuts:", error);
    }
};

/**
 * Opens the shortcut settings page if the API supports it.
 * If the `API.commands.openShortcutSettings` function is available, it will be invoked.
 * Otherwise, a warning will be logged to the console indicating that the shortcut settings API is not available.
 *
 * @async
 * @function OpenShortcutsPage
 * @returns {Promise<void>} Resolves when the operation is complete.
 */
async function OpenShortcutsPage() {
    if (API.commands && typeof API.commands.openShortcutSettings === "function") {
        API.commands.openShortcutSettings();
    } else {
        console.warn("Shortcut settings API is not available.");
    }
};


/**
 * Update the UI: set the value of the shortcut textbox.
 */
async function updateUI() {
    elementsDo(".hide-on-chrome" , (elem) => { if ( IS_CHROME_ENV) setVisibility(elem, false) });
    elementsDo(".hide-on-firefox", (elem) => { if (!IS_CHROME_ENV) setVisibility(elem, false) });

    await AudioDevicePatternManager.getInstance().loadAll();
    if (isOK(btnBind("#save-patterns", (event) => {
        AudioDevicePatternManager.getInstance().saveAll();
        event.preventDefault();
    }))) {
        AudioDevicePatternManager.getInstance().autoSave = false;
        watchChange("PatternsManager.disableSave", () => AudioDevicePatternManager.getInstance().isSaving() || !AudioDevicePatternManager.getInstance().isDirty(), (disableSave) => {
            elementsDo("#save-patterns", (elem) => {
                elem.disabled = disableSave;
            });
            return true; // Keep watching
        });
        watchChange("PatternsManager.saving", () => AudioDevicePatternManager.getInstance().isSaving(), (isSaving) => {
            elementsDo("#device-pattern-table input, #device-pattern-table selector", (elem) => {
                elem.disabled = isSaving;
            });
            return true; // Keep watching
        });
    } else {
        AudioDevicePatternManager.getInstance().autoSave = true;
    }
    btnBind("#add-pattern", () => {
        AudioDevicePatternManager.getInstance().addNewPattern();
    });
    btnBind("#permisions-patterns", () => {
        AudioDevicePatternManager.getInstance().requestPermission();
    });
    watchChange("PatternsManager.request", () => AudioDevicePatternManager.getInstance().hasPermission(), (hasPermission) => {
        elementsDo("#permisions-patterns", (elem) => {
            elem.disabled = hasPermission;
        });
        return true; // Keep watching
    });
    const tableElement = document.querySelector("#device-pattern-table");
    if (tableElement) {
        await AudioDevicePatternManager.getInstance().init(tableElement, true);
    }

    if (!IS_CHROME_ENV && !navigator.mediaDevices.selectAudioOutput) {
        setVisibility("#audio-select-warn-firefox", true);
    }

    MeetSupportManager.getInstance().setData([
        {enabled: false, name: "GoogleMeet", urlPattern: "*://meet.google.com/*"},
    ], false);
    MeetSupportManager.getInstance().loadAll();
    const meetSupportTable = document.querySelector("#meet-support-table");
    if (meetSupportTable) {
        MeetSupportManager.getInstance().init(meetSupportTable, true);
        watchChange("MeetSupportManager.saving", () => MeetSupportManager.getInstance().isSaving(), (isSaving) => {
            elementsDo("#meet-support-table input", (elem) => {
                elem.disabled = isSaving;
            });
            return true; // Keep watching
        });
    }

    ShowAllShortcuts();
    btnBind("#keyboard-shortcut-reset", ResetAllShortcuts);
    btnBind("#keyboard-shortcut-settings", OpenShortcutsPage);
}

/**
 * Update the UI when the page loads.
 */
document.addEventListener("DOMContentLoaded", updateUI);
if (navigator?.mediaDevices)
{
    navigator.mediaDevices.ondevicechange = (event) => {
        if (PatternsManager) {
            PatternsManager.updateDevices();
        }
    };
}

const API = typeof browser !== "undefined" ? browser : chrome; // For compatibility with Chrome and Firefox
const IS_CHROME = typeof chrome !== "undefined" && typeof browser === "undefined";
const DATA_PATTERNS = "patterns";

function resolveElement(selector) {
    if (selector instanceof HTMLElement) {
        return selector;
    } else if (typeof selector === "string") {
        const element = document.querySelectorAll(selector);
        if (element) {
            return element;
        } 
    }
    console.error(`Element not found for selector: ${selector}`);
    return null;
}

function elementDo(selector, cb) {
    const element = resolveElement(selector);
    if (element instanceof HTMLElement) {
        return [cb(element)];
    }
    if (element instanceof NodeList) {
        if (element.length === 0) {
            return null;
        }
        let results = [];
        element.forEach((elem) => {
            results.push(cb(elem));
        });
        return results;
    }
    return null;
}

function setVisibility(selector, visible) {
    return elementDo(selector, (element) => {
        element.style.display = visible ? "block" : "none";
    });
}

function isVisible(selector) {
    const results = elementDo(selector, (element) => {
        return element.style.display !== "none";
    });
    if (results && results.length > 0) return results.every((result) => result === true);
    return false;
}

function btnBind(selector, callback) {
    return elementDo(selector, (element) => {
        if (isVisible(element)) {
            element.addEventListener("click", (event) => {
                if (callback(event)) {
                    event.preventDefault();
                }
            });
        }
    });
}


let PatternsManager = null;

class AudioDevicePattern {
    static useSelectList() {
        return navigator.mediaDevices?.selectAudioOutput ? false : true;
    }

    static showDefaultOption() {
        return !IS_CHROME;
    }

    static makeHTMLRow(pattern = {}, devices = {}) {
        const row = document.createElement("tr");

        // Use input fields for devices
        const urlCell = document.createElement("td");
        urlCell.className = "field-url";
        const urlInput = document.createElement("input");
        urlInput.type = "text";
        urlInput.className = "url-pattern";
        urlInput.value = pattern.urlPattern || "*://*/*";
        urlCell.appendChild(urlInput);
        row.appendChild(urlCell);

        const outputCell = document.createElement("td");
        outputCell.className = "field-output";
        if (AudioDevicePattern.useSelectList()) {
            // Fallback to select element for audio output
            const outputSelect = document.createElement("select");
            outputSelect.className = "audio-output";
            outputCell.appendChild(outputSelect);
        } else {
            const outputField = document.createElement("input");
            outputField.type = "text";
            outputField.className = "audio-output";
            outputField.readOnly = true;
            outputField.value = pattern.audioOutput || (AudioDevicePattern.showDefaultOption() ? "Default" : "");
            outputCell.appendChild(outputField);
        }
        row.appendChild(outputCell);

        const actionsCell = document.createElement("td");
        actionsCell.className = "field-actions";
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "btn remove small";
        removeButton.textContent = "Remove";
        actionsCell.appendChild(removeButton);
        row.appendChild(actionsCell);
        return row;
    }

    constructor(pattern = {}, devices = {audiooutput: []}) {
        this.pattern = pattern;
        this.rowElement = null;
        this.eventBinded = false;
        this.remove = false;
        this.devices = devices;
    }

    init(tbodyElement) {
        if (this.rowElement) {
            this.rowElement.remove();
        }
        this.rowElement = AudioDevicePattern.makeHTMLRow(this.pattern, this.devices);
        if (tbodyElement) {
            tbodyElement.appendChild(this.rowElement);
            this.updateDevices(this.devices);
        }
        this.eventBinded = false;
        this.initEvents();
    }

    getPatternData() {
        return {
            urlPattern: this.pattern.urlPattern,
            audioOutput: this.pattern.audioOutput || (AudioDevicePattern.showDefaultOption() ? "Default" : ""),
            audioOutputId: this.pattern.audioOutputId || null,
        };
    }

    getElements () {
        return {
            urlInput: this.rowElement ? this.rowElement.querySelector(".url-pattern") : null,
            audioOutputSelect: this.rowElement ? this.rowElement.querySelector(".audio-output") : null,
            removeButton: this.rowElement ? this.rowElement.querySelector(".remove.btn") : null,
        };
    }

    initEvents() {
        if (this.eventBinded) return;
        if (this.rowElement) {
            const self = this;
            this.eventBinded = true;

            const { urlInput, audioOutputSelect, removeButton } = this.getElements();

            if (urlInput) {
                urlInput.addEventListener("input", () => {
                    self.pattern.urlPattern = urlInput.value;
                    self.onChange();
                });
            }
            if (audioOutputSelect) {
                if (AudioDevicePattern.useSelectList()) {
                    audioOutputSelect.addEventListener("change", (e) => self.listenForOutputDeviceSelection(audioOutputSelect, e));
                } else {
                    audioOutputSelect.addEventListener("click", (e) => self.listenForOutputDeviceRequest(audioOutputSelect, e));
                }
            }
            if (removeButton) {
                removeButton.addEventListener("click", (e) => self.listenForRemove(removeButton, e));
            }
        }
    }

    listenForOutputDeviceRequest(elem, event) {
        const self = this;
        navigator.mediaDevices.selectAudioOutput().then((device) => {
            if (device) {
                self.pattern.audioOutput = device.label || (AudioDevicePattern.showDefaultOption() ? "Default" : "");
                self.pattern.audioOutputId = device.deviceId;
                self.onChange();
            }
        });
    }

    listenForOutputDeviceSelection(elem, event) {
        this.pattern.audioOutput = elem.options[elem.selectedIndex].text;
        this.pattern.audioOutputId = elem.value;
        this.onChange();
    }

    listenForRemove(elem, event) {
        if (this.remove) return; // Prevent double removal
        if (this.rowElement) {
            this.rowElement.remove();
            this.remove = true; // Mark the pattern for removal
            this.onChange();
        }
    }

    updateDevices(devices) {
        if (!devices || !devices.audiooutput) return;
        this.devices = devices;
        // Check - maybe id changed
        if (this.pattern.audioOutput) {
            const selectedDevice = this.devices.audiooutput.find((device) => device.label === this.pattern.audioOutput);
            if (selectedDevice) {
                this.pattern.audioOutputId = selectedDevice.deviceId;
            }
        }
        if (this.rowElement && AudioDevicePattern.useSelectList()) {
            const audioOutputSelect = this.getElements().audioOutputSelect;
            if (audioOutputSelect) {
                while (audioOutputSelect.firstChild) {
                    audioOutputSelect.removeChild(audioOutputSelect.lastChild);
                }
                if (AudioDevicePattern.showDefaultOption()) {
                    const defaultOption = document.createElement("option");
                    defaultOption.value = "Default";
                    defaultOption.textContent = "Default";
                    audioOutputSelect.appendChild(defaultOption);
                }
                devices.audiooutput.forEach((device) => {
                    const option = document.createElement("option");
                    option.value = device.deviceId;
                    option.textContent = device.label || device.deviceId;
                    audioOutputSelect.appendChild(option);
                });
                this.onChange(); // Update the selected value after populating the options
            }
        }
    }

    onChange() {
        if (this.rowElement) {
            const { urlInput, audioOutputSelect, removeButton } = this.getElements();
            if (urlInput) {
                urlInput.value = this.pattern.urlPattern || "*://*/*";
            }
            if (audioOutputSelect) {
                if (audioOutputSelect.tagName === "INPUT") {
                    audioOutputSelect.value = this.pattern.audioOutput || (AudioDevicePattern.showDefaultOption() ? "Default" : "");
                } else if (audioOutputSelect.tagName === "SELECT") {
                    const options = Array.from(audioOutputSelect.options);
                    let selectedOption = options.find((option) => option.value === this.pattern.audioOutputId);
                    if (!selectedOption) {
                        selectedOption = options.find((option) => option.textContent === this.pattern.audioOutput);
                    }
                    if (selectedOption) {
                        audioOutputSelect.value = selectedOption.value;
                    } else {
                        audioOutputSelect.value = (AudioDevicePattern.showDefaultOption() ? "Default" : "");
                    }
                }
            }
        }
        if (PatternsManager) PatternsManager.saveAll();
    }
}

class AudioDeviceManager {
    constructor()
    {
        this.patterns = [];
        this.devices = {audiooutput: []};
        this.tbody = null;
    }

    async init(tableElement) {
        this.devices = await AUDIO_EnumareteDevices();
        let data = await API.storage.local.get(DATA_PATTERNS);
        data = data.patterns || [];
        this.patterns = data.map((pattern) => new AudioDevicePattern(pattern, this.devices));
        if (tableElement) {
            this.tbody = tableElement.querySelector("tbody");
            if (this.tbody) {
                while (this.tbody.firstChild) {
                    this.tbody.removeChild(this.tbody.lastChild);
                }
            }
            this.patterns.forEach((pattern) => pattern.init(this.tbody));
        }
    }

    addNewPattern() {
        const newPattern = new AudioDevicePattern({}, this.devices);
        this.patterns.push(newPattern);
        if (this.tbody) {
            newPattern.init(this.tbody);
        }
    }

    async saveAll() {
        this.patterns = this.patterns.filter((pattern) => !pattern.remove);
        const data = {};
        data[DATA_PATTERNS] = this.patterns.map((pattern) => pattern.getPatternData());
        await API.storage.local.set(data);
    }

    async updateDevices() {
        this.devices = await AUDIO_EnumareteDevices();
        this.patterns.forEach((pattern) => pattern.updateDevices(this.devices));
    }
}


// By using storage API with keys like "enableGoogleMeetTabs" - manage what type of meetings should be supported
// This class covers one type and manage html row in table of settings page
class MeetSupportFeature {
    constructor(name) {
        this.name = name;
        this.enabled = false;
        this.rowElement = null;
        this.load();
    }

    key() {
        return "enable" + this.name + "Tabs";
    }

    load() {
        const key = this.key();
        const self = this;
        API.storage.local.get(key).then((data) => {
            if (data && data[key] !== undefined) {
                self.enabled = data[key];
                self.updateUI();
            }
        });
    }

    save() {
        const key = this.key();
        API.storage.local.set({ [key]: this.enabled });
    }

    updateUI() {
        if (this.rowElement) {
            const checkbox = this.rowElement.querySelector("input[type='checkbox']");
            if (checkbox) {
                checkbox.checked = this.enabled;
            }
        }
    }

    onChange() {
        this.save();
        this.updateUI();
    }

    init(tbodyElement) {
        if (this.rowElement) {
            this.rowElement.remove();
        }
        this.rowElement = MeetSupportFeature.makeHTMLRow(this.name, this.enabled);
        if (tbodyElement) {
            tbodyElement.appendChild(this.rowElement);
        }
        this.initEvents();
    }

    static makeHTMLRow(name, enabled) {
        const row = document.createElement("tr");

        const checkboxCell = document.createElement("td");
        const checkbox = document.createElement("input");
        checkbox.type = "checkbox";
        checkbox.checked = enabled;
        checkboxCell.appendChild(checkbox);
        row.appendChild(checkboxCell);

        const nameCell = document.createElement("td");
        nameCell.textContent = name;
        row.appendChild(nameCell);

        return row;
    }

    initEvents() {
        if (this.rowElement) {
            const self = this;
            const checkbox = this.rowElement.querySelector("input[type='checkbox']");
            if (checkbox) {
                checkbox.addEventListener("change", () => {
                    self.enabled = checkbox.checked;
                    self.onChange();
                });
            }
        }
    }
}

class MeetSupportManager {
    constructor() {
        this.features = [
            new MeetSupportFeature("GoogleMeet")
        ];
    }

    static getInstance() {
        if (!MeetSupportManager.instance) {
            MeetSupportManager.instance = new MeetSupportManager();
        }
        return MeetSupportManager.instance;
    }

    init(tableElement) {
        const tbodyElement = tableElement.querySelector("tbody");
        if (tbodyElement) {
            while (tbodyElement.firstChild) {
                tbodyElement.removeChild(tbodyElement.lastChild);
            }
            this.features.forEach((feature) => feature.init(tbodyElement));
            this.loadSettings();
        }
    }

    loadSettings() {
        this.features.forEach((feature) => feature.load());
    }

    saveAll() {
        this.features.forEach((feature) => feature.save());
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

async function ResetAllShortcuts() {
    const shortcuts = await API.commands.getAll();
    const resetPromises = shortcuts.map((shortcut) => {
        return API.commands.reset(shortcut.name);
    });
    await Promise.all(resetPromises);
    ShowAllShortcuts();
};

async function OpenShorcutsPage() {
    API.commands.openShortcutSettings();
};


/**
 * Update the UI: set the value of the shortcut textbox.
 */
async function updateUI() {
    elementDo(".hide-on-chrome", (elem) => { if (IS_CHROME) setVisibility(elem, false) });
    elementDo(".hide-on-firefox", (elem) => { if (!IS_CHROME) setVisibility(elem, false) });

    PatternsManager = new AudioDeviceManager();
    const tableElement = document.querySelector("#device-pattern-table");
    if (tableElement) {
        await PatternsManager.init(tableElement);
    }

    btnBind("#add-pattern", () => {
        PatternsManager.addNewPattern();
    });

    if (!IS_CHROME && !navigator.mediaDevices.selectAudioOutput) {
        setVisibility("#audio-select-warn-firefox", true);
    }

    const meetSupportTable = document.querySelector("#meet-support-table");
    if (meetSupportTable) {
        const meetSupportManager = MeetSupportManager.getInstance();
        meetSupportManager.init(meetSupportTable);
    }

    ShowAllShortcuts();
    btnBind("#keyboard-shortcut-reset", ResetAllShortcuts);
    btnBind("#keyboard-shortcut-settings", OpenShorcutsPage);
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

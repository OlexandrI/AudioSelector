const API = typeof browser !== "undefined" ? browser : chrome; // For compatibility with Chrome and Firefox
const IS_CHROME = typeof chrome !== "undefined" && typeof browser === "undefined";
const DATA_PATTERNS = "patterns";

let PatternsManager = null;

class AudioDevicePattern {
    static useSelectList() {
        return navigator.mediaDevices?.selectAudioOutput ? false : true;
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
            outputField.value = pattern.audioOutput || "Default";
            outputCell.appendChild(outputField);
        }
        row.appendChild(outputCell);

        const actionsCell = document.createElement("td");
        actionsCell.className = "field-actions";
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "remove-button";
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
            audioOutput: this.pattern.audioOutput || "Default",
            audioOutputId: this.pattern.audioOutputId || null,
        };
    }

    getElements () {
        return {
            urlInput: this.rowElement ? this.rowElement.querySelector(".url-pattern") : null,
            audioOutputSelect: this.rowElement ? this.rowElement.querySelector(".audio-output") : null,
            removeButton: this.rowElement ? this.rowElement.querySelector(".remove-button") : null,
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
                self.pattern.audioOutput = device.label || "Default";
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
                const defaultOption = document.createElement("option");
                defaultOption.value = "Default";
                defaultOption.textContent = "Default";
                audioOutputSelect.appendChild(defaultOption);
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
                    audioOutputSelect.value = this.pattern.audioOutput || "Default";
                } else if (audioOutputSelect.tagName === "SELECT") {
                    const options = Array.from(audioOutputSelect.options);
                    let selectedOption = options.find((option) => option.value === this.pattern.audioOutputId);
                    if (!selectedOption) {
                        selectedOption = options.find((option) => option.textContent === this.pattern.audioOutput);
                    }
                    if (selectedOption) {
                        audioOutputSelect.value = selectedOption.value;
                    } else {
                        audioOutputSelect.value = "Default";
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

/**
 * Update the UI: set the value of the shortcut textbox.
 */
async function updateUI() {

    PatternsManager = new AudioDeviceManager();
    const tableElement = document.querySelector("#device-pattern-table");
    if (tableElement) {
        await PatternsManager.init(tableElement);
    }

    const addButton = document.querySelector("#add-pattern");
    if (addButton) {
        addButton.addEventListener("click", () => {
            PatternsManager.addNewPattern();
        });
    }

    if (!IS_CHROME && !navigator.mediaDevices.selectAudioOutput) {
        let warnElem = document.querySelector("#audio-select-warn-firefox");
        if (warnElem) {
            warnElem.style.display = "block";
        }
    }
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

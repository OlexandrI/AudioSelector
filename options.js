const API = typeof browser !== "undefined" ? browser : chrome; // For compatibility with Chrome and Firefox
const IS_CHROME = typeof chrome !== "undefined" && typeof browser === "undefined";
const DATA_PATTERNS = "patterns";
const DEBUG_TRACE = true; // Set to true to enable debug trace

function resolveElement(selector) {
    if (typeof selector === "undefined") {
        return null;
    }
    if (selector instanceof HTMLElement) {
        return selector;
    } else if (typeof selector === "string") {
        const element = document.querySelector(selector);
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
    return null;
}

function resolveElements(selector) {
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

function elementsDo(selector, cb) {
    const element = resolveElements(selector);
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
    return elementsDo(selector, (element) => {
        element.style.display = visible ? "block" : "none";
    });
}

function isVisible(selector) {
    const results = elementsDo(selector, (element) => {
        return element.style.display !== "none";
    });
    if (results && results.length > 0) return results.every((result) => result === true);
    return false;
}

function removeAllChilds(element) {
    element = resolveElement(element);
    if (element) {
        while (element.firstChild) {
            element.removeChild(element.firstChild);
        }
    }
}

function btnBind(selector, callback) {
    return elementsDo(selector, (element) => {
        if (isVisible(element)) {
            element.addEventListener("click", (event) => {
                if (callback(event)) {
                    event.preventDefault();
                }
            });
            return true;
        }
        return false;
    });
}

function isOK(result) {
    if (Array.isArray(result)) {
        return result.every((item) => item === true);
    }
    if (typeof result === "boolean") {
        return result === true;
    }
    if (typeof result === "undefined" || result === null) {
        return false;
    }
    return !!result;
}

function watchChange(key, checkFn, cb, fireIfFirstOnChanged = true, interval = 100) {
    const prevValue = watchChange[key];
    watchChange[key] = checkFn();
    let handler = null;
    handler = setInterval(() => {
        const newValue = checkFn();
        if (newValue !== watchChange[key]) {
            watchChange[key] = newValue;
            if (!cb(newValue, prevValue)) {
                clearInterval(handler);
                handler = null;
            }
        }
    }, interval);

    if (fireIfFirstOnChanged && prevValue !== watchChange[key]) {
        cb(watchChange[key], prevValue);
    }
}

function _DEBUG_CALL() {
    if (!DEBUG_TRACE) return;
    const stack = new Error().stack;
    const callerFull = stack.split('\n')[1].trim();
    const indx = ([callerFull.indexOf('@'), callerFull.indexOf('/'), callerFull.indexOf('<')]).reduce((a, b) => b == -1 ? a : Math.min(a, b));
    const caller = indx >= 0 ? callerFull.substring(0, indx).trim() : callerFull;
    console.log(`Called ${caller} with arguments:`, arguments);
}

// Schema represented as json object.
// key - name of the field and will be used same key in data object for access
// value - object description:
//  - label - label for the field
//  - type - type of the field representation: label, select, checkbox, input, input-readonly
//  - getter (optional)  - function to get value from data object
//  - setter (optional)  - function to set value to data object
//  - validator (optional) - function to validate value before set to data object
//  - options (optional) - array of objects for select type: {value, label}, can be a function to get options from data object
//  - default (optional) - default value for the field, will be used if data object doesn't have this field
//  - tooltip (optional) - tooltip for the field
//  - class (optional)   - class name for the field
class TableDataSchema {
    constructor(schemaObject)
    {
        this.schema = schemaObject || {};
    }

    // Returns headers info
    getHeaders() {
        return Object.keys(this.schema).map((key) => {
            const field = this.schema[key];
            return {
                key: key,
                label: field.label || key,
                tooltip: field.tooltip || null,
                class: field.class || ("field-" + key) || null,
            };
        });
    }

    getFieldInfo(key) {
        if (this.schema[key]) {
            return this.schema[key];
        }
        return null;
    }

    getFieldValue(key, data) {
        const field = this.getFieldInfo(key);
        if (field) {
            if (field.getter && typeof field.getter === "function") {
                return field.getter(data);
            } else if (data[key] !== undefined) {
                return data[key];
            } else if (field.default !== undefined) {
                return field.default;
            }
        }
        return null;
    }

    setFieldValue(key, data, value) {
        const field = this.getFieldInfo(key);
        if (field) {
            if (field.validator && typeof field.validator === "function") {
                const valid = field.validator(value);
                if (!valid) return false;
            }
            if (field.setter && typeof field.setter === "function") {
                field.setter(data, value);
            } else {
                data[key] = value;
            }
            return true;
        }
        return false;
    }

    resetFieldValue(key, data) {
        const field = this.getFieldInfo(key);
        if (field) {
            if (field.default !== undefined) {
                data[key] = field.default;
            } else {
                delete data[key];
            }
            return true;
        }
        return false;
    }

    getOptions(key, data) {
        const field = this.getFieldInfo(key);
        if (field) {
            if (field.options && Array.isArray(field.options)) {
                return field.options;
            } else if (field.options && typeof field.options === "function") {
                return field.options(data);
            }
        }
        return null;
    }
}

class TableRow {
    constructor(data, schema) {
        this.rowElement = null;
        this.remove = false;
        this.data = data;
        this.schema = schema;
        this.autoSave = false;
        this.permission = null;
        this.bGenStateCell = true;
        this.bGenActionsCell = true;
        this._hasPermission = false;
        this._isSaving = false;
        this._isDirty = false;
        this._scope_updateState = false;
        this._scope_load = false;
    }

    getData() {
        return this.data;
    }

    isSaving() {
        return this._isSaving;
    }

    isDirty() {
        return this._isDirty;
    }

    hasPermission() {
        return this._hasPermission;
    }

    checkPermission() {
        _DEBUG_CALL(this.permission);
        if (this.permission) {
            const self = this;
            return API.permissions.contains(this.permission).then((result) => {
                _DEBUG_CALL(self.permission, result);
                self._hasPermission = result;
                self.updateState();
            }).catch((error) => {
                _DEBUG_CALL(self.permission, error);
                self._hasPermission = false;
                self.updateState();
            });
        } else {
            return new Promise.resolve(true);
        }
    }

    requestPermission() {
        _DEBUG_CALL();
        if (this.permission) {
            const self = this;
            return API.permissions.request(this.permission).then((result) => {
                self._hasPermission = result;
                self.updateState();
            }).catch((error) => {
                console.error("Error requesting permission:", error);
                self._hasPermission = false;
                self.updateState();
            });
        } else {
            return new Promise.resolve(true);
        }
    }

    afterAnyChange() {
        _DEBUG_CALL();
        this._isDirty = true;
        if (this.autoSave) {
            this.save();
        } else {
            updateState();
        }
    }

    get(key) {
        return this.schema.getFieldValue(key, this.data);
    }

    set(key, value, triggerEvents = true) {
        _DEBUG_CALL(arguments);
        if (this.schema.setFieldValue(key, this.data, value)) {
            if (triggerEvents && !this._scope_load) this.afterAnyChange();
            return true;
        }
        return false;
    }

    reset(key) {
        if (!key) {
            // Reset all values
            for (const fieldKey in this.schema.schema) {
                this.schema.resetFieldValue(fieldKey, this.data);
            }
        } else {
            this.schema.resetFieldValue(key, this.data);
        }
        this.afterAnyChange();
    }

    options(key) {
        return this.schema.getOptions(key, this.data);
    }

    removeHTML() {
        if (this.rowElement) {
            this.rowElement.remove();
            this.rowElement = null;
        }
    }

    remove() {
        this.removeHTML();
        this.remove = true;
        updateState();
    }

    onChanged(elem, event, key, value) {
        _DEBUG_CALL(arguments);
        // Mark element as dirty
        elem.classList.add("dirty");
        // Update value in data object
        this.set(key, value);
    }

    onFocused(elem, event, key) {
        _DEBUG_CALL(arguments);
        elem.classList.add("focused");
    }

    onBlured(elem, event, key) {
        _DEBUG_CALL(arguments);
        elem.classList.remove("focused");
    }

    genStateCell(stateCell) {
        const noPermission = document.createElement("span");
        noPermission.className = "state-no-permission";
        noPermission.title = "No permission";
        noPermission.textContent = String.fromCharCode(0x26A0);
        stateCell.appendChild(noPermission);
    }

    genActions(actionsCell) {
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "btn remove small";
        removeButton.textContent = "Remove";
        removeButton.addEventListener("click", (event) => {
            self.removeHTML();
            self.remove = true;
            updateState();
        });
        actionsCell.appendChild(removeButton);
    }

    genHTML() {
        const rowElement = document.createElement("tr");
        const headers = this.schema.getHeaders();
        const self = this;

        if (this.bGenStateCell) {
            const stateCell = document.createElement("td");
            stateCell.className = "state";
            this.genStateCell(stateCell);
            rowElement.appendChild(stateCell);
        }

        headers.forEach((header) => {
            const cell = document.createElement("td");
            cell.className = header.class;
            cell.setAttribute("data-key", header.key);
            const fieldValue = this.get(header.key);
            const type = this.schema.getFieldInfo(header.key).type;
            let valueElem = null;
            switch (type) {
                case "label":
                    const label = document.createElement("span");
                    label.className = "label";
                    label.textContent = fieldValue || header.label;
                    cell.appendChild(label);
                    break;
                case "select":
                    const select = document.createElement("select");
                    const options = this.options(header.key);
                    if (options) {
                        options.forEach((option) => {
                            const opt = document.createElement("option");
                            opt.value = option.value || option.label;
                            opt.textContent = option.label || option.value;
                            if (opt.value === fieldValue) {
                                opt.selected = true;
                            }
                            select.appendChild(opt);
                        });
                    }
                    select.addEventListener("change", (event) => {
                        const selectedValue = select.options[select.selectedIndex].value;
                        self.onChanged(select, event, header.key, selectedValue);
                    });
                    cell.appendChild(select);
                    break;
                case "checkbox":
                    const checkbox = document.createElement("input");
                    checkbox.type = "checkbox";
                    checkbox.checked = !!fieldValue;
                    checkbox.addEventListener("change", (event) => {
                        const checkedValue = checkbox.checked;
                        self.onChanged(checkbox, event, header.key, checkedValue);
                    });
                    cell.appendChild(checkbox);
                    break;
                case "input":
                case "input-readonly":
                    const input = document.createElement("input");
                    input.type = "text";
                    input.value = fieldValue || "";
                    if (type === "input-readonly") {
                        input.readOnly = true;
                        input.className = "readonly";
                    } else {
                        input.readOnly = false;
                        input.className = "editable";
                    }
                    input.addEventListener("input", (event) => {
                        const inputValue = input.value;
                        self.onChanged(input, event, header.key, inputValue);
                    });
                    cell.appendChild(input);
                    break;
            };
            if (valueElem) {
                if (header.tooltip) {
                    valueElem.setAttribute("title", header.tooltip);
                    valueElem.tooltip = header.tooltip;
                }
                valueElem.addEventListener("focus", (event) => {
                    self.onFocused(valueElem, event, header.key);
                });
                valueElem.addEventListener("blur", (event) => {
                    self.onBlured(valueElem, event, header.key);
                });
            }
            rowElement.appendChild(cell);
        });

        if (this.bGenActionsCell) {
            const actionsCell = document.createElement("td");
            actionsCell.className = "field-actions";
            this.genActions(actionsCell);
            rowElement.appendChild(actionsCell);
        }

        return rowElement;
    }

    getElement(key) {
        if (this.rowElement) {
            const cell = this.rowElement.querySelector(`td[data-key="${key}"]`);
            if (cell) {
                const input = cell.querySelector("input, select");
                if (input) {
                    return input;
                }
            }
        }
        return null;
    }

    getElements() {
        const elements = {};
        const headers = this.schema.getHeaders();

        if (this.rowElement) {
            headers.forEach((header) => {
                const cell = this.rowElement.querySelector(`td[data-key="${header.key}"]`);
                elements[header.key] = null;
                if (cell) {
                    const input = cell.querySelector("input, select");
                    if (input) {
                        elements[header.key] = input;
                    }
                }
            });
        } else {
            headers.forEach((header) => {
                elements[header.key] = null;
            });
        }

        return elements;
    }

    updateState() {
        if (this._scope_updateState) return;
        this._scope_updateState = true;

        if (this.rowElement) {
            const isSaving = this.isSaving();
            const isDirty = this.isDirty();
            if (isSaving) {
                this.rowElement.classList.add("saving");
            } else {
                this.rowElement.classList.remove("saving");
            }
            if (isDirty) {
                this.rowElement.classList.add("dirty");
            } else {
                this.rowElement.classList.remove("dirty");
                // Remove dirty class from all elements
                const dirtyElements = this.rowElement.querySelectorAll("td .dirty");
                dirtyElements.forEach((elem) => {
                    elem.classList.remove("dirty");
                });
            }
            if (this.permission) {
                if (this._hasPermission) {
                    this.rowElement.classList.remove("no-permission");
                } else {
                    this.rowElement.classList.add("no-permission");
                }
            }
        }

        // Update value in elements
        const elements = this.getElements();
        for (const key in elements) {
            const elem = elements[key];
            if (elem) {
                const fieldValue = this.get(key);
                if (elem.tagName === "SELECT") {
                    elem.value = fieldValue || "";
                } else if (elem.tagName === "INPUT") {
                    if (elem.type === "checkbox") {
                        elem.checked = !!fieldValue;
                    } else {
                        elem.value = fieldValue || "";
                    }
                }
            }
        }

        this._scope_updateState = false;
    }

    // Return promise
    // Implement it in subclass
    save_implementation() {
        return Promise.resolve(false);
    }

    // Return promise
    save() {
        _DEBUG_CALL();
        if (this._isSaving) return Promise.resolve(false);
        this._isSaving = true;
        const self = this;
        return this.save_implementation().then((result) => {
            self._isSaving = false;
            self.updateState();
            return result;
        }).catch((error) => {
            console.error("Error saving data:", error);
            self._isSaving = false;
            self.updateState();
            return false;
        });
    }

    // Return promise
    // Implement it in subclass
    load_implementation() {
        return Promise.resolve(false);
    }

    // Return promise
    load() {
        _DEBUG_CALL();
        if (this._isSaving) return Promise.resolve(false);
        const self = this;
        this._scope_load = true;
        return this.load_implementation().then((result) => {
            self.updateState();
            this._scope_load = false;
            return result;
        }).catch((error) => {
            console.error("Error loading data:", error);
            self.updateState();
            this._scope_load = false;
            return false;
        });
    }

    init(tbodyElement) {
        _DEBUG_CALL(arguments);
        this.removeHTML();
        this.rowElement = this.genHTML();
        if (tbodyElement) {
            tbodyElement.appendChild(this.rowElement);
            this.updateState();
        }
        this.checkPermission();
    }
}

class TableHelper {
    constructor(schema, tableElement) {
        this.tableElement = resolveElement(tableElement);
        this.headersElement = this.tableElement ? this.tableElement.querySelector("thead") : null;
        this.tbodyElement = this.tableElement ? this.tableElement.querySelector("tbody") : null;
        this.schema = schema;
        this.rows = [];
        this.autoSave = false;
        this.genStateCell = true;
        this.genActionsCell = true;
    }

    getData() {
        return this.rows.map((row) => row.getData());
    }

    removeAll() {
        _DEBUG_CALL();
        this.rows.forEach((row) => {
            row.remove();
        });
        this.rows = [];
    }

    resetAll() {
        _DEBUG_CALL();
        this.rows.forEach((row) => {
            row.reset();
        });
    }

    makeRow(data, schema) {
        return new TableRow(data, schema);
    }

    setData(data, bInit = false) {
        _DEBUG_CALL(data, bInit);
        if (data && Array.isArray(data)) {
            this.removeAll();
            const self = this;
            data.forEach((item) => {
                const row = self.makeRow(item, self.schema);
                if (bInit) row.init(this.tbodyElement);
                this.rows.push(row);
            });
        }
    }

    isSaving() {
        return this.rows.some((row) => row.isSaving());
    }

    isDirty() {
        return this.rows.some((row) => row.isDirty());
    }

    hasPermission() {
        return this.rows.every((row) => row.hasPermission());
    }

    checkPermission() {
        _DEBUG_CALL();
        const permissionPromises = this.rows.map((row) => row.checkPermission());
        return Promise.all(permissionPromises).then(() => {
            this.updateState();
        }).catch((error) => {
            console.error("Error checking permission:", error);
            this.updateState();
        });
    }

    requestPermission() {
        _DEBUG_CALL();
        const permissionPromises = this.rows.map((row) => {
            if (row.hasPermission()) {
                return Promise.resolve(true);
            } else {
                row.requestPermission();
            }
        });
        return Promise.all(permissionPromises).then(() => {
            this.updateState();
        }).catch((error) => {
            console.error("Error requesting permission:", error);
            this.updateState();
        });
    }

    updateState() {
        _DEBUG_CALL();
        if (this.tableElement) {
            const isSaving = this.isSaving();
            const isDirty = this.isDirty();
            if (isSaving) {
                this.tableElement.classList.add("saving");
            } else {
                this.tableElement.classList.remove("saving");
            }
            if (isDirty) {
                this.tableElement.classList.add("dirty");
            } else {
                this.tableElement.classList.remove("dirty");
            }
        }
    }

    loadAll() {
        _DEBUG_CALL();
        const loadPromises = this.rows.map((row) => row.load());
        return Promise.all(loadPromises).then(() => {
            this.updateState();
        }).catch((error) => {
            console.error("Error loading data:", error);
            this.updateState();
        });
    }

    saveAll() {
        _DEBUG_CALL();
        const savePromises = this.rows.map((row) => row.save());
        return Promise.all(savePromises).then(() => {
            this.updateState();
        }).catch((error) => {
            console.error("Error saving data:", error);
            this.updateState();
        });
    }

    _genTH(key, className, label, tooltip) {
        const cell = document.createElement("th");
        cell.className = className;
        cell.setAttribute("data-key", key);
        const labelElem = document.createElement("span");
        labelElem.textContent = label || key;
        if (tooltip) {
            labelElem.setAttribute("title", tooltip);
            labelElem.tooltip = tooltip;
        }
        cell.appendChild(labelElem);
        return cell;
    }

    genHeaderHTML() {
        const headerRows = [];
        const headers = this.schema.getHeaders();
        if (this.genStateCell) {
            headerRows.push(this._genTH("state", "field-state", "State", "Current state markers"));
        }
        headers.forEach((header) => {
            headerRows.push(this._genTH(header.key, header.class, header.label, header.tooltip));
        });
        if (this.genActionsCell) {
            headerRows.push(this._genTH("actions", "field-actions", "Actions", "Actions for this row"));
        }
        return headerRows;
    }

    init(tableElement = null, regenHeaders = true) {
        _DEBUG_CALL(tableElement, regenHeaders);
        const self = this;
        if (tableElement) {
            this.tableElement = resolveElement(tableElement);
            this.headersElement = this.tableElement ? this.tableElement.querySelector("thead") : null;
            this.tbodyElement = this.tableElement ? this.tableElement.querySelector("tbody") : null;
        }
        if (regenHeaders && this.headersElement) {
            removeAllChilds(this.headersElement);
            const headerRows = this.genHeaderHTML();
            headerRows.forEach((headerRow) => {
                self.headersElement.appendChild(headerRow);
            });
        }
        this.rows.forEach((row) => {
            row.init(self.tbodyElement);
        });
    }
}

const AudioDevicePatternStatic = {
    useSelectList: () => {
        return navigator.mediaDevices?.selectAudioOutput ? false : true;
    },

    showDefaultOption: () => {
        return !IS_CHROME;
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
    }

    onChanged(elem, event, key, value) {
        if (key === "urlPattern") {
            this.permission.origins = [value];
            this.checkPermission();
        } else if (key === "audioOutput") {
            const selectedDevice = this.devices.audiooutput.find((device) => device.deviceId === value);
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
        _DEBUG_CALL("AudioDevicePatternManager loadAll");
        return new Promise((resolve) => {
            const cb = () => {
                API.storage.local.get(DATA_PATTERNS).then((data) => {
                    _DEBUG_CALL("AudioDevicePatternManager loadAll", data);
                    data = data.patterns || [];
                    self.setData(data, false);
                    self.updateState();
                    resolve();
                }).catch((error) => {
                    _DEBUG_CALL("AudioDevicePatternManager loadAll", error);
                    console.warn("Error loading data:", error);
                    self.updateState();
                    resolve();
                });
            };
            AUDIO_EnumareteDevices().then((devices) => {
                _DEBUG_CALL("AudioDevicePatternManager devices", devices);
                self.devices = devices;
                cb();
            }).catch((error) => {
                _DEBUG_CALL("AudioDevicePatternManager devices", error);
                console.error("Error loading devices:", error);
                self.devices = {audiooutput: []};
                cb();
            });
        });
    }

    saveAll() {
        const self = this;
        _DEBUG_CALL("AudioDevicePatternManager saveAll");
        return this.requestPermission().then(async (result) => {
            const setData = {};
            setData[DATA_PATTERNS] = self.getData();
            await API.storage.local.set(setData).then(() => {
                _DEBUG_CALL("AudioDevicePatternManager saveAll", setData);
                self._isDirty = false;
            }).catch((error) => {
                _DEBUG_CALL("AudioDevicePatternManager saveAll", error);
                console.error("Error saving data:", error);
            });
            if (!result) _DEBUG_CALL("AudioDevicePatternManager saveAll no all permissions");
            this.updateState();
            return !self._isDirty;
        }).catch((error) => {
            _DEBUG_CALL("AudioDevicePatternManager saveAll", error);
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
        _DEBUG_CALL("MeetSupportRow save_implementation", key, self.data.enabled);
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
        _DEBUG_CALL("MeetSupportRow load_implementation", key);
        return API.storage.local.get(key).then((data) => {
            _DEBUG_CALL("MeetSupportRow load_implementation", key, data);
            if (data && data[key] !== undefined) {
                self.data.enabled = data[key];
                self.updateState();
                return true;
            }
        }).catch((error) => {
            _DEBUG_CALL("MeetSupportRow load_implementation", key, error);
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
    _DEBUG_CALL();

    elementsDo(".hide-on-chrome" , (elem) => { if ( IS_CHROME) setVisibility(elem, false) });
    elementsDo(".hide-on-firefox", (elem) => { if (!IS_CHROME) setVisibility(elem, false) });

    await AudioDevicePatternManager.getInstance().loadAll();
    if (isOK(btnBind("#save-patterns", (event) => {
        AudioDevicePatternManager.getInstance().saveAll();
        event.preventDefault();
    }))) {
        AudioDevicePatternManager.getInstance().autoSave = false;
        _DEBUG_CALL("AudioDevicePatternManager with Save button");
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
        _DEBUG_CALL("AudioDevicePatternManager with autoSave");
    }
    btnBind("#add-pattern", () => {
        AudioDevicePatternManager.getInstance().addNewPattern();
    });
    const tableElement = document.querySelector("#device-pattern-table");
    if (tableElement) {
        await AudioDevicePatternManager.getInstance().init(tableElement, true);
    }

    if (!IS_CHROME && !navigator.mediaDevices.selectAudioOutput) {
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

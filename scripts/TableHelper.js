// TableHelper.js

const TABLE_API = (typeof browser !== "undefined") ? browser : chrome; // For compatibility with Chrome and Firefox

/**
 * TableDataSchema is a utility class designed to manage and interact with a schema definition for tabular data.
 * It provides methods to retrieve metadata, manipulate field values, and handle options for fields defined in the schema.
 *
 * Schema is defined as an object where each key represents a field in the table, and its value is an object containing metadata and behavior for that field.
 * key - name of the field and will be used same key in data object for access.
 * value - object description:
 * - label - label for the field
 * - type - type of the field representation: label, select, checkbox, input, input-readonly
 * - getter (optional)  - function to get value from data object
 * - setter (optional)  - function to set value to data object
 * - validator (optional) - function to validate value before set to data object
 * - options (optional) - array of objects for select type: {value, label}, can be a function to get options from data object
 * - default (optional) - default value for the field, will be used if data object doesn't have this field
 * - tooltip (optional) - tooltip for the field
 * - class (optional)   - class name for the field
 * 
 * @class
 * @param {Object} schemaObject - An object defining the schema for the table data. Each key represents a field, and its value is an object containing metadata and behavior for that field.
 *
 * @throws {Error} Throws an error if the provided schemaObject is not an object.
 *
 * @example
 * const schema = {
 *   name: {
 *     label: "Name",
 *     tooltip: "The full name of the person",
 *     class: "field-name",
 *     default: "Unknown",
 *     validator: (value) => typeof value === "string",
 *     setter: (data, value) => { data.name = value.toUpperCase(); },
 *     getter: (data) => data.name.toLowerCase(),
 *     options: ["Alice", "Bob", "Charlie"]
 *   },
 *   age: {
 *     label: "Age",
 *     tooltip: "The age of the person",
 *     class: "field-age",
 *     default: 0,
 *     validator: (value) => Number.isInteger(value) && value >= 0,
 *     options: (data) => Array.from({ length: 100 }, (_, i) => i)
 *   }
 * };
 *
 * const tableSchema = new TableDataSchema(schema);
 * const headers = tableSchema.getHeaders();
 * const nameValue = tableSchema.getFieldValue("name", { name: "Alice" });
 * const isSet = tableSchema.setFieldValue("age", {}, 25);
 */
class TableDataSchema {
    constructor(schemaObject)
    {
        this.schema = schemaObject || {};
        if (typeof this.schema !== "object") {
            throw new Error("Schema must be an object");
        }
    }

    /**
     * Generates an array of header objects based on the schema.
     * Each header object contains metadata about a field, including its key, label, tooltip, and CSS class.
     *
     * @returns {Array<Object>} An array of header objects.
     * @returns {string} return[].key - The key of the field.
     * @returns {string} return[].label - The label of the field, defaults to the key if not provided.
     * @returns {string|null} return[].tooltip - The tooltip for the field, or null if not provided.
     * @returns {string} return[].class - The CSS class for the field, defaults to "field-" followed by the key.
     */
    getHeaders() {
        return Object.keys(this.schema).map((key) => {
            const field = this.schema[key];
            return {
                key: key,
                label: field.label || key,
                tooltip: field.tooltip || null,
                class: field.class || "field-" + key,
            };
        });
    }

    /**
     * Retrieves the information of a specific field from the schema based on the provided key.
     *
     * @param {string} key - The key of the field to retrieve information for.
     * @returns {Object|null} The field information if the key exists in the schema, otherwise null.
     */
    getFieldInfo(key) {
        if (this.schema[key]) {
            return this.schema[key];
        }
        return null;
    }

    /**
     * Retrieves the value of a field based on the provided key and data.
     *
     * @param {string} key - The key identifying the field to retrieve.
     * @param {Object|undefined} data - The data object containing potential field values.
     * @returns {*} - The value of the field, determined by the field's getter function,
     *                the value in the data object, the field's default value, or null if none exist.
     */
    getFieldValue(key, data) {
        const field = this.getFieldInfo(key);
        if (field) {
            if (field.getter && typeof field.getter === "function") {
                // Don't care about data validation here, getter may not use it totally
                return field.getter(data);
            } else if (data && data[key] !== undefined) {
                return data[key];
            } else if (field.default !== undefined) {
                return field.default;
            }
        }
        return null;
    }

    /**
     * Sets the value of a field identified by the given key.
     *
     * @param {string} key - The key identifying the field to update.
     * @param {Object} data - The object containing the field to update. If no setter is provided, the value will be directly assigned to this object.
     * @param {*} value - The new value to set for the field.
     * @returns {boolean} - Returns `true` if the value was successfully set, otherwise `false`.
     *
     * @throws {Error} - Throws an error if the field's validator function exists and the value is invalid.
     *
     * @description
     * This method retrieves field information using the provided key. If the field has a validator function, it validates the value before setting it.
     * If the field has a setter function, the setter is called with the provided data and value. If no setter is defined, the value is directly assigned
     * to the `data` object using the key. If the field does not exist or the value is invalid, the method returns `false`.
     */
    setFieldValue(key, data, value) {
        const field = this.getFieldInfo(key);
        if (field) {
            if (field.validator && typeof field.validator === "function") {
                const valid = field.validator(value);
                if (!valid) return false;
            }
            if (field.setter && typeof field.setter === "function") {
                // Don't care about data validation here, setter may not use it totally
                field.setter(data, value);
            } else if(data) {
                data[key] = value;
            } else {
                return false;
            }
            return true;
        }
        return false;
    }

    /**
     * Resets the value of a specified field in the given data object to its default value.
     * If the field has a defined default value, it sets the field in the data object to that value.
     * If no default value is defined, it removes the field from the data object.
     *
     * @param {string} key - The key of the field to reset.
     * @param {Object} data - The data object containing the field to reset.
     * @returns {boolean} - Returns `true` if the field was successfully reset, otherwise `false`.
     */
    resetFieldValue(key, data) {
        const field = this.getFieldInfo(key);
        if (field && data) {
            if (field.default !== undefined) {
                data[key] = field.default;
            } else {
                delete data[key];
            }
            return true;
        }
        return false;
    }

    /**
     * Retrieves the options for a given field key.
     *
     * @param {string} key - The key identifying the field to retrieve options for.
     * @param {*} data - Additional data that may be passed to the options function, if applicable.
     * @returns {Array|null} - Returns an array of options if available, or null if no valid options are found.
     *                         Logs a warning if the options type is unsupported.
     */
    getOptions(key, data) {
        const field = this.getFieldInfo(key);
        if (field) {
            if (field.options && Array.isArray(field.options)) {
                return field.options;
            } else if (field.options && typeof field.options === "function") {
                return field.options(data);
            } else if (field.options) {
                console.warn(`Unsupported type for options in field "${key}". Expected an array or a function.`);
            }
        }
        return null;
    }
}
/**
 * Represents a table row with dynamic data binding and state management.
 * 
 * @class TableRow
 * @param {Object} data - The data object representing the row's values.
 * @param {Object} schema - The schema object defining the structure and behavior of the row.
 */
class TableRow {
    constructor(data, schema) {
        this.rowElement = null;
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
        this._remove = false;
    }

    /**
     * Retrieves the data stored in the current instance.
     * @returns {*} The data associated with this instance.
     */
    getData() {
        return this.data;
    }

    /**
     * Checks if the saving process is currently in progress.
     *
     * @returns {boolean} True if saving is in progress, otherwise false.
     */
    isSaving() {
        return this._isSaving;
    }

    /**
     * Checks if the current state is marked as dirty.
     *
     * @returns {boolean} Returns `true` if the state is dirty, otherwise `false`.
     */
    isDirty() {
        return this._isDirty;
    }

    /**
     * Checks if the current instance has the required permission.
     *
     * @returns {boolean} True if the instance has permission, otherwise false.
     */
    hasPermission() {
        return this._hasPermission;
    }

    checkPermission() {
        if (this.permission) {
            const self = this;
            return TABLE_API.permissions.contains(this.permission).then((result) => {
                self._hasPermission = result;
                self.updateState();
                return result;
            }).catch((error) => {
                self._hasPermission = false;
                self.updateState();
                return false;
            });
        } else {
            return Promise.resolve(true);
        }
    }

    requestPermission() {
        if (this.permission) {
            const self = this;
            return TABLE_API.permissions.request(this.permission).then((result) => {
                self._hasPermission = result;
                self.updateState();
                return result;
            }).catch((error) => {
                console.error("Error requesting permission:", error);
                self._hasPermission = false;
                self.updateState();
                return false;
            });
        } else {
            return Promise.resolve(true);
        }
    }

    afterAnyChange() {
        this._isDirty = true;
        if (this.autoSave) {
            this.save();
        } else {
            this.updateState();
        }
    }

    get(key) {
        return this.schema.getFieldValue(key, this.data);
    }

    set(key, value, triggerEvents = true) {
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
        this._remove = true;
        this.updateState();
    }

    onChanged(elem, event, key, value) {
        // Mark element as dirty
        elem.classList.add("dirty");
        // Update value in data object
        this.set(key, value);
    }

    onFocused(elem, event, key) {
        elem.classList.add("focused");
    }

    onBlured(elem, event, key) {
        elem.classList.remove("focused");
    }

    genStateCell(stateCell) {
        const states = [
            { className: "state-no-permission", title: "Permission required", icon: "🔒" },
            { className: "state-dirty", title: "Has not saved changes", icon: "📝" },
            { className: "state-ok", title: "OK", icon: "🟢" },
        ];
    
        states.forEach((state) => {
            const span = document.createElement("span");
            span.className = state.className;
            span.title = state.title;
            span.textContent = state.icon;
            stateCell.appendChild(span);
        });
    }

    genActions(actionsCell) {
        const self = this;
        const removeButton = document.createElement("button");
        removeButton.type = "button";
        removeButton.className = "btn remove small";
        removeButton.textContent = "🗑️";
        removeButton.addEventListener("click", (event) => {
            self.remove();
            event.preventDefault();
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
                            opt.value = option?.value ?? option?.label ?? String(option);
                            opt.textContent = option?.label ?? option?.value ?? String(option);
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
                    valueElem = select;
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
                    valueElem = checkbox;
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
                    valueElem = input;
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
                    elem.value = fieldValue ?? "";
                } else if (elem.tagName === "INPUT") {
                    if (elem.type === "checkbox") {
                        elem.checked = !!fieldValue;
                    } else {
                        elem.value = fieldValue ?? "";
                    }
                }
            }
        }

        this._scope_updateState = false;
    }

    updateOptions() {
        const elements = this.getElements();
        for (const key in elements) {
            const elem = elements[key];
            const type = this.schema.getFieldInfo(key).type;
            if (elem && elem.tagName === "SELECT" && type === "select") {
                const fieldValue = this.get(key);
                const options = this.options(key);
                while (elem.firstChild) elem.removeChild(elem.firstChild);
                if (options) {
                    options.forEach((option) => {
                        const opt = document.createElement("option");
                        opt.value = option?.value ?? option?.label ?? String(option);
                        opt.textContent = option?.label ?? option?.value ?? String(option);
                        if (opt.value === fieldValue) {
                            opt.selected = true;
                        }
                        elem.appendChild(opt);
                    });
                }
            }
        }
    }

    // Return promise
    // Implement it in subclass
    save_implementation() {
        return Promise.resolve(false);
    }

    // Return promise
    save() {
        if (this._isSaving) return Promise.resolve(false);
        this._isSaving = true;
        const self = this;
        return this.save_implementation().then((result) => {
            if (result) self._isDirty = false;
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
        return this.rows.filter(row => !row._remove).map((row) => row.getData());
    }

    removeAll() {
        this.rows.forEach((row) => {
            row.remove();
        });
        this.rows = [];
    }

    resetAll() {
        this.rows.forEach((row) => {
            row.reset();
        });
    }

    makeRow(data, schema) {
        const row = new TableRow(data, schema);
        row.bGenStateCell = this.genStateCell;
        row.bGenActionsCell = this.genActionsCell;
        row.autoSave = this.autoSave;
        return row;
    }

    setData(data, bInit = false) {
        if (data && Array.isArray(data)) {
            this.removeAll();
            const self = this;
            data.forEach((item) => {
                const row = self.makeRow(item, self.schema);
                if (bInit) row.init(self.tbodyElement);
                self.rows.push(row);
            });
        }
    }

    isSaving() {
        return this.rows.some((row) => row.isSaving());
    }

    isDirty() {
        return this.rows.some((row) => row.isDirty() || row._remove);
    }

    hasPermission() {
        return this.rows.every((row) => row.hasPermission());
    }

    checkPermission() {
        const self = this;
        const permissionPromises = this.rows.map((row) => row.checkPermission());
        return Promise.all(permissionPromises).then(() => {
            self.updateState();
        }).catch((error) => {
            console.error("Error checking permission:", error);
            self.updateState();
        });
    }

    requestPermission() {
        const self = this;
        const permissionPromises = this.rows.map((row) => {
            if (row.hasPermission()) {
                return Promise.resolve(true);
            } else {
                return row.requestPermission();
            }
        });
        return Promise.all(permissionPromises).then(() => {
            self.updateState();
        }).catch((error) => {
            console.error("Error requesting permission:", error);
            self.updateState();
        });
    }

    updateState() {
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

    updateOptions() {
        this.rows.forEach((row) => row.updateOptions());
    }

    loadAll() {
        const self = this;
        const loadPromises = this.rows.map((row) => row.load());
        return Promise.all(loadPromises).then(() => {
            self.updateState();
        }).catch((error) => {
            console.error("Error loading data:", error);
            self.updateState();
        });
    }

    saveAll() {
        const self = this;
        const savePromises = this.rows.map((row) => row.save());
        return Promise.all(savePromises).then(() => {
            self.rows = self.rows.filter((row) => !row._remove);
            self.updateState();
        }).catch((error) => {
            console.error("Error saving data:", error);
            self.updateState();
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
        const tr = document.createElement("tr");
        const headers = this.schema.getHeaders();
        if (this.genStateCell) {
            tr.appendChild(this._genTH("state", "field-state", "State", "Current state markers"));
        }
        headers.forEach((header) => {
            tr.appendChild(this._genTH(header.key, header.class, header.label, header.tooltip));
        });
        if (this.genActionsCell) {
            tr.appendChild(this._genTH("actions", "field-actions", "Actions", "Actions for this row"));
        }
        return tr;
    }

    init(tableElement = null, regenHeaders = true) {
        const self = this;
        if (tableElement) {
            this.tableElement = resolveElement(tableElement);
            this.headersElement = this.tableElement ? this.tableElement.querySelector("thead") : null;
            this.tbodyElement = this.tableElement ? this.tableElement.querySelector("tbody") : null;
        }
        if (regenHeaders && this.headersElement) {
            removeAllChildren(this.headersElement);
            const headerRow = this.genHeaderHTML();
            this.headersElement.appendChild(headerRow);
        }
        this.rows.forEach((row) => {
            row.init(self.tbodyElement);
        });
    }
}

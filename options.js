const SHOW_INPUT = false;

let managers = [];
let patterns = [];

class ShortcutManager {
  constructor(rowElement) {
    this.rowElement = rowElement;
    this.ctrlCheckbox = rowElement.querySelector(
      'input[type="checkbox"][id$="-ctrl"]'
    );
    this.altCheckbox = rowElement.querySelector(
      'input[type="checkbox"][id$="-alt"]'
    );
    this.shiftCheckbox = rowElement.querySelector(
      'input[type="checkbox"][id$="-shift"]'
    );
    this.keyInput = rowElement.querySelector('input[type="text"]');
    this.commandName = rowElement.dataset.command;
    this.autosave = true;

    this.init();
  }

  init() {
    // Add event listener for key input
    this.keyInput.addEventListener("click", () => this.listenForKey());
  }

  listenForKey() {
    this.keyInput.value = ""; // Clear the current value
    const keyListener = (event) => {
      if (
        event.key !== "Control" &&
        event.key !== "Alt" &&
        event.key !== "Shift"
      ) {
        this.keyInput.value = event.key.toUpperCase();
        document.removeEventListener("keydown", keyListener);
        if (this.autosave) this.saveShortcut(); // Save the shortcut
      }
    };
    document.addEventListener("keydown", keyListener);
  }

  getShortcut() {
    const modifiers = [];
    if (this.ctrlCheckbox.checked) modifiers.push("Ctrl");
    if (this.altCheckbox.checked) modifiers.push("Alt");
    if (this.shiftCheckbox.checked) modifiers.push("Shift");
    const key = this.keyInput.value;
    return modifiers.length > 0 && key ? `${modifiers.join("+")}+${key}` : "";
  }

  async loadShortcut() {
    const commands = await browser.commands.getAll();
    const command = commands.find((cmd) => cmd.name === this.commandName);
    if (command) {
      const [modifiers, key] = command.shortcut.split("+").reduce(
        (acc, part) => {
          if (["Ctrl", "Alt", "Shift"].includes(part)) {
            acc[0].push(part);
          } else {
            acc[1] = part;
          }
          return acc;
        },
        [[], ""]
      );
      this.ctrlCheckbox.checked = modifiers.includes("Ctrl");
      this.altCheckbox.checked = modifiers.includes("Alt");
      this.shiftCheckbox.checked = modifiers.includes("Shift");
      this.keyInput.value = key || "";
    }
  }

  async saveShortcut() {
    const shortcut = this.getShortcut();
    if (shortcut) {
      await browser.commands.update({
        name: this.commandName,
        shortcut: shortcut,
      });
    }
  }

  async resetShortcut() {
    await browser.commands.reset(this.commandName);
    await this.loadShortcut();
  }

  static loadAll() {
    const rows = document.querySelectorAll("tr[data-command]");
    managers = Array.from(rows).map((row) => new ShortcutManager(row));
    managers.forEach((manager) => manager.loadShortcut());
  }

  static async saveAll() {
    for (const manager of managers) {
      await manager.saveShortcut();
    }
  }

  static resetAll() {
    for (const manager of managers) {
      manager.resetShortcut();
    }
  }
}

class DevicePatternManager {
  constructor(pattern = {}, rowElement = null) {
    if (!rowElement) {
      rowElement = DevicePatternManager.createPatternRow(pattern);
      const tbody = document.querySelector("#device-pattern-table tbody");
      if (tbody) tbody.appendChild(rowElement);
    }
    this.rowElement = rowElement;
    this.urlInput = rowElement.querySelector(".url-pattern");
    if (SHOW_INPUT) this.audioInputSelect = rowElement.querySelector(".audio-input");
    this.audioOutputSelect = rowElement.querySelector(".audio-output");
    this.removeButton = rowElement.querySelector(".remove-button");
    this.urlInput.value = pattern.urlPattern || "";
    if (SHOW_INPUT) this.audioInputSelect.value = pattern.audioInput || "Default";
    this.audioOutputSelect.value = pattern.audioOutput || "Default";
    this.pattern = pattern;
    this.removed = false;
    this.autosave = true;

    this.init();
  }

  init() {
    this.removeButton.addEventListener("click", () => this.removeRow());
    this.urlInput.addEventListener("input", () => this.onChange());
    if (SHOW_INPUT) this.audioInputSelect.addEventListener("click", () => this.listenForInputDevice());
    this.audioOutputSelect.addEventListener("click", () => this.listenForOutputDevice());
  }

  listenForInputDevice() {
    if (!navigator.mediaDevices?.selectAudioOutput) {
      return;
    }
    const self = this;
    navigator.mediaDevices.selectAudioOutput().then((device) => {
      if (device) {
        self.audioInputSelect.value = device.label;
        self.pattern.audioInput = device.lable;
        self.pattern.audioInputId = device.deviceId;
        self.onChange();
      }
    });
  }

  listenForOutputDevice() {
    if (!navigator.mediaDevices?.selectAudioOutput) {
      return;
    }
    const self = this;
    navigator.mediaDevices.selectAudioOutput().then((device) => {
      if (device) {
        self.audioOutputSelect.value = device.label;
        self.pattern.audioOutput = device.lable;
        self.pattern.audioOutputId = device.deviceId;
        self.onChange();
      }
    });
  }

  onChange() {
    if (this.autosave) {
      DevicePatternManager.saveAll();
    }
  }

  removeRow() {
    this.rowElement.remove();
    patterns.remove(this);
    this.removed = true;
  }

  getPatternData() {
    return {
      urlPattern: this.urlInput.value,
      audioInput: this.audioInputSelect?.value || this.pattern?.audioInput || "Default",
      audioInputId: this.pattern.audioInputId,
      audioOutput: this.audioOutputSelect?.value || this.pattern?.audioOutput || "Default",
      audioOutputId: this.pattern.audioOutputId
    };
  }

  static async loadAll() {
    let data = await browser.storage.local.get("patterns");
    data = data.patterns || [];
    const tbody = document.querySelector("#device-pattern-table tbody");
    if (tbody) tbody.innerHTML = ""; // Clear existing rows
    patterns = data.map(
      (pattern) => new DevicePatternManager(pattern)
    );
  }

  static async saveAll() {
    const data = patterns.map((manager) => manager.getPatternData());
    await browser.storage.local.set({ patterns: data });
  }

  static createPatternRow(pattern = {}) {
    const row = document.createElement("tr");

    // Use unput fields for devices
    row.innerHTML = `
        <td class="field-url"><input type="text" class="url-pattern" value="${
          pattern.urlPattern || "Default"
        }" /></td>`;
    if (SHOW_INPUT)
      row.innerHTML += `
        <td class="field-input"><input type="text" class="audio-input" readonly value="${
          pattern.audioInput || "Default"
        }" /></td>`;
    row.innerHTML += `
        <td class="field-output"><input type="text" class="audio-output" readonly value="${
          pattern.audioOutput || "Default"
        }" /></td>
        <td class="field-actions">
          <button type="button" class="remove-button">Remove</button>
        </td>
      `;
    return row;
  }

  static async resetAll() {
    await browser.storage.local.clear();
    const tbody = document.querySelector("#device-pattern-table tbody");
    if (tbody) tbody.innerHTML = ""; // Clear existing rows
    patterns = []; // Clear the patterns array
  }
}

async function saveAll() {
  await ShortcutManager.saveAll();
  await DevicePatternManager.saveAll();
}

function openSettingsPage() {
  let createData = {
    type: "detached_panel",
    url: "settings.html",
    width: 540,
    height: 480,
  };
  browser.windows.create(createData);
}

/**
 * Update the UI: set the value of the shortcut textbox.
 */
async function updateUI() {
  DevicePatternManager.loadAll([]);
  ShortcutManager.loadAll();

  // Add new pattern row
  if (document.querySelector("#add-pattern")) {
    document.querySelector("#add-pattern").addEventListener("click", () => {
      patterns.push(new DevicePatternManager());
      DevicePatternManager.saveAll();
    });
  }

  if (!SHOW_INPUT) {
    const inputSelect = document.querySelectorAll(".field-input");
    for (let i = 0; i < inputSelect.length; i++) {
      inputSelect[i].remove();
    }
  }

  if (document.querySelector("#save")) {
    document.querySelector("#save").addEventListener("click", saveAll);
  }

  if (document.querySelector("#reset")) {
    document.querySelector("#reset").addEventListener("click", async () => {
      await ShortcutManager.resetAll();
      //await DevicePatternManager.resetAll();
    });
  }

  if (document.querySelector("#settings")) {
    document.querySelector("#settings").addEventListener("click", openSettingsPage);
  }

  if (!navigator.mediaDevices.selectAudioOutput) {
    let warnElem = document.querySelector("#audio-select-warn");
    if (warnElem) {
      warnElem.style.display = "block";
    }
  }
}

/**
 * Update the UI when the page loads.
 */
document.addEventListener("DOMContentLoaded", updateUI);

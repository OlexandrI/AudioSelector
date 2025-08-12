// For compatibility with Chrome and Firefox
const IS_FIREFOX = typeof browser !== "undefined" && browser.runtime && browser.runtime.getBrowserInfo;
const IS_CHROME = typeof chrome !== "undefined";
const API = typeof browser !== "undefined" ? browser : chrome;
const DATA_PATTERNS = "patterns";

// Helper functions for tab management
const Helpers = {
  /**
   * Get the currently active tab in the current window.
   * @returns {Promise<tabs.Tab|null>} The active tab or null if not found.
   */
  activeTab: async function () {
    const tabs = await API.tabs.query({ active: true, currentWindow: true }).catch((error) => {
      console.error(`Error querying active tab: ${error}`);
      return null;
    });
    if (tabs && tabs.length > 0) {
      return tabs[0];
    }
    return null;
  },

  /**
   * Resolve a tab object from various input types or get active tab if input isn't tab or tab id number.
   * @param {tabs.Tab|number|any} tab The tab identifier (ID, object, or other).
   * @returns {Promise<tabs.Tab|null>} The resolved tab or null if not found.
   * @nothrows If the input is invalid or the tab cannot be found, this function will not throw an error.
   */
  resolveTab: async function (tab) {
    if (tab && typeof tab === "object" && tab.hasOwnProperty("id")) {
      return tab;
    }
    
    if (typeof tab === "number") {
      return await API.tabs.get(tab).catch((error) => {
        console.error(`Error getting tab ${tab}: ${error}`);
        return null;
      });
    }

    // Otherwise - return active tab
    return Helpers.activeTab();
  },

  /**
   * Execute a function in the context of a tab.
   * @param {tabs.Tab|number|any} tab The tab identifier (ID, object, or other).
   * @param {Function} func The function to execute.
   * @param {Array} args The arguments to pass to the function.
   * @returns {Promise<any|null>} The result of the function execution or null if failed.
   * @nothrows If the tab is not found or the script fails to execute, this function will not throw an error.
   */
  executeInTab: async function (tab, func, args = []) {
    const resolvedTab = await Helpers.resolveTab(tab);
    if (!resolvedTab) {
      console.error("No valid tab found to execute script.");
      return null;
    }

    const results = await API.scripting.executeScript({
      target: { tabId: resolvedTab.id },
      func: func,
      args: args,
    }).catch((error) => {
      console.error(`Error executing script in tab ${resolvedTab.id}: ${error}`);
      return null;
    });

    if (!results || results.length === 0) {
      console.warn(`No results from script execution in tab ${resolvedTab.id}`);
      return null;
    }

    if (results[0].error) {
      console.error(`Error in script execution: ${results[0].error}`);
      return null;
    }

    return results[0].result;
  },

  /**
   * Inject a script into a tab.
   * @param {tabs.Tab|number|any} tab The tab identifier (ID, object, or other).
   * @param {string} script The script to inject.
   * @returns {Promise<boolean>} True if the script was injected successfully, false otherwise.
   * @nothrows If the tab is not found or the script fails to inject, this function will not throw an error.
   */
  injectScript: async function (tab, script) {
    const resolvedTab = await Helpers.resolveTab(tab);
    if (!resolvedTab) {
      console.error("No valid tab found to inject script.");
      return false;
    }

    try {
      await API.scripting.executeScript({
        target: { tabId: resolvedTab.id },
        files: [script],
      });
      return true;
    } catch (error) {
      console.error(`Error injecting script ${script} in tab ${resolvedTab.id}: ${error}`);
      return false;
    }
  },

  /**
   * Focus a tab and optionally unmute it.
   * @param {tabs.Tab|number|any} tab The tab identifier (ID, object, or other).
   * @param {boolean} unmute Whether to unmute the tab (Default: false).
   * @returns {Promise<boolean>} True if the tab was focused successfully, false otherwise.
   * @nothrows If the tab is not found or the focus action fails, this function will not throw an error.
   */
  focusTab: async function (tab, unmute = false) {
    const resolvedTab = await Helpers.resolveTab(tab);
    if (!resolvedTab) {
      console.error("No valid tab found to focus.");
      return false;
    }

    // Make tab and window active
    console.log(`Making tab ${resolvedTab.title} active`);
    try {
      // We need to be sure that window with this tab is active
      await API.windows.update(resolvedTab.windowId, { focused: true });
      // Switch to the tab
      await API.tabs.update(resolvedTab.id, unmute ? { muted: false, active: true } : { active: true });
      return true;
    } catch (error) {
      console.error(`Error switching to tab ${resolvedTab.id}: ${error}`);
      return false;
    }
  },

  /**
   * Open a new tab with the specified URL.
   * @param {string} url The URL to open in the new tab.
   * @returns {Promise<tabs.Tab|null>} The created tab object or null if failed.
   * @nothrows If the URL is invalid or the tab cannot be created, this function will not throw an error.
   *
   * @note To detect when the tab has finished loading, listen to the tabs.onUpdated or the
   * webNavigation.onCompleted event before calling tabs.create.
   */
  openTab: function (url) {
    return API.tabs.create({ url, active: true }).catch((error) => {
      console.error(`Error creating tab with URL ${url}: ${error}`);
      return null;
    });
  },

  /**
   * Get a value from storage.
   * @param {string} key The key to retrieve.
   * @param {any} defaultValue The default value to return if the key is not found (Default: null).
   * @returns {Promise<any>} The stored value or the default value.
   * @nothrows If the key is not found or an error occurs, this function will not throw an error.
   */
  getStorageValue: async function (key, defaultValue = null) {
    try {
      return await API.storage.local.get(key).then((data) => {
        if (data && data[key] !== undefined) {
          return data[key];
        }
        return defaultValue;
      });
    } catch(error) {
      console.error(`Error getting storage value for key ${key}: ${error}`);
    };

    return defaultValue;
  },

  /**
   * Set a value in storage.
   * @param {string} key The key to set.
   * @param {any} value The value to set.
   * @returns {Promise<any>} The set value or null if failed.
   * @nothrows If the key is invalid or the value cannot be set, this function will not throw an error.
   */
  setStorageValue: async function (key, value) {
    try {
      await API.storage.local.set({ [key]: value });
      return value;
    } catch (error) {
      console.error(`Error setting storage value for key ${key}: ${error}`);
    }

    return null;
  },

  /**
   * Convert a wildcard pattern to a regular expression.
   * @param {string} pattern The wildcard pattern to convert.
   * @returns {RegExp} The resulting regular expression.
   */
  wildcardToRegExp: function (pattern) {
    if (!pattern || typeof pattern !== "string") return /^$/i;
    const escaped = pattern
      .replace(/[.+^${}()|[\]\\]/g, "\\$&")
      .replace(/\*/g, ".*")
      .replace(/\?/g, ".");
    return new RegExp("^" + escaped + "$", "i");
  },

  store: {},
  get: function(key, defValue = null) {
    return Helpers.store[key] !== undefined ? Helpers.store[key] : defValue;
  },
  set: function(key, value) {
    Helpers.store[key] = value;
  },
  add: function(key, value) {
    if (Array.isArray(Helpers.store[key])) {
      Helpers.store[key].push(value);
    } else {
      Helpers.store[key] = [value];
    }
  },
  has: function(key, value = null) {
    if (value === null) {
      return Helpers.store[key] !== undefined;
    }
    if (Array.isArray(Helpers.store[key])) {
      return Helpers.store[key].includes(value);
    }
    return false;
  },
  remove: function(key, value = null) {
    if (value === null) {
      delete Helpers.store[key];
    } else if (Array.isArray(Helpers.store[key])) {
      const index = Helpers.store[key].indexOf(value);
      if (index !== -1) {
        Helpers.store[key].splice(index, 1);
      }
    }
  },
};

const SelectAudio = {
  /**
   * Execute a function in the context of a specific tab but ensure before that audio helpers injected.
   * @param {tabs.Tab|number|any} tab The tab to execute the function in.
   * @param {Function} func The function to execute.
   * @param {Array} args The arguments to pass to the function.
   * @returns {Promise<any>} The result of the function execution or null if failed.
   * @nothrows If the tab is not found or the script fails to execute, this function will not throw an error.
   */
  executeInTab: async function (tab, func, args = []) {
    const ok = await Helpers.injectScript(tab, "scripts/audio.js");
    if (!ok) return null;
    return await Helpers.executeInTab(tab, func, args);
  },

  /**
   * Enumerate audio input/output devices.
   * @param {tabs.Tab|number|any} tab The tab to execute the function in.
   * @returns {Promise<{audioinput: {label: string, deviceId: string}[], audiooutput: {label: string, deviceId: string}[], videoinput: {label: string, deviceId: string}[]}>} The result of the function execution or null if failed.
   * @nothrows If the tab is not found or the script fails to execute, this function will not throw an error.
   */
  enumerateDevices: async function (tab) {
    return await SelectAudio.executeInTab(tab, () => {
      return AUDIO_EnumerateDevices();
    });
  },

  /**
   * Select an audio device in the context of a specific tab.
   * @param {tabs.Tab|number|any} tab The tab to execute the function in.
   * @param {string} label The label of the audio device to select.
   * @param {string} id The ID of the audio device to select.
   * @param {boolean} saveAsManual Whether to save the device selection as manual.
   * @returns {Promise<[true, string, string]|[false, null, null]>} The result of the function execution or null if failed.
   * @nothrows If the tab is not found or the script fails to execute, this function will not throw an error.
   */
  selectDevice: async function (tab = null, label = "", id = "", saveAsManual = true) {
    const resolvedTab = await Helpers.resolveTab(tab);
    if (!resolvedTab) return [false, null, null];

    // Check if we have stored another id for this tab
    if (label && id) {
      const storedId = Helpers.get("deviceId_per_tab_" + resolvedTab.id + label, null);
      if (storedId) {
        console.info(`Using stored id "${storedId}" for device "${label}" (${id}) for tab "${resolvedTab.title}"`);
        id = storedId;
      }
    }
    const result = await SelectAudio.executeInTab(resolvedTab, (label, id) => {
      return AUDIO_SelectDevice(label, id);
    }, [label, id]);

    if (result && result[0]) {
      if (saveAsManual) Helpers.add("manualAudioDevice", resolvedTab.id);
      // Different tabs can have different id for the same device
      // So, we want to store id for the tab
      Helpers.set("deviceId_per_tab_" + resolvedTab.id + result[1], result[2]);
      console.info(`Audio device "${result[1]}" (${result[2]}) selected for tab "${resolvedTab.title}"`);
    } else if (label && id) {
      console.error(`Failed to select audio device "${label}" (${id}) for tab "${resolvedTab.title}"`);
    }

    return result;
  },

  /**
   * Automatically select an audio device for the given tab.
   * @param {tabs.Tab} tab The tab to execute the function in.
   * @returns {Promise<boolean>} True if a device was automatically selected, false otherwise.
   * 
   * @note Automatic select based on user settings.
   */
  autoSelectDevice: async function (tab) {
    if (!tab?.url) return false;
    if (Helpers.has("manualAudioDevice", tab.id)) {
      console.info(`Tab ${tab.id} has manual audio device set. Skipping auto selection.`);
      return false;
    }

    const data = await Helpers.getStorageValue(DATA_PATTERNS, []);
    if (Array.isArray(data) && data.length > 0) {
      for (const pattern of data) {
        if (!pattern.urlPattern || !pattern.audioOutput || pattern.audioOutput === "Default") continue;
        const urlPattern = Helpers.wildcardToRegExp(pattern.urlPattern);
        // Check if the tab URL matches the pattern
        if (urlPattern.test(tab.url)) {
          // Await the selection and stop after the first match
          await SelectAudio.selectDevice(tab, pattern.audioOutput, pattern.audioOutputId, false);
          return true;
        }
      }
    }

    return false;
  }
};

/**
 * Manage meet tabs and their audio settings.
 */
class MeetTabsManager {
  constructor(name, url, script) {
    this.name = name;
    this.urlPattern = url;
    this.script = script;
    this.urlRegExp = null;
    this.enabled = false;
    this._enablingInProgress = false;
    this.checkEnabled();
  }

  key() {
      return "enable" + this.name + "Tabs";
  }

  id() {
    return "MeetSupportScript_" + this.key();
  }

  /**
   * Check if the current meet tabs manager is enabled
   * @returns {boolean} - True if enabled, false otherwise
   */
  isEnabled() {
    return this.enabled;
  }

  /**
   * Activate current meet tabs manager
   * @param {boolean} enabled - True to enable, false to disable
   * @noreturn
   */
  async setActive(enabled) {
    if (this.enabled === !!enabled || this._enablingInProgress)
    {
      // Wait for the current operation to finish
      await new Promise(resolve => {
        const check = () => {
          if (!this._enablingInProgress) {
            resolve();
          } else {
            setTimeout(check, 100);
          }
        };
        check();
      });
    }

    const self = this;
    this._enablingInProgress = true;
    // If enabled - register content script
    if (enabled) {
      await API.scripting.getRegisteredContentScripts({ids: [self.id()]}).then((registered) => {
        if (registered.length > 0) {
          const registeredIndx = registered.findIndex((script) => script.id === self.id());
          if (registeredIndx !== -1) {
            console.info(`Content script ${self.id()} is already registered.`);
            return;
          }
        }

        API.scripting.registerContentScripts([
          {
            id: self.id(),
            matches: [this.urlPattern],
            js: [self.script],
            allFrames: true,
            runAt: "document_start",
          },
        ]).then(() => {
          console.info(`Content script ${self.id()} registered.`);
          self.enabled = true;
        }).catch((error) => {
          console.error(`Error registering content script for ${self.key()}: ${error}`);
          self.enabled = false;
        }).finally(() => {
            self._enablingInProgress = false;
        });
      });
    } else {
      self.enabled = false;
      await API.scripting.getRegisteredContentScripts({ids: [self.id()]}).then(async (registered) => {
        if (registered.length > 0) {
          const registeredIndx = registered.findIndex((script) => script.id === self.id());
          if (registeredIndx !== -1) {
            await API.scripting.unregisterContentScripts({ids: [self.id()]}).then(() => {
              console.info(`Content script ${self.id()} unregistered.`);
            }).catch((error) => {
              console.error(`Error unregistering content script for ${self.key()}: ${error}`);
            });
          }
        }
      }).finally(() => {
          self._enablingInProgress = false;
      });
    }
  }

  /**
   * Check if the current meet tabs manager is should be enabled and enable/disable it
   * @returns {Promise<boolean>} - True if enabled, false otherwise
   */
  async checkEnabled() {
    const self = this;
    return await Helpers.getStorageValue(this.key(), true).then((enabled) => {
      self.setActive(enabled);
      return self.enabled;
    });
  }

  /**
   * Set the enabled state of the current meet tabs manager
   * @param {boolean} enabled - True to enable, false to disable
   * @noreturn
   */
  async setEnabled(enabled) {
    const self = this;
    await Helpers.setStorageValue(this.key(), enabled).catch((error) => {
      console.error(`Error setting storage value for ${self.key()}: ${error}`);
    });
    //await this.setActive(enabled);
  }

  /**
   * Check if the given tab is a meet tab
   * @param {tabs.Tab} tab - Tab object to check
   * @returns {boolean} - True if tab is a meet tab, false otherwise
   *
   * @note Not resolving input tab argument.
   */
  isTab(tab) {
    if (!this.urlRegExp) {
      this.urlRegExp = Helpers.wildcardToRegExp(this.urlPattern);
    }
    return !!(tab && tab.url && this.urlRegExp.test(tab.url));
  }

  /**
   * Query all meet tabs
   * @returns {Promise<Array>} - Promise with array of meet tabs
   * @nothrows
   */
  async queryTabs() {
    try {
      return await API.tabs.query({ url: this.urlPattern });
    } catch (error) {
      console.error(`Error querying tabs: ${error}`);
      return [];
    }
  }

  /**
   * Inject the content script into the given tab
   * @param {tabs.Tab|number|any} tab The tab identifier (ID, object, or other).
   * @returns {Promise<boolean>} True if the script was injected successfully, false otherwise.
   * @nothrows If the tab is not found or the script fails to inject, this function will not throw an error.
   */
  async inject(tab) {
    return await Helpers.injectScript(tab, this.script);
  }

  /**
   * Get the state of the given meet tab
   * @param {tabs.Tab|number|any} tab The tab identifier (ID, object, or other).
   * @returns {Promise<{title: string,inMeeting: boolean,micMuted: boolean,camMuted: boolean}>} Promise with the tab state
   * @nothrows If the tab is not found or the state cannot be retrieved, this function will not throw an error.
   */
  async getState(tab) {
    return {
      title: typeof tab === "object" && tab.hasOwnProperty("title") ? tab.title : "",
      inMeeting: false,
      micMuted: false,
      camMuted: false,
    };
  }

  /**
   * Join the meet in the tab
   * @param {tabs.Tab|number|any} tab The tab identifier (ID, object, or other).
   * @returns {Promise<boolean>} True if the join was successful, false otherwise.
   * @nothrows If the tab is not found or the join fails, this function will not throw an error.
   */
  async join(tab) {
    return false;
  }

  /**
   * Switch the microphone mute state in the tab
   * @param {tabs.Tab|number|any} tab The tab identifier (ID, object, or other).
   * @returns {Promise<boolean>} True if the mute state was successfully toggled, false otherwise.
   * @nothrows If the tab is not found or the toggle fails, this function will not throw an error.
   */
  async toggleMic(tab) {
    return false;
  }

  /**
   * Switch camera mute state in the tab
   * @param {tabs.Tab|number|any} tab The tab identifier (ID, object, or other).
   * @returns {Promise<boolean>} True if the mute state was successfully toggled, false otherwise.
   * @nothrows If the tab is not found or the toggle fails, this function will not throw an error.
   */
  async toggleCam(tab) {
    return false;
  }

  /**
   * Query all meet tabs with their state that managed by this manager 
   * @returns {Promise<Array>} - Promise with array of meet tabs with their state
   * @nothrows If the tabs cannot be queried or their state cannot be retrieved, this function will not throw an error.
   */
  async queryTabsWithState() {
    const tabs = await this.queryTabs();
    const tabsWithState = [];

    for (const tab of tabs) {
      const state = await this.getState(tab);
      if (state) {
        tabsWithState.push({ ...tab, ...state });
      }
    }

    return tabsWithState;
  }

  /**
   * Get all meet tabs with inMeeting state
   * @returns {Promise<Array>} - Promise with array of meet tabs with inMeeting state
   * @nothrows If the tabs cannot be queried or their state cannot be retrieved, this function will not throw an error.
   */
  async getTabsWithInMeeting() {
    const tabs = await this.queryTabsWithState();
    return tabs.filter((tab) => tab.inMeeting);
  }

  /**
   * Check if we have any meet tabs with inMeeting state
   * @returns {Promise<boolean>} - Promise with result of the check
   * @nothrows If the tabs cannot be queried or their state cannot be retrieved, this function will not throw an error.
   */
  async hasInMeetTabs() {
    const tabs = await this.queryTabsWithState();
    return tabs.some((tab) => tab.inMeeting);
  }

  /**
   * Switch to the next active tab of this type meet
   * @returns {Promise<boolean>} - Promise with result of the switch to next tab
   * @nothrows If the tabs cannot be queried or their state cannot be retrieved, this function will not throw an error.
   * 
   * If we have one tab where we are in meeting - switch to it,
   * if no - check if we have focused some tab of this type meet and switch to next one
   * if no - switch to first one
   * if no one - do nothing
   */
  async switchToActiveOrNextTab() {
    const tabs = await this.queryTabsWithState();
    if (tabs.length === 0) {
      console.info(`No active meet tabs found for ${this.name} manager.`);
      return false;
    }

    const inMeetingTabs = tabs.filter((tab) => tab.inMeeting);
    const focusedTab = await Helpers.activeTab();
    // Determine which list of tabs to use for cycling
    const cycleList = inMeetingTabs.length > 0 ? inMeetingTabs : tabs;
    const focusedIndexInCycle = focusedTab ? cycleList.findIndex((tab) => tab.id === focusedTab.id) : -1;

    let targetTab;
    if (focusedIndexInCycle !== -1) {
      // If a tab from the cycle list is focused, get the next one
      const nextIndex = (focusedIndexInCycle + 1) % cycleList.length;
      targetTab = cycleList[nextIndex];
    } else {
      // Otherwise, just pick the first tab in the prioritized list
      targetTab = cycleList[0];
    }
    
    if (targetTab && focusedTab && targetTab.id === focusedTab.id) {
      console.info(`Selected ${this.name} tab is already focused.`);
      return true;
    }

    return await Helpers.focusTab(targetTab, true);
  }
}

/**
 * Google Meet tabs manager
 */
class GoogleMeetTabsManager extends MeetTabsManager {
  constructor() {
    super("GoogleMeet", "*://meet.google.com/*", "scripts/gmeet.js");
  }

  async getState(tab) {
    return await Helpers.executeInTab(tab, () => {
      return GMeet_getState();
    });
  }

  async join(tab) {
    return await Helpers.executeInTab(tab, () => {
      return GMeet_joinMeeting();
    });
  }

  async toggleMic(tab) {
    return await Helpers.executeInTab(tab, () => {
      return GMeet_switchMic();
    });
  }

  async toggleCam(tab) {
    return await Helpers.executeInTab(tab, () => {
      return GMeet_switchCam();
    });
  }
}

const MeetManagers = [
  new GoogleMeetTabsManager()
];
/**
 * Get a meet manager by name
 * @param {string} name 
 * @returns {MeetTabsManager|null}
 */
MeetManagers.get = function (name) {
  const manager = MeetManagers.find(manager => manager.name === name);
  return manager || null;
}

/**
 * Get the tab with inMeeting state
 * @returns {Promise<[MeetTabsManager, Tab]|null>} - Promise with (manager, tab) pair if found, or null if not found
 */
async function GetTabWithInMeeting() {
  const allInMeetingTabs = [];
  for (const manager of MeetManagers) {
    if (!manager.isEnabled()) continue;
    const tabs = await manager.getTabsWithInMeeting();
    if (tabs.length > 0) {
      allInMeetingTabs.push(...tabs.map((tab) => [manager, tab]));
    }
  }
  if (allInMeetingTabs.length === 1) {
    return allInMeetingTabs[0];
  } else if (allInMeetingTabs.length > 1) {
    // If we have more than one tab in meeting - check if we have focused one of them
    const focusedTab = await Helpers.activeTab();
    const focusedTabIndx = focusedTab ? allInMeetingTabs.findIndex((tab) => tab[1].id === focusedTab.id) : -1;
    if (focusedTabIndx !== -1) {
      // If we have focused one of them - return it
      return allInMeetingTabs[focusedTabIndx];
    }
  }

  return null;
}

/**
 * Switch to the next active tab in the meeting
 * @returns {Promise<boolean>} - Promise with the result of the switch
 *
 * @note If has tab with joined meeting - switch to it, otherwise switch to next one opened meeting tab
 */
async function MeetSwitchToNextTab() {
  // Consolidate all tabs from all enabled managers
  let allTabs = [];
  for (const manager of MeetManagers) {
    if (manager.isEnabled()) {
      allTabs.push(...await manager.queryTabsWithState());
    }
  }

  if (allTabs.length === 0) {
    console.info("No meet tabs found to switch to.");
    return false;
  }

  const inMeetingTabs = allTabs.filter(t => t.inMeeting);
  const cycleList = inMeetingTabs.length > 0 ? inMeetingTabs : allTabs;

  const focusedTab = await Helpers.activeTab();
  const focusedIndex = focusedTab ? cycleList.findIndex(t => t.id === focusedTab.id) : -1;

  let targetTab;
  if (focusedIndex !== -1) {
    targetTab = cycleList[(focusedIndex + 1) % cycleList.length];
  } else {
    targetTab = cycleList[0];
  }

  if (targetTab && focusedTab && targetTab.id === focusedTab.id) {
    console.info("Selected tab is already focused.");
    return true;
  }

  return await Helpers.focusTab(targetTab, true);
}

/**
 * Join the meeting in the current tab
 * @returns {Promise<boolean>} - Promise with the result of the join
 *
 * @note If no one currently in meeting and exactly one not in meeting -> join it
 */
async function MeetJoin() {
  // Collect (manager, tab) pairs with state
  const pairsArrays = await Promise.all(
    MeetManagers.map(async (manager) => {
      if (!manager.isEnabled()) return [];
      const tabs = await manager.queryTabsWithState();
      return tabs.map(t => [manager, t]);
    })
  );
  const allPairs = pairsArrays.flat();
  const inMeeting = allPairs.filter(p => p[1].inMeeting);
  const notInMeeting = allPairs.filter(p => !p[1].inMeeting);

  // If no one currently in meeting and exactly one not in meeting -> join it
  if (inMeeting.length === 0 && notInMeeting.length === 1) {
    const [manager, tab] = notInMeeting[0];
    const joined = await manager.join(tab);
    if (joined) {
      await Helpers.focusTab(tab, true);
      return true;
    }
  }
  return false;
}

/**
 * Toggle the microphone in the current meeting tab
 * @returns {Promise<boolean>} - Promise with the result of the toggle
 *
 * @note Works only if one tab is currently in a meeting exists
 */
async function MeetToggleMuteMicrophone() {
  const tab = await GetTabWithInMeeting();
  if (tab) {
    return tab[0].toggleMic(tab[1]);
  }
  return false;
}

/**
 * Toggle the camera in the current meeting tab
 * @returns {Promise<boolean>} - Promise with the result of the toggle
 *
 * @note Works only if one tab is currently in a meeting exists
 */
async function MeetToggleMuteCamera() {
  const tab = await GetTabWithInMeeting();
  if (tab) {
    return tab[0].toggleCam(tab[1]);
  }
  return false;
}

/**
 * Inject the meeting content script into the specified tab
 * @param {tabs.Tab|number|any} tab 
 * @returns {Promise<boolean>} - Promise with the result of the injection
 */
async function injectMeetContentScript(tab) {
  for (const manager of MeetManagers) {
    if (!manager.isEnabled()) continue;
    if (manager.isTab(tab)) {
      await manager.inject(tab);
      return true;
    }
  }
  return false;
}


function onSettingsChange(changes) {
  const changedItems = Object.keys(changes);

  for (const item of changedItems) {
    for (const manager of MeetManagers) {
      if (manager.key() === item) {
        manager.setActive(changes[item].newValue);
      }
    }
  }
}


// Listen for commands (shortcuts)
API.commands.onCommand.addListener((command) => {
  if (command === "meet-switch-tab") {
    MeetSwitchToNextTab();
  } else if (command === "meet-toggle-microphone") {
    MeetToggleMuteMicrophone();
  } else if (command === "meet-toggle-camera") {
    MeetToggleMuteCamera();
  } else if (command === "meet-join") {
    MeetJoin();
  } else if (command === "select-audio-device") {
    SelectAudio.selectDevice();
  }
});

// Listen when new tab stay audiable and check from storage url patterns to set audio devices
// Also - we want to remember if manually selected device for some tab
API.tabs.onUpdated.addListener(
  (tabId, changeInfo, tab) => {
    if (!tab?.url || !tab.url.startsWith("http")) return;

    if (changeInfo?.status === "complete") {
      // Check if it is a meeting tab and inject manager code if it is
      injectMeetContentScript(tab);
      // Here we also track tabs with autoplay
      if (tab.audible) {
        SelectAudio.autoSelectDevice(tab);
      }
    } else if (changeInfo?.audible) {
      // And here - if tab becomes audible
      SelectAudio.autoSelectDevice(tab);
    }
  }
);
API.tabs.onRemoved.addListener(
  (tabId, removeInfo) => {
    // Remove tab from manual audio device list
    Helpers.remove("manualAudioDevice", tabId);
  }
);

// Listen for settings (local storage) changes
API.storage.local.onChanged.addListener(onSettingsChange);

// On install extension
API.runtime.onInstalled.addListener((details) => {
  const manifest = chrome.runtime.getManifest();
  const currentVersion = manifest.version;

  if (details.reason === 'update' && details.previousVersion !== currentVersion) {
    console.log(`Extension updated from ${details.previousVersion} to ${currentVersion}`);
    // Handle extension update
    // ...
  }

  if (details?.temporary) {
    // Handle temporary installation
    // ...
    return;
  }

  if (details.reason === 'install') {
    // Enable GoogleMeet manager by default
    const gmeet = MeetManagers.get("GoogleMeet");
    if (gmeet) gmeet.setEnabled(true);
    // Show options page
    API.runtime.openOptionsPage();
  }
});

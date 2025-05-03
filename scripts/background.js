// For compatibility with Chrome and Firefox
const IS_FIREFOX = typeof browser !== "undefined" && browser.runtime && browser.runtime.getBrowserInfo;
const IS_CHROME = typeof chrome !== "undefined";
const API = typeof browser !== "undefined" ? browser : chrome;
const DATA_PATTERNS = "patterns";

const Helpers = {
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

  injectScript: async function (tab, script) {
    const resolvedTab = await Helpers.resolveTab(tab);
    if (!resolvedTab) {
      console.error("No valid tab found to inject script.");
      return false;
    }

    try {
      const result = await API.scripting.executeScript({
        target: { tabId: resolvedTab.id },
        files: [script],
      });
      return true;
    } catch (error) {
      console.error(`Error injecting script ${script} in tab ${resolvedTab.id}: ${error}`);
      return false;
    }
  },

  focusTab: async function (tab, unmute = false) {
    const resolvedTab = await Helpers.resolveTab(tab);
    if (!resolvedTab) {
      console.error("No valid tab found to focus.");
      return false;
    }

    // Make tab and window active
    console.log(`Making tab ${resolvedTab.title} active`);
    // We need to be sure that window with this tab is active
    let result = await API.windows.update(resolvedTab.windowId, {
      focused: true,
    }).catch((error) => {
      console.error(`Error switching to window ${resolvedTab.windowId}: ${error}`);
      return false;
    }).then(() => {
      return true;
    });

    // Switch to the tab
    result = result && await API.tabs.update(resolvedTab.id, unmute ? {
      muted: false,
      active: true,
    } : {
      active: true,
    }).catch((error) => {
      console.error(`Error switching to tab ${resolvedTab.id}: ${error}`);
      return false;
    }).then(() => {
      return true;
    });

    return result;
  },

  openTab: function (url) {
    const createData = {
      url: url,
      active: true,
    };
    return API.tabs.create(createData).catch((error) => {
      console.error(`Error creating tab with URL ${url}: ${error}`);
      return null;
    });
  },

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

  store: {},
  get: function(key, defaultValue = null) {
    return Helpers.store[key] !== undefined ? Helpers.store[key] : defaultValue;
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
  executeInTab: async function (tab, func, args = []) {
    return new Promise(async (resolve, reject) => {
      const result = await Helpers.injectScript(tab, "scripts/audio.js");
      if (!result) {
        return resolve(null);
      }
      Helpers.executeInTab(tab, func, args).then((result) => {
        resolve(result);
      }).catch((error) => {
        resolve(null);
      });
    });
  },

  enumarateDevices: async function (tab) {
    return SelectAudio.executeInTab(tab, () => {
      return AUDIO_EnumareteDevices();
    });
  },

  selectDevice: async function (tab = null, label = "", id = "", saveAsManual = true) {
    const resolvedTab = await Helpers.resolveTab(tab);
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

  autoSelectDevice: async function (tab) {
    if (!tab) return false;
    if (Helpers.has("manualAudioDevice", tab.id)) {
      console.info(`Tab ${tab.id} has manual audio device set. Skipping auto selection.`);
      return false;
    }

    return await Helpers.getStorageValue(DATA_PATTERNS, true).then((data) => {
      if (data && data.length > 0) {
        for (let i = 0; i < data.length; i++) {
          const pattern = data[i];
          if (!pattern.urlPattern || !pattern.audioOutput || pattern.audioOutput === "Default") continue;
          const urlPattern = new RegExp("/" + pattern.urlPattern.replaceAll("/", "\\/") + "/", "i");
          // Check if the tab URL matches the pattern
          if (tab.url.match(urlPattern)) {
            if (pattern.audioOutput && pattern.audioOutput !== "Default") {
              SelectAudio.selectDevice(tab, pattern.audioOutput, pattern.audioOutputId, false);
              return true;
            }
          }
        }
      }
      return false;
    });
  }
};


class MeetTabsManager {
  constructor(name, url, script) {
    this.name = name;
    this.urlPattern = url;
    this.script = script;
    this.urlRegExp = null;
    this.enabled = false;
    this.checkEnabled();
  }

  key() {
      return "enable" + this.name + "Tabs";
  }

  id() {
    return "MeetSupportScript_" + this.key();
  }

  isEnabled() {
    return this.enabled;
  }

  setEnabled(enabled) {
    if (this.enabled === !!enabled)
    {
      return;
    }

    const self = this;
    // If enabled - register content script
    if (enabled) {
      API.scripting.getRegisteredContentScripts({ids: [self.id()]}).then((registered) => {
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
        });
      });
    } else {
      self.enabled = false;
      API.scripting.getRegisteredContentScripts({ids: [self.id()]}).then((registered) => {
        if (registered.length > 0) {
          const registeredIndx = registered.findIndex((script) => script.id === self.id());
          if (registeredIndx !== -1) {
            API.scripting.unregisterContentScripts({ids: [self.id()]}).then(() => {
              console.info(`Content script ${self.id()} unregistered.`);
            }).catch((error) => {
              console.error(`Error unregistering content script for ${self.key()}: ${error}`);
            });
          }
        }
      });
    }
  }

  checkEnabled() {
    const self = this;
    return Helpers.getStorageValue(this.key(), true).then((enabled) => {
      self.setEnabled(enabled);
      return self.enabled;
    });
  }

  // Check tab is this type of meet tab
  // @param {object} tab - Tab object to check
  // @return {boolean} - True if tab is a meet tab, false otherwise
  isTab(tab) {
    if (!this.urlRegExp) {
      this.urlRegExp = new RegExp("/" + this.urlPattern.replaceAll("/", "\\/") + "/", "i");
    }
    return tab && tab.url && this.urlRegExp.test(tab.url);
  }

  // Request to get all meet tabs
  // @return {Promise} - Promise with array of meet tabs
  async queryTabs() {
    try {
      return await API.tabs.query({ url: this.urlPattern });
    } catch (error) {
      console.error(`Error querying tabs: ${error}`);
      return [];
    }
  }

  async inject(tab) {
    return await Helpers.injectScript(tab, this.script);
  }

  // Get tab info from the meet tab
  // @param {object} tab - Tab object to get info from
  // @return {object} - Object with tab info: { title: "string", inMeeting: true/false, micMuted: true/false, camMuted: true/false } or null
  async getState(tab) {
    return {
      title: typeof tab === "object" && tab.hasOwnProperty("title") ? tab.title : "",
      inMeeting: false,
      micMuted: false,
      camMuted: false,
    };
  }

  // Join the meet in the tab
  // @param {object} tab - Tab object to join the meet in
  async join(tab) {
    return false;
  }

  // Switch microphone mute state in the tab
  // @param {object} tab - Tab object to switch microphone mute state in
  // @return {Promise} - Promise with result of the microphone mute state after
  async toggleMic(tab) {
    return false;
  }

  // Switch camera mute state in the tab
  // @param {object} tab - Tab object to switch camera mute state in
  // @return {Promise} - Promise with result of the camera mute state after
  async toggleCam(tab) {
    return false;
  }

  // Get all meet tabs with their state
  // @return {Promise} - Promise with array of meet tabs with their state
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

  // Get all meet tabs with inMeeting state
  // @return {Promise} - Promise with array of meet tabs with inMeeting state
  async getTabsWithInMeeting() {
    const tabs = await this.queryTabsWithState();
    return tabs.filter((tab) => tab.inMeeting);
  }

  // Check if we have any meet tabs with inMeeting state
  // @return {Promise} - Promise with result of the check
  async hasInMeetTabs() {
    const tabs = await this.queryTabsWithState();
    return tabs.some((tab) => tab.inMeeting);
  }

  // Switch to next active tab of this type meet
  // If we have one tab where we are in meeting - switch to it,
  // if no - check if we have focused some tab of this type meet and switch to next one
  // if no - switch to first one
  // if no one - do nothing
  // @return {Promise} - Promise with result of the switch to next tab
  async switchToActiveOrNextTab() {
    const tabs = await this.queryTabsWithState();
    const inMeetingTabs = tabs.filter((tab) => tab.inMeeting);
    const focusedTab = await Helpers.activeTab();
    const focusedTabIndx = focusedTab ? tabs.findIndex((tab) => tab.id === focusedTab.id) : -1;

    let targetTab = null;
    if (inMeetingTabs.length === 1) {
      // If we have one tab where we are in meeting - switch to it
      targetTab = inMeetingTabs[0];
    } else
    if (focusedTabIndx !== -1) {
      // If we have focused some tab of this type meet and switch to next one
      const nextIndex = (focusedTabIndx + 1) % inMeetingTabs.length;
      targetTab = inMeetingTabs[nextIndex];
    } else
    if (tabs.length > 0) {
      // If no - switch to first one
      targetTab = tabs[0];
    }
    
    if (targetTab === focusedTab) {
      console.info("Selected tab is already focused.");
      return true;
    }

    if (!targetTab) {
      console.info("No active meet tabs found.");
      return false;
    }

    return await Helpers.focusTab(targetTab, true);
  }
}

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
      return GMeet_joinMeet();
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

async function MeetSwitchToNextTab() {
  for (const manager of MeetManagers) {
    if (!manager.isEnabled()) continue;
    const hasInMeetTabs = await manager.hasInMeetTabs();
    if (!hasInMeetTabs) {
      continue;
    }
    const switched = await manager.switchToActiveOrNextTab();
    if (switched) {
      return true;
    }
  }

  for (const manager of MeetManagers) {
    if (!manager.isEnabled()) continue;
    const tabs = await manager.queryTabs();
    if (tabs.length < 1) {
      continue;
    }
    // @TODO: When reach end of one managers tabs - go trough next manager
    const switched = await manager.switchToActiveOrNextTab();
    if (switched) {
      return true;
    }
  }

  return false;
}

async function MeetJoin() {
  const allTabs = MeetManagers.map(async (manager) => (manager.isEnabled() ? await manager.queryTabsWithState() : []).map((tab) => [manager, tab])).flat(1);
  const inMeetTab = allTabs.find((tab) => tab[1].inMeeting);
  const notInMeetingTabs = allTabs.filter((tab) => !tab[1].inMeeting);
  if (!inMeetTab && notInMeetingTabs.length === 1) {
    if (notInMeetingTabs[0].join(notInMeetingTabs[1])) {
      Helpers.focusTab(notInMeetingTabs[1], true);
      return true;
    }
    return false;
  }

  return false;
}

async function MeetToggleMuteMicrophone() {
  const tab = await GetTabWithInMeeting();
  if (tab) {
    return tab[0].toggleMic(tab[1]);
  }
  return false;
}

async function MeetToggleMuteCamera() {
  const tab = await GetTabWithInMeeting();
  if (tab) {
    return tab[0].toggleCam(tab[1]);
  }
  return false;
}

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
    if (item.startsWith("enable")) for (const manager of MeetManagers) {
      if (manager.key() === item) {
        manager.setEnabled(changes[item].newValue);
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
    if (tab.url.indexOf("http") !== 0) {
      return;
    }

    if (changeInfo?.status === "complete") {
      injectMeetContentScript(tab);
    }

    if (changeInfo?.audible) {
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

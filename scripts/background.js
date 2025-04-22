const GMeet = {
  // Get all active GMeetTabs, sort it and return as array
  // Use: browser.tabs.query - FF 45+, Chrome 45+, Edge 79+, Safari 14+
  GetTabs: function () {
    return browser.tabs
      .query({ url: "*://meet.google.com/*" })
      .then((tabs) => {
        let activeMeetTabs = tabs.filter((tab) => tab.audible);
        activeMeetTabs.sort((a, b) => a.title.localeCompare(b.title));
        return activeMeetTabs;
      })
      .catch((error) => {
        console.error(`Error querying tabs: ${error}`);
        return [];
      });
  },

  // Execute content script in the tab to get the state info of the GMeet tab
  // Use: browser.scripting.executeScript - FF 102+, Chrome 88+, Edge 88+, Safari 15.4+
  // Use: browser.scripting.InjectionTarget - FF 102+, Chrome 88+, Edge 88+, Safari 15.4+
  // Use: browser.scripting.InjectionResult - FF 102+, Chrome 88+, Edge 88+, Safari 17+
  // return { title: "string", inMeeting: true/false, micMuted: true/false, camMuted: true/false } or null
  GetTabInfo: function (tab) {
    return new Promise((resolve, reject) => {
      if (!tab || !tab.id) {
        reject(new Error("Invalid tab object or tab ID"));
        return;
      }
      // Check if the tab is a Google Meet tab
      if (!tab.url.includes("meet.google.com")) {
        resolve(null);
        return;
      }

      // Execute the content script in the tab to get the state info
      browser.scripting
        .executeScript({
          target: { tabId: tab.id },
          func: () => {
            return GMeet_getState();
          },
        })
        .then((results) => {
          if (results && results.length > 0) {
            resolve(results[0].result);
          } else {
            resolve(null);
          }
        })
        .catch((error) => {
          console.error(`Error executing script in tab ${tab.id}: ${error}`);
          resolve(null);
        });
    });
  },

  // Return Promise with array of all GMeet tabs with info
  GetTabsWithInfo: function () {
    return new Promise((resolve, reject) => {
      GMeet.GetTabs()
        .then((activeMeetTabs) => {
          let promises = activeMeetTabs.map((tab) => GMeet.GetTabInfo(tab));
          Promise.all(promises)
            .then((results) => {
              let tabsWithInfo = activeMeetTabs.map((tab, index) => {
                return { index, ...tab, info: results[index] };
              });
              resolve(tabsWithInfo);
            })
            .catch(reject);
        })
        .catch(reject);
    });
  },

  // Switch to next active GMeetTab
  // First - we get all, next - find the current one
  // if no - switch to first one, if yes - switch to next one
  // Use: browser.windows.update - FF 45+, Chrome 4+, Edge 14+, Safari 14+
  // Use: browser.tabs.query - FF 45+, Chrome 45+, Edge 79+, Safari 14+
  // Use: browser.tabs.update - FF 45+, Chrome 16+, Edge 14+, Safari 14+
  SwitchToNextGMeetTab: function () {
    GMeet.GetTabsWithInfo().then(async (activeMeetTabs) => {
      if (activeMeetTabs.length === 0) {
        console.log("No active meet tabs found.");
        return;
      }

      // First - check if we have only one meet tab where we are in meeting
      const inMeetingTabs = activeMeetTabs.filter((tab) => tab.info?.inMeeting);
      let MakeActive = inMeetingTabs.length === 1 ? inMeetingTabs[0] : null;
      // If no - find focused tab and switch to next one
      if (MakeActive === null) {
        MakeActive = 0;
        for (let i = 0; i < activeMeetTabs.length; i++) {
          if (activeMeetTabs[i].focused) {
            // check if window is focused
            let windowInfo = await browser.windows.get(
              activeMeetTabs[i].windowId
            );
            if (windowInfo.focused) {
              MakeActive = (i + 1) % activeMeetTabs.length;
              break;
            }
            MakeActive = i;
            break;
          }
        }
        MakeActive = activeMeetTabs[MakeActive];
      }

      // Check if selected tab not focused now
      if (MakeActive.focused) {
        let windowInfo = await browser.windows.get(activeMeetTabs[i].windowId);
        if (windowInfo.focused) {
          console.info("Selected tab is already focused.");
          return;
        }
      }

      // Make tab and window active
      console.log(`Making tab ${MakeActive.title} active`);
      // We need to be sure that window with this tab is active
      browser.windows.update(MakeActive.windowId, {
        focused: true,
      });
      // Switch to the tab
      browser.tabs.update(MakeActive.id, {
        muted: false,
        active: true,
      });
    });
  },

  // Find all google meet tabs, and if only one with active meet is found, toggle mute state of microphone for it
  ToggleMuteMicrophone: function () {
    GMeet.GetTabsWithInfo().then((tabsWithInfo) => {
      let activeMeetTabs = tabsWithInfo.filter((tab) => tab.info?.inMeeting);
      if (activeMeetTabs.length === 1) {
        console.log(`Toggle microphone for tab: ${activeMeetTabs[0].id}`);
        browser.scripting.executeScript({
          target: { tabId: activeMeetTabs[0].id },
          func: () => {
            return GMeet_switchMic();
          },
        });
      } else if (activeMeetTabs.length === 0) {
        console.log("No active meet tabs found.");
      } else {
        console.log("More than one active meet tab found.");
      }
    });
  },

  // Find all google meet tabs, and if only one with active meet is found, toggle mute state of camera for it
  ToggleMuteCamera: function () {
    GMeet.GetTabsWithInfo().then((tabsWithInfo) => {
      let activeMeetTabs = tabsWithInfo.filter((tab) => tab.info.inMeeting);
      if (activeMeetTabs.length === 1) {
        console.log(`Toggle camera for tab: ${activeMeetTabs[0].id}`);
        browser.scripting.executeScript({
          target: { tabId: activeMeetTabs[0].id },
          func: () => {
            return GMeet_switchCam();
          },
        });
      } else if (activeMeetTabs.length === 0) {
        console.log("No active meet tabs found.");
      } else {
        console.log("More than one active meet tab found.");
      }
    });
  },

  // Get all gmeet tabs, and if no one where we are in meeting and have only one where we are not in meeting - join it
  JoinMeet: function () {
    GMeet.GetTabsWithInfo().then((tabsWithInfo) => {
      let activeMeetTabs = tabsWithInfo.filter((tab) => tab.info?.inMeeting);
      if (activeMeetTabs.length === 0) {
        let notInMeetingTabs = tabsWithInfo.filter(
          (tab) => !tab.info?.inMeeting
        );
        if (notInMeetingTabs.length === 1) {
          console.log(`Joining meet for tab: ${notInMeetingTabs[0].id}`);
          browser.scripting.executeScript({
            target: { tabId: notInMeetingTabs[0].id },
            func: () => {
              return GMeet_joinMeet();
            },
          });
        } else if (notInMeetingTabs.length === 0) {
          console.log("No active meet tabs found.");
        } else {
          console.log("More than one active meet tab found.");
        }
      } else {
        console.log("Already in a meeting or join button not found.");
      }
    });
  },
};

const SelectAudio = {
  enumarateDevices: function (tab) {
    return new Promise((resolve, reject) => {
      let tabId = tab ? tab.id : null;
      const request = () => {
        browser.scripting
          .executeScript({
            target: { tabId: tabId },
            func: () => {
              return AUDIO_EnumareteDevices();
            },
          })
          .then((results) => {
            if (results && results.length > 0) {
              if (results[0].result === null) {
                reject(new Error("No devices found."));
              } else {
                resolve(results[0].result);
              }
            } else {
              reject(new Error("No devices found."));
            }
          })
          .catch((error) => {
            console.error(`Error executing script in tab ${tabId}: ${error}`);
            resolve(null);
          });
      };
      if (!tabId) {
        browser.tabs
          .query({ active: true, currentWindow: true })
          .then((tabs) => {
            let activeTab = tabs[0];
            if (activeTab) {
              tabId = activeTab.id;
              request();
            } else {
              reject(new Error("No active tab found."));
              return;
            }
          })
          .catch((error) => {
            console.error(`Error querying active tab: ${error}`);
            reject(error);
          });
      } else {
        request();
      }
    });
  },

  selectDevice: function (tab, label, id) {
    let tabId = tab ? tab.id : null;
    const request = () => {
      browser.scripting
        .executeScript({
          target: { tabId: tabId },
          func: async (label, id) => {
            let result = await AUDIO_SelectDevice(label, id);
            return result;
          },
          args: [label, id],
        })
        .then((results) => {
            if (results && results.length > 0) {
                if (results[0].result === null) {
                    console.error("No devices found.");
                } else if (results[0].result[0]) {
                    console.log(`Selected device: ${results[0].result[1]}`);
                }
            }
        })
        .catch((error) => {
          console.error(`Error executing script in tab ${tabId}: ${error}`);
          resolve(null);
        });
    };
    if (!tabId) {
      browser.tabs
        .query({ active: true, currentWindow: true })
        .then((tabs) => {
          let activeTab = tabs[0];
          if (activeTab) {
            tabId = activeTab.id;
            request();
          } else {
            reject(new Error("No active tab found."));
            return;
          }
        })
        .catch((error) => {
          console.error(`Error querying active tab: ${error}`);
          reject(error);
        });
    } else {
      request();
    }
  },
};

function openSettingsPage() {
  let createData = {
    type: "detached_panel",
    url: "options.html",
    width: 540,
    height: 480,
  };
  browser.windows.create(createData);
}

browser.commands.onCommand.addListener((command) => {
  if (command === "gmeet-switch-tab") {
    GMeet.SwitchToNextGMeetTab();
  } else if (command === "gmeet-toggle-microphone") {
    GMeet.ToggleMuteMicrophone();
  } else if (command === "gmeet-toggle-camera") {
    GMeet.ToggleMuteCamera();
  } else if (command === "select-audio-device") {
    SelectAudio.selectDevice();
  }
});

function getAudioPatterns() {
  return browser.storage.local.get("patterns").catch((error) => {
    console.error(`Error getting audio patterns: ${error}`);
    return null;
  });
}

function checkTabAudio(tab) {
  // Load from storage settings
  getAudioPatterns().then((data) => {
    if (data && data.patterns && data.patterns.length > 0) {
      for (let i = 0; i < data.patterns.length; i++) {
        let pattern = data.patterns[i];
        if (!pattern.urlPattern) continue;
        const urlPattern = new RegExp(
          "/" + pattern.urlPattern.replaceAll("/", "/") + "/",
          "i"
        );
        // Check if the tab URL matches the pattern
        if (tab.url.match(urlPattern)) {
          // Set audio devices
          /*if (pattern.audioInput && pattern.audioInput !== "Default") {
            SelectAudio.selectDevice(tab, pattern.audioInput);
          }*/
          if (pattern.audioOutput && pattern.audioOutput !== "Default") {
            SelectAudio.selectDevice(tab, pattern.audioOutput, pattern.audioOutputId);
          }
          break;
        }
      }
    }
  });
}

// Now we want listen when new tab opened or updated/reloaded and check from storage url patterns to set audio devices
browser.tabs.onCreated.addListener((tab) => {
  if (tab.audible) {
    checkTabAudio(tab);
  }
});
browser.tabs.onUpdated.addListener(
  (tabId, changeInfo, tab) => {
    if (changeInfo?.status === "complete" || changeInfo?.audible) {
      checkTabAudio(tab);
    }
  },
  { properties: ["audible"] }
);

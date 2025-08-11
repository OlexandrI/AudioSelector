// Content script for all tabs to controll audio devices

if (!window._AUDIOSELECTOR_AUDIO) {
window._AUDIOSELECTOR_AUDIO = true; // Flag to indicate that this script is running

class Modal{
  constructor(title, bodyElement, closeCb = null, autoCloseDelay = -1) {
    this.title = title;
    this.bodyElement = bodyElement;
    this.closeCb = closeCb;
    this.modalElement = null;
    this.bgElement = null;
    this.autoCloseDelay = autoCloseDelay;
    this._autoCloseHandler = null;
    this._autoCloseDate = null;
    this._autoCloseElement = null;
  }

  _createModal() {
    this.modalElement = document.createElement("div");
    this.modalElement.className = "audio-selector-modal";

    // Make it over all and center by horizontal and 10% from top
    this.modalElement.style.position = "fixed";
    this.modalElement.style.top = "10%";
    this.modalElement.style.left = "50%";
    this.modalElement.style.transform = "translate(-50%, 0)";
    this.modalElement.style.zIndex = "9999";
    this.modalElement.style.backgroundColor = "white";
    this.modalElement.style.padding = "22px 24px 16px 24px";
    this.modalElement.style.borderRadius = "10px";
    this.modalElement.style.boxShadow = "0 0 10px rgba(0, 0, 0, 0.5)";
    this.modalElement.style.width = "300px";
    this.modalElement.style.maxHeight = "80%";
    this.modalElement.style.overflowY = "auto";
    this.modalElement.style.fontFamily = "Arial, sans-serif";
    this.modalElement.style.fontSize = "16px";
    this.modalElement.style.color = "black";
    this.modalElement.style.textAlign = "center";
    this.modalElement.style.lineHeight = "1.5";

    // Now add title
    const divTitle = document.createElement("h2");
    divTitle.innerText = this.title;
    divTitle.style.marginBottom = "10px";
    this.modalElement.appendChild(divTitle);

    // Now add body container
    const divBody = document.createElement("div");
    divBody.style.marginBottom = "10px";
    divBody.style.textAlign = "left";
    divBody.style.width = "100%";
    divBody.style.height = "100%";
    divBody.style.overflowY = "auto";
    divBody.style.overflowX = "hidden";
    divBody.style.padding = "14px";
    divBody.style.color = "black";
    divBody.style.boxSizing = "border-box";
    if (this.bodyElement instanceof Node) {
      divBody.appendChild(this.bodyElement);
    } else {
      const text = document.createElement("p");
      text.innerText = this.bodyElement;
      divBody.appendChild(text);
    }
    // Add element for auto timer (hidden by default)
    const autoCloseTimer = document.createElement("div");
    autoCloseTimer.innerText = `Auto close in ${this.autoCloseDelay} seconds`;
    autoCloseTimer.style.display = "none"; // Hidden by default
    autoCloseTimer.classList.add("hidden");
    divBody.appendChild(autoCloseTimer);
    this._autoCloseElement = autoCloseTimer;
    this.modalElement.appendChild(divBody);

    // Add close button to right top corner
    const closeButton = document.createElement("button");
    closeButton.innerText = "X";
    closeButton.style.position = "absolute";
    closeButton.style.top = "6px";
    closeButton.style.right = "6px";
    closeButton.style.backgroundColor = "red";
    closeButton.style.color = "white";
    closeButton.style.border = "none";
    closeButton.style.borderRadius = "5px";
    closeButton.style.cursor = "pointer";
    closeButton.style.padding = "2px 6px";
    closeButton.style.fontWeight = "bold";
    this.modalElement.appendChild(closeButton);

    // Make background
    this.bgElement = document.createElement("div");
    this.bgElement.className = "audio-selector-modal-bg";
    this.bgElement.style.position = "fixed";
    this.bgElement.style.top = "0";
    this.bgElement.style.left = "0";
    this.bgElement.style.width = "100%";
    this.bgElement.style.height = "100%";
    this.bgElement.style.backgroundColor = "rgba(0, 0, 0, 0.5)";
    this.bgElement.style.zIndex = "9998";
    this.bgElement.style.pointerEvents = "none"; // Disable pointer events for the background
    this.bgElement.style.display = "block";
    this.bgElement.style.overflow = "hidden";

    // Bind events
    const self = this;
    closeButton.addEventListener("click", () => {
      self._removeModal();
      if (typeof self.closeCb === "function") {
        self.closeCb();
      }
    });
  }

  _removeModal() {
    if (this.modalElement) {
      this.modalElement.remove();
      this.modalElement = null;
    }
    if (this.bgElement) {
      this.bgElement.remove();
      this.bgElement = null;
    }
  }

  _updateAutoCloseTimerLabel() {
    if (this._autoCloseElement) {
      this._autoCloseElement.innerText = `Auto close in ${this.autoCloseRemainingSeconds()} seconds`;
      this._autoCloseElement.classList.remove("timer_progress_100");
      this._autoCloseElement.classList.remove("timer_progress_75");
      this._autoCloseElement.classList.remove("timer_progress_50");
      this._autoCloseElement.classList.remove("timer_progress_25");
      this._autoCloseElement.classList.remove("timer_progress_0");
      const currentProgress = this.autoCloseRemainingSeconds() / this.autoCloseDelay * 100;
      if (currentProgress > 80) {
        this._autoCloseElement.classList.add("timer_progress_100");
      } else if (currentProgress > 60) {
        this._autoCloseElement.classList.add("timer_progress_75");
      } else if (currentProgress > 35) {
        this._autoCloseElement.classList.add("timer_progress_50");
      } else if (currentProgress > 15) {
        this._autoCloseElement.classList.add("timer_progress_25");
      } else {
        this._autoCloseElement.classList.add("timer_progress_0");
      }
    }
  }

  show(closeCb = undefined) {
    if (typeof closeCb !== "undefined") {
      this.closeCb = closeCb;
    }
    if (!this.modalElement) {
      this._createModal();
      document.body.appendChild(this.bgElement);
      document.body.appendChild(this.modalElement);
    }
    if (this.autoCloseDelay > 0) {
      this.autoCloseAfter(this.autoCloseDelay);
    }
  }

  close() {
    if (!this.modalElement) return;
    this._removeModal();
    if (typeof this.closeCb === "function") {
      this.closeCb();
    }
  }

  autoCloseAfter(seconds) {
    const self = this;
    this._autoCloseHandler = setTimeout(() => {
      self.close();
    }, seconds * 1000);
    this._autoCloseDate = new Date(Date.now() + seconds * 1000);
    if (this._autoCloseElement) {
      this._autoCloseElement.style.display = "block";
      this._autoCloseElement.classList.remove("hidden");
      this._autoCloseElement.classList.add("timer_progress_100");
      // Periodic update the timer text (every ~250ms)
      this._autoCloseInterval = setInterval(() => {
        self._updateAutoCloseTimerLabel();
      }, 250);
    }
  }

  autoCloseRemainingSeconds() {
    if (this._autoCloseDate) {
      const remainingTime = this._autoCloseDate - Date.now();
      return Math.max(0, Math.ceil(remainingTime / 1000));
    }
    return 0;
  }
}

async function AUDIO_RequestPermission() {
  if (window.hasOwnProperty("AUDIO_REQUESTED") && typeof window.AUDIO_REQUESTED === "boolean") {
    return window.AUDIO_REQUESTED;
  }

  // Try get correct permission (any way in still not implemented)
  try {
    const response = await navigator.permissions.query({ name: "speaker-selection" });
    if (response && response.state === "granted") {
      window.AUDIO_REQUESTED = true;
      return true;
    }
  } catch (err) { }

  // If no - try another way
  if (navigator.mediaDevices?.getUserMedia) {
    try {
      const constraints = { audio: true };
      await navigator.mediaDevices.getUserMedia(constraints);
      window.AUDIO_REQUESTED = true;
      return true;
    } catch (err) { }
  } else {
    console.warn("[AudioSelector] getUserMedia not supported!");
  }

  // Show modal to user with warning info
  // and 5 seconds timer for auto close
  const modal = new Modal("Audio Permission Required", "Please grant audio permission to use this feature.", null, 5);
  modal.show();

  console.warn("[AudioSelector] RequestPermission: no permission granted!");
  window.AUDIO_REQUESTED = false;

  return false;
}

function AUDIO_SaveDeviceLabel(deviceId, label) {
  if (deviceId && label) {
    window.AUDIO_DEVICES = window.AUDIO_DEVICES || {};
    window.AUDIO_DEVICES[deviceId] = label;
  }
}

function AUDIO_GetDeviceLabel(deviceId) {
  if (window.AUDIO_DEVICES && window.AUDIO_DEVICES[deviceId]) {
    return window.AUDIO_DEVICES[deviceId];
  }
  return null;
}

function AUDIO_EnumerateDevices() {
  return new Promise(async (resolve) => {
    await AUDIO_RequestPermission();

    const mediaDevices = {
      audioinput: [],
      audiooutput: [],
      videoinput: [],
    };

    if (navigator.mediaDevices?.enumerateDevices) {
      let result = await navigator.mediaDevices.enumerateDevices();
      if (result.filter((device) => device.kind === "audiooutput").length < 1 && navigator.mediaDevices?.selectAudioOutput) {
        // Still no permission - try to use selectAudioOutput() method
        try {
          await navigator.mediaDevices.selectAudioOutput();
          result = await navigator.mediaDevices.enumerateDevices();
        } catch (err) { }
      }
      result.forEach((device) => {
        if (!device.label || !device.deviceId) return;
        mediaDevices[device.kind] = mediaDevices[device.kind] || [];
        mediaDevices[device.kind].push({
          label: device.label,
          deviceId: device.deviceId,
        });
        AUDIO_SaveDeviceLabel(device.deviceId, device.label);
      });
    }

    resolve(mediaDevices);
  });
}

async function AUDIO_WatchMediaElement(element, id) {
  if (element instanceof HTMLMediaElement) {
    // Always store selected sinkId
    element.setAttribute("data-audio-selector-sink-id", id);

    // Check, maybe me watching it now
    if (element.hasAttribute("data-audio-selector-watching")) return;
    element.setAttribute("data-audio-selector-watching", "true");

    // On emptied event - clear the sinkId
    // It need to fix bug when after change audio source device works incorrectly
    element.addEventListener("emptied", () => {
      element.setSinkId("");
    });
    element.addEventListener("ended", () => {
      element.setSinkId("");
    });

    // And reset sinkId when started
    element.addEventListener("playing", () => {
      element.setSinkId(element.getAttribute("data-audio-selector-sink-id"));
    });

    // Check if the sinkId is different
    if (element.sinkId !== id) await element.setSinkId(id);
  }
}

function AUDIO_GetUsedSinkIds() {
  const usedSinkIds = new Set();
  const elems = document.querySelectorAll("audio, video");
  elems.forEach((el) => {
    if (el.sinkId) usedSinkIds.add(el.sinkId);
  });
  return Array.from(usedSinkIds);
}

function AUDIO_CheckSinkIdOnAll(id) {
  const elems = Array.from(document.querySelectorAll("audio, video"));
  if (elems.length === 0) return false;
  return elems.every((el) => el.sinkId === id);
}

async function AUDIO_SetSinkIdForAll(id) {
  let bResult = true;
  const elems = document.querySelectorAll("audio, video");
  for (let i = 0; i < elems.length; i++) {
    const el = elems[i];
    if (el instanceof HTMLMediaElement) {
      if (el.sinkId !== id) {
        try {
          await AUDIO_WatchMediaElement(el, id);
        } catch (err) {
          bResult = false;
        }
      }
    }
  }
  return bResult;
}

function AUDIO_GetInfo() {
  return new Promise(async (resolve) => {
    const devices = await AUDIO_EnumerateDevices();
    const usedSinkIds = AUDIO_GetUsedSinkIds();

    for (let kind in devices) {
      devices[kind].forEach((device) => {
        device.isUsed = usedSinkIds.includes(device.deviceId);
      });
    }

    return resolve(devices);
  });
}

async function AUDIO_RequestUserSelectDevice() {
  if (navigator.mediaDevices.selectAudioOutput) {
    try {
      const device = await navigator.mediaDevices.selectAudioOutput();
      if (device) {
        AUDIO_SaveDeviceLabel(device.deviceId, device.label || "Default");
        if (AUDIO_CheckSinkIdOnAll(device.deviceId)) {
          return [true, device.label || "Default", device.deviceId];
        }
        if (await AUDIO_SetSinkIdForAll(device.deviceId)) {
          return [true, device.label || "Default", device.deviceId];
        }
      }
    } catch (err) {
      console.error("[AudioSelector] RequestUserSelectDevice error:", err);
    }
  }
  else
  {
    // Make modal dialog with list of devices
    const selectDevices = document.createElement("select");
    selectDevices.style.width = "100%";
    selectDevices.style.padding = "10px";
    selectDevices.style.borderRadius = "5px";
    selectDevices.style.border = "1px solid #ccc";
    selectDevices.style.marginBottom = "10px";
    selectDevices.style.cursor = "pointer";
    // Add options to select
    const genOptions = async () => {
      if (selectDevices.options.length > 0) {
        for (let i = selectDevices.options.length - 1; i >= 0; i--) {
          selectDevices.remove(i);
        }
      }
      
      const devices = await AUDIO_EnumerateDevices();
      const audioOutputDevices = devices.audiooutput || [];

      const defaultOption = document.createElement("option");
      defaultOption.value = "";
      defaultOption.innerText = "Default";
      selectDevices.appendChild(defaultOption);
      audioOutputDevices.forEach((device) => {
        const option = document.createElement("option");
        option.value = device.deviceId;
        option.innerText = device.label || "Default";
        selectDevices.appendChild(option);
      });
    };
    const modal = new Modal("Select audio output device", selectDevices);
    // Bind event to select
    return await (new Promise(async (resolve) => {
      const handle = setTimeout(() => {
        modal.close();
        resolve([false, null, null]);
      }, 30000); // 30 seconds timeout

      selectDevices.addEventListener("change", async (event) => {
        const deviceId = event.target.value;
        if (deviceId) {
          modal.close();
          clearTimeout(handle);
          try {
            const result = await AUDIO_UseDeviceByID(deviceId);
            if (result[0]) {
              resolve(result);
            }
          } catch (err) {
            console.error("[AudioSelector] RequestUserSelectDevice error:", err);
            resolve([false, null, null]);
          }
        }
      });

      navigator.mediaDevices.addEventListener("devicechange", genOptions);

      genOptions();
      modal.show();
    }));
  }
}

async function AUDIO_UseDeviceByID(deviceId, label = "User defined") {
  if (AUDIO_CheckSinkIdOnAll(deviceId)) {
    return [true, AUDIO_GetDeviceLabel(deviceId) || label || "Some AudioOutput Device", deviceId];
  }
  if (await AUDIO_SetSinkIdForAll(deviceId)) {
    return [true, AUDIO_GetDeviceLabel(deviceId) || label || "Some AudioOutput Device", deviceId];
  }

  return [false, null, null];
}

const SelectDevice = async function(label, deviceId) {
  if (!label && !deviceId) {
    return await AUDIO_RequestUserSelectDevice();
  }

  let device = null;
  if (deviceId && navigator.mediaDevices?.selectAudioOutput) {
    try {
      device = await navigator.mediaDevices.selectAudioOutput({ deviceId });
      AUDIO_SaveDeviceLabel(device.deviceId, device.label || label || "Some AudioOutput Device");
    } catch (err) { }
  }

  if (deviceId)
  {
    const result = await AUDIO_UseDeviceByID(deviceId, label);
    if (result[0]) {
      return result;
    }
  }

  if (!device) {
    let devices = await AUDIO_EnumerateDevices();
    // If no - try to find
    if (deviceId) {
      device = devices?.audiooutput?.length > 0 ? devices.audiooutput.find((device) => device.deviceId === deviceId) : null;
    }
    if (!device && label) {
      device = devices?.audiooutput?.length > 0 ? devices.audiooutput.find((device) => device.label.indexOf(label) >= 0) : null;
    }
  }

  if (device) {
    AUDIO_SaveDeviceLabel(device.deviceId, device.label || "Some AudioOutput Device");
    return await AUDIO_UseDeviceByID(device.deviceId, device.label);
  }

  return [false, null, null];
}

function AUDIO_SelectDevice(label, deviceId) {
  return SelectDevice(label, deviceId);
}

}

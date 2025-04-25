// Content script for all tabs to controll audio devices

class Modal{
  constructor(title, bodyElement, closeCb = null) {
    this.title = title;
    this.bodyElement = bodyElement;
    this.closeCb = closeCb;
    this.modalElement = null;
    this.bgElement = null;
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
    this.modalElement.style.padding = "20px";
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
    divTitle.innerText = "Select audio output device";
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
    if (typeof this.bodyElement === "string") {
      const text = document.createElement("p");
      text.innerText = this.bodyElement;
      divBody.appendChild(text);
    }
    else if (this.bodyElement) {
      divBody.appendChild(this.bodyElement);
    }
    this.modalElement.appendChild(divBody);

    // Add close button to right top corner
    const closeButton = document.createElement("button");
    closeButton.innerText = "X";
    closeButton.style.position = "absolute";
    closeButton.style.top = "10px";
    closeButton.style.right = "10px";
    closeButton.style.backgroundColor = "red";
    closeButton.style.color = "white";
    closeButton.style.border = "none";
    closeButton.style.borderRadius = "5px";
    closeButton.style.cursor = "pointer";
    closeButton.style.padding = "5px 10px";
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

  show(closeCb = undefined) {
    if (typeof closeCb !== "undefined") {
      this.closeCb = closeCb;
    }
    if (!this.modalElement) {
      this._createModal();
      document.body.appendChild(this.bgElement);
      document.body.appendChild(this.modalElement);
    }
  }

  close() {
    if (!this.modalElement) return;
    this._removeModal();
    if (typeof this.closeCb === "function") {
      this.closeCb();
    }
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

async function AUDIO_EnumareteDevices() {
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

  return mediaDevices;
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
  const elems = document.querySelectorAll("audio, video");
  let result = elems.length > 0;
  elems.forEach((el) => result = result && el.sinkId === id);
  return result;
}

async function AUDIO_SetSinkIdForAll(id) {
  let bResult = true;
  const elems = document.querySelectorAll("audio, video");
  for (let i = 0; i < elems.length; i++) {
    const el = elems[i];
    if (el.sinkId !== id) {
      try {
        await el.setSinkId(id);
      } catch (err) {
        bResult = false;
        break;
      }
    }
  }
  return bResult;
}

async function AUDIO_GetInfo() {
  const devices = await AUDIO_EnumareteDevices();
  const usedSinkIds = AUDIO_GetUsedSinkIds();

  for (let kind in devices) {
    devices[kind].forEach((device) => {
      device.isUsed = usedSinkIds.includes(device.deviceId);
    });
  }

  return devices;
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
      
      const devices = await AUDIO_EnumareteDevices();
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
    const promise = await (new Promise(async (resolve) => {
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

    return promise;
  }
}

async function AUDIO_UseDeviceByID(deviceId) {
  if (AUDIO_CheckSinkIdOnAll(deviceId)) {
    return [true, AUDIO_GetDeviceLabel(deviceId) || "User defined", deviceId];
  }
  if (await AUDIO_SetSinkIdForAll(deviceId)) {
    return [true, AUDIO_GetDeviceLabel(deviceId) || "User defined", deviceId];
  }

  return [false, null, null];
}

async function AUDIO_SelectDevice(label, deviceId) {
  if (!label && !deviceId) {
    return await AUDIO_RequestUserSelectDevice();
  }

  if (deviceId)
  {
    const result = await AUDIO_UseDeviceByID(deviceId);
    if (result[0]) {
      return result;
    }
  }

  let device = null;
  if (deviceId && navigator.mediaDevices?.selectAudioOutput) {
    try {
      device = await navigator.mediaDevices.selectAudioOutput({ deviceId });
    } catch (err) { }
  }

  if (!device) {
    let devices = await AUDIO_EnumareteDevices();
    // If no - try to find
    if (deviceId) {
      device = devices?.audiooutput?.length > 0 ? devices.audiooutput.find((device) => device.deviceId === deviceId) : null;
    }
    if (!device && label) {
      device = devices?.audiooutput?.length > 0 ? devices.audiooutput.find((device) => device.label.indexOf(label) >= 0) : null;
    }
  }

  if (device) {
    AUDIO_SaveDeviceLabel(device.deviceId, device.label || "Default");
    return await AUDIO_UseDeviceByID(device.deviceId);
  }

  return [false, null, null];
}

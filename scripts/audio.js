// Content script for all tabs to controll audio devices

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

async function AUDIO_EnumareteDevices(video = false) {
  await AUDIO_RequestPermission(video);

  const mediaDevices = {
    audioinput: [],
    audiooutput: [],
    videoinput: [],
  };

  if (navigator.mediaDevices?.enumerateDevices) {
    let result = await navigator.mediaDevices.enumerateDevices();
    result.forEach((device) => {
      if (!device.label || !device.deviceId) return;
      mediaDevices[device.kind] = mediaDevices[device.kind] || [];
      mediaDevices[device.kind].push({
        label: device.label,
        deviceId: device.deviceId,
      });
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

async function AUDIO_RequestUserSelectDevice() {
  if (navigator.mediaDevices.selectAudioOutput) {
    try {
      const device = await navigator.mediaDevices.selectAudioOutput();
      if (device) {
        AUDIO_SaveDeviceLabel(device.deviceId, device.label || "Default");
        if (AUDIO_CheckSinkIdOnAll(device.deviceId)) {
          return [true, device.label || "Default"];
        }
        if (await AUDIO_SetSinkIdForAll(device.deviceId)) {
          return [true, device.label || "Default"];
        }
      }
    } catch (err) {
      console.error("[AudioSelector] RequestUserSelectDevice error:", err);
    }
  }
  else
  {
    // @TODO: Make popup for user to select device
  }

  return [false, null];
}

async function AUDIO_UseDeviceByID(deviceId) {
  if (AUDIO_CheckSinkIdOnAll(deviceId)) {
    return [true, AUDIO_GetDeviceLabel(deviceId) || "User defined"];
  }
  if (await AUDIO_SetSinkIdForAll(deviceId)) {
    return [true, AUDIO_GetDeviceLabel(deviceId) || "User defined"];
  }

  return [false, null];
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

  let devices = await AUDIO_EnumareteDevices();
  let device = null;
  // If no - try to find
  if (deviceId) {
    device = devices?.audiooutput?.length > 0 ? devices.audiooutput.find((device) => device.deviceId === deviceId) : null;
  }
  if (!device && label) {
    device = devices?.audiooutput?.length > 0 ? devices.audiooutput.find((device) => device.label.indexOf(label) >= 0) : null;
  }

  if (device) {
    if (navigator.mediaDevices.selectAudioOutput) {
      try {
        let device2 = await navigator.mediaDevices.selectAudioOutput({ deviceId: device.deviceId });
        if (device2 && device2.deviceId !== device.deviceId) {
          console.log("[AudioSelector] Device ID changed. Old:", device.deviceId, "New:", device2.deviceId);
          device = device2;
        }
      } catch (err) { }
    }
    AUDIO_SaveDeviceLabel(device.deviceId, device.label || "Default");
    return await AUDIO_UseDeviceByID(device.deviceId);
  }

  return [false, null];
}

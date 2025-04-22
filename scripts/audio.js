// Content script for all tabs to controll audio devices

async function AUDIO_EnumareteDevices() {
  if (!navigator.mediaDevices?.enumerateDevices) {
    console.warn("enumerateDevices() not supported.");
    return [];
  }
  let result = await navigator.mediaDevices.enumerateDevices();
  result = result.filter((device) => device.label !== "");
  const mediaDevices = {
    audioinput: [],
    audiooutput: [],
    videoinput: [],
  };
  result.forEach((device) => {
    mediaDevices[device.kind] = mediaDevices[device.kind] || [];
    mediaDevices[device.kind].push({
      label: device.label,
      id: device.deviceId,
    });
  });
  return mediaDevices;
}

async function AUDIO_SelectDevice(label, deviceId) {
  if (!navigator.mediaDevices.selectAudioOutput) {
    console.error("setSinkId not enabled!");
    console.warn(
      "Please set 'media.setsinkid.enabled' to 'true' in 'about:config'!"
    );
    return [false, "SetSinkIdError"];
  }

  async function setSinkIdForAll(id) {
    let bResult = true;
    const elems = document.querySelectorAll("audio, video");
    for (let i = 0; i < elems.length; i++) {
      const el = elems[i];
      if (el.sinkId !== id) {
        await el.setSinkId(id).catch((err) => {
          bResult = false;
        });
      }
    }
    return bResult;
  }
  function checkSinkIdOnAll(id) {
    return document
      .querySelectorAll("audio, video")
      .every((el) => el.sinkId === id);
  }

  let devices = await AUDIO_EnumareteDevices();
  let device = devices?.audiooutput?.length > 0 ? (deviceId ? devices.audiooutput.find((device) => device.deviceId === deviceId) : (label ? devices.audiooutput.find((device) => device.label.indexOf(label) >= 0) : null)) : null;

  if (device) {
    if (checkSinkIdOnAll(device.deviceId)) {
      return [true, device.label];
    }
  }

  if (deviceId) {
    if (await setSinkIdForAll(deviceId)) {
      return [true, label || "user defined"];
    }
  }

  return (device
    ? navigator.mediaDevices.selectAudioOutput({ deviceId: device.deviceId })
    : (deviceId
      ? navigator.mediaDevices.selectAudioOutput({ deviceId: deviceId })
      : navigator.mediaDevices.selectAudioOutput())
  )
    .then((device) => {
      setSinkIdForAll(device.deviceId);
      return [true, device.label];
    })
    .catch((err) => {
      return [false, err.name];
    });
}

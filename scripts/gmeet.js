// Content script for Google Meet
// This script will run on the Google Meet page and inject the necessary functionality:
// - Detect when the user is in a meeting
// - Detect when mic/camera is muted/unmuted
// - Popup messages from chat (TODO)
// This script will communicate with the background script to send messages and perform actions

if (!window._AUDIOSELECTOR_GMEETSUPPORT) {
window._AUDIOSELECTOR_GMEETSUPPORT = true; // Flag to indicate that this script is running

const JOIN_BTN_SELECTOR = '[jsname="Qx7uuf"] button';
const MUTE_BTNS_SELECTOR = '[data-is-muted] > div';
const MIC_BTN_SELECTOR = '[data-is-muted][jsname="hw0c9"] > div';
const CAM_BTN_SELECTOR = '[data-is-muted][jsname="psRWwc"] > div';

// Function for detecting if the user is in a meeting
function GMeet_isInMeeting() {
    // Check if the user is in a meeting by looking for the "Join now" button
    return !document.querySelector(JOIN_BTN_SELECTOR);
}

// Function for joining a meeting
function GMeet_joinMeeting() {
    // Check if the user is in a meeting by looking for the "Join now" button
    const joinBtn = document.querySelector(JOIN_BTN_SELECTOR);
    if (joinBtn) {
        joinBtn.click();
        console.log("[AudioSelector] Joining meeting...");
    } else {
        console.log("[AudioSelector] Already in a meeting or join button not found.");
    }
}

function GMeet_getMutedBtns() {
    // Get the mute button elements
    let result = {
        micBtn: document.querySelector(MIC_BTN_SELECTOR),
        camBtn: document.querySelector(CAM_BTN_SELECTOR),
    };
    
    if (!result.micBtn || !result.camBtn) {
        // Teoretically, there are two buttons: one for mic and one for camera
        // But we have 4 buttons: two for mic and two for camera
        const Btns = document.querySelectorAll(MUTE_BTNS_SELECTOR);
        if (Btns.length === 2) {
            result.micBtn = result.micBtn || Btns[0];
            result.camBtn = result.camBtn || Btns[1];
        } else if (Btns.length === 4) {
            result.micBtn = result.micBtn || Btns[0];
            result.camBtn = result.camBtn || Btns[2];
        } else {
            return null;
        }
    }

    return result;
}

// Function for detecting if mic/camera is muted or not
// return true if muted, false if not muted
function GMeet_getMutedState(btns) {
    btns = btns || GMeet_getMutedBtns();
    // Check if the mic and camera buttons are muted or not
    const micMuted = (btns && btns.hasOwnProperty("micBtn") && btns.micBtn) ? btns.micBtn.parentElement.dataset.isMuted === 'true' : false;
    const camMuted = (btns && btns.hasOwnProperty("camBtn") && btns.camBtn) ? btns.camBtn.parentElement.dataset.isMuted === 'true' : false;
    return { micMuted, camMuted };
}

// Function for getting the current state of the meeting
// return { title: "string", inMeeting: true/false, micMuted: true/false, camMuted: true/false }
function GMeet_getState() {
    const inMeeting = GMeet_isInMeeting();
    const mutedState = GMeet_getMutedState();
    // Get title of the meeting
    const title = document.title || 'Google Meet';
    return { title, inMeeting, ...mutedState };
}

// Function for switching the mic muted state
// return true if mic set to muted, false if set to unmuted
function GMeet_switchMic() {
    const btns = GMeet_getMutedBtns();
    if (btns && btns.micBtn) {
        btns.micBtn.click();
        console.log("[AudioSelector] Switching mic state...");
        return btns.micBtn.parentElement.dataset.isMuted === 'true';
    } else {
        console.warn("[AudioSelector] Mic button not found!");
    }

    return false;
}

// Function for switching the camera muted state
// return true if camera set to muted, false if set to unmuted
function GMeet_switchCam() {
    const btns = GMeet_getMutedBtns();
    if (btns && btns.camBtn) {
        btns.camBtn.click();
        console.log("[AudioSelector] Switching camera state...");
        return btns.camBtn.parentElement.dataset.isMuted === 'true';
    } else {
        console.warn("[AudioSelector] Camera button not found!");
    }
    return false;
}

};

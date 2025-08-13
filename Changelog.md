# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## v0.3

### **v0.3.2** - 2025-08-13

- **Added**
  - Added support for the **Opera** browser.
  - A banner image has been added.
  - Google Meet support is now enabled by default upon installation.
  - The `Open in shortcuts settings` button for Chrome is now enabled.
  - The extension now watches for shortcut changes to automatically update and display them on the options page.
  - The options page opens automatically upon installation.
- **Changed**
  - "google meet" was replaced with "meet" in the shortcut descriptions.
- **Fixed**
  - The auto-selection of audio devices for tabs with auto-play has been fixed.
  - Several minor potential issues were addressed.
  - The width of input fields on the options page was corrected.
  - The updating of the state in the Meet supports table has been fixed.
  - The shortcut for joining Google Meet was fixed.

### **v0.3.1** - 2025-08-12

- **Added**
  - The extension now watches for shortcut changes to automatically update and display them on the options page.
  - The options page opens automatically upon installation.
- **Fixed**
  - The auto-selection of audio devices for tabs with auto-play has been fixed.
  - Several minor potential issues were addressed.
  - The width of input fields on the options page was corrected.
  - The updating of the state in the Meet supports table has been fixed.
  - The shortcut for joining Google Meet was fixed.

### **v0.3.0** - 2025-08-12

- **Added**
  - A button for manually requesting permissions was added.
- **Removed**
  - The requirement for the `<all urls>` permission was removed.
- **Changed**
  - The style of the options page was updated.
  - The logic for the options page was refactored.
- **Fixed**
  - The selection of the active Meet tab for commands was fixed.
  - An issue with the incorrect output device after changing the audio source was fixed.
  - The tooltip for the `no-permission` status was corrected.
  - A bug with removing rows was fixed.
  - Issues with updating the state of rows and table actions were resolved.

## v0.2

### **v0.2.3** - 2025-05-02

- **Fixed**
  - The selection of the active Meet tab for commands was fixed.

### **v0.2.2** - 2025-04-28

- **Added**
  - Added support for the **Chrome** browser.
  - Screenshots were added to the repository.
- **Fixed**
  - The functionality of the "remove pattern" button was fixed.
- **Changed**
  - The options page received minor restyling.

### **v0.2.1** - 2025-04-25

- **Fixed**
  - The functionality for switching to a Meet tab was fixed.

### **v0.2** - 2025-04-25

- **Added**
  - A custom modal dialog was implemented for requesting an audio output device when `selectAudioOutput()` is not available.
  - The ability to enable or disable support for different meeting tabs was added to the settings.
- **Removed**
  - The 512px icon was removed to reduce the extension size.
  - The ability to change shortcuts from settings was removed, as the browser has a native implementation for this.
- **Changed**
  - The logic for permission requests and device selection was refactored and fixed.
  - The options page was converted into a tab.
  - Informative logs were added.
- **Fixed**
  - The permission request for enumerating devices was fixed.
  - An issue with removing patterns and the use of `innerHTML` was fixed.

## v0.1

### **v0.1** - 2025-04-22

- **Added**
  - Initial version of the extension was implemented.
  - Core features were implemented: switching to a Google Meet tab, muting/unmuting the mic for an active Meet tab without switching, and selecting the audio output device for a tab.
  - An experimental feature for automatic audio output selection based on URL patterns was added.

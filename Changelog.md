# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/), and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## **v0.3.2** - 2025-08-13

- **Added**
  - `Open in shortcuts settings` button enabled for Chrome.
  - Added watching for shortcut changes to update the options page automatically.
  - The options page now opens automatically upon installation.
- **Fixed**
  - Corrected issues with input field widths on the options page.
  - Fixed the logic for automatically selecting an audio device for tabs with auto-play.
  - Addressed minor potential issues and fixed the joining Google Meet shortcut.
  - Fixed updating the state in the Meet supports table.

## **v0.3.1** - 2025-08-12

- **Added**
  - Enabled Google Meet support by default on installation.
  - Support for the Opera browser.
  - Banner image added.
  - The options page now updates the device list when opened.
- **Changed**
  - Replaced "google meet" with "meet" in shortcut descriptions.
  - The options page was refactored into modular scripts for better organization and maintainability.
- **Fixed**
  - Fixed an issue where the output device would be incorrect after changing the audio source.
  - Fixed Chrome compatibility issues.
  - Fixed an issue with selecting the output device for patterns in Firefox.

## **v0.3.0** - 2025-08-12

- **Added**
  - A button for manually requesting permissions was added.
  - Implemented a refactored logic for the options page.
- **Removed**
  - The requirement for the `<all_urls>` permission was removed; permissions are now requested only when needed.
- **Fixed**
  - The `no-permission` tooltip was corrected.
  - The state of rows and table actions was fixed.
  - Corrected an issue with removing rows.
  - Fixed the issue with selecting the active meet tab for commands.

## **v0.2.2** - 2025-04-28

- **Fixed**
  - Fixed the action for the remove pattern button.
- **Changed**
  - Minor restyling of the options page was performed.

## **v0.2.1** - 2025-04-25

- **Fixed**
  - Corrected the functionality for switching to a meet tab.

## **v0.2** - 2025-04-25

- **Added**
  - A custom modal was implemented for selecting an audio output device when the `selectAudioOutput()` API is unavailable.
  - The ability to enable or disable support for different meeting tabs was added to the settings.
  - Informative logs were added.
  - The settings page was changed to a tab.
- **Changed**
  - The logic for permission requests and device selection was refactored and fixed.
  - A list of all shortcuts was added to the settings, as the browser now has a native implementation for changing them.
- **Removed**
  - The 512px icon was removed to reduce the extension size.

---

## **v0.1** - 2025-04-22

- **Added**
  - Initial implementation of the extension.
  - Core features implemented: switching to a Google Meet tab, muting/unmuting the mic for an active Meet tab without switching, and selecting the audio output device for a tab.
  - An experimental feature for automatic audio device selection by URL patterns was added.

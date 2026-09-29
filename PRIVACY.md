# Privacy Policy – Kuma Glance

_Last updated: 2026-09-29_

Kuma Glance is a Stream Deck plugin that shows the monitors of **your own Uptime Kuma server** on your Stream Deck. This page explains which data the plugin handles. In short: the plugin only talks to the Uptime Kuma server you configure, and nothing is sent to the author or to any third party.

## Data the plugin stores

| Data | Where | Why |
| --- | --- | --- |
| Uptime Kuma server URL | Stream Deck plugin settings on your computer (stored by the Stream Deck app in the system's credential store, e.g. the macOS Keychain) | To connect to your server |
| Uptime Kuma login token | Same as above | To stay logged in without storing your password |
| Key settings (selected monitor, tag, displayed value, press action) | Stream Deck profile on your computer | To show the right monitor on each key |

Your **password** and **2FA code** are only sent once to your Uptime Kuma server to obtain the login token. They are never stored.

Monitor data (names, tags, status, ping, uptime, heartbeats) is kept in memory only while the plugin runs and is not written to disk.

## Data the plugin sends

- The plugin connects **only to the Uptime Kuma server URL you enter**, using the same Socket.IO interface as the Uptime Kuma web interface. It reads your monitors and, if you configure a key for it, pauses or resumes a monitor.
- Pressing a monitor key in a tag folder opens that monitor's page on your Uptime Kuma server in your default browser.
- There is **no analytics, no telemetry, no advertising and no connection to servers of the author** or any other third party.

## Logs

The plugin writes a small log file on your computer (in the plugin's `logs` folder), used for troubleshooting only. It contains the connection state, error messages from Uptime Kuma and, when a tag summary key is pressed, the tag name and the Stream Deck device ID and type. The log never contains your password or login token and is not sent anywhere.

## Deleting your data

- **Log out** in the settings of any Kuma Glance key: the login token is removed from the plugin settings. Changing your Uptime Kuma password also invalidates existing login tokens.
- **Uninstall** the plugin in the Stream Deck app to remove the plugin, its settings and logs.

## Third parties

- **Uptime Kuma** is your own, self-hosted server; its handling of data is up to you as the operator.
- **Elgato / Stream Deck app**: installing plugins through the Elgato Marketplace and running the Stream Deck app are subject to [Elgato's privacy policy](https://www.elgato.com/privacy-policy).

## Contact

Questions about privacy: please open an issue at <https://github.com/kirkanos/kuma-glance/issues>.

# Elgato Marketplace listing

Texts and assets for the Kuma Glance listing in the [Maker Console](https://maker.elgato.com). Keep this file in sync with the listing when submitting updates.

Name and monetization cannot be changed in the Maker Console after the first submission.

## Name

Kuma Glance

## Description

Maximum 1,500 characters (currently 1,323).

```text
Keep an eye on your self-hosted services without opening a browser. Kuma Glance shows your Uptime Kuma monitors live on your Stream Deck – status, ping and uptime at a glance.

MONITOR KEYS
• Background color shows the status: up, down, pending, maintenance or paused
• Current ping, average ping (24h) or uptime (24h / 30 days) – press the key to switch
• A heartbeat strip with the latest checks, just like in the Uptime Kuma dashboard
• Optionally pause and resume a monitor with a key press

TAG SUMMARIES & TAG FOLDERS
• One key per Uptime Kuma tag with an up/down ring chart – it turns red as soon as something is down
• Press it to open a folder with a key for every monitor of that tag, with paging for large tags
• A press on a monitor opens its page in Uptime Kuma

DIALS
• On Stream Deck + and + XL: turn a dial to browse your monitors, the touch strip shows name, value and heartbeats

WORKS WITH
• Uptime Kuma 1.x and 2.x, including two-factor authentication
• Stream Deck, Mini, XL, Neo, +, + XL and Corsair Galleon 100 SD
• macOS and Windows

PRIVACY
Kuma Glance connects only to your own Uptime Kuma server. Your password is used once to log in and is never stored. No telemetry.

Ideal for homelabs, self-hosting, sysadmins and DevOps teams.

Unofficial plugin, not affiliated with the Uptime Kuma project.
```

Not verified on real hardware or servers yet: two-factor login, and the tag folders for Mini, XL, +, Galleon 100 SD (see [TAG_FOLDERS.md](TAG_FOLDERS.md)).

## Tags

Stream Deck, Stream Deck +, Stream Deck XL, Stream Deck Mini, Stream Deck Neo, Stream Deck + XL, macOS, Windows; themes such as Productivity / Developer Tools, depending on what the Maker Console offers.

## Links

| Link | URL |
| --- | --- |
| Support | https://github.com/kirkanos/kuma-glance/issues |
| Setup guide | https://github.com/kirkanos/kuma-glance#readme |
| Privacy policy | https://github.com/kirkanos/kuma-glance/blob/main/PRIVACY.md |

## Assets

All images are 1920 × 960 PNG, rendered from the real key and dial renderers with `npm run preview`.

| Use | File |
| --- | --- |
| Thumbnail | [gallery/1-overview.png](gallery/1-overview.png) |
| Gallery 1 | [gallery/1-overview.png](gallery/1-overview.png) |
| Gallery 2 | [gallery/2-tag-folder.png](gallery/2-tag-folder.png) |
| Gallery 3 | [gallery/3-states.png](gallery/3-states.png) |
| Gallery 4 | [gallery/4-dials.png](gallery/4-dials.png) |

## Product file

`com.kirkanos.kuma-glance.streamDeckPlugin` from the [latest GitHub release](https://github.com/kirkanos/kuma-glance/releases/latest), built by the release workflow for tags like `v2.2.1`.

## Release notes

First submission:

```text
First Marketplace release: monitor keys with status, ping, uptime and heartbeat strip, tag summaries with tag folders, dial support for Stream Deck + and + XL.
```

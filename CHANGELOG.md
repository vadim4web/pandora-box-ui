# Changelog

## 0.2.0

- Added independent Normal, Clip and true alpha Cutout modes for text and icons, embedded SVG masks and mask scale/position/opacity controls.
- Added menu counts 2–9, per-item labels/URLs/SVGs/masks/variables, and retained inactive items when reducing the count.
- Added direct plain-text label editing in an explicit Edit Mode, with Enter to commit and Escape to cancel.
- Shared item normalization, SVG/URL sanitization, HTML generation and CSS mask generation between Playground and CLI.
- Preserved separate editable Monaco drafts/applied snapshots, upgraded exports to JSON v3 and kept older configuration support.
- Added optional CLI `--html` output, portable CSS-only mask delivery, configuration examples for 2/5/9 items and expanded configuration tests.
- Preserved original projection, independent idle/hover materials, side-only sibling shading, root override priority and runtime independence from Playground JavaScript.
- Corrected unpublished package metadata to retain `private: true`.
- Clipped hidden upper-face paint so adjacent surfaces cannot fill cutout openings; retained exposed ledges during hover.
- Resolved sibling-based palette progress on the item before inheritance so front, side and top use the same active item's color.
- Fixed the Monaco worker base URL, added a local development server and real browser tests, including pixel checks for transparent text/icon openings and JavaScript-free consumer pages.

## 0.1.6

- Made all three Monaco tabs independently editable, applicable and persistent.
- Added HTML/Core preview overrides, root JSON/CSS detection at npm install, a build CLI and layered defaults for root configuration priority.

## 0.1.5

- Added Monaco editing, CSS/JSON exports and a standalone CSS distribution bundle.

## 0.1.4

- Added collapsible settings and separate color pickers.

## 0.1.3

- Added independent metal and hover palette presets.

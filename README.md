# Pandora menu prototype

A CSS pseudo-3D menu, prepared for the next step: packaging `pandora-menu` as a library.

## Structure

- `pandora-menu.css`: component geometry, faces, colors and animations, scoped to `.pandora-menu` and `.pandora-menu__item`.
- `demo.css`: page background, viewport fitting and the six demo items' configuration.
- `index.html`: the demo markup. Open it directly or serve this directory as a static site.

The demo's stylesheet URLs include their Git blob IDs to refresh cached styles after publication. Update the matching `v` query token in `index.html` when changing a stylesheet.

The component CSS does not style the host page's `body`, unrelated lists or global pseudo-elements. It inherits its font size from its container; the demo applies the responsive scale.

## Configuration

Each item uses CSS custom properties for its icon, accent hue/lightness, optional top-face color and stacking layer. Higher `--pandora-menu-layer` values belong to earlier items. The demo keeps these settings together in one rule per item.

Set the shared `--pandora-menu-*` properties on a menu instance to adjust its neutral colors, accent saturation, hover offset or transition durations. Reduced-motion preferences disable transitions automatically.

### Face lighting

Neutral and highlighted items use the same lighting model. Each face is derived from that item's current front color with [`color-mix(in srgb)`](https://developer.mozilla.org/en-US/docs/Web/CSS/Reference/Values/color_value/color-mix):

| Property | Default | Effect |
| --- | --- | --- |
| `--pandora-menu-top-light` | `15%` | Mix white into the top face. |
| `--pandora-menu-side-shade` | `25%` | Mix black into the side face. |
| `--pandora-menu-occlusion-shade` | `37.5%` | Mix black into sides below the highlighted item. |
| `--pandora-menu-edge-light` | `12%` | Mix white into front and side edges. |

With the default `#808080` front, the resting top is approximately `#939393`, the side `#606060`, and an occluded side `#505050`. These are color mixing weights, not percentages of physical luminance. Calculations live on each item so per-item themes and hover states recalculate all faces together.

Optional exact-color overrides are `--pandora-menu-top`, `--pandora-menu-side`, `--pandora-menu-occluded-side`, and per-item `--pandora-menu-item-top`. Highlighted faces accept `--pandora-menu-accent-top-color` and `--pandora-menu-accent-side-color`. The demo uses the shared lighting ratios throughout.

## Geometry notes

The menu uses `em` dimensions so its faces scale together. Keep the top-face correction `calc(100% + 0.125em - 1px)` and transform order when changing the implementation. The demo's `body` and scene both match the viewport width; mobile text inflation is controlled in `demo.css`.

Adjacent items overlap by `--pandora-menu-item-overlap` (default `1px`). Set it to `0px` for the original spacing, or adjust it on a menu instance to tune row density.

Hover translates the complete item, including both pseudo-element faces. `--pandora-menu-hover-offset` defaults to `-5%` of the item's width and controls the shared slide distance.

Navigation destinations, keyboard interaction, dynamic item generation and package exports belong to the library implementation step.

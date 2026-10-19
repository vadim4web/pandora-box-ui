# Pandora menu prototype

A CSS pseudo-3D menu, prepared for the next step: packaging `pandora-menu` as a library.

## Structure

- `pandora-menu.css`: component geometry, faces, colors and animations, scoped to `.pandora-menu` and `.pandora-menu__item`.
- `demo.css`: page background, viewport fitting and the six demo items' configuration.
- `index.html`: the demo markup. Open it directly or serve this directory as a static site.

The component CSS does not style the host page's `body`, unrelated lists or global pseudo-elements. It inherits its font size from its container; the demo applies the responsive scale.

## Configuration

Each item uses CSS custom properties for its icon, accent hue/lightness, optional top-face color and stacking layer. Higher `--pandora-menu-layer` values belong to earlier items. The demo keeps these settings together in one rule per item.

Set the shared `--pandora-menu-*` properties on a menu instance to adjust its neutral colors, accent saturation, hover offset or transition durations. Reduced-motion preferences disable transitions automatically.

## Geometry notes

The menu uses `em` dimensions so its faces scale together. Keep the top-face correction `calc(100% + 0.125em - 1px)` and transform order when changing the implementation. The demo's `body` and scene both match the viewport width; mobile text inflation is controlled in `demo.css`.

Navigation destinations, keyboard interaction, dynamic item generation and package exports belong to the library implementation step.

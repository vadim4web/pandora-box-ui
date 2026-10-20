# Menu rendering and editable configuration

## CSS surfaces and alpha

Normal mode preserves legacy markup and geometry. New exported links contain a `.pb-menu__label` span. Their front finish is painted by the link's separate `::before` surface. The item's `::before` still paints the side, and its `::after` still paints the top using the original projection matrices.

Text cutout applies an inverse SVG alpha mask to the front paint. Icon cutout applies an inverse SVG alpha mask to the side paint. Visible label/icon paint is hidden in cutout mode; the corresponding surface has actual transparent pixels. The mask is applied to that individual surface rather than the whole item, preserving the other faces and the 3D transforms. Both `mask-image` and `-webkit-mask-image` are emitted. The inverse alpha is generated inside a self-contained SVG, so the runtime does not depend on differences between CSS `mask-composite` operators.

Clip retains the surface and masks only the visible text/icon paint. Text uses the optional custom SVG mask or the item's icon. Icon clip paints its SVG shape in the selected independent icon color. Scale and X/Y position adjust the SVG mask; opacity controls clipped paint or cutout strength.

Masks use embedded data URLs. No external SVG request, editor script or font-icon package is needed on a production page. SVG input supports self-contained paths, circles, rectangles, lines, ellipses, polygons, polylines and groups with safe presentation attributes. Arbitrary SVG text, definitions, filters, embedded images, external references, scripts and events are removed. The component generates its own trusted inverse-mask definitions separately. The sanitized shape markup is the exported source.

## Typography and advanced overrides

Text cutout glyphs are baked into an SVG during export/build using the configured `--pb-menu-font-family`, `--pb-menu-font-weight` and `--pb-menu-width`, or the component defaults: Georgia/Times serif, weight 800, spacing `.075ch` and 8.5em width. `--pb-menu-font-size` is used to resolve supported pixel/rem widths, and `--pb-menu-icon-size` controls baked icon openings. Per-item variables override global variables for this calculation. Platform font fallback can slightly change glyph appearance. Normal and clipped text remain ordinary live text.

Supply typography/width/icon-size through saved JSON `variables` or per-item variables before regenerating masks. The helper understands plain `em`, `px` and `rem` widths; advanced expressions and arbitrary Core CSS layout changes can change the relationship between live geometry and a precomputed cutout. Generated masks scale with the painted face; changing only a stylesheet after export can stretch an existing mask. Changing text or mask controls in the Playground regenerates its masks. An arbitrary production CSS declaration does not rerun the build helper.

The label remains in accessible link text even when its visible paint is removed. Playground Edit Mode temporarily exposes all labels so clipped or cutout text can be edited. CSS masking support is required for clip/cutout effects; test the target browser when using these optional modes.

## Saved state

`state.itemCount` is the active count, clamped to 2–9. `state.items` holds up to nine item records, including inactive trailing records. Each record contains:

```json
{
  "label": "Projects",
  "url": "/projects",
  "icon": "<svg viewBox=\"0 0 24 24\"><path d=\"M3 5h18v14H3z\"/></svg>",
  "mask": null,
  "variables": {"--pb-menu-text": "#ffffff"}
}
```

The shared global controls are `textMode`, `iconMode`, `maskScale` (0.25–3), `maskX`/`maskY` (0–100), and `maskOpacity` (0–1). Text/icon colors use separate idle/hover tokens. Metal controls the idle material and five palette anchors control active hover colors. They remain independent of modes and geometry.

Reducing the active count retains the tail in state/JSON, and increasing it restores the records before adding defaults. The runtime HTML contains only active items. CSS samples the five palette anchors across the actual count, and descending item layers keep a later top face from covering the preceding label.

JSON v3 saves all state plus separate Config/HTML/Core drafts and applied snapshots. A draft can differ from the preview. Control synchronization preserves manual drafts and reports the difference; explicit code regeneration is the point at which a draft is replaced. For a portable production result, save the matching HTML and Config CSS, or use the CLI's CSS plus optional HTML output. Keep JSON as the editable source, especially when reducing the count.

## Browser review checklist

For each count 2–9, inspect idle/hover/focus state, top/side overlap and ground shadow. Exercise all three modes on both text and icons, custom SVG masks, scale/position/opacity and a patterned backdrop visible through cutouts. Commit and cancel direct text edits; paste formatted content and verify plain text only. Apply each Monaco tab, protect a dirty draft while using controls, and round-trip JSON/CSS/HTML. Finally check keyboard links, small screens, reduced motion, a generated CLI page and a base-plus-config page without Playground JavaScript.

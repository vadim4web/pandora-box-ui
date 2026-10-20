# PandoraBox UI · v0.2.0

A CSS-only pseudo-3D navigation menu with independent idle metals, hover palettes, text/icon colors, SVG clipping and transparent cutouts. The standalone Playground provides Monaco editors and editable menu items. Production pages need only the exported HTML and CSS.

Repository: [vadim4web/pandora-box-ui](https://github.com/vadim4web/pandora-box-ui). The current Playground is in `demo/`; the earlier root-level prototype is retained for compatibility.

**Live demo:** [PandoraBox UI Playground](https://vadim4web.github.io/pandora-box-ui/demo/).

## Playground

From this source checkout, run `npm run demo` and open `http://localhost:8765/demo/`. In Windows PowerShell, use `npm.cmd` if local execution policy blocks `npm.ps1`. Alternatively serve `demo/index.html` with VS Code Live Server. A custom static server must serve `.mjs` files with a JavaScript MIME type. The first panel, **Code · Monaco Editor**, starts open. Other settings remain collapsible. Monaco loads from a pinned CDN; an editable textarea retains Apply, Save and import/export when the CDN is unavailable.

Choose **2–9 items** with the count control or Add/Remove. Edit each item's label, URL, SVG icon, optional custom SVG mask and CSS variables. Reducing the count hides the trailing items while retaining their saved data; increasing it restores them. New items receive a label, fragment URL and built-in icon.

Enable **Edit Mode** to edit labels directly in the preview. Only the text span becomes `contenteditable`; links do not navigate during editing. Enter commits, Escape restores the label from the start of that edit, and paste inserts plain text. Changes update the saved menu state and generated HTML. Disable Edit Mode for ordinary link and keyboard navigation.

### Rendering modes

Text and icons have independent **Normal / Clip / Cutout** selectors.

| Mode | Text | Icon |
|---|---|---|
| Normal | Ordinary text with idle/hover text colors. | Inline SVG with independent idle/hover icon colors. |
| Clip | Text is visible only inside the item's SVG alpha mask. | Icon color is painted through its SVG alpha mask. |
| Cutout | Letter shapes remove alpha from the front surface. | SVG shapes remove alpha from the side surface. |

Use a built-in icon or provide a self-contained SVG mask. Mask scale, X/Y position and opacity control the mask. Cutout opacity controls the depth of the transparent opening: 1 removes the surface completely inside the mask, and 0 leaves it opaque. Cutouts reveal the actual page content behind the painted face. The component does not paint a background-colored imitation of an opening.

The side/top faces, hover motion, lighting and ground shadow retain their existing projection. Five palette anchors are interpolated across the actual item count. Hover changes the active item's finish; following items only receive the intended side-face shading. Reduced-motion preferences disable component motion.

### Monaco and draft synchronization

All three tabs remain writable and apply to the live preview:

| Tab | Apply effect | Save filename |
|---|---|---|
| Config CSS | Applies project tokens and authored overrides. Recognized tokens update controls. | `pandora-menu.config.css` |
| HTML | Applies safe navigation/SVG markup and updates menu content. | `pandora-menu.html` |
| Core CSS | Applies edited component CSS over the default core. | `pandora-menu.core.css` |

Each tab keeps a separate draft, applied snapshot and editor history. **Apply** affects the active tab. **Save** downloads its current draft; it does not overwrite a project file. `Ctrl/Cmd+S` saves, and `Ctrl/Cmd+Enter` applies. **Copy CSS** copies Config CSS; **Copy code** copies the active tab.

Controls update generated code while keeping manually edited drafts available. The editor reports when a draft differs from the preview. An explicit regeneration action requests confirmation before replacing a manual draft. Export JSON saves menu state, inactive items, all three documents and their applied/draft status. Import accepts JSON, CSS and HTML. Applied JSON version 3 settings reproduce the preview; pending code drafts remain pending. Legacy version 2 JSON retains its earlier draft-first CSS compilation behavior.

## Configuration and npm

The package is private and unpublished. Test it locally with `npm pack`; use the resulting tarball in a consuming app. No package publication is performed by the build.

```text
my-site/
├── package.json
├── pandora.config.json   # optional structured settings
├── pandora.config.css    # optional final overrides
└── src/
```

Minimal `pandora.config.json`:

```json
{
  "format": "pandora-box-ui",
  "version": 3,
  "state": {
    "metal": "titanium",
    "palette": "aurora",
    "itemCount": 2,
    "textMode": "normal",
    "iconMode": "normal",
    "maskScale": 1,
    "maskX": 50,
    "maskY": 50,
    "maskOpacity": 1,
    "items": [
      {"label": "Home", "url": "/"},
      {"label": "Work", "url": "/work"}
    ]
  },
  "variables": {
    "--pb-menu-hover-text": "#fff5dd",
    "--pb-menu-hover-offset": "-7%"
  }
}
```

An item may also contain `icon` (SVG string), `mask` (SVG string or null) and `variables` (its own `--pb-menu-*` declarations). Omitted icons use defaults. Counts are normalized to 2–9, modes to supported values and mask controls to their ranges. Up to nine items are retained, including inactive trailing items. Only safe SVG shapes/attributes and safe navigation URLs are kept; unsupported SVG scripts, embedded HTML, event handlers and external references are removed. JSON is data; no JavaScript configuration is evaluated.

Geometry, animation, font and additional component tokens can be set through `variables` or `pandora.config.css`. Variable names must begin with `--pb-menu-`; declaration values cannot inject additional CSS rules.

```css
/* pandora.config.css — final project priority */
.pb-menu {
  --pb-menu-text: #f4f4fa;
  --pb-menu-hover-offset: -8%;
}
```

Priority from low to high is library defaults/presets in `@layer pandora-base`, applied Core CSS in `@layer pandora-custom-core`, generated menu state/item masks, JSON variables, applied Playground Config CSS, then root `pandora.config.css`. Project overrides are unlayered and override library selectors without `!important`. JSON v3 uses `documents.config.applied`, or a clean draft when no applied snapshot exists. Legacy `css` and v2 document exports remain supported.

### Generate production CSS and optional HTML

```bash
npx pandora-box-ui build --out ./src/pandora-box-ui.css
npx pandora-box-ui build --out ./public/menu.css --html ./public/menu.html
```

`--root path` selects another consuming project root. `--out path` selects CSS output. `--html path` additionally writes a standalone HTML example with the saved item content and a relative link to that CSS. The generated page includes no runtime JavaScript. Custom layout or other manually authored HTML from Monaco can be saved from the HTML tab and integrated into your app separately.

Import the generated CSS in a bundler, or link it from HTML:

```js
import './pandora-box-ui.css';
```

For an ordinary tarball/registry install with lifecycle scripts enabled, `postinstall` also detects root configs and compiles the installed package's `dist/pandora-box-ui.css`. It changes only packaged CSS. Development symlinks and installs with scripts disabled use the explicit CLI. Regenerate after changing root settings.

```js
import 'pandora-box-ui/pandora-box-ui.css';
```

## Direct CSS and CDN

Copy `dist/pandora-box-ui.css`, save/export the Playground HTML and Config CSS, and load the Config CSS after the base. No npm CLI is required for this route.

```html
<link rel="stylesheet" href="/assets/pandora-box-ui.css">
<link rel="stylesheet" href="/assets/pandora.config.css">
```

A versioned npm CDN URL becomes usable only after the package is actually published under that name and version. A static CDN cannot read a local `pandora.config.json`: deploy the exported stylesheet beside the base, or deploy combined CSS generated by the CLI. Playground JavaScript and Monaco are never required on the production page.

Existing markup with text directly inside `.pb-menu__link` continues to work in normal mode. New exports wrap labels in `.pb-menu__label`, which supports editing and rendering modes. Use exported HTML and its matching configuration CSS together for clip/cutout modes.

## Examples and checks

- [Two items](examples/items-2/pandora.config.json): normal text and icons.
- [Five items](examples/items-5/pandora.config.json): clipped text, icon cutouts and a custom mask.
- [Nine items](examples/items-9/pandora.config.json): text cutouts, independent colors and saved per-item variables.
- [Static HTML](examples/basic.html) and [root override example](examples/configured-project/pandora.config.json).
- [Rendering and configuration details](docs/RENDERING.md), [distribution notes](docs/PUBLISHING.md), [changelog](CHANGELOG.md).

To try a configuration directory from this source checkout:

```bash
node bin/pandora-box-ui.mjs build --root examples/items-5 --out menu.css --html menu.html
```

```bash
npm run build
npm test
npm run check
npm pack --dry-run
```

Node tests cover counts 2–9, every text/icon mode pair, item retention, SVG/URL sanitization, JSON/CSS priority, applied versus pending drafts and generated consumer HTML/CSS. Visual checks additionally need a real browser to inspect cutout transparency, projected faces, editing, keyboard focus, mobile layout and reduced motion. See [docs/PUBLISHING.md](docs/PUBLISHING.md) for release verification.

The optional Playwright suite is `npm run test:browser`. Setup and the verified 0.2.0 results are in [docs/TESTING.md](docs/TESTING.md).

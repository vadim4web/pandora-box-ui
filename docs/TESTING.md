# Verification for 0.2.0

Verified on 20 October 2026 using Node 22.20.0, npm 10.9.3 and installed Google Chrome 155 through Playwright on Windows.

The following pass:

- `npm run build`, `npm test`, and `npm run check`.
- `npm run test:browser`: 58 checks, including direct root hosting, English-only UI/accessibility labels, the old URL redirect, exact default-theme CSS tokens and Reset behavior; all 72 combinations of 2–9 items and independent text/icon modes; descending stacking and original face matrices; hover and side-only shading; keyboard links and reduced motion. Every position in each menu count is checked against its expected OKLCH palette sample.
- Pixel checks show actual red and blue scene backgrounds through text and icon openings on the first, middle and last rows. Hidden adjacent top faces no longer fill the openings.
- Enter/Escape, plain-text paste, preview-to-HTML/state synchronization, retained hidden items, editable Config/HTML/Core documents, manual-draft preservation and custom token/material changes.
- CSS/JSON imports, export contents and browser reload restoration; real CDN-backed Monaco and offline textarea fallback.
- Layout at 320, 375, 768 and 1440 pixels. Screenshots were reviewed for 2/5/9 items and Normal/Clip/Cutout, plus hover samples at every count.
- Combined CLI HTML/CSS and separate base/config stylesheets render 2/5/9 items with JavaScript disabled.
- `npm pack` produces the local 0.2.0 tarball. Installing that tarball in a separate test app applies root JSON and final-priority root CSS during postinstall. The installed CLI emits companion HTML and CSS from those external files.
- `npm publish --dry-run` passes with the public registry/access metadata and the release lifecycle hooks; it does not upload the package.

Firefox, Safari, physical mobile devices and a published npm/CDN release were not tested. The package metadata is ready for public npm publication; an actual registry release has not been performed by these checks. Mobile coverage uses Chrome viewport emulation. Advanced layout/typography changes in hand-authored Core CSS should be visually checked after regenerating cutout masks; see [RENDERING.md](RENDERING.md).

## Run the optional browser suite

Install the test-only tool separately from the production package:

```sh
npm install --prefix .tmp/browser-tools --no-audit --no-fund --ignore-scripts playwright
npm run test:browser
```

On Windows the suite uses installed Google Chrome by default. Set `PANDORA_BROWSER` to another Chromium executable if necessary. On platforms without an installed browser, install Playwright's Chromium first:

```sh
npm exec --prefix .tmp/browser-tools -- playwright install chromium
npm run test:browser
```

The suite starts and closes its own local server and browser. Reports, screenshots and static consumer fixtures are written under `.tmp/browser-results/`, which is ignored by Git and excluded from the npm tarball. No production JavaScript dependency is added.

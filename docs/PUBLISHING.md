# Distribution and publishing · PandoraBox UI

The project is configured for public publication as `pandora-box-ui@0.2.0`. The publishing metadata is ready. Building, testing and packing do not publish to npm.

| Metadata | Value |
| --- | --- |
| Name / current version | `pandora-box-ui` / `0.2.0` |
| Author / license | `vadim4web` / `MIT` |
| Repository | `git+https://github.com/vadim4web/pandora-box-ui.git` |
| Homepage | `https://vadim4web.github.io/pandora-box-ui/` |
| Issues | `https://github.com/vadim4web/pandora-box-ui/issues` |
| Publish registry / access | `https://registry.npmjs.org/` / `public` |

The blocking `private:true` field has been removed. `publishConfig` targets the public npm registry. `prepublishOnly` runs the build, Node tests and package checks before publication. The runtime tarball includes CSS, CLI/build helpers, examples and documentation; it excludes the Playground page, temporary files, credentials and browser-test artifacts.

## Publish the demo

The live Playground is [https://vadim4web.github.io/pandora-box-ui/](https://vadim4web.github.io/pandora-box-ui/). GitHub Pages publishes the root of `main`. The root `index.html` contains the full app and loads assets from `demo/`, `src/` and `scripts/` using paths that work under the repository's Pages URL. The old `/demo/` URL redirects to the root. The earlier prototype is archived at `examples/legacy-prototype.html`.

## First npm publication

Create an npm account and enable two-factor authentication. Interactive publication requires 2FA; see [npm's authentication requirements](https://docs.npmjs.com/requiring-2fa-for-package-publishing-and-settings-modification/).

From the source checkout, use these commands in Windows PowerShell. Use `npm` instead of `npm.cmd` in other shells:

```powershell
npm.cmd login --registry=https://registry.npmjs.org/
npm.cmd whoami
npm.cmd view pandora-box-ui version --registry=https://registry.npmjs.org/
```

Check the registry immediately before publishing. A 404 means there is no visible registered package under that name; it does not reserve the name. If a package exists, verify that your npm account owns it. Your npm username can differ from your GitHub username. Keep the unscoped `pandora-box-ui` name unless you also update the CLI/postinstall paths and documented imports for a rename.

When the package name is confirmed:

```powershell
npm.cmd run prepublishOnly
npm.cmd pack --dry-run
npm.cmd publish --dry-run
npm.cmd publish --access public
npm.cmd view pandora-box-ui@0.2.0 version dist.tarball
```

Run each command after the preceding command succeeds. Inspect the file list and confirm version `0.2.0` before the real publish. `npm publish --dry-run` validates the publishing flow without uploading the package. `npm publish --access public` performs the upload; complete npm's authentication/2FA prompt. No metadata edits or removal of `private` are required. Demo deployment does not publish the npm package.

After a successful publication, the package page will be `https://www.npmjs.com/package/pandora-box-ui`. Test it in a consuming app:

```powershell
npm.cmd install pandora-box-ui@0.2.0
```

```js
import 'pandora-box-ui/pandora-box-ui.css';
```

For direct CDN use after publication:

```html
<link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/pandora-box-ui@0.2.0/dist/pandora-box-ui.css">
```

Include matching navigation HTML and any exported project configuration stylesheet. The runtime requires no Playground JavaScript.

## Publish an update

Start from a clean checkout. Update the code and CHANGELOG, then increment the version:

```powershell
npm.cmd version patch
npm.cmd run prepublishOnly
npm.cmd publish --access public
git push origin main --follow-tags
npm.cmd view pandora-box-ui version
```

Use `minor` or `major` instead of `patch` when appropriate. `npm version` creates the version commit and tag; `--follow-tags` uploads them after publication succeeds. An already published name/version cannot be reused. Consuming apps install the new version through their normal dependency update process. See [npm's publishing guide](https://docs.npmjs.com/creating-and-publishing-unscoped-public-packages/) for registry and authentication details.

## Separate runtime and development tools

The runtime is the CSS component and its presets. `dist/pandora-box-ui.css` and `dist/pandora-box-ui.base.css` are self-contained base stylesheets. Generated per-item SVG masks are CSS data URLs. Application HTML contains navigation links, label spans and SVG icons. Production pages need no JavaScript, Monaco, mask generator or Playground code.

The root Playground uses assets in `demo/` to edit content/settings and three independent code documents. The dependency-free Node module `scripts/menu-model.mjs` is shared by the browser tool and the build compiler so generated masks and item data use the same rules. It runs during development/build only. CLI and compiler files are included in npm's package so consumer builds can read root configuration.

## Root configuration priority

`pandora.config.json` and `pandora.config.css` are read from the selected application root. The root CSS file has final priority. The build emits:

1. Defaults and preset rules in `@layer pandora-base`.
2. Applied `documents.core.applied` in `@layer pandora-custom-core`.
3. Unlayered generated item/mask rules and JSON `state` tokens.
4. JSON `variables` (overriding state tokens).
5. Applied Playground Config CSS.
6. Root `pandora.config.css`.

Unlayered project declarations override normal declarations in either library layer, even when library selectors are more specific. No `!important` is required. User-supplied Core CSS can intentionally change component behavior; it remains below project overrides.

Version 3 JSON distinguishes a pending Config CSS draft from the applied snapshot. A nonempty `documents.config.applied` is used; when none exists, only a clean draft is used. A dirty unapplied draft stays out of the compiled preview. Legacy v2 uses `documents.config.draft` first, and older `css` strings remain supported. Applied HTML is an application document: the CSS compiler does not inject it into an existing application.

JSON is parsed as data. No `.js` configuration is evaluated. Global variables accept only `--pb-menu-*` names and scalar declaration values. Unsafe declaration separators fail the build. SVG and item URL inputs use the shared allowlist sanitizer.

## CLI and install behavior

```bash
npx pandora-box-ui build --root . --out ./public/menu.css --html ./public/menu.html
```

The CSS output merges base, generated masks and project overrides. Optional `--html` writes a standalone HTML example generated from the saved menu state, including active items and their URLs/icons. Its link to the CSS is relative to the HTML output directory. Without `--html`, application HTML is untouched. Save manually authored Monaco HTML separately when your app uses a custom layout.

An ordinary npm tarball/registry install may also run `postinstall`, using npm's `INIT_CWD` to discover root config. It writes only the installed package's combined `dist/pandora-box-ui.css`; no consumer source files change. No config means defaults. A development symlink is left untouched. With lifecycle scripts disabled or a symlink install, use the CLI explicitly. Regenerate after config changes; import or link the exact generated stylesheet.

## Verification before a release

```bash
npm run build
npm test
npm run check
npm pack --dry-run
npm pack
```

Install the produced tarball in a temporary consuming project containing root JSON and CSS configs. Verify the installed CSS includes both and root CSS is last. Run the CLI with and without `--html`, open the generated page, and repeat with npm scripts disabled. Confirm development symlinks do not change library sources. Test valid and invalid configs, no config, applied Core CSS, pending drafts and item counts 2–9.

Node tests exercise all 72 item-count/text-mode/icon-mode combinations, retained trailing items, SVG/URL sanitization, safe tokens, configuration priority, versioned draft behavior and generated consumer artifacts. Browser verification must also cover actual alpha transparency over a patterned backdrop, projected faces, sibling shading, editing/undo, Monaco synchronization, desktop/mobile layout, keyboard focus and reduced motion. Node string assertions do not establish visual correctness.

## CDN and archives

A static archive can use copied `dist/pandora-box-ui.css` plus exported Config CSS and HTML. A published version can use a versioned npm CDN base stylesheet and a hosted configuration stylesheet after it. CDN delivery does not depend on npm lifecycle scripts and cannot discover a local config file. The complete merged CSS generated by the CLI may also be hosted as a single stylesheet.

Keep SVG data URLs intact when processing/minifying CSS. The optional `PandoraBox menu data` comment supports Playground CSS round-tripping; removing it does not affect runtime masks, but JSON remains the complete editable source for item restoration.

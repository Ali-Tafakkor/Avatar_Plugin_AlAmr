# Bundles and product data

Read this when creating a product, choosing assets or changing storage. Al-Amr
distributes the product's built files as an immutable archive. Desktop downloads,
verifies and stores the admitted bytes, then serves them through its local product
origin. A publisher's development server is not the released frontend.

## Choose the right product boundary

| Kind               | Owns                                                                 | Receives from the platform                                      |
| ------------------ | -------------------------------------------------------------------- | --------------------------------------------------------------- |
| App                | Its responsive content, product data and optional backend            | An independent product view and injected `window.alamr`         |
| Web Environment    | Its scene, rendering, semantic places and Plugin composition         | A destination with the injected Runtime API                     |
| Plugin             | Its declared adapters, contributions and optional backend components | Installation-scoped ports from a compatible host                |
| Native Environment | Its exported executable and target-specific assets                   | Managed launch; the declared native connection contract, if any |

Every App supports Compact. Workspace is optional; both use the same document.
Desktop owns the surrounding controls, focus and exit. Do not mount a second
platform Widget. An Environment owns its rendering and scene; no particular
engine or rendering package is required. A browser Plugin is a trusted library
inside its host's JavaScript context, not an isolated security sandbox.

The web Runtime recipes apply to Apps and web Environments. A native export with
`connection:none` has no `window.alamr` or web readiness callback. Use the
[native publication path](https://agent.al-amr.com/docs/publish/native-publishing.md) for native exports;
Hampa v1 admits compatible managed web bundles, not Native Environments.

## Spend bytes where they improve the product

Bundle the code, fonts, images, audio and models the product needs when their
licenses permit it. A larger useful local bundle can be better than repeated
network requests. Do not introduce a CDN or remote font merely to imitate a
website's first-download budget. Fetch genuinely remote or changing content
through the product's declared services.

Keep three costs separate:

- Download, verification and disk storage of each new bundle.
- Startup work: parsing code, decoding media and preparing the first usable view.
- Ongoing CPU/GPU, memory and battery use, including background Apps.

Load optional large assets when needed. Stored compressed bytes are not decoded
texture or audio memory. Local installation does not guarantee network services
or current authorization while offline; handle their actual Runtime results.
The client's cached bytes are not a promise of permanent backup or access to a
withdrawn product.

Current web bundle ceilings are different for an App and a world:

| Bundle      | Compressed total | Uncompressed total | One file | File count |
| ----------- | ---------------- | ------------------ | -------- | ---------- |
| App         | 256 MiB          | 256 MiB            | 64 MiB   | 512        |
| Environment | 256 MiB          | 1 GiB              | 128 MiB  | 20,000     |

These are validation limits, not size targets. The installed validator is the
authority if the client changes. Plugin and native artifact profiles have their
own limits; do not apply this table to them.

## Build for the local origin

The bundle entry is `index.html` at its root. Ship referenced assets under the
output directory and use paths that work at the product's local origin. Put
scripts in files: product content policy does not allow inline executable scripts.
Use the real Desktop preview to catch missing assets, blocked requests and
assumptions about HTTP origins. Browser-only success does not establish that.

In a no-build starter, `dist/` is authored source and belongs in version control.
In a project with a build, edit its authored source and rebuild `dist/`; do not
patch generated output and call that a durable fix. Desktop opens built bytes;
it does not run or watch the project's dev server.

## Prepare presentation media

Every new product needs its own public card image. `alamr create` supplies a
working placeholder, but replace it with artwork that identifies this product
before submitting a release. Check the built or packaged bytes, not only the
source design file. PNG and JPEG are supported, up to 2 MiB per image.

| Product     | Manifest field                                                          | Where the file goes                                                                     | Image geometry                                                                              |
| ----------- | ----------------------------------------------------------------------- | --------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Environment | `portal.art.imageUrl` and a meaningful `portal.art.alt`                 | Inside built `dist/`, at the relative path named by `imageUrl`                          | Landscape: 800–2048 px wide, 400–1365 px high, aspect ratio 1.5–2; 16:9 is a useful target. |
| App         | `presentation.iconUrl`                                                  | Inside built `dist/`, at the relative path named by `iconUrl`                           | Square, 128–1024 px per side.                                                               |
| Plugin      | `presentation.icon.path`, `contentType`, `digest`, and meaningful `alt` | In the package at the relative path named by `path`; include it in `package.json.files` | Square, 128–1024 px per side.                                                               |

For a no-build starter, replace `dist/environment-cover.jpg`,
`dist/app-icon.png`, or root `plugin-icon.png` directly. With a build system,
put the designed source in the project's normal assets, make the build copy it
to the declared output path, and inspect the final output. When changing a
Plugin icon, update its SHA-256 `digest` and `contentType` in the manifest.
`alamr validate --json` checks the local image bytes, size and shape, and warns
if the bundled image is still the starter placeholder. Check the warning even
when validation succeeds. The Registry verifies publication bytes again.
For a Native Environment, put the cover inside the exported folder and follow
the [native publication path](https://agent.al-amr.com/docs/publish/native-publishing.md); its cover is
not a web `dist/` asset.

## Keep user data outside release content

The bundle is the application, not a writable user database. Use product-owned
browser storage or a backend as appropriate. Browser storage can be unavailable
or cleared; implement an honest unavailable/quota state and export or recovery
when the feature needs it. No platform-wide product storage API is implied.

Scope account data by the current product identity and verified actor; do not
show a former account's cached private content while a new identity is loading.
Store no account credential, session token, send token or private key in browser
storage, logs or the release. Pure device-local data and account-owned data may
have different lifetimes; choose deliberately.

Product updates must handle existing saved data, including failed migrations.
Save recoverable work during editing; the bounded exit callback cannot protect
against every crash. Ending membership or Hampa removes current authority but
does not automatically delete the product's archives, downloaded files or drafts.
Shared state requires the product's own protocol or backend; local storage does
not synchronize different people's devices.

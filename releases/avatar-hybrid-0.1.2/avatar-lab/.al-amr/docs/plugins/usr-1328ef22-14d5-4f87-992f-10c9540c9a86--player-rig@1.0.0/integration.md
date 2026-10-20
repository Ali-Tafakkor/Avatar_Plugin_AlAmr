# آواتار 1.0.0

نمایش آواتارها و کنترل حرکت، پرواز و دوربین اول‌شخص و سوم‌شخص در محیط‌ها.

## Immutable release

- Plugin ID: `plg_0bec7e8e-8852-4f44-9446-f5df278ab59e`
- Release ID: `rel_7ba7cc86-b078-42bf-8f76-c43c898cfd54`
- Version: `1.0.0`
- Publisher documentation: [README.md](./README.md) — how to use this Plugin, written by its publisher
- Release manifest: [manifest.json](./manifest.json)

## Package artifacts

The package import specifier is the Registry-reviewed `packageName`; do not substitute a source-workspace package name. `packageSpec` identifies the exact install bytes.

| Provider | packageName | packageSpec | Integrity |
| --- | --- | --- | --- |
| al_amr | `@al-amr-community/usr-1328ef22-14d5-4f87-992f-10c9540c9a86--player-rig` | `https://new-registry.al-amr.com/v1/packages/sha512/d025483d83637d22f55114229a5a843d409ca247288aa9e5f1b4a886d5b10c8a73eecddcf5e71f886c2dea4df2d2c751e773071c5b6cc204a047833f0b231679.tgz` | `sha512-0CVIPYNjfSL1URQimlqEPUCcokcoiqnl8bSohtWxDIpz7s3c9ecfiGwt6k3y0sdR53MHHFtswgSgR4M/CyMWeQ==` |

## Install into a compatible host

A compatible App or Environment installs this release through one adapter. The installation goes in `plugins` in `al-amr.app.json` or `al-amr.environment.json`:

```json
{
  "integrationKind": "frontend_adapter",
  "pluginId": "plg_0bec7e8e-8852-4f44-9446-f5df278ab59e",
  "releaseVersion": "1.0.0",
  "adapterId": "r3f"
}
```

- `releaseVersion` is this exact version; ranges are refused.
- `adapterId` is one of `r3f`; a host installs a Plugin through one adapter.
- `environmentConfig` is optional: a JSON object of at most 8 KiB, validated against the Plugin's `environmentConfigSchema` when it declares one.

Do not write the entry by hand. In the consuming project run:

```sh
alamr add usr-1328ef22-14d5-4f87-992f-10c9540c9a86/player-rig@1.0.0 --json
alamr validate --json
```

`alamr add` writes this entry and the exact `package.json` dependency, prints the install command to run next, and runs `alamr docs sync`, which copies the README.md, integration.md, manifest.json and types.d.ts of every installed release into `.al-amr/docs/plugins/` and points the project's `AGENTS.md` at them.

## Trust and compatibility preflight

- Runtime class: `trusted_library` (trusted library code in the host App or Environment; not a JavaScript sandbox)
- Kind: `frontend_only`
- Contracts: `^1.0.0`
- Platform permissions: none declared
- Browser requirements: none declared
- Direct network origins: none declared
- Collected data: none declared
- Shared data: none declared

## Machine-readable release artifacts

- Reviewed TypeScript declaration: [types.d.ts](./types.d.ts)

## Frontend adapters

| Adapter ID | Runtime | Export path | Exports | Capabilities | Host kinds | Required host ports |
| --- | --- | --- | --- | --- | --- | --- |
| `r3f` ([types](./types.d.ts?adapter=r3f)) | `react-three-fiber` | `.` | `PlayerRig`, `PlayerAvatar`, `PlayerAvatarAnchor`, `PlayerAvatarOverlay`, `PlayerAvatarFleet`, `PlayerAvatarFleetOverlay`, `PLAYER_AVATAR_FLEET_CAPACITY`, `PLAYER_AVATAR_ANCHORS`, `avatarOutfitFor`, `fleetAppearanceForSeed`, `DEFAULT_AVATAR_OUTFIT`, `applyPlayerAvatarLocomotion`, `createAvatarAnimationDriver`, `createPlayerController`, `createPlayerStateSource`, `createLocalReplicaSource`, `createPlayerKeyActionMap`, `DEFAULT_PLAYER_INPUT_BINDINGS`, `usePlayerSnapshot`, `usePlayerPose`, `usePlayerCamera`, `createFlatNavigationSurface`, `playerRigPluginManifest`, `PLAYER_RIG_PLUGIN_ID`, `DEFAULT_AVATAR_ANIMATION_OPTIONS`, `DEFAULT_PLAYER_CAMERA_CONFIG`, `shouldRenderLocalAvatar`, `stepPlayerCamera`, `computeCameraTransform`, `stepCameraFollowTransform`, `DEFAULT_PLAYER_MOVEMENT_CONFIG`, `isPlayerGrounded`, `stepPlayerMovement`, `AVATAR_SHIRT_COLORS`, `AVATAR_TROUSER_COLORS`, `AVATAR_HAIR_COLORS`, `AVATAR_SKIN_COLORS`, `AVATAR_SHOE_COLORS`, `AVATAR_ACCENT_COLORS`, `AVATAR_OUTFIT_COMBINATIONS`, `PLAYER_AVATAR_ROOT_NAME`, `PLAYER_AVATAR_HEIGHT`, `PLAYER_AVATAR_HEAD_NAME`, `PLAYER_AVATAR_JOINT_NAMES`, `PLAYER_AVATAR_FLEET_HIGH_CAPACITY`, `PLAYER_AVATAR_FLEET_MEDIUM_CAPACITY`, `PLAYER_AVATAR_FLEET_LOW_CAPACITY`, `reconcileFleetDescriptors`, `reconcileFleetSlots` | `render:3d`, `player:movement`, `player:camera`, `avatar:attachment-surfaces`, `avatar:instanced-fleet` | `environment` | none declared |

## Semantic composition surfaces

The host is the compositor. Providers define semantic mount points; contributors provide content for a compatible surface without importing the provider Plugin.

| Direction | Surface | Adapter | Export | Description |
| --- | --- | --- | --- | --- |
| provides | `avatar.overhead` | `r3f` | `PlayerAvatarOverlay` | RTL-safe fixed-pixel semantic overhead surface for centered Environment-composed identity labels and Plugin actions. |
| provides | `avatar.fleet` | `r3f` | `PlayerAvatarFleet` | Instanced high/medium/low LOD fleet renderer with one frame sampler and capacity for 160 stable replica slots. |
| provides | `avatar.fleet-overhead` | `r3f` | `PlayerAvatarFleetOverlay` | One fullscreen DOM projection surface for up to 24 fleet identity labels. |

## Semantic behavior ports

The Environment resolves and owns these bindings. Matching compares interface/version, lifecycle, cardinality, actor-correlation policy, and protocol artifact digest before Plugin code is loaded.

| Direction | Port | Adapter | Interface | Version | Lifecycle | Cardinality | Actor correlation | Binding/export | Protocol |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| provides | `local-replica` | `r3f` | `spatial.local-replica-source` | `2.0.0` | `scope` | `one` | `none` | `createLocalReplicaSource` | `local-replica-schema` |
| provides | `player-state` | `r3f` | `spatial.player-state-source` | `1.0.0` | `scope` | `one` | `none` | `createPlayerStateSource` | `player-state-schema` |
| requires | `remote-replicas` | `r3f` | `spatial.remote-replica-source` | `^2.0.0` | `scope` | `one` | `actor_key` | `remoteReplicaSource` | `remote-replica-schema` |

## Import examples

These imports use the selected Registry artifact package name: `@al-amr-community/usr-1328ef22-14d5-4f87-992f-10c9540c9a86--player-rig`.

### r3f (react-three-fiber)

```ts
import * as PluginAdapter from "@al-amr-community/usr-1328ef22-14d5-4f87-992f-10c9540c9a86--player-rig";

// Runtime values are available on PluginAdapter. The reviewed declaration
// names (runtime values plus structural TypeScript bindings) are listed above
// and in types.d.ts; type-only declarations do not exist at runtime.
void PluginAdapter;
```


## Verified protocol artifacts

The Managed Store artifact validator recomputes each digest from package bytes. Registry metadata alone is not integrity evidence. Read these files from the exact installed package at the listed package-relative paths. A protocol named openapi.json there is the author's contract; this catalogue's openapi.json is the separate Registry grant API.

| ID | Kind | Specification | Package path | SHA-256 digest |
| --- | --- | --- | --- | --- |
| `player-state-schema` | `json_schema` | `2020-12` | `./protocol/player-state.schema.json` | `sha256:40714a846f0b6b0d64f3a82c788f800ca73e39fc9e7f8408d0e2ab777fcb443b` |
| `local-replica-schema` | `json_schema` | `2020-12` | `./protocol/local-replica.schema.json` | `sha256:bbdac5411de7f5070ff8a8035f6a590abf5d22ed3e89b9a3fbbb9a2673e7ef7d` |
| `remote-replica-schema` | `json_schema` | `2020-12` | `./protocol/remote-replica.schema.json` | `sha256:246e750e4f9b8a6dda070a55d0770bfd43fadc3ea482ac3c5d6ee846afe1fc7a` |

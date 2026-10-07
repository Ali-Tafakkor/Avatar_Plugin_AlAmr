# Player Rig

Local player movement, flight and a third/first-person camera for a React Three
Fiber Environment, plus an instanced renderer for up to 160 remote avatars. It
gives the Environment one external player store, an articulated 1.78 m default
avatar, semantic avatar anchors and overlay surfaces, and allocation-free
transform sampling for a network transport. It does not own terrain, collision
authority, world routing, portals, presence or networking: the Environment
supplies a `NavigationSurface`, and replication comes from a separate Plugin
such as Multiplayer. It is frontend-only, requests no platform permission and
contacts no service.

## This repository

The Player Rig Plugin is its own repository and depends on no Al-Amr package.
The platform reaches it through publication, never as a workspace (ADR-0159),
and what a product needs from the platform at runtime arrives injected on
`window.alamr` (ADR-0155) — `alamr.d.ts` beside this file is its declaration.

It was copied out of the platform monorepo (`gitlab.al-amr.com/AliAsgary/al-amr`)
at commit `3ad2452ed`, whose tag `platform-split-base` is the last one that still
held the products. The full history stays there; `git filter-repo --path
plugins/player-rig --path-rename plugins/player-rig/:` at that tag rebuilds it
here if it is ever wanted.

## Install

Install the published release with `alamr add <publisher>/player-rig@1.0.0 --adapter r3f`, using the publisher handle shown in the Registry catalogue. Run the install command it prints. The CLI writes the exact Plugin ID, release and package dependency into the host; do not copy a development Registry's IDs.

The import specifier in the examples below, `PLAYER_RIG_PACKAGE`, is a placeholder: replace it with the reviewed `packageName` from the release's `integration.md`. `alamr docs sync` keeps that documentation under `.al-amr/docs/plugins/<publisher>--player-rig@<version>/`.

Peer dependencies: `react >=19 <19.3`, `three >=0.185.1 <0.186.0`,
`@react-three/fiber >=9.6.1 <10`, `@react-three/drei >=10.7.7 <11`.

## Settings

None. The Plugin declares no `settings` and no `environmentConfig`.

## Use in an Environment

### Controller and rig

Create the controller once, outside the Canvas, so a renderer retry or device
loss does not reset the player and a DOM HUD can read the same store.

The Environment owns the canvas. It must render with `WebGPURenderer` from
`three/webgpu` (WebGPU, or its WebGL2 backend), because the rig's materials are
TSL node materials; a classic `WebGLRenderer` draws nothing. Disable any other
camera controls: the rig drives the camera.

```tsx
import { Canvas } from "@react-three/fiber";
import { WebGPURenderer } from "three/webgpu";
import {
  PlayerRig,
  createFlatNavigationSurface,
  createPlayerController,
  usePlayerSnapshot,
} from "PLAYER_RIG_PACKAGE";

const player = createPlayerController({ position: [0, 0, 8], yaw: 0 });
const navigation = createFlatNavigationSurface(0); // demos only

const createRenderer = async ({ canvas }: { canvas: HTMLCanvasElement }) => {
  const renderer = new WebGPURenderer({ canvas, antialias: true });
  await renderer.init();
  return renderer;
};

export function World() {
  return (
    <Canvas gl={createRenderer}>
      <PlayerRig controller={player} navigation={navigation} />
    </Canvas>
  );
}

export function Hud() {
  const { pose, camera } = usePlayerSnapshot(player);
  return (
    <output>
      {pose.mode} / {camera.mode}
    </output>
  );
}
```

Render exactly one `PlayerRig` per locally controlled player. It installs
keyboard, pointer and wheel listeners, advances the controller every frame and
drives the R3F camera, so disable any other camera controls.

`PlayerRig` props:

| Prop               | Type                                     | Effect                                                                                                                                                        |
| ------------------ | ---------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `controller`       | `PlayerController`                       | Required external store.                                                                                                                                      |
| `navigation`       | `NavigationSurface`                      | Required Environment-owned ground, landing, collision and camera queries.                                                                                     |
| `movement`         | `Partial<PlayerMovementConfig>`          | Overrides `DEFAULT_PLAYER_MOVEMENT_CONFIG` (speeds, gravity, `acceleration`, `deceleration`, `airControl`, `groundAdhesion`, `maxSubstepSeconds`, body size). |
| `camera`           | `Partial<PlayerCameraConfig>`            | Overrides `DEFAULT_PLAYER_CAMERA_CONFIG` (distances, first-person thresholds, pitch limits, sensitivity, eye height).                                         |
| `inputBindings`    | `PlayerInputBindings`                    | Replaces an action's `KeyboardEvent.code` list; an empty list disables it.                                                                                    |
| `avatar`           | `ReactNode`                              | Replaces the default avatar; the node is positioned, rotated and hidden in first person for you.                                                              |
| `outfit`           | `AvatarOutfit`                           | Dresses the default avatar. Pass `avatarOutfitFor(self.actorKey)` so the local player matches what every peer renders. Ignored with `avatar`.                 |
| `enabled`          | `boolean` (default `true`)               | `false` stops input and per-frame simulation.                                                                                                                 |
| `paused`           | `boolean` (default `false`)              | Releases input to another surface; movement and camera input stop, but `controller.teleport(...)` still moves the avatar and snaps the camera.                |
| `onInteract`       | `(snapshot) => void`                     | Called when the `interact` key goes down (not on key repeat). The rig never navigates by itself.                                                              |
| `onAnimationFrame` | `(locomotion: AvatarLocomotion) => void` | Receives the exact locomotion applied to the local avatar each frame.                                                                                         |

Default bindings (`DEFAULT_PLAYER_INPUT_BINDINGS`): `WASD`/arrows move relative
to the camera, `Shift` sprint or flight boost, `Space` jump or ascend, `Ctrl`
descend, `F` enter flight or request/cancel a safe landing, `E` interact. Right
mouse drag orbits; the wheel changes distance and blends into first person.
Keys typed into inputs, textareas, selects and content-editable elements are
ignored. `createPlayerKeyActionMap(overrides)` builds the same lookup for
control hints or a custom input layer.

`PlayerController` exposes `getSnapshot`/`subscribe`,
`getPoseSnapshot`/`subscribePose`, `getCameraSnapshot`/`subscribeCamera`,
`teleport(position, yaw?)`, `setAction`, `resetInput`, `requestInteraction` and
`getDiscontinuityId()`. Snapshots are frozen. React hooks: `usePlayerSnapshot`,
`usePlayerPose` (pose only) and `usePlayerCamera` (camera only, for HUDs that
should not re-render on every step). Always move a player across a gap with
`teleport`: it increments the discontinuity counter that network transports
use to hard-snap instead of interpolating.

### NavigationSurface

```ts
interface NavigationSurface {
  sampleGround(position: Vector3Tuple): NavigationPoint | null; // feet point at x/z
  sampleLanding(position: Vector3Tuple, maxDistance: number): NavigationPoint | null;
  resolveMovement?(request: MovementResolutionRequest): Vector3Tuple; // bounds, obstacles
  resolveCamera?(request: CameraResolutionRequest): Vector3Tuple; // pull camera in front of scenery
}
```

Return finite points. `createFlatNavigationSurface(groundHeight, bounds?)` is a
development surface; production worlds implement their own terrain, roads,
skyways and collision.

### Avatar anchors and overlays

Never copy avatar dimensions into Environment or other Plugin code; read the
semantic anchors instead.

- `PLAYER_AVATAR_ANCHORS`: `root`, `chest`, `head`, `overhead` offsets.
- `PlayerAvatarAnchor anchor offset?`: a group at an anchor, for world-scaled 3D
  content.
- `PlayerAvatarOverlay` (provides surface `avatar.overhead`): a fixed-pixel,
  RTL-safe DOM label mounted inside the `PlayerAvatar` it describes. Props:
  `anchor` (default `overhead`), `offset`, `visible`, `zIndexRange`, `style`.
  The wrapper sets `pointer-events: none`; give interactive children
  `pointer-events: auto`.

```tsx
<PlayerAvatar bodyColor={outfit.shirtColor} skinColor={outfit.skinColor}>
  <PlayerAvatarOverlay>
    <div className="label" style={{ pointerEvents: "auto" }}>
      <span>{profile.displayName}</span>
      {callAction}
    </div>
  </PlayerAvatarOverlay>
</PlayerAvatar>
```

A contributing Plugin exports its content (for example a call button); the
Environment places it inside the overlay. No Plugin imports Player Rig to mount
itself.

### Remote avatars: `PlayerAvatarFleet`

`PlayerAvatarFleet` (surface `avatar.fleet`) renders every remote replica from
one frame callback into 15 fixed `InstancedMesh` groups. By camera distance,
replicas within `highDistance` render as complete people (nearest 24 at most),
within `mediumDistance` as medium capsules (48 at most), the rest as low
capsules.
`PlayerAvatarFleetOverlay` (surface `avatar.fleet-overhead`) projects up to 24
DOM labels through one fullscreen root. Transform packets never cause React
renders; only directory changes do.

```tsx
import { useCallback } from "react";
import {
  PlayerAvatarFleet,
  PlayerAvatarFleetOverlay,
  fleetAppearanceForSeed,
  type RemoteReplicaSource,
} from "PLAYER_RIG_PACKAGE";

function RemotePlayers({ source }: { source: RemoteReplicaSource }) {
  const appearance = useCallback(
    (member: { actorKey: string }) => fleetAppearanceForSeed(member.actorKey),
    [],
  );
  return (
    <>
      <PlayerAvatarFleet source={source} resolveAppearance={appearance} />
      <PlayerAvatarFleetOverlay
        source={source}
        renderLabel={(member) => member.profile.displayName ?? "Guest"}
      />
    </>
  );
}
```

`PlayerAvatarFleet` props: `source` (required), `visible` (default `true`),
`highDistance` (default 25 m), `mediumDistance` (default 60 m), `castShadows`
(default `false`; affects only the full-detail group), `resolveAppearance`
(`FleetAppearance`, including `hidden`), `resolvePosePreset` (`scale`,
`verticalOffset`, e.g. for seating). Keep both resolvers referentially stable:
a new function re-resolves every replica.

`PlayerAvatarFleetOverlay` props: `source`, `maximumLabels` (default and
maximum 24), `maximumDistance` (default 35 m), `visible`,
`selectedReplicaIds` (always ranked first), `className`, `renderLabel`
(default: display name or `"Guest"`). Each label element is `dir="auto"` with
`pointer-events: auto`.

Appearance: `avatarOutfitFor(seed)` deterministically derives shirt, trousers,
hair, shoes, accent and skin from any stable string; the scoped `actorKey` is
the intended seed, so every client dresses the same person the same way with no
protocol field. `fleetAppearanceForSeed(seed)` returns the same outfit in
`FleetAppearance` form. An empty seed yields `DEFAULT_AVATAR_OUTFIT`.

### Semantic ports

The Environment binds ports in its manifest `compositionPlan`; Player Rig never
imports another Plugin.

| Direction | Port id           | Interface                              | Export / binding                       | Correlation |
| --------- | ----------------- | -------------------------------------- | -------------------------------------- | ----------- |
| provides  | `local-replica`   | `spatial.local-replica-source@2.0.0`   | `createLocalReplicaSource(controller)` | none        |
| provides  | `player-state`    | `spatial.player-state-source@1.0.0`    | `createPlayerStateSource(controller)`  | none        |
| requires  | `remote-replicas` | `spatial.remote-replica-source ^2.0.0` | `remoteReplicaSource` (optional)       | `actorKey`  |

- `createLocalReplicaSource(controller).sampleInto(target)` writes position,
  quaternion, linear velocity, `movementMode` (`grounded | flying`) and the
  uint32 discontinuity counter into caller-owned arrays. It allocates nothing.
- `createPlayerStateSource(controller)` returns
  `{ getSnapshot, getPosition, subscribe, setAnimationSnapshot, close }`. The
  snapshot has position, velocity, heading, mode and animation, and no account
  identifier. Pass `playerState.setAnimationSnapshot` to
  `PlayerRig onAnimationFrame` so consumers see the applied locomotion.
- The required port is the structural `RemoteReplicaSource` accepted by
  `PlayerAvatarFleet source` and `PlayerAvatarFleetOverlay source`: `list`,
  `getMember`, `sampleInto`, `subscribeDirectory`, `getDirectorySnapshot`.
  The Environment may wrap it with its own rules before passing it in.

With Multiplayer (and Media, which binds no port):

```json
{
  "compositionPlan": {
    "schemaVersion": "1",
    "bindings": [
      {
        "id": "local-replica-to-multiplayer",
        "provider": {
          "pluginId": "plg_0bec7e8e-8852-4f44-9446-f5df278ab59e",
          "adapterId": "r3f",
          "portId": "local-replica"
        },
        "consumer": {
          "pluginId": "plg_multiplayer",
          "adapterId": "browser",
          "portId": "local-replica"
        }
      },
      {
        "id": "multiplayer-replicas-to-player-fleet",
        "provider": {
          "pluginId": "plg_multiplayer",
          "adapterId": "browser",
          "portId": "remote-replicas"
        },
        "consumer": {
          "pluginId": "plg_0bec7e8e-8852-4f44-9446-f5df278ab59e",
          "adapterId": "r3f",
          "portId": "remote-replicas"
        }
      }
    ]
  }
}
```

```tsx
const multiplayer = createMultiplayerSession(client, {
  scope: "zone:plaza",
  localReplicaSource: createLocalReplicaSource(player),
});
const remotes = createRemoteReplicaSource(multiplayer);
// inside the Canvas:
<PlayerAvatarFleet source={remotes} />;
```

### Lower-level exports

For custom avatars and rigs: `PlayerAvatar` (props `position`, `rotationY`,
`scale`, `bodyColor`, `trouserColor`, `hairColor`, `shoeColor`, `accentColor`,
`skinColor`, `castShadow`, `children`), `createAvatarAnimationDriver`
(`idle | walk | run | jump | fall | land | fly` locomotion snapshots you can map
to GLB clips), `applyPlayerAvatarLocomotion` (drives the named joints in
`PLAYER_AVATAR_JOINT_NAMES`), the pure step functions `stepPlayerMovement`,
`isPlayerGrounded`, `stepPlayerCamera`, `computeCameraTransform`,
`stepCameraFollowTransform`, `shouldRenderLocalAvatar`, and the palette
constants `AVATAR_*_COLORS`.

## Limits and failure modes

- Fleet capacity is 160 replicas (`PLAYER_AVATAR_FLEET_CAPACITY`): 24 high,
  48 medium, 88 low. Replicas past 160 in `source.list()` order are not drawn.
  Slots are stable and reused; LOD is re-ranked every 250 ms with 15 %
  hysteresis. A replica whose `sampleInto` returns `false` is skipped for that
  frame and reappears on its next sample; freshness and age never hide it.
  Frustum culling uses a bounding sphere.
- Fleet labels: at most 24, within `maximumDistance`, re-selected every 250 ms.
  The overlay positions labels at `overhead` height and does not apply
  `resolvePosePreset` offsets.
- Materials are TSL `MeshStandardNodeMaterial` from `three/webgpu`, so the
  Canvas must use `WebGPURenderer` (WebGPU, or its WebGL2 backend), constructed
  and `init()`ed by the Environment. A classic `WebGLRenderer` will not render
  the avatars.
- `createPlayerStateSource(...).subscribe` throws after `close()`.
- Movement quality depends on the `NavigationSurface`: a `null` ground sample
  leaves the player without support, so it falls.
- The Plugin is trusted library code running with the Environment's
  JavaScript authority; its declared permissions are not a sandbox.

## Versioning

SemVer. An installation pins one exact immutable release. `compat`:
`contracts ^1.0.0`. Port interfaces are versioned separately
(`spatial.local-replica-source@2.0.0`, `spatial.player-state-source@1.0.0`,
requires `spatial.remote-replica-source ^2.0.0`); a composition binding is
accepted only when interface, version, lifecycle, cardinality, correlation and
protocol schema digest match.

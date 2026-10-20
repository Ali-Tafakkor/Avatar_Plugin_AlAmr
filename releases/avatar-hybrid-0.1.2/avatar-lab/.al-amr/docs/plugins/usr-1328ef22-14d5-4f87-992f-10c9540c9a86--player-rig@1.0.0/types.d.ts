import * as three from 'three';
import { ColorRepresentation, Group, Color } from 'three';
import * as react from 'react';
import { ReactNode, CSSProperties } from 'react';

/**
 * The platform shapes this Plugin names, owned here.
 *
 * This file used to be an import of `@al-amr/contracts`. That package is
 * `private: true` and the platform publishes nothing (ADR-0142), so a
 * dependency on it cannot be resolved from a clone of this repository — and
 * ADR-0159 made this repository the only place this Plugin lives. What a
 * product needs from the platform at runtime arrives injected on
 * `window.alamr` (ADR-0155); what it needs at compile time is small enough to
 * state, so it is stated.
 */
/**
 * A pseudonymous correlation key, scoped to one Environment context.
 *
 * Minted by the Registry as `sak_` followed by twenty-two URL-safe characters
 * and handed to a Plugin inside its Grant. It is the ONLY identifier by which
 * two cooperating Plugins may recognise the same person, and it is not an
 * account id: the same person carries a different key in a different
 * Environment. This Plugin never derives one and never parses one — it
 * receives the key and passes it through — so the alias is the whole contract
 * the type needs to carry.
 */
type ScopedActorKey = string;

type Vector3Tuple = readonly [x: number, y: number, z: number];
type QuaternionTuple = readonly [x: number, y: number, z: number, w: number];
type PlayerMode = "grounded" | "flying";
type PlayerCameraMode = "third-person" | "first-person";
interface PlayerPose {
    readonly position: Vector3Tuple;
    readonly velocity: Vector3Tuple;
    readonly yaw: number;
    /** Optional full body rotation for flight/banking; yaw remains the navigation heading. */
    readonly orientation?: QuaternionTuple;
    readonly mode: PlayerMode;
    /** True while a flying player is descending toward a safe sampled surface. */
    readonly landingRequested: boolean;
}
interface PlayerCameraState {
    readonly yaw: number;
    readonly pitch: number;
    readonly distance: number;
    readonly mode: PlayerCameraMode;
    /** A smoothed 0..1 value used for first-person transitions and avatar visibility. */
    readonly firstPersonBlend: number;
}
interface PlayerSnapshot {
    readonly pose: PlayerPose;
    readonly camera: PlayerCameraState;
    readonly interactionSequence: number;
}
type PlayerInputAction = "forward" | "backward" | "left" | "right" | "sprint" | "jump" | "descend" | "toggleFlight" | "interact";
interface PlayerInputSnapshot {
    readonly actions: Readonly<Record<PlayerInputAction, boolean>>;
    /** Increments once for every up-to-down transition of an action. */
    readonly pressSequence: Readonly<Record<PlayerInputAction, number>>;
}
interface NavigationPoint {
    /** Position of the player's feet on the walkable surface. */
    readonly position: Vector3Tuple;
    readonly normal?: Vector3Tuple;
    readonly kind?: "terrain" | "road" | "skyway" | "custom";
}
interface MovementResolutionRequest {
    readonly from: Vector3Tuple;
    readonly desired: Vector3Tuple;
    readonly mode: PlayerMode;
    readonly radius: number;
    readonly height: number;
}
interface CameraResolutionRequest {
    readonly focus: Vector3Tuple;
    readonly desired: Vector3Tuple;
    readonly radius: number;
}
/**
 * Environment-owned navigation boundary. Terrain, roads, skyways, bounds, and
 * obstacle implementations stay outside this Plugin.
 */
interface NavigationSurface {
    /** Returns the walkable point at the query's x/z location, or null. */
    sampleGround(position: Vector3Tuple): NavigationPoint | null;
    /** Returns the safest surface below the query within maxDistance. */
    sampleLanding(position: Vector3Tuple, maxDistance: number): NavigationPoint | null;
    /** Applies world bounds and body/obstacle collision to desired movement. */
    resolveMovement?(request: MovementResolutionRequest): Vector3Tuple;
    /** Pulls a third-person camera forward when scenery blocks its path. */
    resolveCamera?(request: CameraResolutionRequest): Vector3Tuple;
}
interface PlayerController {
    getSnapshot(): PlayerSnapshot;
    subscribe(listener: () => void): () => void;
    getPoseSnapshot(): PlayerPose;
    subscribePose(listener: () => void): () => void;
    getCameraSnapshot(): PlayerCameraState;
    subscribeCamera(listener: () => void): () => void;
    /** Monotonic uint32 incremented by explicit teleports for network hard-snaps. */
    getDiscontinuityId(): number;
    getInputSnapshot(): PlayerInputSnapshot;
    setAction(action: PlayerInputAction, pressed: boolean): void;
    resetInput(): void;
    setPose(pose: PlayerPose): void;
    setCamera(camera: PlayerCameraState): void;
    /** Atomically publishes a render-frame pose and camera update. */
    setFrame(pose: PlayerPose, camera: PlayerCameraState): void;
    teleport(position: Vector3Tuple, yaw?: number): void;
    requestInteraction(): void;
}
interface PlayerMovementConfig {
    readonly walkSpeed: number;
    readonly sprintSpeed: number;
    readonly flySpeed: number;
    readonly flyBoostSpeed: number;
    readonly verticalFlySpeed: number;
    readonly landingSpeed: number;
    readonly jumpSpeed: number;
    readonly gravity: number;
    readonly maxStepHeight: number;
    readonly landingSearchDistance: number;
    readonly landingSnapDistance: number;
    readonly takeoffSpeed: number;
    readonly bodyRadius: number;
    readonly bodyHeight: number;
    readonly turnSharpness: number;
    /** Grounded horizontal acceleration in metres per second squared. */
    readonly acceleration: number;
    /** Horizontal braking when no movement direction is held. */
    readonly deceleration: number;
    /** Horizontal acceleration retained while jumping or falling. */
    readonly airControl: number;
    /** Maximum downward surface gap that remains attached without gravity. */
    readonly groundAdhesion: number;
    /** Maximum simulation catch-up accepted from one render frame. */
    readonly maxDeltaSeconds: number;
    /** Maximum duration of one internal collision/navigation simulation step. */
    readonly maxSubstepSeconds: number;
}
interface PlayerCameraConfig {
    readonly minDistance: number;
    readonly maxDistance: number;
    readonly initialDistance: number;
    readonly firstPersonEnterDistance: number;
    readonly firstPersonExitDistance: number;
    readonly minPitch: number;
    readonly maxPitch: number;
    readonly pointerSensitivity: number;
    readonly zoomSensitivity: number;
    readonly transitionSharpness: number;
    readonly followSharpness: number;
    readonly eyeHeight: number;
    readonly targetHeight: number;
    readonly cameraCollisionRadius: number;
}

type AvatarAnimationState = "idle" | "walk" | "run" | "jump" | "fall" | "land" | "fly";
/**
 * Framework-neutral locomotion snapshot. A procedural rig can consume the
 * values directly; a GLB adapter can map `state` and `transitionProgress` to
 * AnimationMixer clips without changing PlayerRig or PlayerController.
 */
interface AvatarLocomotion {
    readonly state: AvatarAnimationState;
    readonly previousState: AvatarAnimationState;
    readonly stateTime: number;
    readonly transitionProgress: number;
    readonly horizontalSpeed: number;
    readonly verticalSpeed: number;
    readonly grounded: boolean;
    /** Accumulated horizontal travel, measured from actual poses. */
    readonly distance: number;
    /** Horizontal travel since the previous update. */
    readonly deltaDistance: number;
    /** Distance-synchronised 0..2π gait phase. */
    readonly stridePhase: number;
}
interface AvatarAnimationDriverOptions {
    readonly walkThreshold: number;
    readonly runThreshold: number;
    readonly strideLength: number;
    readonly landingDuration: number;
    readonly transitionDuration: number;
}
interface AvatarAnimationDriver {
    getSnapshot(): AvatarLocomotion;
    /**
     * Advances from an immutable player pose. Pass `grounded` when a navigation
     * sample is available; otherwise a conservative velocity inference is used.
     */
    update(pose: PlayerPose, deltaSeconds: number, grounded?: boolean): AvatarLocomotion;
    reset(pose?: PlayerPose): AvatarLocomotion;
}
declare const DEFAULT_AVATAR_ANIMATION_OPTIONS: AvatarAnimationDriverOptions;
declare function createAvatarAnimationDriver(overrides?: Partial<AvatarAnimationDriverOptions>): AvatarAnimationDriver;

declare const DEFAULT_PLAYER_CAMERA_CONFIG: PlayerCameraConfig;
interface CameraInputDelta {
    readonly orbitX: number;
    readonly orbitY: number;
    readonly zoom: number;
}
interface CameraTransform {
    readonly position: Vector3Tuple;
    readonly target: Vector3Tuple;
    readonly focus: Vector3Tuple;
}
/**
 * Hides the complete local avatar on entry and restores it only once the exit
 * blend has fully settled, preventing body geometry from clipping the camera.
 */
declare function shouldRenderLocalAvatar(camera: PlayerCameraState): boolean;
declare function stepPlayerCamera(camera: PlayerCameraState, input: CameraInputDelta, deltaSeconds: number, overrides?: Partial<PlayerCameraConfig>): PlayerCameraState;
declare function computeCameraTransform(camera: PlayerCameraState, pose: PlayerPose, overrides?: Partial<PlayerCameraConfig>): CameraTransform;
/** Smooths both halves of a third-person look-at transform. */
declare function stepCameraFollowTransform(current: CameraTransform, desired: CameraTransform, camera: PlayerCameraState, deltaSeconds: number, overrides?: Partial<PlayerCameraConfig>): CameraTransform;

interface CreatePlayerControllerOptions {
    readonly position?: Vector3Tuple;
    readonly yaw?: number;
    readonly mode?: PlayerPose["mode"];
    readonly cameraYaw?: number;
    readonly cameraPitch?: number;
    readonly cameraDistance?: number;
}
declare function createPlayerController(options?: CreatePlayerControllerOptions): PlayerController;

declare function usePlayerSnapshot(controller: PlayerController): PlayerSnapshot;
/** Pose-only subscription intended for scene consumers and future replication. */
declare function usePlayerPose(controller: PlayerController): PlayerPose;
/** Camera-only subscription avoids rerendering a HUD for every pose update. */
declare function usePlayerCamera(controller: PlayerController): PlayerCameraState;

type PlayerInputBindings = Readonly<Partial<Record<PlayerInputAction, readonly string[]>>>;
/** Desktop defaults; Environments may replace any action without forking the rig. */
declare const DEFAULT_PLAYER_INPUT_BINDINGS: Readonly<Record<PlayerInputAction, readonly string[]>>;
/**
 * Builds the allocation-free lookup used by `PlayerRig` keyboard handlers.
 * A supplied action replaces that action's defaults; an empty list disables it.
 */
declare function createPlayerKeyActionMap(overrides?: PlayerInputBindings): Readonly<Record<string, PlayerInputAction | undefined>>;

declare const DEFAULT_PLAYER_MOVEMENT_CONFIG: PlayerMovementConfig;
interface MovementIntent {
    readonly forward: boolean;
    readonly backward: boolean;
    readonly left: boolean;
    readonly right: boolean;
    readonly sprint: boolean;
    readonly ascend: boolean;
    readonly descend: boolean;
    readonly jumpRequested: boolean;
    readonly toggleFlightRequested: boolean;
    readonly cameraYaw: number;
}
interface StepPlayerMovementOptions {
    readonly pose: PlayerPose;
    readonly intent: MovementIntent;
    readonly navigation: NavigationSurface;
    readonly deltaSeconds: number;
    readonly config?: Partial<PlayerMovementConfig>;
}
/** Returns true only when the pose is resting on a sampled surface. */
declare function isPlayerGrounded(pose: PlayerPose, navigation: NavigationSurface, groundAdhesion?: number): boolean;
declare function stepPlayerMovement({ pose, intent, navigation, deltaSeconds, config: overrides, }: StepPlayerMovementOptions): PlayerPose;
/** A useful development/default surface; production worlds should supply their own. */
declare function createFlatNavigationSurface(groundHeight?: number, bounds?: {
    readonly minX: number;
    readonly maxX: number;
    readonly minZ: number;
    readonly maxZ: number;
}): NavigationSurface;

/**
 * One person's authored appearance. Every colour is a plain hex string so the
 * same value can drive a `PlayerAvatar` prop, a `FleetAppearance` channel, or a
 * host's own avatar without conversion.
 */
interface AvatarOutfit {
    readonly shirtColor: string;
    readonly trouserColor: string;
    readonly hairColor: string;
    readonly shoeColor: string;
    readonly accentColor: string;
    readonly skinColor: string;
}
/**
 * Per-replica appearance override read by the instanced fleet. Declared beside
 * the outfit palette so `fleetAppearanceForSeed` needs no import from the
 * renderer. `bodyColor` is the shirt; it also tints the medium and low
 * distance capsules, which carry no separate clothing channels.
 */
interface FleetAppearance {
    readonly bodyColor?: ColorRepresentation;
    readonly skinColor?: ColorRepresentation;
    readonly trouserColor?: ColorRepresentation;
    readonly hairColor?: ColorRepresentation;
    readonly shoeColor?: ColorRepresentation;
    readonly accentColor?: ColorRepresentation;
    readonly hidden?: boolean;
}
/**
 * Eight shirts, spread across the hue wheel AND the value range so two people
 * read apart across a plaza. All warm-leaning, light and sun-bleached: under a
 * bright sun a saturated garment turns into a plastic decal, while washed
 * cloth keeps looking like cloth. Few and distinct beats many and muddled.
 */
declare const AVATAR_SHIRT_COLORS: readonly ["#efe8d6", "#a9c4da", "#a9b287", "#c8846b", "#e2c793", "#a293ad", "#6f9e94", "#5c6b80"];
/**
 * Soft light neutrals. Nothing dark: legs sit in the body's own shadow most of
 * the time, and a dark trouser there reads as a hole, not cloth.
 */
declare const AVATAR_TROUSER_COLORS: readonly ["#c9b391", "#c99b96", "#93a0af", "#a5a381"];
declare const AVATAR_HAIR_COLORS: readonly ["#33291f", "#4e3a26", "#74553a", "#8f8778", "#b8b1a4"];
declare const AVATAR_SKIN_COLORS: readonly ["#7b4a31", "#a06a48", "#c68f63", "#e9c19b"];
declare const AVATAR_SHOE_COLORS: readonly ["#c2a37c", "#8f8272", "#7d5b3f", "#77777d"];
/** Collar trim. Tonal neighbours of the shirts — a seam, never jewellery. */
declare const AVATAR_ACCENT_COLORS: readonly ["#efe6d4", "#e6cd96", "#b9c2cc"];
/**
 * The flagship outfit. Used wherever no identity is available — notably the
 * single-player Hub, whose end-to-end screenshots depend on it being fixed.
 */
declare const DEFAULT_AVATAR_OUTFIT: AvatarOutfit;
/** Distinct appearances reachable through `avatarOutfitFor`. */
declare const AVATAR_OUTFIT_COMBINATIONS: number;
/**
 * Resolves one person's outfit from any stable identity string — a Registry
 * `actorKey` is the intended seed. Pure and allocation-cheap: the same seed
 * always yields the same appearance, on every peer, with no protocol field and
 * no round trip. An empty seed falls back to the flagship outfit.
 */
declare function avatarOutfitFor(seed: string): AvatarOutfit;
/**
 * The same outfit shaped for `PlayerAvatarFleet.resolveAppearance`. Wrap it in
 * a `useCallback` — the fleet rebuilds every replica descriptor, and therefore
 * restarts every gait, whenever the resolver's identity changes.
 */
declare function fleetAppearanceForSeed(seed: string): FleetAppearance;

interface MutableLocalReplicaState {
    position: [number, number, number];
    orientation: [number, number, number, number];
    linearVelocity: [number, number, number];
    discontinuityId: number;
    movementMode: PlayerMode;
}
/** Structural provider contract for `spatial.local-replica-source@2.0.0`. */
interface LocalReplicaSource {
    sampleInto(target: MutableLocalReplicaState): boolean;
}
interface RemoteReplicaMember {
    readonly id: string;
    readonly handle: number;
    readonly actorKey: ScopedActorKey;
    readonly profile: {
        readonly displayName?: string;
        readonly avatarUrl?: string;
    };
    readonly environmentRoles: readonly string[];
}
interface MutableRemoteReplicaState extends MutableLocalReplicaState {
    tier: "near" | "medium" | "low";
    dormant: boolean;
    ageMs: number;
    source: "interpolated" | "extrapolated" | "held" | "discontinuity";
    freshness: "live" | "degraded" | "reconnecting";
}
/** Structural consumer contract; Player Rig never imports Multiplayer. */
interface RemoteReplicaSource {
    list(): readonly string[];
    getMember(id: string): RemoteReplicaMember | undefined;
    /** Compatibility alias for pre-v3 consumers. */
    sample(id: string, target: MutableRemoteReplicaState, localTime?: number): boolean;
    sampleInto(id: string, target: MutableRemoteReplicaState, localTime?: number): boolean;
    subscribeDirectory(listener: () => void): () => void;
    getDirectorySnapshot(): number;
}
interface PlayerStateAnimation {
    readonly state: AvatarLocomotion["state"];
    readonly previousState: AvatarLocomotion["previousState"];
    readonly stateTime: number;
    readonly transitionProgress: number;
    readonly stridePhase: number;
    readonly grounded: boolean;
}
/**
 * Payload contract for `spatial.player-state-source@1.0.0`.
 *
 * The interface deliberately contains no account identifier. An Environment
 * may bind this local state source to multiple consumers, while cross-Plugin
 * remote-actor correlation remains limited to the Registry-issued actorKey.
 */
interface PlayerStateSnapshot {
    readonly position: Vector3Tuple;
    readonly velocity: Vector3Tuple;
    readonly yaw: number;
    readonly mode: PlayerMode;
    readonly teleport?: boolean;
    readonly animation: PlayerStateAnimation;
}
interface PlayerStateSource {
    getSnapshot(): PlayerStateSnapshot;
    getPosition(): Vector3Tuple;
    subscribe(listener: () => void): () => void;
    setAnimationSnapshot(animation: AvatarLocomotion): void;
    close(): void;
}
/**
 * Creates the Environment-bindable state source declared by the Player Rig
 * manifest. Consumers depend on the semantic interface, never this package.
 */
declare function createPlayerStateSource(controller: PlayerController): PlayerStateSource;
/**
 * Allocation-free local transform sampling for fixed-rate network transports.
 * Quaternion output preserves full 3D orientation and remains valid for flight.
 */
declare function createLocalReplicaSource(controller: PlayerController): LocalReplicaSource;

declare const PLAYER_AVATAR_ROOT_NAME = "al-amr-player-local-avatar";
declare const PLAYER_AVATAR_HEIGHT = 1.78;
/** The head joint. Named so hosts and the animation driver can pitch the gaze. */
declare const PLAYER_AVATAR_HEAD_NAME = "al-amr-player-local-head";
declare const PLAYER_AVATAR_ANCHORS: Readonly<{
    readonly root: readonly [0, 0, 0];
    readonly chest: readonly [0, 1.18, 0];
    readonly head: readonly [0, 1.57, 0];
    readonly overhead: readonly [0, number, 0];
}>;
type PlayerAvatarAnchorName = keyof typeof PLAYER_AVATAR_ANCHORS;
declare function PlayerAvatarAnchor({ anchor, offset, children, }: {
    readonly anchor: PlayerAvatarAnchorName;
    readonly offset?: Vector3Tuple;
    readonly children?: ReactNode;
}): react.JSX.Element;
declare const PLAYER_AVATAR_JOINT_NAMES: Readonly<{
    torso: "al-amr-player-joint-torso";
    leftShoulder: "al-amr-player-joint-left-shoulder";
    rightShoulder: "al-amr-player-joint-right-shoulder";
    leftElbow: "al-amr-player-joint-left-elbow";
    rightElbow: "al-amr-player-joint-right-elbow";
    leftHip: "al-amr-player-joint-left-hip";
    rightHip: "al-amr-player-joint-right-hip";
    leftKnee: "al-amr-player-joint-left-knee";
    rightKnee: "al-amr-player-joint-right-knee";
}>;
interface PlayerAvatarProps {
    readonly position?: Vector3Tuple;
    readonly rotationY?: number;
    readonly scale?: number;
    /** Shirt colour. Also tints the sleeves and the distance capsules. */
    readonly bodyColor?: string;
    readonly accentColor?: string;
    readonly skinColor?: string;
    readonly trouserColor?: string;
    readonly hairColor?: string;
    readonly shoeColor?: string;
    readonly castShadow?: boolean;
    /** Host-composed Plugin UI or 3D content mounted through a semantic avatar surface. */
    readonly children?: ReactNode;
}
/** Applies a locomotion snapshot to the named joints of the default avatar. */
declare function applyPlayerAvatarLocomotion(root: Group, locomotion: AvatarLocomotion): void;
/**
 * Stylised 1.78 m adult figure. Every surface is a revolved profile or an
 * ellipsoid carrying a portable TSL painterly ramp, so the body reads as
 * modelled form under raking light rather than as faceted primitives. Hosts may
 * replace it with any ReactNode; the public animation driver provides the seam
 * for a future GLB rig.
 */
declare const PlayerAvatar: react.ForwardRefExoticComponent<PlayerAvatarProps & react.RefAttributes<Group<three.Object3DEventMap>>>;

interface PlayerAvatarOverlayProps {
    readonly anchor?: PlayerAvatarAnchorName;
    readonly offset?: Vector3Tuple;
    readonly children?: ReactNode;
    readonly visible?: boolean;
    readonly zIndexRange?: [number, number];
    readonly style?: CSSProperties;
}
/**
 * Fixed-pixel DOM overlay attached to a semantic avatar anchor.
 *
 * This intentionally does not use Drei's transform, sprite, or distanceFactor
 * modes. Those modes scale DOM with world distance and are unsuitable for
 * readable identity labels and interactive avatar actions.
 */
declare function PlayerAvatarOverlay({ anchor, offset, children, visible, zIndexRange, style, }: PlayerAvatarOverlayProps): react.JSX.Element | null;

declare const PLAYER_AVATAR_FLEET_CAPACITY = 160;
declare const PLAYER_AVATAR_FLEET_HIGH_CAPACITY = 24;
declare const PLAYER_AVATAR_FLEET_MEDIUM_CAPACITY = 48;
declare const PLAYER_AVATAR_FLEET_LOW_CAPACITY: number;
interface PlayerAvatarFleetProps {
    readonly source: RemoteReplicaSource;
    readonly visible?: boolean;
    readonly highDistance?: number;
    readonly mediumDistance?: number;
    readonly castShadows?: boolean;
    readonly resolveAppearance?: (member: NonNullable<ReturnType<RemoteReplicaSource["getMember"]>>) => FleetAppearance | undefined;
    readonly resolvePosePreset?: (member: NonNullable<ReturnType<RemoteReplicaSource["getMember"]>>) => FleetPosePreset | undefined;
}
interface FleetPosePreset {
    readonly scale?: number;
    readonly verticalOffset?: number;
}
interface FleetDescriptor {
    appearance: FleetAppearance;
    pose: FleetPosePreset;
    bodyColor: Color;
    skinColor: Color;
    trouserColor: Color;
    hairColor: Color;
    shoeColor: Color;
    accentColor: Color;
    phase: number;
    gaitPhase: number;
    lastAnimatedAt: number | undefined;
    lastPositionX: number;
    lastPositionZ: number;
    hasLastPosition: boolean;
    horizontalSpeed: number;
    animationState: AvatarAnimationState;
    previousAnimationState: AvatarAnimationState;
    transitionProgress: number;
    freshnessWeight: number;
    /** Drives the landing crouch, which only exists as a transition. */
    wasAirborne: boolean;
    landingRemaining: number;
}
/**
 * Fleet renderer for large multiplayer scopes. It samples every remote replica
 * from one R3F frame callback and renders 15 fixed instanced draw groups instead of
 * mounting one React avatar tree per participant.
 */
declare function PlayerAvatarFleet({ source, visible, highDistance, mediumDistance, castShadows, resolveAppearance, resolvePosePreset, }: PlayerAvatarFleetProps): react.JSX.Element;
/**
 * Bring the descriptor map in line with the current roster, preserving the
 * identity — and therefore the animation state — of every replica that is still
 * present. Exported so the preservation guarantee can be tested without a
 * renderer.
 */
declare function reconcileFleetDescriptors(descriptors: Map<string, FleetDescriptor>, ids: readonly string[], resolvers: {
    getMember: RemoteReplicaSource["getMember"];
    resolveAppearance?: PlayerAvatarFleetProps["resolveAppearance"];
    resolvePosePreset?: PlayerAvatarFleetProps["resolvePosePreset"];
}): Map<string, FleetDescriptor>;
declare function reconcileFleetSlots(slots: Map<string, number>, replicaIds: readonly string[], capacity: number): string[];

interface PlayerAvatarFleetOverlayProps {
    readonly source: RemoteReplicaSource;
    readonly maximumLabels?: number;
    readonly maximumDistance?: number;
    readonly visible?: boolean;
    readonly selectedReplicaIds?: readonly string[];
    readonly className?: string;
    readonly renderLabel?: (member: NonNullable<ReturnType<RemoteReplicaSource["getMember"]>>) => ReactNode;
}
/** One DOM projection root for the whole fleet; no Html object is mounted per avatar. */
declare function PlayerAvatarFleetOverlay({ source, maximumLabels, maximumDistance, visible, selectedReplicaIds, className, renderLabel, }: PlayerAvatarFleetOverlayProps): react.JSX.Element;

interface PlayerRigProps {
    readonly controller: PlayerController;
    readonly navigation: NavigationSurface;
    readonly movement?: Partial<PlayerMovementConfig>;
    readonly camera?: Partial<PlayerCameraConfig>;
    readonly inputBindings?: PlayerInputBindings;
    readonly avatar?: ReactNode;
    /**
     * How the local player is dressed, for the default avatar.
     *
     * Seed it with the room's own `actorKey` through `avatarOutfitFor`, which is
     * the same derivation every OTHER client already applies to this player. Left
     * unset the rig wears `DEFAULT_AVATAR_OUTFIT` — so the visitor walked around
     * in the flagship cream-and-slate while the whole plaza saw them in one of
     * thousands of other outfits, and the one person who could never see who they
     * were was themselves.
     *
     * Ignored when `avatar` is supplied: a host composing its own avatar node
     * owns its appearance outright.
     */
    readonly outfit?: AvatarOutfit;
    readonly enabled?: boolean;
    readonly paused?: boolean;
    readonly onInteract?: (snapshot: PlayerSnapshot) => void;
    /** Receives the exact locomotion snapshot applied to the local avatar. */
    readonly onAnimationFrame?: (locomotion: AvatarLocomotion) => void;
}
/**
 * Installs desktop input, advances the external controller, and owns the local
 * R3F camera. Render exactly one rig for each locally controlled player.
 */
declare function PlayerRig({ controller, navigation, movement, camera: cameraOverrides, inputBindings, avatar, outfit, enabled, paused, onInteract, onAnimationFrame, }: PlayerRigProps): react.JSX.Element;

/**
 * The reviewed manifest, as the bytes beside this file.
 *
 * It used to be `PluginManifestSchema.parse(rawManifest)`, which cost a
 * dependency on `@al-amr/contracts` — a private platform package a clone of
 * this repository cannot resolve (ADR-0142) — to re-check bytes that are
 * already in the tree. `alamr validate` checks this file against the platform's
 * own schema, with the CLI the client ships, which is the only copy of that
 * schema anybody can be sure is current. TypeScript's inferred type for the
 * JSON is narrower than the parsed one was, so consumers lose nothing.
 */
declare const playerRigPluginManifest: {
    contractVersion: string;
    runtimeApi: string;
    pluginId: string;
    publisher: {
        id: string;
        handle: string;
    };
    slug: string;
    name: string;
    version: string;
    shortDescription: string;
    category: string;
    presentation: {
        icon: {
            path: string;
            digest: string;
            contentType: string;
            alt: string;
        };
    };
    kind: string;
    runtimeClass: string;
    frontendAdapters: {
        id: string;
        runtime: string;
        exportPath: string;
        hostKinds: string[];
        exports: string[];
        capabilities: string[];
        composition: {
            provides: {
                surface: string;
                exportName: string;
                description: string;
            }[];
            contributes: never[];
        };
        semanticPorts: {
            provides: {
                id: string;
                interfaceId: string;
                version: string;
                exportName: string;
                description: string;
                lifecycle: string;
                cardinality: string;
                actorCorrelation: string;
                protocolArtifactId: string;
            }[];
            requires: {
                id: string;
                interfaceId: string;
                versionRange: string;
                bindingName: string;
                description: string;
                lifecycle: string;
                cardinality: string;
                optional: boolean;
                actorCorrelation: string;
                protocolArtifactId: string;
            }[];
        };
        peerDependencies: {
            react: string;
            three: string;
            "@react-three/fiber": string;
            "@react-three/drei": string;
        };
    }[];
    backendComponents: never[];
    protocolArtifacts: {
        id: string;
        kind: string;
        specificationVersion: string;
        path: string;
        digest: string;
        mediaType: string;
    }[];
    platformPermissions: never[];
    browserRequirements: never[];
    compat: {
        contracts: string;
    };
    documentation: {
        canonicalUrl: string;
        integrationUrl: string;
        repositoryUrl: string;
        license: string;
    };
};
/**
 * Derived rather than restated: the Registry assigns a Plugin's id when the
 * project is linked and rewrites the manifest with it, so a literal here would
 * be a second source of truth that goes stale on the first publication.
 */
declare const PLAYER_RIG_PLUGIN_ID: string;

export { AVATAR_ACCENT_COLORS, AVATAR_HAIR_COLORS, AVATAR_OUTFIT_COMBINATIONS, AVATAR_SHIRT_COLORS, AVATAR_SHOE_COLORS, AVATAR_SKIN_COLORS, AVATAR_TROUSER_COLORS, type AvatarAnimationDriver, type AvatarAnimationDriverOptions, type AvatarAnimationState, type AvatarLocomotion, type AvatarOutfit, type CameraInputDelta, type CameraResolutionRequest, type CameraTransform, type CreatePlayerControllerOptions, DEFAULT_AVATAR_ANIMATION_OPTIONS, DEFAULT_AVATAR_OUTFIT, DEFAULT_PLAYER_CAMERA_CONFIG, DEFAULT_PLAYER_INPUT_BINDINGS, DEFAULT_PLAYER_MOVEMENT_CONFIG, type FleetAppearance, type FleetPosePreset, type LocalReplicaSource, type MovementIntent, type MovementResolutionRequest, type MutableLocalReplicaState, type MutableRemoteReplicaState, type NavigationPoint, type NavigationSurface, PLAYER_AVATAR_ANCHORS, PLAYER_AVATAR_FLEET_CAPACITY, PLAYER_AVATAR_FLEET_HIGH_CAPACITY, PLAYER_AVATAR_FLEET_LOW_CAPACITY, PLAYER_AVATAR_FLEET_MEDIUM_CAPACITY, PLAYER_AVATAR_HEAD_NAME, PLAYER_AVATAR_HEIGHT, PLAYER_AVATAR_JOINT_NAMES, PLAYER_AVATAR_ROOT_NAME, PLAYER_RIG_PLUGIN_ID, PlayerAvatar, PlayerAvatarAnchor, type PlayerAvatarAnchorName, PlayerAvatarFleet, PlayerAvatarFleetOverlay, type PlayerAvatarFleetOverlayProps, type PlayerAvatarFleetProps, PlayerAvatarOverlay, type PlayerAvatarOverlayProps, type PlayerAvatarProps, type PlayerCameraConfig, type PlayerCameraMode, type PlayerCameraState, type PlayerController, type PlayerInputAction, type PlayerInputBindings, type PlayerInputSnapshot, type PlayerMode, type PlayerMovementConfig, type PlayerPose, PlayerRig, type PlayerRigProps, type PlayerSnapshot, type PlayerStateAnimation, type PlayerStateSnapshot, type PlayerStateSource, type QuaternionTuple, type RemoteReplicaMember, type RemoteReplicaSource, type ScopedActorKey, type StepPlayerMovementOptions, type Vector3Tuple, applyPlayerAvatarLocomotion, avatarOutfitFor, computeCameraTransform, createAvatarAnimationDriver, createFlatNavigationSurface, createLocalReplicaSource, createPlayerController, createPlayerKeyActionMap, createPlayerStateSource, fleetAppearanceForSeed, isPlayerGrounded, playerRigPluginManifest, reconcileFleetDescriptors, reconcileFleetSlots, shouldRenderLocalAvatar, stepCameraFollowTransform, stepPlayerCamera, stepPlayerMovement, usePlayerCamera, usePlayerPose, usePlayerSnapshot };

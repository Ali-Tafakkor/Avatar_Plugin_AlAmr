# Local extracted avatar runtime

Read root AGENTS.md and PROJECT_HANDOFF.md. The owner accepted the visible result on 2026-10-17 and explicitly authorized committing/pushing the current version to the existing Git repository on 2026-10-19. That Git authorization supersedes the earlier local-only restriction. It does not authorize alamr test/publish/pack/upload/link or any Registry submission operation. Do not repeat runtime/visual tests merely for this Git handoff; the owner said testing was sufficient.

This is a private, local reusable library consumed by avatar-lab; it is not a registered Al-Amr Plugin. The original ../AvatarMotionLab and the v1 source/plugin/delivered Environment must remain unchanged. Keep geometry, skinning, all face morphs, materials and source bytes recoverable. Runtime corrections belong here. Use the consuming host's exact Three instance and host-owned Player Rig camera, world root and movement. Read avatar-lab product guidance before altering its integration.

Record real geometry, face and animation validation evidence. Passing structural tests is separate from visual verification in real Al-Amr Desktop. No Blender MCP workflow is authorized.

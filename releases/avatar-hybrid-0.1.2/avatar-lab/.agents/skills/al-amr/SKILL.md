---
name: al-amr
description: "Build, debug and prepare publication of Al-Amr Apps, Environments and Plugins with the project's own tools and Desktop CLI."
---

# Build an Al-Amr product

Use this skill for product development, platform integration, debugging and
publication preparation. Read the project's `AGENTS.md` for its manifest and
exact Desktop CLI launcher. Preserve the person's task, tools and instructions:
a request for investigation or a proposal stays read-only; implementing a feature
does not by itself authorize upload, submission or deployment.

## Start with the product model

An App opens independently in Desktop; an Environment is a destination and UI
compositor; a Plugin supplies a capability to its declared host. Each owns its
optional backend. Apps and web Environments ship as immutable bundles downloaded
and stored by the client. Bundled fonts, models and libraries need not be fetched
on every opening; install size, startup work and memory are different budgets.
Read [bundles and data](agent-bundles.md) when choosing assets,
storage or the product architecture.

Before handing off a new product, replace the starter presentation image with
product-specific art. An Environment needs a landscape cover (16:9 is a useful
target), while an App and a Plugin need square icons. Read the exact image sizes,
bundle paths, alt text and validation steps in
[bundles and data](agent-bundles.md#prepare-presentation-media).

Use `window.alamr` in Apps and web Environments, and installation-scoped ports
in Plugins. Main, the trusted desktop process, owns platform connection and
session renewal. Product code needs no Al-Amr SDK or private platform package.
Keep the existing framework, engine and package manager. A minimal starter has
authored source in `dist/` and needs no build; if adding a build, its declared
script must produce `dist/`.

## Read the reference for this task

Do not load every reference. Use the installed `alamr api describe --json` and
local `alamr.d.ts` for exact supported methods; types alone do not grant a
capability. Current Registry state decides publication and live authority.

| Task                                                                                  | Read                                                                          |
| ------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| Assets, local bundles, storage, App/Environment/Plugin boundaries                     | [Bundles and data](agent-bundles.md)                              |
| Cover or icon artwork, image sizes, paths and alt text                                | [Presentation media](agent-bundles.md#prepare-presentation-media) |
| Startup, offline opening, permissions, identity, display changes, closing, activation | [Runtime lifecycle](agent-runtime.md)                             |
| Build, local test, Desktop preview, offline scenarios, diagnosing stale output        | [Development loop](agent-development.md)                          |
| News, content acknowledgement, background delivery or ringing                         | [Notifications and live alerts](agent-notifications.md)           |
| Personal companions, consented contacts or a reach proof                              | [Companionship](agent-companions.md)                              |
| جمع: persistent membership, a shared archive or group invitation                      | [Groups](agent-groups.md)                                         |
| همپایی: shared execution, leader/follower behavior and late arrival                   | [Hampa](agent-hampa.md)                                           |
| A product backend, credentials or Plugin grants                                       | [Backend authority](agent-backend.md)                             |
| Authoring, installing or composing a Plugin                                           | [Plugins](agent-plugins.md)                                       |
| Changing a release, choosing its next version or preparing submission                 | [Versions and publication](agent-publishing.md)                   |

Companionship, persistent groups and Hampa are separate layers. Implement the
requested ones: an archive needs no live session; a Hampa-only product need not
enumerate all groups. Hampa supplies execution context; the product implements
its shared media, document or scene and recovery of current state.

## Finish the requested work

For code changes, run the project's relevant tests, build its final output,
run `alamr validate --json` and `alamr doctor --profile project --json`, then
open and exercise that output with `alamr dev --json` and the development
reference's preview tools. Exercise a Plugin in its consuming App or Environment.
Read stable result codes, diagnostics and `nextActions`; startup readiness alone
does not prove the changed feature works.

For changed release content, check the publication reference before handoff.
Advance a consumed version once for the next release, then keep that working
version through local edits; do not bump on every task or retry. `alamr test`
uploads and binds a publication candidate; it is not a local test command.

After a client upgrade, `alamr docs sync --local --json` refreshes these guides
and standalone types. `alamr docs sync --json` also fetches exact installed
Plugin documentation. Neither upgrades product dependencies or grants consent.
Resolve reported conflicts while preserving the creator's edits.

Report the behavior actually exercised, the build/revision tested and whether
providers were simulated or real. Complete routine build and inspection work
yourself. Use the person's existing authorized publication path when submission
is requested; distinguish local readiness, submitted review and publication.

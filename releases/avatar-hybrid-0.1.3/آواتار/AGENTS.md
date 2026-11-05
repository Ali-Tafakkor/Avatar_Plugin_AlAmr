<!-- al-amr:agent-kit:start schema=1 digest=sha256:2204726c9b9cecc584d18af98bdd740a35462b76cde2759fb77f96bb0d13ec34 -->
# Al-Amr plugin

Use this Desktop CLI launcher (JSON string; decode and quote it for your shell, and use & in PowerShell):

```json
"C:\\Users\\alita\\AppData\\Roaming\\al-amr\\bin\\alamr.cmd"
```

The product manifest is `al-amr.plugin.json`, the source of truth for this product. Read [.agents/skills/al-amr/SKILL.md](.agents/skills/al-amr/SKILL.md) before working on this product.

Before submission, replace the starter cover or icon with product-specific artwork. The skill's Bundles and data guide gives the image sizes, output paths and alt text. Run `alamr validate --json` against the built or packaged image and review its warnings.

`alamr test` packs automatically. Do not add a manual pack step or install npm for platform packing.

The product owns its tools. A minimal starter needs no package manager and no build step: dist is authored source. If you add a build, give `package.json` a `build` script that writes `dist/`. Local types are in alamr.d.ts.

Declare each semantic UI surface/contribution in the manifest and immutable integration.md. The consuming host owns mounting and cleanup.

For implementation work, close the loop yourself: finish the project's tests and build, run `alamr validate --json`, then `alamr dev --json` and confirm the product actually opened. A Plugin is exercised in its consuming App or Environment. Use --json results and nextActions. Keep a read-only request read-only. Publication preparation, `alamr test --yes --json`, inventories, packs, uploads, and binds a Registry candidate; use it only in an authorized publication workflow. The skill explains verification and publication.

Products ship as cached local bundles. Read the skill's bundle and lifecycle guidance before applying ordinary website assumptions. After a consumed release, select the next suitable product version once; keep that working version across edits. Frozen candidate bytes can also require a new version. Do not bump on every task or change contractVersion for product edits; consult the publication reference.

Preserve the person's existing project instructions and authorization. Keep credentials out of product code and reports. The CLI is bundled; do not install it from npm. CLI authentication is separate from Desktop's account session. No platform package or agent host is required. Public reference: https://agent.al-amr.com/llms.txt
<!-- al-amr:agent-kit:end -->

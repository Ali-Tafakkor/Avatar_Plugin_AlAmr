# Olive Man case study — historical inherited-head route and surface repairs

**New-identity route superseded in 1.3.0.** The later owner review found that the avatars looked like the same person with different styling. The mounted-head sculpt and donor-UV method below records what was done; it is not evidence of independent facial construction and must not be used to build the next identity. Use [fresh geometry construction](../10-reference-likeness-and-clothes.md) instead. Hair coverage, garment fitting and wrist/host debugging remain useful after a new head exists.

The brief supplied one frontal, full-body A-pose with a clear outfit. That view established the swept hair silhouette, brow and eye spacing, beard, shirt fit, trouser shape and shoes. The side and rear views had to be inferred. The first render made those guesses visible early enough for the owner to correct the sides, nape and hairline directly on screenshots. Use the requested character's reference and proportions when applying the workflow. [Reference likeness and clothing](../10-reference-likeness-and-clothes.md)

## Historical method — not instructions for new identities

> 1. Start with a compatible skinned body and an expressive head. Mount the face in a known body pose and compare the face at eye level before tightening the likeness. Olive Man used the local Hybrid runtime's body animation and articulated hands with its separately mounted expressive head. Each selectable character had its own mutable geometry, materials and state.
> 2. Sculpt the large likeness cues in the mounted head's local frame. On a rig with relative morphs, move the base and each endpoint through the same warp, then store their difference in bind space. Transform the corresponding normals and check the eyes, lids, lashes, teeth and mouth in combination with the new head shape. [Hybrid identity and morphs](../09-customization-and-hybrid.md)
> 3. Recover the surface position and normal for each covered texel by rasterizing the existing UV triangles. In Olive Man, this let the bake project the useful frontal portion of the photo and feather its weight by facing angle and position. Preserve the source lid rims and mouth interior, use a compatible skin tone around the unseen sides, and extend color into the UV gutters so the atlas filters cleanly.
> 4. Fix color casts around the outside of the eyes on the UV surface. The useful change was a bounded blend toward nearby skin tone with some native texture detail preserved. Weight it away from the lids and brows. Compare under the same scene light from both sides so that a painted shadow can be distinguished from a shadow cast by the brow.

## Use the hair mesh for silhouette and scalp color for coverage

- A tall outer mesh can still leave bare scalp at the nape. Sample horizontal cuts of the mounted, sculpted head to fit the shell. Adjust the crown lift and the base line independently. In this case, reducing the lift preserved the sweep and lowering the base line at the nape covered the rear gap.
- When the fringe silhouette is approved and skin shows immediately beneath it, extend the root color on the head surface. Paint the short hair in front of and above each ear with a separate contour that rises around the cartilage. Derive both contours in head space so they follow the character through poses and around UV seams. Recalibrate symmetrical masks if the new head or cut is asymmetric.
- For a soft boundary, carry the two distance fields on the scalp, smooth each field across its own falloff width, then take the greater coverage. Blend the existing scalp material toward the hair-root color there. In the close-ups this softened the angular join and covered the skin stripe under the fringe. Preserve the previous fade in already approved areas.
- Verify with a low front angle under the fringe, close views of both ears, and a rear three-quarter view at the nape. Match the annotated image angle as closely as possible. Use the red outlines as surface boundaries to locate on the model.

## Fit the garment and spend geometry on the silhouette

The owner preferred the olive shirt's band around the neck and asked to remove the projecting front collar points. Keep the selected neckline attached to the garment rig and check the neck from front and side. Decide on the band or collar shape from each new brief. [Production garment and contact checks](../11-full-body-production.md)

Olive Man's buttons and placket moved from raised details to a bake on the existing clothing atlas. Place small details in garment bind space, restrict them to the front-facing surface, and rasterize them into the actual UV islands. The button centers and edges followed the skinned shirt and read at the intended viewing distance. Preserve enough texels for the smallest detail at the usual zoom. For new builds under 1.4.0, [reference13](../13-body-and-garment-shape.md) supersedes the old collar-band choice: use texture-only collar/button details even in close-up, while retaining the necessary neckline and main garment silhouette.

The combined hair and clothing revision went from 101,262 to 80,438 visible avatar triangles. The later temple and fringe color correction kept the revised triangle count and used the existing seven textures. Those numbers describe this asset and scene.

## Where to inspect the working example

In the originating project, `avatar-olive-man/appearance.mjs` contains the mounted sculpt and root material, `hair.mjs` contains the shell and scalp contours, `tailoring.mjs` contains garment fit, and `tools/bake-albedo.py` contains the texture bake. The before/after inventory is in `avatar-olive-man/evidence/refinement/verification.json`. The close-ups and final receipt are in `avatar-olive-man/evidence/hairline-contact/`.

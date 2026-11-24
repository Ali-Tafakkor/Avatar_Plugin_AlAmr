export function stabilizeHandContact({ body, handContact: contact }) {
  const { applyStaticContact } = body;
  const { restore, solve } = contact;
  let restClip = null, restTime = 0;

  body.applyStaticContact = frame => {
    const result = applyStaticContact(frame);
    const { active, clip } = result;
    const current = active && (clip === 'Stand' || clip === 'Sitting') ? clip : null;
    if (current !== restClip) restTime = 0;
    restClip = current;
    return result;
  };
  contact.solve = delta => {
    if (restClip && delta > 0) {
      restTime += Math.min(delta, .1);
      // Let the 180 ms locomotion crossfade finish. Rest previews are sampled
      // directly. Solve from the restored pose to avoid a release/reapply loop.
      if (restTime >= .18 || body.sourceAnimator.getStatus().mode === 'preview') {
        restore(true);
        solve(0);
        return;
      }
    }
    solve(delta);
  };
  return () => {
    restore(true);
    contact.solve = solve;
    body.applyStaticContact = applyStaticContact;
  };
}

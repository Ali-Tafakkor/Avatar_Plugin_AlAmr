import { forwardRef, useCallback, useRef } from 'react';
import type { Group } from 'three';
import { Avatar03, type Avatar03Handle, type Avatar03Props, type Avatar03Ready } from '../../آواتار/dist/index.js';
import { fixLegacyPreviewMaterials, type LegacyMaterialAudit } from './legacy-preview.mjs';

export const LegacyComparisonAvatar = forwardRef<Avatar03Handle, Avatar03Props & { onAudit: (audit: LegacyMaterialAudit) => void }>(function LegacyComparisonAvatar({ onReady, onAudit, ...props }, ref) {
  const root = useRef<Group>(null);
  const ready = useCallback((info: Avatar03Ready) => {
    if (root.current) onAudit(fixLegacyPreviewMaterials(root.current));
    onReady?.(info);
  }, [onReady, onAudit]);
  return <group ref={root}><Avatar03 {...props} ref={ref} onReady={ready} /></group>;
});

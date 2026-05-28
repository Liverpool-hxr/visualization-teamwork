import React from 'react';
import type { Patch } from '@/types/attention';

interface PatchGridProps {
  patches: Patch[];
  colorBy?: 'entropy' | 'max_attn';
  onPatchClick?: (patch: Patch) => void;
}

const PatchGrid: React.FC<PatchGridProps> = ({ 
  patches, 
  colorBy = 'entropy',
  onPatchClick 
}) => {
  const getColor = (value: number) => {
    const normalizedValue = (value - 0.7) / (1.3 - 0.7);
    const clampedValue = Math.max(0, Math.min(1, normalizedValue));
    
    const r = Math.floor(255 * clampedValue);
    const g = Math.floor(100 + 155 * (1 - clampedValue));
    const b = Math.floor(150);
    
    return `rgb(${r}, ${g}, ${b})`;
  };

  const maxItems = Math.min(patches.length, 256);
  const gridSize = Math.ceil(Math.sqrt(maxItems));
  const displayPatches = patches.slice(0, maxItems);

  return (
    <div style={{ padding: '16px' }}>
      <div 
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(${gridSize}, 1fr)`,
          gap: '2px',
          aspectRatio: '1',
        }}
      >
        {displayPatches.map((patch) => (
          <div
            key={patch.patch_id}
            style={{
              backgroundColor: getColor(colorBy === 'entropy' ? patch.entropy : patch.max_attn),
              borderRadius: '2px',
              cursor: onPatchClick ? 'pointer' : 'default',
              transition: 'transform 0.15s',
            }}
            onClick={() => onPatchClick?.(patch)}
            title={`Patch ${patch.patch_id}\nEntropy: ${patch.entropy.toFixed(4)}\nMax Attn: ${patch.max_attn.toFixed(4)}`}
          />
        ))}
      </div>
      <div style={{ marginTop: '12px', display: 'flex', alignItems: 'center', gap: '8px' }}>
        <span style={{ fontSize: '12px', color: '#666' }}>Color by: {colorBy}</span>
        <div style={{ flex: 1, height: '12px', borderRadius: '6px', background: 'linear-gradient(to right, rgb(178, 255, 150), rgb(255, 100, 150))' }} />
      </div>
    </div>
  );
};

export default PatchGrid;
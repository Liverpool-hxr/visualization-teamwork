/**
 * Attention heatmap overlay component using Canvas 2D API.
 * Mirrors the three-panel visualization from backend/visualization.py:
 *   Panel 1: LR Input image
 *   Panel 2: Input + attention heatmap overlay + grid + star marker
 *   Panel 3: SR Output image
 */
import React, { useRef, useEffect } from 'react';
import { PATCH_SIZE, GRID_SIZE, NUM_PATCHES } from '@/utils/math';

interface AttentionOverlayProps {
  inputUrl: string;
  outputUrl: string;
  /** Flat attention matrix [numPatches x numPatches] (Float64Array) */
  attnMatrix: Float64Array | null;
  patchId: number;
  /** Canvas width in pixels. Default auto-fits container. */
  width?: number;
}

const CANVAS_HEIGHT = 260;
const PANEL_PADDING = 8;
const NUM_PANELS = 3;

const AttentionOverlay: React.FC<AttentionOverlayProps> = ({
  inputUrl,
  outputUrl,
  attnMatrix,
  patchId,
  width,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const imgCache = useRef<Map<string, HTMLImageElement>>(new Map());

  const loadImage = (url: string): Promise<HTMLImageElement> => {
    const cached = imgCache.current.get(url);
    if (cached) return Promise.resolve(cached);
    return new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => {
        imgCache.current.set(url, img);
        resolve(img);
      };
      img.onerror = reject;
      img.src = url;
    });
  };

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const containerWidth = width ?? canvas.parentElement?.clientWidth ?? 900;
    const panelWidth = (containerWidth - PANEL_PADDING * (NUM_PANELS + 1)) / NUM_PANELS;
    const totalWidth = containerWidth;

    canvas.width = totalWidth * (window.devicePixelRatio || 1);
    canvas.height = CANVAS_HEIGHT * (window.devicePixelRatio || 1);
    canvas.style.width = `${totalWidth}px`;
    canvas.style.height = `${CANVAS_HEIGHT}px`;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.scale(window.devicePixelRatio || 1, window.devicePixelRatio || 1);

    const render = async () => {
      try {
        const [inputImg, outputImg] = await Promise.all([
          loadImage(inputUrl),
          loadImage(outputUrl),
        ]);

        // Clear canvas
        ctx.clearRect(0, 0, totalWidth, CANVAS_HEIGHT);

        // Determine the display grid size (resize input to match panel)
        const ds = GRID_SIZE * PATCH_SIZE; // 16 * 4 = 64
        const scale = Math.min(panelWidth / ds, CANVAS_HEIGHT / ds);
        const displaySize = ds * scale;
        const xOffset = (panelWidth - displaySize) / 2;
        const yOffset = (CANVAS_HEIGHT - displaySize) / 2;

        // Panel 1: LR Input
        const p1x = PANEL_PADDING;
        drawPanelBackground(ctx, p1x, 0, panelWidth, CANVAS_HEIGHT, '#0d1117');
        ctx.drawImage(inputImg, p1x + xOffset, yOffset, displaySize, displaySize);
        drawPanelLabel(ctx, p1x + panelWidth / 2, CANVAS_HEIGHT - 8, 'LR Input');

        // Panel 2: Attention Overlay
        const p2x = PANEL_PADDING + panelWidth + PANEL_PADDING;
        drawPanelBackground(ctx, p2x, 0, panelWidth, CANVAS_HEIGHT, '#0d1117');

        // Draw input image as base
        ctx.drawImage(inputImg, p2x + xOffset, yOffset, displaySize, displaySize);

        // Draw attention heatmap overlay if matrix is available
        if (attnMatrix) {
          const n = NUM_PATCHES;
          const g = GRID_SIZE;

          // Get the attention row for the selected patch
          const row = attnMatrix.subarray(patchId * n, (patchId + 1) * n);

          // Reshape to gxg and normalize
          const pa = new Float64Array(g * g);
          for (let i = 0; i < g; i++) {
            for (let j = 0; j < g; j++) {
              pa[i * g + j] = row[i * g + j];
            }
          }

          // Find percentile range (1st and 99th)
          const sorted = new Float64Array(pa);
          sorted.sort();
          const vmin = sorted[Math.floor(sorted.length * 0.01)] || sorted[0];
          const vmax = sorted[Math.floor(sorted.length * 0.99)] || sorted[sorted.length - 1];
          const vrange = vmax - vmin || 1;

          // Calculate cell size in canvas pixels
          const cellSize = displaySize / g;

          // Blue gradient heatmap: low attention = light blue (barely visible), high attention = deep blue
          for (let row = 0; row < g; row++) {
            for (let col = 0; col < g; col++) {
              const val = (pa[row * g + col] - vmin) / vrange;
              const clamped = Math.max(0, Math.min(1, val));
              // Intensity maps to: alpha 0.05→0.85, blue deepens
              const alpha = 0.05 + clamped * 0.8;
              const r = Math.round(40 - clamped * 30);
              const gC = Math.round(110 - clamped * 60);
              const b = Math.round(180 + clamped * 75);
              ctx.fillStyle = `rgba(${r}, ${gC}, ${b}, ${alpha})`;
              ctx.fillRect(
                p2x + xOffset + col * cellSize,
                yOffset + row * cellSize,
                cellSize,
                cellSize,
              );
            }
          }

          // Draw grid lines
          ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
          ctx.lineWidth = 0.5;
          ctx.setLineDash([2, 2]);
          for (let i = 0; i <= g; i++) {
            const pos = i * cellSize;
            ctx.beginPath();
            ctx.moveTo(p2x + xOffset + pos, yOffset);
            ctx.lineTo(p2x + xOffset + pos, yOffset + displaySize);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(p2x + xOffset, yOffset + pos);
            ctx.lineTo(p2x + xOffset + displaySize, yOffset + pos);
            ctx.stroke();
          }
          ctx.setLineDash([]);

          // Draw red star marker on selected patch
          const patchRow = Math.floor(patchId / g);
          const patchCol = patchId % g;
          const cx = p2x + xOffset + patchCol * cellSize + cellSize / 2;
          const cy = yOffset + patchRow * cellSize + cellSize / 2;
          drawStar(ctx, cx, cy, cellSize * 0.4, '#ff0000');
        }

        const patchLabel = attnMatrix
          ? `Attn L? H? P${patchId}`
          : 'Attention Overlay';
        drawPanelLabel(ctx, p2x + panelWidth / 2, CANVAS_HEIGHT - 8, patchLabel, '#ffa502');

        // Panel 3: SR Output
        const p3x = PANEL_PADDING + (panelWidth + PANEL_PADDING) * 2;
        drawPanelBackground(ctx, p3x, 0, panelWidth, CANVAS_HEIGHT, '#0d1117');
        const outScale = Math.min(panelWidth / outputImg.width, CANVAS_HEIGHT / outputImg.height);
        const outDw = outputImg.width * outScale;
        const outDh = outputImg.height * outScale;
        const outX = p3x + (panelWidth - outDw) / 2;
        const outY = (CANVAS_HEIGHT - outDh) / 2;
        ctx.drawImage(outputImg, outX, outY, outDw, outDh);
        drawPanelLabel(ctx, p3x + panelWidth / 2, CANVAS_HEIGHT - 8, 'SR x4');
      } catch (err) {
        console.error('AttentionOverlay render error:', err);
        ctx.fillStyle = '#4a6080';
        ctx.font = '12px monospace';
        ctx.fillText('加载失败', 20, CANVAS_HEIGHT / 2);
      }
    };

    render();
  }, [inputUrl, outputUrl, attnMatrix, patchId, width]);

  return (
    <canvas
      ref={canvasRef}
      style={{
        maxWidth: '100%',
        borderRadius: '6px',
        border: '1px solid #1f2d42',
        background: '#0d1117',
      }}
    />
  );
};

/* ── Drawing helpers ────────────────────────────────────────── */

function drawPanelBackground(
  ctx: CanvasRenderingContext2D,
  x: number, y: number, w: number, h: number,
  color: string,
): void {
  ctx.fillStyle = color;
  ctx.fillRect(x, y, w, h);
}

function drawPanelLabel(
  ctx: CanvasRenderingContext2D,
  cx: number, y: number,
  text: string,
  color = '#8fa3bf',
): void {
  ctx.fillStyle = color;
  ctx.font = '10px ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace';
  ctx.textAlign = 'center';
  ctx.fillText(text, cx, y);
}

function drawStar(
  ctx: CanvasRenderingContext2D,
  cx: number, cy: number, r: number,
  color: string,
): void {
  const spikes = 5;
  const outerR = r;
  const innerR = r * 0.4;

  ctx.fillStyle = color;
  ctx.beginPath();
  for (let i = 0; i < spikes; i++) {
    const angle = (Math.PI / 2) * -1 + (i * Math.PI * 2) / spikes;
    const xOut = cx + Math.cos(angle) * outerR;
    const yOut = cy + Math.sin(angle) * outerR;
    if (i === 0) ctx.moveTo(xOut, yOut);
    else ctx.lineTo(xOut, yOut);

    const angleIn = angle + Math.PI / spikes;
    const xIn = cx + Math.cos(angleIn) * innerR;
    const yIn = cy + Math.sin(angleIn) * innerR;
    ctx.lineTo(xIn, yIn);
  }
  ctx.closePath();
  ctx.fill();

  // Black outline
  ctx.strokeStyle = 'black';
  ctx.lineWidth = 1;
  ctx.stroke();
}

export default AttentionOverlay;

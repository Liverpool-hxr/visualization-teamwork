/**
 * NPY data loading and computation service.
 * Replaces all backend API routes with pure frontend computation.
 */
import { load as npyLoad } from 'npyjs';
import {
  NUM_PATCHES,
  meanEntropy,
  klUniform,
  localityScore,
  rowVar,
  sparseRatio,
  svdMetrics,
} from '@/utils/math';
import type { AttentionTreeData, Layer, Head, Patch } from '@/types/attention';
import type { KLLocalityData, FunnelData, ThreeDBarData } from '@/types/chart';

/* ── Case configuration ─────────────────────────────────────── */

const CASE_LIST = ['example1', 'example2', 'example3', 'example4'];

interface NpyResult {
  data: Float32Array;
  shape: number[];
  numLayers: number;
  numHeads: number;
  numPatches: number;
}

/* ── Core: load NPY ─────────────────────────────────────────── */

let cachedResult: NpyResult | null = null;
let cachedCase: string | null = null;

export function getCaseList(): string[] {
  return CASE_LIST;
}

export async function loadNpyData(caseName: string): Promise<NpyResult> {
  if (cachedCase === caseName && cachedResult) {
    return cachedResult;
  }

  const url = `/mock/${caseName}/attn_list.npy`;
  const npy = await npyLoad(url);

  const data = npy.data as Float32Array;
  const shape = npy.shape; // [layers, 1, heads, patches, patches] or [layers, heads, patches, patches]

  // Determine dimensions
  const numLayers = shape[0];
  // Handle shape variations: [L, 1, H, N, N] or [L, H, N, N]
  let numHeads: number;
  let numPatches: number;

  if (shape.length === 5) {
    // [L, 1, H, N, N]
    numHeads = shape[2];
    numPatches = shape[3];
  } else if (shape.length === 4) {
    // [L, H, N, N]
    numHeads = shape[1];
    numPatches = shape[2];
  } else {
    // Fallback: try to infer
    numHeads = shape.length >= 3 ? shape[1] : Math.round(Math.sqrt(data.length / shape[0]));
    numPatches = shape.length >= 4 ? shape[2] : NUM_PATCHES;
  }

  cachedCase = caseName;
  cachedResult = { data, shape, numLayers, numHeads, numPatches };
  return cachedResult;
}

/* ── Access a single head's attention matrix ────────────────── */

export function getAttnMatrix(
  data: Float32Array,
  shape: number[],
  numPatches: number,
  layerId: number,
  headId: number,
): Float64Array {
  let offset: number;
  const is5D = shape.length === 5;
  const layerSize = is5D
    ? shape[2] * shape[3] * shape[4]  // heads * N * N
    : shape[1] * shape[2] * shape[3];  // heads * N * N

  if (shape.length === 5) {
    const headSize = shape[3] * shape[4];
    offset = layerId * layerSize + headId * headSize;
  } else {
    const headSize = shape[2] * shape[3];
    offset = layerId * layerSize + headId * headSize;
  }

  // Float32 → Float64: must copy values, cannot zero-copy (different element sizes + alignment)
  const src = new Float32Array(data.buffer, data.byteOffset + offset * 4, numPatches * numPatches);
  const dst = new Float64Array(numPatches * numPatches);
  dst.set(src);
  return dst;
}

/* ── Compute tree_stats ─────────────────────────────────────── */

export function computeTreeStats(
  data: Float32Array,
  shape: number[],
  numLayers: number,
  numHeads: number,
  numPatches: number,
): AttentionTreeData {
  const layers: Layer[] = [];

  for (let l = 0; l < numLayers; l++) {
    let layerEntropySum = 0;
    let layerMaxSum = 0;
    const heads: Head[] = [];

    for (let h = 0; h < numHeads; h++) {
      const mat = getAttnMatrix(data, shape, numPatches, l, h);
      const headEntropy = meanEntropy(mat, numPatches);
      const headMax = rowMaxMean(mat, numPatches);
      layerEntropySum += headEntropy;
      layerMaxSum += headMax;

      // Per-patch entropy
      const patches: Patch[] = [];
      for (let p = 0; p < numPatches; p++) {
        const row = mat.subarray(p * numPatches, (p + 1) * numPatches);
        let sum = 0;
        for (let j = 0; j < numPatches; j++) sum += row[j];
        let ent = 0;
        for (let j = 0; j < numPatches; j++) {
          const prob = row[j] / (sum + 1e-8);
          if (prob > 1e-8) ent -= prob * Math.log(prob);
        }
        patches.push({
          patch_id: p,
          entropy: round4(ent),
          max_attn: round4(rowMax(row)),
        });
      }

      heads.push({
        head_id: h,
        entropy: round4(headEntropy),
        max_attn: round4(headMax),
        patches,
      });
    }

    layers.push({
      layer_id: l,
      entropy: round4(layerEntropySum / numHeads),
      max_attn: round4(layerMaxSum / numHeads),
      heads,
    });
  }

  return {
    layers,
    meta: { num_layers: numLayers, num_heads: numHeads, num_patches: numPatches },
  };
}

/* ── Compute kl_locality ────────────────────────────────────── */

export function computeKLLocality(
  data: Float32Array,
  shape: number[],
  numLayers: number,
  numHeads: number,
  numPatches: number,
): KLLocalityData {
  const kl: number[][] = [];
  const lc: number[][] = [];

  for (let l = 0; l < numLayers; l++) {
    kl[l] = [];
    lc[l] = [];
    for (let h = 0; h < numHeads; h++) {
      const mat = getAttnMatrix(data, shape, numPatches, l, h);
      kl[l][h] = klUniform(mat, numPatches);
      lc[l][h] = localityScore(mat, numPatches);
    }
  }

  const layers = [];
  for (let l = 0; l < numLayers; l++) {
    const klMean = kl[l].reduce((a, b) => a + b, 0) / numHeads;
    const lcMean = lc[l].reduce((a, b) => a + b, 0) / numHeads;
    layers.push({
      layer: l,
      kl_per_head: kl[l].map(v => round6(v)),
      locality_per_head: lc[l].map(v => round6(v)),
      kl_mean: round6(klMean),
      locality_mean: round6(lcMean),
    });
  }

  return {
    layers,
    num_layers: numLayers,
    num_heads: numHeads,
    baseline_kl: 0,
    baseline_locality: 7.5625 / numPatches,
  };
}

/* ── Compute funnel ─────────────────────────────────────────── */

/** Utility: yield to main thread to prevent UI freeze */
function yieldToMain(): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, 0));
}

/** Compute funnel data with yielding between layers (prevents UI freeze from SVD) */
export async function computeFunnelDataAsync(
  data: Float32Array,
  shape: number[],
  numLayers: number,
  numHeads: number,
  numPatches: number,
  onProgress?: (layer: number, total: number) => void,
): Promise<FunnelData> {
  const er: number[] = [];
  const ms: number[] = [];

  for (let l = 0; l < numLayers; l++) {
    let totalER = 0;
    let totalMS = 0;
    for (let h = 0; h < numHeads; h++) {
      const mat = getAttnMatrix(data, shape, numPatches, l, h);
      const [rank, energy] = svdMetrics(mat, numPatches);
      totalER += rank;
      totalMS += energy;
    }
    er.push(totalER / numHeads);
    ms.push(totalMS / numHeads);
    onProgress?.(l + 1, numLayers);
    // Yield to browser after each layer (each layer's SVD is heavy)
    await yieldToMain();
  }

  const erBase = er[0] || 1;
  const msBase = ms[0] || 1;

  return {
    layers: Array.from({ length: numLayers }, (_, l) => ({
      layer: l,
      effective_rank_rel: round2((er[l] / erBase) * 100),
      singular_energy_rel: round2((ms[l] / msBase) * 100),
    })),
    num_layers: numLayers,
    num_heads: numHeads,
  };
}

/** Synchronous fallback (blocks UI, use computeFunnelDataAsync instead) */
export function computeFunnelData(
  data: Float32Array,
  shape: number[],
  numLayers: number,
  numHeads: number,
  numPatches: number,
): FunnelData {
  const er: number[] = [];
  const ms: number[] = [];

  for (let l = 0; l < numLayers; l++) {
    let totalER = 0;
    let totalMS = 0;
    for (let h = 0; h < numHeads; h++) {
      const mat = getAttnMatrix(data, shape, numPatches, l, h);
      const [rank, energy] = svdMetrics(mat, numPatches);
      totalER += rank;
      totalMS += energy;
    }
    er.push(totalER / numHeads);
    ms.push(totalMS / numHeads);
  }

  const erBase = er[0] || 1;
  const msBase = ms[0] || 1;

  return {
    layers: Array.from({ length: numLayers }, (_, l) => ({
      layer: l,
      effective_rank_rel: round2((er[l] / erBase) * 100),
      singular_energy_rel: round2((ms[l] / msBase) * 100),
    })),
    num_layers: numLayers,
    num_heads: numHeads,
  };
}

/* ── Compute 3d_bar (row_var + sparseRatio, no gini) ───────── */

export function compute3DBarData(
  data: Float32Array,
  shape: number[],
  numLayers: number,
  numHeads: number,
  numPatches: number,
): ThreeDBarData {
  const rawRV: number[] = [];
  const rawSR: number[] = [];

  for (let l = 0; l < numLayers; l++) {
    let rv = 0, sr = 0;
    for (let h = 0; h < numHeads; h++) {
      const mat = getAttnMatrix(data, shape, numPatches, l, h);
      rv += rowVar(mat, numPatches);
      sr += sparseRatio(mat);
    }
    rawRV.push(rv / numHeads);
    rawSR.push(sr / numHeads);
  }

  const baseRV = rawRV[0] || 1;
  const baseSR = rawSR[0] || 1;

  return {
    layers: rawRV.map((rv, l) => ({
      layer: l,
      row_var_rel: round2((rv / baseRV) * 100),
      sparsity_rel: round2((rawSR[l] / baseSR) * 100),
    })),
    num_layers: numLayers,
    num_heads: numHeads,
  };
}

/* ── Image URLs ─────────────────────────────────────────────── */

export function getImageUrls(caseName: string): { inputUrl: string; outputUrl: string } {
  return {
    inputUrl: `/mock/${caseName}/input.png`,
    outputUrl: `/mock/${caseName}/output.png`,
  };
}

/* ── Helpers ────────────────────────────────────────────────── */

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
function round6(n: number): number {
  return Math.round(n * 1000000) / 1000000;
}
function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function rowMax(row: Float64Array): number {
  let m = -Infinity;
  for (let i = 0; i < row.length; i++) {
    if (row[i] > m) m = row[i];
  }
  return m;
}

function rowMaxMean(mat: Float64Array, n: number): number {
  let total = 0;
  for (let i = 0; i < n; i++) {
    total += rowMax(mat.subarray(i * n, (i + 1) * n));
  }
  return total / n;
}

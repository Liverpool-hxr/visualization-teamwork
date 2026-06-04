# Pure Frontend Attention Heatmap Implementation Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task.

**Goal:** Replace backend Python visualization (Flask + matplotlib + cv2) with pure frontend computation (TypeScript + Canvas + npyjs), using pre-saved npy data from mock/example1~4 folders. Replace image upload with case selector dropdown.

**Architecture:** Frontend reads `attn_list.npy` via npyjs library, computes all metrics (entropy, KL, locality, SVD, row_var, gini, sparsity) in TypeScript, renders attention heatmap overlay using Canvas API (replacing matplotlib/cv2), displays input/output images directly. All 5 routes (/tree_stats, /visualize, /analysis/*) become frontend functions.

**Tech Stack:** TypeScript, React, npyjs (npm), Canvas 2D API, ECharts (existing)

---

### Task 1: Install npyjs dependency and prepare mock data

**Files:**
- Modify: `web/package.json`
- Create: `web/public/mock/example1/` ~ `web/public/mock/example4/`

**Step 1: Install npyjs**
```bash
cd web && npm install npyjs
```

**Step 2: Copy mock data to web/public/mock/**
Copy `../mock/example1`, `../mock/example2`, `../mock/example3`, `../mock/example4` into `web/public/mock/`. This makes them served as static assets by Vite.

---

### Task 2: Create math utility functions

**Files:**
- Create: `web/src/utils/math.ts`

Complete TypeScript re-implementation of all math functions from `backend/visualization.py`:

- `rowEntropy(mat)`: per-row Shannon entropy
- `meanEntropy(mat)`: mean entropy
- `klUniform(mat)`: KL divergence vs uniform distribution
- `localityScore(mat)`: locality score (neighboring patch attention)
- `rowVar(mat)`: row variance
- `sparseRatio(mat)`: sparsity ratio
- `giniCoefficient(mat)`: Gini coefficient
- `svdMetrics(mat)`: effective rank + singular energy ratio (power iteration, top 20)

Constants from visualization.py:
- `UNIFORM_PROB = 1 / NUM_PATCHES` (NUM_PATCHES = 256 for 64/4)
- `PATCH_SIZE = 4`

---

### Task 3: Create npyService.ts for loading and computing all data

**Files:**
- Create: `web/src/services/npyService.ts`

Exports:
- `loadNpyData(caseName: string)`: load attn_list.npy, return { data: Float32Array, shape: number[], numLayers, numHeads, numPatches }
- `computeTreeStats(attnData, shape)`: compute Layer/Head/Patch entropy tree (mirrors /tree_stats)
- `computeKLLocality(attnData, shape)`: compute KL locality data (mirrors /analysis/kl_locality)
- `computeFunnelData(attnData, shape)`: compute funnel data (mirrors /analysis/funnel)
- `compute3DBarData(attnData, shape)`: compute 3d bar data (mirrors /analysis/3d_bar)
- `getAttnMatrix(attnData, shape, layerId, headId)`: return a single head's attention matrix as Float64Array[N][N]
- `getImageUrls(caseName)`: return { inputUrl: string, outputUrl: string }

---

### Task 4: Create AttentionOverlay Canvas component

**Files:**
- Create: `web/src/components/charts/AttentionOverlay/index.tsx`
- Create: `web/src/components/charts/AttentionOverlay/index.module.css`

Props: `{ inputUrl, outputUrl, attnMatrix, patchId, numPatches, patchSize=4 }`

Renders three panels in a Canvas (mirroring matplotlib `plt.subplots(1, 3, figsize=(12, 4))`):
1. Left panel: draw input image (scaled to patch_grid_size * patchSize)
2. Middle panel: draw input image + attention heatmap overlay (0.6/0.4 blend) using JET colormap, grid lines, red star marker on selected patch
3. Right panel: draw output image (scaled to match display height)

The component accepts attnMatrix as a flat Float32Array of size [numPatches][numPatches] and uses the row corresponding to patchId for the heatmap.

---

### Task 5: Modify InspectorStore to support case-based mode

**Files:**
- Modify: `web/src/store/inspectorStore.tsx`

Changes:
- Add state fields: `activeCase: string | null`, `caseList: string[]`, `inputUrl: string | null`, `outputUrl: string | null`
- Add `attnData: Float32Array | null` + `attnShape: number[]` (raw attention data)
- Keep existing fields: tree, selected, heatmapUrl, status, logs
- Add action `setCase(caseName)`: loads npy data, computes tree_stats, sets inputUrl/outputUrl
- Modify `setSelected`: instead of calling API, it uses the cached attnData to compute the attention matrix for rendering (no URL needed - the heatmapUrl concept changes to a computed attention matrix)
- Add action `setAttnData(data: Float32Array, shape: number[])`: store raw attention data from npy

---

### Task 6: Modify SidebarStatic to replace upload with case selector

**Files:**
- Modify: `web/src/components/shell/SidebarStatic/index.tsx`
- Modify: `web/src/components/shell/SidebarStatic/index.module.css`

Changes:
- Remove: file input, drag-drop zone, "RUN MODEL" button, "加载树" button
- Add: Case selector dropdown (Ant Design Select or native select) with options: example1~4
- On case select: call `actions.setCase(caseName)` which auto-loads npy → compute tree → display
- Preview area: show input thumbnail + case name
- Keep: tree display (AttentionTree), legend, log bar
- Keep: patch click → setSelected → trigger heatmap render (no API call, directly passes attnMatrix)

---

### Task 7: Modify Heatmap page to use Canvas overlay and auto-load analysis data

**Files:**
- Modify: `web/src/pages/Heatmap/index.tsx`
- Modify: `web/src/pages/Heatmap/index.module.css`

Changes:
- Replace `<Image src={state.heatmapUrl}>` with `<AttentionOverlay>` component
- Pass: inputUrl, outputUrl, attnMatrix (from selected patch), patchId, numPatches
- Auto-load kl_locality data when case is selected (compute from attnData instead of API)
- Keep: head similarity heatmap (ECharts), but data now comes from computed npyService instead of API
- Keep: header badges (Layer X, Head Y, Patch Z)
- Keep: empty state message (adapt text)

---

### Task 8: Verify and test

**Files:**
- (verification only)

**Step 1:** Run `npm run dev` and verify the page loads without errors
**Step 2:** Select different cases from the dropdown, verify tree loads correctly
**Step 3:** Click patches in the tree, verify canvas renders heatmap overlay correctly
**Step 4:** Verify head similarity heatmap loads automatically
**Step 5:** Check no console errors

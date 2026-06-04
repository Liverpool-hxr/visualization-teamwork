/**
 * Pure TypeScript re-implementation of math functions from backend/visualization.py.
 * All operations work on Float64Array for performance.
 *
 * SVD: uses sklearn-style randomized SVD (random projection + QR + small SVD).
 *   - Generate random matrix Omega (n × k)
 *   - Y = A * Omega
 *   - QR decomposition to get orthonormal Q
 *   - B = Q^T * A  (k × n, small)
 *   - SVD of B via power iteration (B is only k × n)
 */

const EPS = 1e-8;

// ── Constants (matching visualization.py) ────────────────────
export const LR_SIZE = 64;
export const PATCH_SIZE = 4;
export const NUM_PATCHES = (LR_SIZE / PATCH_SIZE) ** 2; // 256
export const GRID_SIZE = Math.round(Math.sqrt(NUM_PATCHES)); // 16
export const UNIFORM_PROB = 1 / NUM_PATCHES;
export const UNIFORM_LOCALITY = 7.5625 / NUM_PATCHES;

/* ── Matrix helpers ─────────────────────────────────────────── */

export function getRow(mat: Float64Array, _n: number, row: number): Float64Array {
  return mat.subarray(row * _n, (row + 1) * _n);
}

function vecSum(vec: Float64Array): number {
  let s = 0;
  for (let i = 0; i < vec.length; i++) s += vec[i];
  return s;
}

/* ── Entropy ────────────────────────────────────────────────── */

export function rowEntropy(mat: Float64Array, n: number): Float64Array {
  const result = new Float64Array(n);
  for (let i = 0; i < n; i++) {
    const row = getRow(mat, n, i);
    const sum = vecSum(row);
    let ent = 0;
    for (let j = 0; j < n; j++) {
      const p = row[j] / (sum + EPS);
      if (p > EPS) ent -= p * Math.log(p);
    }
    result[i] = ent;
  }
  return result;
}

export function meanEntropy(mat: Float64Array, n: number): number {
  const ent = rowEntropy(mat, n);
  let sum = 0;
  for (let i = 0; i < n; i++) sum += ent[i];
  return sum / n;
}

/* ── KL Divergence vs Uniform ───────────────────────────────── */

export function klUniform(mat: Float64Array, n: number): number {
  let total = 0;
  for (let i = 0; i < n; i++) {
    const row = getRow(mat, n, i);
    const sum = vecSum(row);
    let rowKl = 0;
    for (let j = 0; j < n; j++) {
      const p = row[j] / (sum + EPS);
      if (p > EPS) rowKl += p * Math.log(p / (UNIFORM_PROB + EPS));
    }
    total += rowKl;
  }
  return total / n;
}

/* ── Locality Score ─────────────────────────────────────────── */

export function localityScore(mat: Float64Array, n: number): number {
  const g = Math.round(Math.sqrt(n));
  let total = 0;
  for (let i = 0; i < n; i++) {
    const row = getRow(mat, n, i);
    const ri = Math.floor(i / g);
    const ci = i % g;
    let s = 0;
    for (let j = 0; j < n; j++) {
      const rj = Math.floor(j / g);
      const cj = j % g;
      if (Math.abs(ri - rj) <= 1 && Math.abs(ci - cj) <= 1) s += row[j];
    }
    total += s;
  }
  return total / n;
}

/* ── Row Variance (lightweight, per head) ───────────────────── */

export function rowVar(mat: Float64Array, n: number): number {
  let total = 0;
  for (let i = 0; i < n; i++) {
    const row = getRow(mat, n, i);
    const mean = vecSum(row) / n;
    let v = 0;
    for (let j = 0; j < n; j++) {
      const d = row[j] - mean;
      v += d * d;
    }
    total += v / n;
  }
  return total / n;
}

/* ── Sparsity Ratio ─────────────────────────────────────────── */

export function sparseRatio(mat: Float64Array): number {
  const len = mat.length;
  let sum = 0;
  for (let i = 0; i < len; i++) sum += mat[i];
  const threshold = (sum / len) * 1.2;
  let count = 0;
  for (let i = 0; i < len; i++) {
    if (mat[i] > threshold) count++;
  }
  return count / len;
}

/* ── SVD Metrics (sklearn-style randomized SVD) ─────────────── */

/**
 * Gram-Schmidt orthonormalization of columns of Y (n rows × k columns, stored column-major).
 * Returns Q same shape as Y.
 */
function gramSchmidt(Y: Float64Array, n: number, k: number): Float64Array {
  const Q = new Float64Array(n * k);

  for (let j = 0; j < k; j++) {
    // Copy column j from Y
    for (let i = 0; i < n; i++) {
      Q[i * k + j] = Y[i * k + j];
    }
    // Subtract projections onto previous q's
    for (let prev = 0; prev < j; prev++) {
      let dot = 0;
      for (let i = 0; i < n; i++) {
        dot += Q[i * k + j] * Q[i * k + prev];
      }
      for (let i = 0; i < n; i++) {
        Q[i * k + j] -= dot * Q[i * k + prev];
      }
    }
    // Normalize
    let norm = 0;
    for (let i = 0; i < n; i++) {
      norm += Q[i * k + j] * Q[i * k + j];
    }
    const invNorm = 1 / (Math.sqrt(norm) + 1e-15);
    for (let i = 0; i < n; i++) {
      Q[i * k + j] *= invNorm;
    }
  }
  return Q;
}

/**
 * Randomized SVD to get top-k singular values.
 * Mirrors sklearn's randomized_svd(mat, n_components=k, random_state=0).
 * Steps:
 *   1. Omega = random matrix (n × k)
 *   2. Y = A * Omega
 *   3. Q = QR(Y) → orthonormal basis
 *   4. B = Q^T * A → (k × n) small matrix
 *   5. SVD of B via power iteration on B^T → singular values
 */
function randomizedSVD(mat: Float64Array, n: number, k: number): number[] {
  // Step 1: Random projection matrix Omega (n × k)
  // Use a pseudo-random "seed" for reproducibility
  const Omega = new Float64Array(n * k);
  for (let i = 0; i < n * k; i++) {
    // Deterministic "random" using simple hash
    Omega[i] = Math.sin(i * 12.9898 + 78.233) * 43758.5453;
    Omega[i] = Omega[i] - Math.floor(Omega[i]);
  }

  // Step 2: Y = A * Omega  (n × k), stored column-major
  const Y = new Float64Array(n * k);
  for (let i = 0; i < n; i++) {
    const aRow = i * n;
    for (let j = 0; j < k; j++) {
      let sum = 0;
      for (let m = 0; m < n; m++) {
        sum += mat[aRow + m] * Omega[m * k + j];
      }
      Y[i * k + j] = sum;
    }
  }

  // Step 3: QR orthonormalization
  const Q = gramSchmidt(Y, n, k);

  // Step 4: B = Q^T * A  (k × n)
  const B = new Float64Array(k * n);
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < n; j++) {
      let sum = 0;
      for (let m = 0; m < n; m++) {
        sum += Q[m * k + i] * mat[m * n + j];
      }
      B[i * n + j] = sum;
    }
  }

  // Step 5: SVD of B via power iteration on B * B^T (k × k, tiny!)
  // C = B * B^T is symmetric positive definite k × k
  const C = new Float64Array(k * k);
  for (let i = 0; i < k; i++) {
    for (let j = 0; j < k; j++) {
      let sum = 0;
      for (let m = 0; m < n; m++) {
        sum += B[i * n + m] * B[j * n + m];
      }
      C[i * k + j] = sum;
    }
  }

  // Compute eigenvalues of C (k × k small matrix) via power iteration + deflation
  const eigenvalues = computeEigenvalues(C, k, Math.min(k, 8));
  eigenvalues.sort((a, b) => b - a);

  // Singular values = sqrt(eigenvalues)
  return eigenvalues
    .filter((v) => v > 1e-12)
    .map((v) => Math.sqrt(v));
}

/**
 * Compute top-k eigenvalues of symmetric matrix C (size × size) via power iteration.
 * Small matrix, uses correct deflation.
 */
function computeEigenvalues(
  C: Float64Array,
  size: number,
  components: number,
): number[] {
  const result: number[] = [];
  const working = new Float64Array(C);

  for (let comp = 0; comp < components; comp++) {
    // Power iteration on a small symmetric matrix
    let v = new Float64Array(size);
    for (let i = 0; i < size; i++) v[i] = Math.sin((i + 1) * 1.5);
    // Normalize
    let vnorm = 0;
    for (let i = 0; i < size; i++) vnorm += v[i] * v[i];
    vnorm = Math.sqrt(vnorm);
    for (let i = 0; i < size; i++) v[i] /= vnorm;

    let lambda = 0;
    for (let iter = 0; iter < 40; iter++) {
      // u = C * v
      const u = new Float64Array(size);
      for (let i = 0; i < size; i++) {
        let s = 0;
        const rowBase = i * size;
        for (let j = 0; j < size; j++) {
          s += working[rowBase + j] * v[j];
        }
        u[i] = s;
      }
      // Rayleigh quotient
      let num = 0;
      for (let i = 0; i < size; i++) num += v[i] * u[i];
      const newLambda = num;
      // Normalize
      let unorm = 0;
      for (let i = 0; i < size; i++) unorm += u[i] * u[i];
      unorm = Math.sqrt(unorm);
      if (unorm < 1e-15) break;
      for (let i = 0; i < size; i++) v[i] = u[i] / unorm;
      if (Math.abs(newLambda - lambda) < 1e-8) break;
      lambda = newLambda;
    }

    if (lambda < 1e-12) break;
    result.push(lambda);

    // Deflate: C = C - lambda * v * v^T
    for (let i = 0; i < size; i++) {
      const rowBase = i * size;
      for (let j = 0; j < size; j++) {
        working[rowBase + j] -= lambda * v[i] * v[j];
      }
    }
  }

  return result;
}

/**
 * Compute effective rank and singular energy ratio.
 * Mirrors Python's svd_metrics exactly.
 */
export function svdMetrics(mat: Float64Array, n: number, eps = 1e-3): [number, number] {
  const k = Math.min(12, n);
  const s = randomizedSVD(mat, n, k);

  if (s.length === 0) return [0, 1];

  const s0 = s[0];
  const valid = s.filter((v) => v > s0 * eps).length;
  const totalSum = s.reduce((a, b) => a + b, 0);
  const energyRatio = s0 / (totalSum + EPS);

  return [valid, energyRatio];
}

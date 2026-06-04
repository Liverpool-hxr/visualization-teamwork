/* eslint-disable react-refresh/only-export-components */
import React, { createContext, useContext, useMemo, useReducer } from 'react';

import type { AttentionTreeData } from '@/types/attention';
import type { FunnelData, KLLocalityData, ThreeDBarData } from '@/types/chart';
import {
  loadNpyData,
  computeTreeStats,
  computeKLLocality,
  computeFunnelDataAsync,
  compute3DBarData,
  getImageUrls,
  getAttnMatrix,
  getCaseList,
} from '@/services/npyService';

export type InspectorStatus = 'idle' | 'busy' | 'ready' | 'error';

export type LogLevel = 'ok' | 'warn' | 'err';

export interface InspectorLogItem {
  ts: number;
  level: LogLevel;
  message: string;
}

export interface SelectedPatch {
  layerId: number;
  headId: number;
  patchId: number;
}

export interface AnalysisCache {
  kl?: KLLocalityData;
  fn?: FunnelData;
  bar3d?: ThreeDBarData;
}

export interface InspectorState {
  status: InspectorStatus;
  logs: InspectorLogItem[];

  /* ── Case mode ── */
  activeCase: string | null;
  caseList: string[];
  inputUrl: string | null;
  outputUrl: string | null;

  /* ── Raw attention data ── */
  attnData: Float32Array | null;
  attnShape: number[];
  numLayers: number;
  numHeads: number;
  numPatches: number;

  /* ── Computed tree ── */
  tree: AttentionTreeData | null;
  selected: SelectedPatch | null;

  /* ── Current attn matrix for selected patch (for heatmap overlay) ── */
  heatmapMatrix: Float64Array | null;

  /* ── Analysis cache ── */
  analysisCache: AnalysisCache;
}

const initialState: InspectorState = {
  status: 'idle',
  logs: [{ ts: Date.now(), level: 'warn', message: '⌁ 选择一个案例开始分析…' }],

  activeCase: null,
  caseList: getCaseList(),
  inputUrl: null,
  outputUrl: null,

  attnData: null,
  attnShape: [],
  numLayers: 0,
  numHeads: 0,
  numPatches: 0,

  tree: null,
  selected: null,
  heatmapMatrix: null,

  analysisCache: {},
};

type Action =
  | { type: 'setStatus'; status: InspectorStatus }
  | { type: 'pushLog'; item: InspectorLogItem }
  | { type: 'setCase'; caseName: string; inputUrl: string; outputUrl: string }
  | { type: 'setAttnData'; data: Float32Array; shape: number[]; numLayers: number; numHeads: number; numPatches: number }
  | { type: 'setTree'; tree: AttentionTreeData | null }
  | { type: 'setSelected'; selected: SelectedPatch | null }
  | { type: 'setHeatmapMatrix'; matrix: Float64Array | null }
  | { type: 'setAnalysisCache'; patch: Partial<AnalysisCache> }
  | { type: 'resetSession' };

const reducer = (state: InspectorState, action: Action): InspectorState => {
  switch (action.type) {
    case 'setStatus':
      return { ...state, status: action.status };
    case 'pushLog':
      return { ...state, logs: [...state.logs, action.item] };
    case 'setCase':
      return {
        ...state,
        activeCase: action.caseName,
        inputUrl: action.inputUrl,
        outputUrl: action.outputUrl,
        tree: null,
        selected: null,
        heatmapMatrix: null,
        analysisCache: {},
      };
    case 'setAttnData':
      return {
        ...state,
        attnData: action.data,
        attnShape: action.shape,
        numLayers: action.numLayers,
        numHeads: action.numHeads,
        numPatches: action.numPatches,
      };
    case 'setTree':
      return { ...state, tree: action.tree };
    case 'setSelected':
      return { ...state, selected: action.selected };
    case 'setHeatmapMatrix':
      return { ...state, heatmapMatrix: action.matrix };
    case 'setAnalysisCache':
      return { ...state, analysisCache: { ...state.analysisCache, ...action.patch } };
    case 'resetSession':
      return initialState;
    default:
      return state;
  }
};

export interface InspectorActions {
  setStatus: (status: InspectorStatus) => void;
  pushLog: (level: LogLevel, message: string) => void;
  /** Select a case: loads NPY → computes tree → sets everything */
  selectCase: (caseName: string) => Promise<void>;
  /** Select a patch: computes attn matrix for heatmap overlay */
  selectPatch: (params: SelectedPatch) => void;
  /** Load an analysis dataset if not already cached. Returns the computed data. */
  loadAnalysis: <K extends keyof AnalysisCache>(key: K) => Promise<AnalysisCache[K] | undefined>;
  setSelected: (selected: SelectedPatch | null) => void;
  setHeatmapMatrix: (matrix: Float64Array | null) => void;
  resetSession: () => void;
}

export interface InspectorContextValue {
  state: InspectorState;
  actions: InspectorActions;
}

const InspectorContext = createContext<InspectorContextValue | null>(null);

export const InspectorProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, dispatch] = useReducer(reducer, initialState);

  const actions = useMemo<InspectorActions>(() => {
    const _selectCase = async (caseName: string) => {
      dispatch({ type: 'setStatus', status: 'busy' });
      dispatch({ type: 'pushLog', item: { ts: Date.now(), level: 'warn', message: `加载案例 ${caseName}…` } });

      try {
        const urls = getImageUrls(caseName);
        dispatch({ type: 'setCase', caseName, inputUrl: urls.inputUrl, outputUrl: urls.outputUrl });

        const npy = await loadNpyData(caseName);
        dispatch({
          type: 'setAttnData',
          data: npy.data,
          shape: npy.shape,
          numLayers: npy.numLayers,
          numHeads: npy.numHeads,
          numPatches: npy.numPatches,
        });
        dispatch({ type: 'pushLog', item: { ts: Date.now(), level: 'ok', message: `数据加载完成: ${npy.numLayers}层 ${npy.numHeads}头 ${npy.numPatches}patches` } });

        // Compute tree stats (can be slow, do in next tick)
        dispatch({ type: 'pushLog', item: { ts: Date.now(), level: 'warn', message: '计算注意力树…' } });
        const tree = computeTreeStats(npy.data, npy.shape, npy.numLayers, npy.numHeads, npy.numPatches);
        dispatch({ type: 'setTree', tree });
        dispatch({ type: 'pushLog', item: { ts: Date.now(), level: 'ok', message: `树计算完成: ${tree.meta?.num_layers ?? tree.layers.length} 层` } });
        dispatch({ type: 'setStatus', status: 'ready' });
      } catch (e) {
        dispatch({ type: 'pushLog', item: { ts: Date.now(), level: 'err', message: `加载失败: ${e instanceof Error ? e.message : String(e)}` } });
        dispatch({ type: 'setStatus', status: 'error' });
      }
    };

    const _selectPatch = (params: SelectedPatch) => {
      if (!state.attnData || !state.attnShape.length) return;
      try {
        const matrix = getAttnMatrix(
          state.attnData,
          state.attnShape,
          state.numPatches,
          params.layerId,
          params.headId,
        );
        dispatch({ type: 'setSelected', selected: params });
        dispatch({ type: 'setHeatmapMatrix', matrix });
        dispatch({ type: 'setStatus', status: 'ready' });
        dispatch({ type: 'pushLog', item: { ts: Date.now(), level: 'ok', message: `热力图就绪 L${params.layerId} H${params.headId} P${params.patchId}` } });
      } catch (e) {
        dispatch({ type: 'pushLog', item: { ts: Date.now(), level: 'err', message: `热力图失败: ${e instanceof Error ? e.message : String(e)}` } });
      }
    };

    const _loadAnalysis = async <K extends keyof AnalysisCache>(key: K): Promise<AnalysisCache[K] | undefined> => {
      if (state.analysisCache[key]) return state.analysisCache[key];
      if (!state.attnData || !state.attnShape.length) return undefined;

      dispatch({ type: 'setStatus', status: 'busy' });
      try {
        let result: AnalysisCache[K];
        switch (key) {
          case 'kl':
            result = computeKLLocality(
              state.attnData, state.attnShape, state.numLayers, state.numHeads, state.numPatches,
            ) as AnalysisCache[K];
            break;
          case 'fn':
            dispatch({ type: 'pushLog', item: { ts: Date.now(), level: 'warn', message: '计算漏斗数据 (SVD, 可能稍慢)…' } });
            result = (await computeFunnelDataAsync(
              state.attnData, state.attnShape, state.numLayers, state.numHeads, state.numPatches,
              (layer, total) => {
                dispatch({ type: 'pushLog', item: { ts: Date.now(), level: 'warn', message: `漏斗: Layer ${layer}/${total}` } });
              },
            )) as AnalysisCache[K];
            break;
          case 'bar3d':
            result = compute3DBarData(
              state.attnData, state.attnShape, state.numLayers, state.numHeads, state.numPatches,
            ) as AnalysisCache[K];
            break;
          default:
            return undefined;
        }
        dispatch({ type: 'setAnalysisCache', patch: { [key]: result } });
        dispatch({ type: 'setStatus', status: 'ready' });
        return result;
      } catch (e) {
        dispatch({ type: 'pushLog', item: { ts: Date.now(), level: 'err', message: `${key} 分析失败: ${e instanceof Error ? e.message : String(e)}` } });
        dispatch({ type: 'setStatus', status: 'error' });
        return undefined;
      }
    };

    // Reference the current state via closure - these functions need to close over
    // the attnData/attnShape from when they're called, not from creation time.
    // We use a mutable ref pattern.
    const stateRef = { current: state };

    return {
      setStatus: (status) => dispatch({ type: 'setStatus', status }),
      pushLog: (level, message) =>
        dispatch({
          type: 'pushLog',
          item: { ts: Date.now(), level, message },
        }),
      selectCase: _selectCase,
      selectPatch: _selectPatch,
      loadAnalysis: _loadAnalysis,
      setSelected: (selected) => dispatch({ type: 'setSelected', selected }),
      setHeatmapMatrix: (matrix) => dispatch({ type: 'setHeatmapMatrix', matrix }),
      resetSession: () => dispatch({ type: 'resetSession' }),
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.analysisCache, state.attnData, state.attnShape, state.numLayers, state.numHeads, state.numPatches]);

  const value = useMemo<InspectorContextValue>(() => ({ state, actions }), [state, actions]);

  return <InspectorContext.Provider value={value}>{children}</InspectorContext.Provider>;
};

export const useInspector = (): InspectorContextValue => {
  const ctx = useContext(InspectorContext);
  if (!ctx) throw new Error('useInspector 必须在 InspectorProvider 内使用');
  return ctx;
};

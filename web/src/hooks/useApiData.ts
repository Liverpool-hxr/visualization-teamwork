import { useState, useEffect, useCallback } from 'react';
import { api } from '@/services/api';
import type { AttentionTreeData } from '@/types/attention';
import type { KLLocalityData, FunnelData, ThreeDBarData } from '@/types/chart';

export interface ApiDataMap {
  treeStats: AttentionTreeData;
  klLocality: KLLocalityData;
  funnel: FunnelData;
  threeDBar: ThreeDBarData;
}

export type ApiDataType = keyof ApiDataMap;

export interface UseApiDataResult<T = unknown> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

export interface UseApiDataOptions {
  enabled?: boolean;
}

const fetchDataMap: { [K in ApiDataType]: () => Promise<ApiDataMap[K]> } = {
  treeStats: () => api.getTreeStats<AttentionTreeData>(),
  klLocality: () => api.getKLLocality<KLLocalityData>(),
  funnel: () => api.getFunnel<FunnelData>(),
  threeDBar: () => api.get3DBar<ThreeDBarData>(),
};

export const useApiData = <K extends ApiDataType>(
  dataType: K,
  options?: UseApiDataOptions,
): UseApiDataResult<ApiDataMap[K]> => {
  const [data, setData] = useState<ApiDataMap[K] | null>(null);
  const [loading, setLoading] = useState(options?.enabled !== false);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    return fetchDataMap[dataType]();
  }, [dataType]);

  useEffect(() => {
    if (options?.enabled === false) return;
    let isMounted = true;
    fetchData()
      .then((result) => {
        if (isMounted) {
          setData(result);
          setLoading(false);
        }
      })
      .catch((err: unknown) => {
        if (isMounted) {
          setError(err instanceof Error ? err.message : 'Failed to fetch data');
          setLoading(false);
        }
      });
    return () => {
      isMounted = false;
    };
  }, [fetchData, options?.enabled]);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchData()
      .then((result) => {
        setData(result);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
      })
      .finally(() => {
        setLoading(false);
      });
  }, [fetchData]);

  return {
    data,
    loading,
    error,
    refetch,
  };
};

export const useTreeStats = (): UseApiDataResult<AttentionTreeData> => {
  return useApiData('treeStats');
};

export const useKLLocality = (): UseApiDataResult<KLLocalityData> => {
  return useApiData('klLocality');
};

export const useFunnel = (): UseApiDataResult<FunnelData> => {
  return useApiData('funnel');
};

export const use3DBar = (): UseApiDataResult<ThreeDBarData> => {
  return useApiData('threeDBar');
};

export default useApiData;

import { useState, useEffect, useCallback } from 'react';
import { mockService } from '@/services/mockService';
import type { AttentionTreeData } from '@/types/attention';
import type { KLLocalityData, FunnelData } from '@/types/chart';

export type DataType = 'treeStats' | 'klLocality' | 'funnel' | 'all';

export interface UseMockDataResult<T = unknown> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const fetchDataMap = {
  treeStats: () => mockService.getTreeStats(),
  klLocality: () => mockService.getKLLocality(),
  funnel: () => mockService.getFunnel(),
  all: () => mockService.getAllData(),
};

export const useMockData = <T = unknown>(dataType: DataType): UseMockDataResult<T> => {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    const result = await fetchDataMap[dataType]();
    return result as T;
  }, [dataType]);

  useEffect(() => {
    let isMounted = true;
    fetchData().then((result) => {
      if (isMounted) {
        setData(result);
        setLoading(false);
      }
    }).catch((err) => {
      if (isMounted) {
        setError(err instanceof Error ? err.message : 'Failed to fetch data');
        setLoading(false);
      }
    });
    return () => {
      isMounted = false;
    };
  }, [fetchData]);

  const refetch = useCallback(() => {
    setLoading(true);
    setError(null);
    fetchData().then((result) => {
      setData(result);
    }).catch((err) => {
      setError(err instanceof Error ? err.message : 'Failed to fetch data');
    }).finally(() => {
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

export const useTreeStats = (): UseMockDataResult<AttentionTreeData> => {
  return useMockData<AttentionTreeData>('treeStats');
};

export const useKLLocality = (): UseMockDataResult<KLLocalityData> => {
  return useMockData<KLLocalityData>('klLocality');
};

export const useFunnel = (): UseMockDataResult<FunnelData> => {
  return useMockData<FunnelData>('funnel');
};

export default useMockData;
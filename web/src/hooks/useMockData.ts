import { useState, useEffect, useCallback } from 'react';
import { mockService } from '@/services/mockService';
import type { AttentionTreeData } from '@/types/attention';
import type { KLLocalityData, FunnelData, ThreeDBarData } from '@/types/chart';

export interface AllMockData {
  treeStats: AttentionTreeData;
  klLocality: KLLocalityData;
  funnel: FunnelData;
  threeDBar: ThreeDBarData;
  visualizeImageUrl: string;
}

export interface MockDataMap {
  treeStats: AttentionTreeData;
  klLocality: KLLocalityData;
  funnel: FunnelData;
  threeDBar: ThreeDBarData;
  visualizeImageUrl: string;
  all: AllMockData;
}

export type DataType = keyof MockDataMap;

export interface UseMockDataResult<T = unknown> {
  data: T | null;
  loading: boolean;
  error: string | null;
  refetch: () => void;
}

const fetchDataMap: { [K in DataType]: () => Promise<MockDataMap[K]> } = {
  treeStats: () => mockService.getTreeStats(),
  klLocality: () => mockService.getKLLocality(),
  funnel: () => mockService.getFunnel(),
  threeDBar: () => mockService.get3DBar(),
  visualizeImageUrl: () => mockService.getVisualizeImageUrl(),
  all: () => mockService.getAllData(),
};

export const useMockData = <K extends DataType>(dataType: K): UseMockDataResult<MockDataMap[K]> => {
  const [data, setData] = useState<MockDataMap[K] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    return fetchDataMap[dataType]();
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
  return useMockData('treeStats');
};

export const useKLLocality = (): UseMockDataResult<KLLocalityData> => {
  return useMockData('klLocality');
};

export const useFunnel = (): UseMockDataResult<FunnelData> => {
  return useMockData('funnel');
};

export const use3DBar = (): UseMockDataResult<ThreeDBarData> => {
  return useMockData('threeDBar');
};

export const useVisualizeImageUrl = (): UseMockDataResult<string> => {
  return useMockData('visualizeImageUrl');
};

export default useMockData;

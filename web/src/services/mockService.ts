import type { AttentionTreeData } from '@/types/attention';
import type { KLLocalityData, FunnelData } from '@/types/chart';

const MOCK_BASE_PATH = '../mock';

const fetchJson = async <T>(fileName: string): Promise<T> => {
  const response = await fetch(`${MOCK_BASE_PATH}/${fileName}`);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${fileName}: ${response.statusText}`);
  }
  return response.json();
};

export const mockService = {
  async getTreeStats(): Promise<AttentionTreeData> {
    return fetchJson<AttentionTreeData>('tree_stats.json');
  },

  async getKLLocality(): Promise<KLLocalityData> {
    return fetchJson<KLLocalityData>('kl_locality.json');
  },

  async getFunnel(): Promise<FunnelData> {
    return fetchJson<FunnelData>('funnel.json');
  },

  async getAllData() {
    const [treeStats, klLocality, funnel] = await Promise.all([
      this.getTreeStats(),
      this.getKLLocality(),
      this.getFunnel(),
    ]);
    return {
      treeStats,
      klLocality,
      funnel,
    };
  },
};

export default mockService;
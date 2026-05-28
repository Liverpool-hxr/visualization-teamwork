import type { AttentionTreeData } from '@/types/attention';
import type { KLLocalityData, FunnelData } from '@/types/chart';

import treeStatsUrl from '../../../mock/tree_stats.json?url';
import klLocalityUrl from '../../../mock/kl_locality.json?url';
import funnelUrl from '../../../mock/funnel.json?url';
import visualizeImageUrl from '../../../mock/visualize.jpg?url';

const fetchJsonFromUrl = async <T>(url: string): Promise<T> => {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.statusText}`);
  }
  return response.json();
};

export const mockService = {
  async getTreeStats(): Promise<AttentionTreeData> {
    return fetchJsonFromUrl<AttentionTreeData>(treeStatsUrl);
  },

  async getKLLocality(): Promise<KLLocalityData> {
    return fetchJsonFromUrl<KLLocalityData>(klLocalityUrl);
  },

  async getFunnel(): Promise<FunnelData> {
    return fetchJsonFromUrl<FunnelData>(funnelUrl);
  },

  async getVisualizeImageUrl(): Promise<string> {
    return visualizeImageUrl;
  },

  async getAllData() {
    const [treeStats, klLocality, funnel, visualizeUrl] = await Promise.all([
      this.getTreeStats(),
      this.getKLLocality(),
      this.getFunnel(),
      this.getVisualizeImageUrl(),
    ]);
    return {
      treeStats,
      klLocality,
      funnel,
      visualizeImageUrl: visualizeUrl,
    };
  },
};

export default mockService;

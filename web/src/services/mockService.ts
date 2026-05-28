import type { AttentionTreeData } from '@/types/attention';
import type { KLLocalityData, FunnelData, ThreeDBarData } from '@/types/chart';

import treeStatsUrl from '../../../mock/tree_stats.json?url';
import klLocalityUrl from '../../../mock/kl_locality.json?url';
import funnelUrl from '../../../mock/funnel.json?url';
import threeDBarUrl from '../../../mock/3d_bar.json?url';
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

  async get3DBar(): Promise<ThreeDBarData> {
    return fetchJsonFromUrl<ThreeDBarData>(threeDBarUrl);
  },

  async getVisualizeImageUrl(): Promise<string> {
    return visualizeImageUrl;
  },

  async getAllData() {
    const [treeStats, klLocality, funnel, threeDBar, visualizeUrl] = await Promise.all([
      this.getTreeStats(),
      this.getKLLocality(),
      this.getFunnel(),
      this.get3DBar(),
      this.getVisualizeImageUrl(),
    ]);
    return {
      treeStats,
      klLocality,
      funnel,
      threeDBar,
      visualizeImageUrl: visualizeUrl,
    };
  },
};

export default mockService;

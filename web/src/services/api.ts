export interface ApiMessageResponse {
  message: string;
}

const normalizeBaseUrl = (raw?: string): string => {
  if (!raw) return '';
  return raw.endsWith('/') ? raw.slice(0, -1) : raw;
};

const API_BASE_URL = normalizeBaseUrl(import.meta.env.VITE_API_BASE_URL);

const withBaseUrl = (path: string): string => {
  if (!API_BASE_URL) return path;
  return `${API_BASE_URL}${path}`;
};

const safeParseJson = async <T>(response: Response): Promise<T | null> => {
  try {
    return (await response.json()) as T;
  } catch {
    return null;
  }
};

const requestJson = async <T>(path: string, init?: RequestInit): Promise<T> => {
  const response = await fetch(withBaseUrl(path), init);
  const data = await safeParseJson<T & Partial<ApiMessageResponse>>(response);
  if (!response.ok) {
    throw new Error(data?.message || response.statusText || '请求失败');
  }
  return (data ?? ({} as T)) as T;
};

export const api = {
  async runModel(image: File): Promise<ApiMessageResponse> {
    const formData = new FormData();
    formData.append('image', image);
    return requestJson<ApiMessageResponse>('/run', { method: 'POST', body: formData });
  },

  async getTreeStats<T>(): Promise<T> {
    return requestJson<T>('/tree_stats');
  },

  async getKLLocality<T>(): Promise<T> {
    return requestJson<T>('/analysis/kl_locality');
  },

  async getFunnel<T>(): Promise<T> {
    return requestJson<T>('/analysis/funnel');
  },

  async get3DBar<T>(): Promise<T> {
    return requestJson<T>('/analysis/3d_bar');
  },

  async getVisualizeBlob(params: { layer_id: number; head_id: number; patch_id: number }): Promise<Blob> {
    const query = new URLSearchParams({
      layer_id: String(params.layer_id),
      head_id: String(params.head_id),
      patch_id: String(params.patch_id),
    });
    const response = await fetch(withBaseUrl(`/visualize?${query.toString()}`));
    if (!response.ok) {
      const data = await safeParseJson<ApiMessageResponse>(response);
      throw new Error(data?.message || response.statusText || '热力图加载失败');
    }
    return response.blob();
  },
};

export default api;

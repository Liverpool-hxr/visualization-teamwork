export interface KLLocalityPerLayer {
  layer: number;
  kl_per_head: number[];
  locality_per_head: number[];
  kl_mean: number;
  locality_mean: number;
}

export interface KLLocalityData {
  layers: KLLocalityPerLayer[];
  num_layers: number;
  num_heads: number;
  baseline_kl: number;
  baseline_locality: number;
}

export interface FunnelPerLayer {
  layer: number;
  effective_rank_rel: number;
  singular_energy_rel: number;
}

export interface FunnelData {
  layers: FunnelPerLayer[];
  num_layers: number;
  num_heads: number;
}

export interface ThreeDBarPerLayer {
  layer: number;
  row_var_rel: number;
  sparsity_rel: number;
}

export interface ThreeDBarData {
  layers: ThreeDBarPerLayer[];
  num_layers: number;
  num_heads: number;
}

export interface HeatmapDataPoint {
  x: number;
  y: number;
  value: number;
  layer?: number;
  head?: number;
}

export interface HeatmapData {
  data: HeatmapDataPoint[];
  xAxis?: string[];
  yAxis?: string[];
}

export interface ChartConfig {
  title?: string;
  xAxisLabel?: string;
  yAxisLabel?: string;
  colorScheme?: string[];
  showLegend?: boolean;
  showTooltip?: boolean;
}

export interface ChartData<T = unknown> {
  type: string;
  data: T;
  config?: ChartConfig;
}

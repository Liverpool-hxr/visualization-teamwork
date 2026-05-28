export interface Patch {
  patch_id: number;
  entropy: number;
  max_attn: number;
}

export interface Head {
  head_id: number;
  entropy: number;
  max_attn: number;
  patches: Patch[];
}

export interface Layer {
  layer_id: number;
  entropy: number;
  max_attn: number;
  heads: Head[];
}

export interface AttentionTreeData {
  layers: Layer[];
}

export type NodeType = 'layer' | 'head' | 'patch';

export interface TreeNodeData {
  id: string;
  type: NodeType;
  name: string;
  entropy: number;
  max_attn: number;
  children?: TreeNodeData[];
  layerId?: number;
  headId?: number;
  patchId?: number;
}

export interface AttentionStats {
  layerId: number;
  headId?: number;
  patchId?: number;
  entropy: number;
  maxAttn: number;
}
import React, { useState, useMemo } from 'react';
import type { Layer, TreeNodeData } from '@/types/attention';
import TreeNode from './TreeNode';
import styles from './index.module.css';

interface AttentionTreeProps {
  data: Layer[];
}

const AttentionTree: React.FC<AttentionTreeProps> = ({ data }) => {
  const [expandedNodes, setExpandedNodes] = useState<Set<string>>(new Set(['layer-0']));

  const treeData: TreeNodeData[] = useMemo(() => {
    return data.map((layer) => ({
      id: `layer-${layer.layer_id}`,
      type: 'layer' as const,
      name: `Layer ${layer.layer_id}`,
      entropy: layer.entropy,
      max_attn: layer.max_attn,
      layerId: layer.layer_id,
      children: layer.heads.map((head) => ({
        id: `layer-${layer.layer_id}-head-${head.head_id}`,
        type: 'head' as const,
        name: `Head ${head.head_id}`,
        entropy: head.entropy,
        max_attn: head.max_attn,
        layerId: layer.layer_id,
        headId: head.head_id,
        children: head.patches.map((patch) => ({
          id: `layer-${layer.layer_id}-head-${head.head_id}-patch-${patch.patch_id}`,
          type: 'patch' as const,
          name: `Patch ${patch.patch_id}`,
          entropy: patch.entropy,
          max_attn: patch.max_attn,
          layerId: layer.layer_id,
          headId: head.head_id,
          patchId: patch.patch_id,
        })),
      })),
    }));
  }, [data]);

  const toggleExpand = (nodeId: string) => {
    setExpandedNodes((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(nodeId)) {
        newSet.delete(nodeId);
      } else {
        newSet.add(nodeId);
      }
      return newSet;
    });
  };

  const isExpanded = (nodeId: string) => expandedNodes.has(nodeId);

  return (
    <div className={styles.treeContainer}>
      <div className={styles.treeHeader}>
        <h3>Transformer Attention Tree</h3>
        <span className={styles.nodeCount}>
          {data.length} layers, {data[0]?.heads.length || 0} heads/layer
        </span>
      </div>
      <div className={styles.treeContent}>
        {treeData.map((node) => (
          <TreeNode
            key={node.id}
            node={node}
            isExpanded={isExpanded(node.id)}
            onToggle={toggleExpand}
            depth={0}
          />
        ))}
      </div>
    </div>
  );
};

export default AttentionTree;
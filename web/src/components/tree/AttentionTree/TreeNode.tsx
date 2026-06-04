import React from 'react';
import type { TreeNodeData } from '@/types/attention';
import styles from './index.module.css';

interface TreeNodeProps {
  node: TreeNodeData;
  isExpanded: boolean;
  onToggle: (nodeId: string) => void;
  depth: number;
}

const TreeNode: React.FC<TreeNodeProps> = ({ node, isExpanded, onToggle, depth }) => {
  const hasChildren = node.children && node.children.length > 0;

  const handleClick = () => {
    if (hasChildren) {
      onToggle(node.id);
    }
  };

  const getIconContent = () => {
    switch (node.type) {
      case 'layer':
        return 'L';
      case 'head':
        return 'H';
      case 'patch':
        return 'P';
      default:
        return '•';
    }
  };

  return (
    <div className={styles.nodeWrapper}>
      <div
        className={`${styles.expandIcon} ${isExpanded ? styles.expanded : ''} ${!hasChildren ? styles.empty : ''}`}
        onClick={handleClick}
      >
        ▶
      </div>
      <div
        className={`${styles.nodeContent} ${!hasChildren ? styles.leafNode : ''}`}
        onClick={handleClick}
      >
        <div className={`${styles.nodeIcon} ${styles[node.type]}`}>
          {getIconContent()}
        </div>
        <div className={styles.nodeInfo}>
          <p className={styles.nodeName}>{node.name}</p>
          <div className={styles.nodeStats}>
            <span className={styles.statItem}>
              <span className={styles.statLabel}>Entropy:</span>
              <span className={styles.statValue}>{node.entropy.toFixed(4)}</span>
            </span>
            <span className={styles.statItem}>
              <span className={styles.statLabel}>Max Attn:</span>
              <span className={styles.statValue}>{node.max_attn.toFixed(4)}</span>
            </span>
          </div>
        </div>
      </div>
      {hasChildren && (
        <div className={`${styles.childrenWrapper} ${isExpanded ? styles.expanded : ''}`}>
          <div className={styles.childrenContent}>
            {node.children?.map((child) => (
              <TreeNode
                key={child.id}
                node={child}
                isExpanded={false}
                onToggle={onToggle}
                depth={depth + 1}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
};

export default TreeNode;

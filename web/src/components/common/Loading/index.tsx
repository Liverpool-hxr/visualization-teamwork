import React from 'react';
import { Spin } from 'antd';
import styles from './index.module.css';

interface LoadingProps {
  description?: string;
  size?: 'small' | 'medium' | 'large';
}

const Loading: React.FC<LoadingProps> = ({ description = 'Loading...', size = 'medium' }) => {
  return (
    <div className={styles.container}>
      <Spin size={size} description={description} className={styles.spin} />
    </div>
  );
};

export default Loading;
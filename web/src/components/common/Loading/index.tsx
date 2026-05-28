import React from 'react';
import { Spin } from 'antd';
import styles from './index.module.css';

interface LoadingProps {
  tip?: string;
  size?: 'small' | 'default' | 'large';
}

const Loading: React.FC<LoadingProps> = ({ tip = 'Loading...', size = 'default' }) => {
  return (
    <div className={styles.container}>
      <Spin size={size} tip={tip} className={styles.spin} />
    </div>
  );
};

export default Loading;
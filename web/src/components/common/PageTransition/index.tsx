import React from 'react';
import { Outlet } from 'react-router-dom';
import styles from './index.module.css';

const PageTransition: React.FC = () => {
  return (
    <div className={styles.pageContent}>
      <Outlet />
    </div>
  );
};

export default PageTransition;

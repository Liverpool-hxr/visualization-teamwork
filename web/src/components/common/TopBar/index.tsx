import React from 'react';
import { Layout } from 'antd';
import { MonitorOutlined, UserOutlined } from '@ant-design/icons';
import styles from './index.module.css';

const { Header } = Layout;

const TopBar: React.FC = () => {
  return (
    <Header className={styles.header}>
      <div className={styles.logo}>
        <MonitorOutlined className={styles.logoIcon} />
        <span className={styles.title}>MultiVIT SR</span>
      </div>
      <div className={styles.userInfo}>
        <UserOutlined className={styles.userIcon} />
        <span className={styles.userName}>User</span>
      </div>
    </Header>
  );
};

export default TopBar;
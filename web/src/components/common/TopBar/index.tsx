import React from 'react';
import { Layout, Button } from 'antd';
import { MonitorOutlined, UserOutlined, MenuOutlined } from '@ant-design/icons';
import styles from './index.module.css';

const { Header } = Layout;

interface TopBarProps {
  onMenuClick?: () => void;
  showMenuButton?: boolean;
}

const TopBar: React.FC<TopBarProps> = ({ onMenuClick, showMenuButton }) => {
  return (
    <Header className={styles.header}>
      <div className={styles.leftSection}>
        {showMenuButton && (
          <Button 
            className={styles.menuButton}
            icon={<MenuOutlined />}
            onClick={onMenuClick}
          />
        )}
        <div className={styles.logo}>
          <MonitorOutlined className={styles.logoIcon} />
          <span className={styles.title}>MultiVIT SR</span>
        </div>
      </div>
      <div className={styles.userInfo}>
        <UserOutlined className={styles.userIcon} />
        <span className={styles.userName}>User</span>
      </div>
    </Header>
  );
};

export default TopBar;

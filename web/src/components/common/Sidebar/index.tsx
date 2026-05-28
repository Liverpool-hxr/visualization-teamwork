import React from 'react';
import { Layout, Menu } from 'antd';
import { HeatMapOutlined, BarChartOutlined, LayoutOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './index.module.css';

const { Sider } = Layout;

type MenuItemType = {
  key: string;
  label: string;
  icon: React.ReactNode;
  path: string;
};

const menuItems: MenuItemType[] = [
  {
    key: 'heatmap',
    label: 'Heatmap',
    icon: <HeatMapOutlined />,
    path: '/heatmap',
  },
  {
    key: 'analysis',
    label: 'Analysis',
    icon: <BarChartOutlined />,
    path: '/analysis',
  },
  {
    key: 'overview',
    label: 'Overview',
    icon: <LayoutOutlined />,
    path: '/overview',
  },
];

const Sidebar: React.FC = () => {
  const location = useLocation();
  const navigate = useNavigate();
  const currentKey = location.pathname.replace('/', '') || 'heatmap';

  const handleMenuClick = (item: { key: string }) => {
    const menuItem = menuItems.find((m) => m.key === item.key);
    if (menuItem) {
      navigate(menuItem.path);
    }
  };

  return (
    <Sider className={styles.sider} width={200} theme="dark">
      <Menu
        mode="inline"
        selectedKeys={[currentKey]}
        onClick={handleMenuClick}
        className={styles.menu}
        items={menuItems.map((item) => ({
          key: item.key,
          label: item.label,
          icon: item.icon,
        }))}
      />
    </Sider>
  );
};

export default Sidebar;
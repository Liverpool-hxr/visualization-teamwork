import React from 'react';
import { Menu } from 'antd';
import { HeatMapOutlined, BarChartOutlined, LayoutOutlined } from '@ant-design/icons';
import { useLocation, useNavigate } from 'react-router-dom';
import styles from './index.module.css';

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

interface SidebarProps {
  collapsed?: boolean;
}

const Sidebar: React.FC<SidebarProps> = ({ collapsed = false }) => {
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
    <Menu
      mode={collapsed ? 'vertical' : 'inline'}
      selectedKeys={[currentKey]}
      onClick={handleMenuClick}
      className={styles.menu}
      inlineCollapsed={collapsed}
      items={menuItems.map((item) => ({
        key: item.key,
        label: item.label,
        icon: item.icon,
      }))}
    />
  );
};

export default Sidebar;

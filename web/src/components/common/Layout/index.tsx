import React, { useState, useEffect } from 'react';
import { Layout, Button } from 'antd';
import { XOutlined } from '@ant-design/icons';
import TopBar from '../TopBar';
import Sidebar from '../Sidebar';
import styles from './index.module.css';

const { Content, Sider } = Layout;

interface LayoutProps {
  children: React.ReactNode;
}

const AppLayout: React.FC<LayoutProps> = ({ children }) => {
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);
  const [isMobile, setIsMobile] = useState(false);
  const [showMobileSidebar, setShowMobileSidebar] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
      if (window.innerWidth < 768) {
        setShowMobileSidebar(false);
      } else {
        setShowMobileSidebar(true);
      }
    };

    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const toggleSidebar = () => {
    if (isMobile) {
      setShowMobileSidebar(!showMobileSidebar);
    } else {
      setIsSidebarCollapsed(!isSidebarCollapsed);
    }
  };

  return (
    <Layout className={styles.layout}>
      <TopBar 
        onMenuClick={toggleSidebar} 
        showMenuButton={isMobile}
      />
      <Layout>
        {!isMobile && (
          <Sider 
            className={styles.sider} 
            width={isSidebarCollapsed ? 80 : 200} 
            theme="dark"
            collapsible
            collapsed={isSidebarCollapsed}
            onCollapse={setIsSidebarCollapsed}
          >
            <Sidebar collapsed={isSidebarCollapsed} />
          </Sider>
        )}
        
        {isMobile && showMobileSidebar && (
          <div className={styles.mobileSidebarOverlay} onClick={() => setShowMobileSidebar(false)}>
            <Sider className={styles.mobileSider} width={200} theme="dark">
              <Button
                className={styles.closeButton}
                icon={<XOutlined />}
                onClick={() => setShowMobileSidebar(false)}
              />
              <Sidebar collapsed={false} />
            </Sider>
          </div>
        )}
        
        <Content className={styles.content}>
          {children}
        </Content>
      </Layout>
    </Layout>
  );
};

export default AppLayout;

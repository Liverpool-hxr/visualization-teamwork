import React from 'react';
import { CSSTransition, SwitchTransition } from 'react-transition-group';
import { Outlet, useLocation } from 'react-router-dom';
import styles from './index.module.css';

const PageTransition: React.FC = () => {
  const location = useLocation();
  const nodeRef = React.useRef<HTMLDivElement>(null);

  return (
    <div className={styles.transitionGroup}>
      <SwitchTransition mode="out-in">
        <CSSTransition key={location.pathname} nodeRef={nodeRef} timeout={{ enter: 300, exit: 200 }} classNames="page">
          <div ref={nodeRef} className={styles.pageContent}>
            <Outlet />
          </div>
        </CSSTransition>
      </SwitchTransition>
    </div>
  );
};

export default PageTransition;

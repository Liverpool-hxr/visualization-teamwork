import React from 'react';
import { CSSTransition, TransitionGroup } from 'react-transition-group';
import { Outlet, useLocation } from 'react-router-dom';
import styles from './index.module.css';

const PageTransition: React.FC = () => {
  const location = useLocation();

  return (
    <TransitionGroup className={styles.transitionGroup}>
      <CSSTransition
        key={location.pathname}
        timeout={{ enter: 300, exit: 200 }}
        classNames="page"
      >
        <div className={styles.pageContent}>
          <Outlet />
        </div>
      </CSSTransition>
    </TransitionGroup>
  );
};

export default PageTransition;

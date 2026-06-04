import React from 'react';
import { Modal as AntModal } from 'antd';
import type { ModalProps } from 'antd';

interface AppModalProps extends ModalProps {
  children: React.ReactNode;
}

const Modal: React.FC<AppModalProps> = (props) => {
  const { children, ...rest } = props;
  
  return (
    <AntModal
      {...rest}
      wrapClassName="custom-modal"
      footer={null}
    >
      {children}
    </AntModal>
  );
};

export default Modal;
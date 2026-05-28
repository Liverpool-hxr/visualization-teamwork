import React, { useState } from 'react';
import { Upload, Button, Image, message } from 'antd';
import type { UploadFile } from 'antd';
import UploadIcon from '@ant-design/icons/UploadOutlined';
import XIcon from '@ant-design/icons/CloseOutlined';
import styles from './index.module.css';

interface ImageUploadProps {
  onImageSelect?: (file: File) => void;
  disabled?: boolean;
  accept?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({ 
  onImageSelect, 
  disabled = false,
  accept = 'image/*' 
}) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = e.target?.result as string;
      setPreviewImage(result);
      setFileList([{
        uid: Math.random().toString(36).substr(2, 9),
        name: file.name,
        status: 'done',
        url: result,
      }]);
      onImageSelect?.(file);
    };
    reader.readAsDataURL(file);
    message.success('图片上传成功');
    return false;
  };

  const handleRemove = () => {
    setPreviewImage(null);
    setFileList([]);
    message.info('图片已移除');
  };

  return (
    <div className={styles.container}>
      {previewImage ? (
        <div className={styles.previewWrapper}>
          <Image
            src={previewImage}
            alt="预览图"
            className={styles.previewImage}
            preview={false}
          />
          <Button
            type="text"
            icon={<XIcon />}
            onClick={handleRemove}
            className={styles.removeButton}
            disabled={disabled}
          />
        </div>
      ) : (
        <Upload
          accept={accept}
          fileList={fileList}
          beforeUpload={handleUpload}
          listType="picture-card"
          disabled={disabled}
          className={styles.uploadButton}
        >
          <div className={styles.uploadIconWrapper}>
            <UploadIcon className={styles.uploadIcon} />
            <p className={styles.uploadText}>点击上传图片</p>
          </div>
        </Upload>
      )}
    </div>
  );
};

export default ImageUpload;
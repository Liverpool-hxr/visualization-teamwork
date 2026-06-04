import React, { useState } from 'react';
import { Upload, Button, Image, message } from 'antd';
import type { UploadFile } from 'antd';
import UploadIcon from '@ant-design/icons/UploadOutlined';
import XIcon from '@ant-design/icons/CloseOutlined';
import styles from './index.module.css';

interface ImageUploadProps {
  value?: string | null;
  onChange?: (value: string | null, file?: File) => void;
  onImageSelect?: (file: File) => void;
  disabled?: boolean;
  accept?: string;
}

const ImageUpload: React.FC<ImageUploadProps> = ({
  value,
  onChange,
  onImageSelect,
  disabled = false,
  accept = 'image/*',
}) => {
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [fileList, setFileList] = useState<UploadFile[]>([]);
  const isControlled = value !== undefined;
  const currentPreview = isControlled ? value : previewImage;
  const effectiveFileList = isControlled ? [] : fileList;

  const handleUpload = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const result = typeof e.target?.result === 'string' ? e.target.result : null;
      if (!result) return;
      onChange?.(result, file);
      if (!isControlled) {
        setPreviewImage(result);
      }
      setFileList([
        {
          uid: Math.random().toString(36).substring(2, 11),
          name: file.name,
          status: 'done',
          url: result,
        },
      ]);
      onImageSelect?.(file);
    };
    reader.readAsDataURL(file);
    message.success('图片上传成功');
    return false;
  };

  const handleRemove = () => {
    onChange?.(null);
    if (!isControlled) {
      setPreviewImage(null);
    }
    setFileList([]);
    message.info('图片已移除');
  };

  return (
    <div className={styles.container}>
      {currentPreview ? (
        <div className={styles.previewWrapper}>
          <Image
            src={currentPreview}
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
          fileList={effectiveFileList}
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

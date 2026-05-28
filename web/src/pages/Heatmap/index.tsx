import React from 'react';
import { Row, Col, Card, Button } from 'antd';
import HeatmapChart from '@/components/charts/HeatmapChart';
import AttentionTree from '@/components/tree/AttentionTree';
import ImageUpload from '@/components/upload/ImageUpload';
import { useTreeStats, useKLLocality, useVisualizeImageUrl } from '@/hooks/useMockData';
import Loading from '@/components/common/Loading';
import styles from './index.module.css';

const Heatmap: React.FC = () => {
  const { data: treeStats, loading: treeLoading } = useTreeStats();
  const { data: klLocality, loading: klLoading } = useKLLocality();
  const { data: visualizeImageUrl, loading: visualizeLoading } = useVisualizeImageUrl();
  const [imageUrl, setImageUrl] = React.useState<string | null>(null);

  const heatmapData = React.useMemo(() => {
    if (!klLocality) return [];
    const data: { x: number; y: number; value: number }[] = [];
    klLocality.layers.forEach((layer) => {
      layer.kl_per_head.forEach((value, headIdx) => {
        data.push({
          x: layer.layer,
          y: headIdx,
          value,
        });
      });
    });
    return data;
  }, [klLocality]);

  if (treeLoading || klLoading) {
    return <Loading />;
  }

  return (
    <div className={styles.page}>
      <Row gutter={16}>
        <Col xs={24} lg={12}>
          <Card
            title="Image Upload"
            className={styles.uploadCard}
            extra={
              <Button
                onClick={() => {
                  if (visualizeImageUrl) {
                    setImageUrl(visualizeImageUrl);
                  }
                }}
                disabled={visualizeLoading || !visualizeImageUrl}
              >
                使用示例图片
              </Button>
            }
          >
            <ImageUpload
              value={imageUrl}
              onChange={(next, file) => {
                void file;
                setImageUrl(next);
              }}
            />
          </Card>
        </Col>
        <Col xs={24} lg={12}>
          <Card title="Attention Tree">
            {treeStats && <AttentionTree data={treeStats.layers} />}
          </Card>
        </Col>
      </Row>
      <Row gutter={16}>
        <Col span={24}>
          <Card title="KL Divergence Heatmap">
            <HeatmapChart
              data={heatmapData}
              config={{
                title: '',
                xAxisLabel: 'Layer',
                yAxisLabel: 'Head',
              }}
              height={400}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Heatmap;

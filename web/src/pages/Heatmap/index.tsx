import React from 'react';
import { Row, Col, Card } from 'antd';
import HeatmapChart from '@/components/charts/HeatmapChart';
import AttentionTree from '@/components/tree/AttentionTree';
import ImageUpload from '@/components/upload/ImageUpload';
import { useTreeStats, useKLLocality } from '@/hooks/useMockData';
import Loading from '@/components/common/Loading';

const Heatmap: React.FC = () => {
  const { data: treeStats, loading: treeLoading } = useTreeStats();
  const { data: klLocality, loading: klLoading } = useKLLocality();

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
    <div style={{ padding: '24px' }}>
      <Row gutter={16}>
        <Col span={12}>
          <Card title="Image Upload" style={{ marginBottom: 16 }}>
            <ImageUpload />
          </Card>
        </Col>
        <Col span={12}>
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
              width={800}
              height={400}
            />
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Heatmap;
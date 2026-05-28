import React, { useState } from 'react';
import { Row, Col, Card, Select } from 'antd';
import KLLocalityChart from '@/components/charts/KLLocalityChart';
import FunnelChart from '@/components/charts/FunnelChart';
import DegradeChart from '@/components/charts/DegradeChart';
import LayerSimilarityChart from '@/components/charts/LayerSimilarityChart';
import HeadSimilarityChart from '@/components/charts/HeadSimilarityChart';
import { useKLLocality, useFunnel } from '@/hooks/useMockData';
import Loading from '@/components/common/Loading';

const Analysis: React.FC = () => {
  const { data: klLocality, loading: klLoading } = useKLLocality();
  const { data: funnel, loading: funnelLoading } = useFunnel();
  const [selectedLayer, setSelectedLayer] = useState(0);

  const layerOptions = klLocality?.layers.map((layer) => ({
    value: layer.layer,
    label: `Layer ${layer.layer}`,
  })) || [];

  if (klLoading || funnelLoading) {
    return <Loading />;
  }

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: '24px' }}>Analysis Dashboard</h1>
      
      <Row gutter={16}>
        <Col span={12}>
          <Card title="KL Divergence & Locality">
            {klLocality && (
              <KLLocalityChart
                data={klLocality}
                config={{
                  xAxisLabel: 'Layer',
                  yAxisLabel: 'Value',
                }}
                width={550}
                height={350}
              />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Effective Rank & Singular Energy">
            {funnel && (
              <FunnelChart
                data={funnel}
                config={{
                  xAxisLabel: 'Layer',
                  yAxisLabel: 'Percentage',
                }}
                width={550}
                height={350}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: '16px' }}>
        <Col span={12}>
          <Card title="Degradation Analysis">
            {funnel && (
              <DegradeChart
                data={funnel}
                config={{
                  xAxisLabel: 'Layer',
                  yAxisLabel: 'Degradation %',
                }}
                width={550}
                height={350}
              />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card 
            title="Layer Similarity Matrix"
            extra={
              <span style={{ fontSize: '12px', color: '#666' }}>
                Based on KL Divergence & Locality
              </span>
            }
          >
            {klLocality && (
              <LayerSimilarityChart
                data={klLocality}
                config={{
                  xAxisLabel: 'Layer',
                  yAxisLabel: 'Layer',
                }}
                width={550}
                height={350}
              />
            )}
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginTop: '16px' }}>
        <Col span={12}>
          <Card 
            title="Head Similarity Matrix"
            extra={
              <Select
                value={selectedLayer}
                onChange={setSelectedLayer}
                options={layerOptions}
                style={{ width: 120 }}
              />
            }
          >
            {klLocality && (
              <HeadSimilarityChart
                data={klLocality}
                layerIndex={selectedLayer}
                config={{
                  xAxisLabel: 'Head',
                  yAxisLabel: 'Head',
                  title: `Layer ${selectedLayer} Heads`,
                }}
                width={550}
                height={350}
              />
            )}
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Summary Statistics">
            <div style={{ padding: '16px' }}>
              <h4 style={{ marginBottom: '16px' }}>Dataset Overview</h4>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '16px' }}>
                <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#1890ff' }}>
                    {klLocality?.num_layers || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Layers</div>
                </div>
                <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#52c41a' }}>
                    {klLocality?.num_heads || 0}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Heads per Layer</div>
                </div>
                <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#faad14' }}>
                    {(klLocality?.baseline_kl || 0).toFixed(4)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Baseline KL</div>
                </div>
                <div style={{ padding: '12px', background: '#f5f5f5', borderRadius: '8px' }}>
                  <div style={{ fontSize: '24px', fontWeight: 'bold', color: '#f5222d' }}>
                    {(klLocality?.baseline_locality || 0).toFixed(4)}
                  </div>
                  <div style={{ fontSize: '12px', color: '#666' }}>Baseline Locality</div>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Analysis;

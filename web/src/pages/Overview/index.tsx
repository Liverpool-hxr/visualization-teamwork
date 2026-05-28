import React from 'react';
import { Row, Col, Card, Statistic, Tag } from 'antd';
import { 
  DatabaseOutlined, 
  CiOutlined, 
  BarsOutlined, 
  EyeOutlined,
  WarningOutlined,
  BranchesOutlined,
  ApiOutlined
} from '@ant-design/icons';
import ActivityOutlined from '@ant-design/icons';
import { useKLLocality, useFunnel, useTreeStats } from '@/hooks/useMockData';
import Loading from '@/components/common/Loading';

const Overview: React.FC = () => {
  const { data: klLocality, loading: klLoading } = useKLLocality();
  const { data: funnel, loading: funnelLoading } = useFunnel();
  const { data: treeStats, loading: treeLoading } = useTreeStats();

  const numLayers = klLocality?.num_layers ?? 0;
  const numHeads = klLocality?.num_heads ?? 0;
  const totalHeads = numLayers * numHeads;
  
  const layers = klLocality?.layers || [];
  const avgKL = layers.reduce((sum, layer) => sum + layer.kl_mean, 0) / numLayers || 0;
  const avgLocality = layers.reduce((sum, layer) => sum + layer.locality_mean, 0) / numLayers || 0;

  const totalPatches = treeStats?.layers.reduce((layerSum, layer) => 
    layerSum + layer.heads.reduce((headSum, head) => headSum + head.patches.length, 0), 0) || 0;

  if (klLoading || funnelLoading || treeLoading) {
    return <Loading />;
  }

  return (
    <div style={{ padding: '24px' }}>
      <h1 style={{ marginBottom: '24px' }}>Model Overview</h1>
      
      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="Number of Layers"
              value={numLayers}
              prefix={<BarsOutlined />}
              suffix="layers"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="Heads per Layer"
              value={numHeads}
              prefix={<CiOutlined />}
              suffix="heads"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="Total Attention Heads"
              value={totalHeads}
              prefix={<BranchesOutlined />}
              suffix="heads"
            />
          </Card>
        </Col>
        <Col span={6}>
          <Card className="stat-card">
            <Statistic
              title="Patches Analyzed"
              value={totalPatches}
              prefix={<DatabaseOutlined />}
              suffix="patches"
            />
          </Card>
        </Col>
      </Row>

      <Row gutter={16} style={{ marginBottom: '24px' }}>
        <Col span={12}>
          <Card title="Model Configuration" className="config-card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="config-item">
                <span className="config-label">Model Architecture</span>
                <Tag color="blue">ViT-Large</Tag>
              </div>
              <div className="config-item">
                <span className="config-label">Patch Size</span>
                <Tag color="green">16x16</Tag>
              </div>
              <div className="config-item">
                <span className="config-label">Hidden Dimension</span>
                <Tag color="purple">1024</Tag>
              </div>
              <div className="config-item">
                <span className="config-label">MLP Ratio</span>
                <Tag color="orange">4.0</Tag>
              </div>
              <div className="config-item">
                <span className="config-label">Attention Heads</span>
                <Tag color="cyan">{numHeads}</Tag>
              </div>
              <div className="config-item">
                <span className="config-label">Layers</span>
                <Tag color="magenta">{numLayers}</Tag>
              </div>
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Performance Metrics" className="metrics-card">
            <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
              <div className="metric-item">
                <div className="metric-header">
                  <ActivityOutlined className="metric-icon" />
                  <span className="metric-label">Average KL Divergence</span>
                </div>
                <div className="metric-value">
                  <span className="value-number">{avgKL.toFixed(4)}</span>
                  <span className="value-unit">nats</span>
                </div>
                <div className="metric-bar">
                  <div 
                    className="metric-fill kl-fill" 
                    style={{ width: `${Math.min(avgKL * 20, 100)}%` }} 
                  />
                </div>
              </div>
              <div className="metric-item">
                <div className="metric-header">
                  <EyeOutlined className="metric-icon" />
                  <span className="metric-label">Average Locality</span>
                </div>
                <div className="metric-value">
                  <span className="value-number">{avgLocality.toFixed(4)}</span>
                  <span className="value-unit">score</span>
                </div>
                <div className="metric-bar">
                  <div 
                    className="metric-fill locality-fill" 
                    style={{ width: `${Math.min(avgLocality * 100, 100)}%` }} 
                  />
                </div>
              </div>
              <div className="metric-item">
                <div className="metric-header">
                  <WarningOutlined className="metric-icon" />
                  <span className="metric-label">Baseline KL</span>
                </div>
                <div className="metric-value">
                  <span className="value-number">{klLocality?.baseline_kl?.toFixed(4) || '0.0000'}</span>
                  <span className="value-unit">nats</span>
                </div>
              </div>
              <div className="metric-item">
                <div className="metric-header">
                  <ApiOutlined className="metric-icon" />
                  <span className="metric-label">Baseline Locality</span>
                </div>
                <div className="metric-value">
                  <span className="value-number">{klLocality?.baseline_locality?.toFixed(4) || '0.0000'}</span>
                  <span className="value-unit">score</span>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>

      <Row gutter={16}>
        <Col span={12}>
          <Card title="Layer Analysis Summary" className="summary-card">
            <div className="layer-summary">
              <div className="summary-header">
                <span>Layer</span>
                <span>KL Mean</span>
                <span>Locality Mean</span>
                <span>Effective Rank</span>
              </div>
              {layers.slice(0, 6).map((layer, idx) => (
                <div key={idx} className="summary-row">
                  <span className="layer-num">L{layer.layer}</span>
                  <span>{layer.kl_mean.toFixed(3)}</span>
                  <span>{layer.locality_mean.toFixed(3)}</span>
                  <span>{funnel?.layers[layer.layer]?.effective_rank_rel.toFixed(2) || '-'}%</span>
                </div>
              ))}
              {numLayers > 6 && (
                <div className="summary-more">
                  ... and {numLayers - 6} more layers
                </div>
              )}
            </div>
          </Card>
        </Col>
        <Col span={12}>
          <Card title="Key Insights" className="insights-card">
            <div className="insights-list">
              <div className="insight-item">
                <div className="insight-badge">High</div>
                <div className="insight-content">
                  <h4>Layer-wise KL Divergence</h4>
                  <p>The KL divergence varies significantly across layers, indicating different attention patterns.</p>
                </div>
              </div>
              <div className="insight-item">
                <div className="insight-badge">Medium</div>
                <div className="insight-content">
                  <h4>Locality Preservation</h4>
                  <p>Lower layers show higher locality scores, suggesting they preserve spatial information.</p>
                </div>
              </div>
              <div className="insight-item">
                <div className="insight-badge">Low</div>
                <div className="insight-content">
                  <h4>Effective Rank Variation</h4>
                  <p>Effective rank decreases in deeper layers, indicating more structured representations.</p>
                </div>
              </div>
            </div>
          </Card>
        </Col>
      </Row>
    </div>
  );
};

export default Overview;

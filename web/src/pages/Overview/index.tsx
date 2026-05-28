import React, { useMemo } from 'react';
import { Row, Col, Card, Statistic, Table } from 'antd';
import type { ColumnsType } from 'antd/es/table';
import {
  DatabaseOutlined,
  BarsOutlined,
  BranchesOutlined,
  ClusterOutlined,
} from '@ant-design/icons';
import { useKLLocality, useFunnel, useTreeStats, use3DBar } from '@/hooks/useMockData';
import KLLocalityChart from '@/components/charts/KLLocalityChart';
import FunnelChart from '@/components/charts/FunnelChart';
import ThreeDBarChart from '@/components/charts/ThreeDBarChart';
import Loading from '@/components/common/Loading';
import styles from './index.module.css';

interface TopPatchRow {
  key: string;
  layerId: number;
  headId: number;
  patchId: number;
  maxAttn: number;
  entropy: number;
}

const Overview: React.FC = () => {
  const { data: klLocality, loading: klLoading } = useKLLocality();
  const { data: funnel, loading: funnelLoading } = useFunnel();
  const { data: treeStats, loading: treeLoading } = useTreeStats();
  const { data: threeDBar, loading: barLoading } = use3DBar();

  const numLayers = klLocality?.num_layers ?? 0;
  const numHeads = klLocality?.num_heads ?? 0;
  const totalHeads = numLayers * numHeads;

  const treeSummary = useMemo(() => {
    if (!treeStats) return null;

    const rows: TopPatchRow[] = [];
    let patchCount = 0;
    let entropySum = 0;
    let maxAttnSum = 0;
    let maxAttnPeak = 0;

    treeStats.layers.forEach((layer) => {
      layer.heads.forEach((head) => {
        head.patches.forEach((patch) => {
          patchCount += 1;
          entropySum += patch.entropy;
          maxAttnSum += patch.max_attn;
          maxAttnPeak = Math.max(maxAttnPeak, patch.max_attn);
          rows.push({
            key: `${layer.layer_id}-${head.head_id}-${patch.patch_id}`,
            layerId: layer.layer_id,
            headId: head.head_id,
            patchId: patch.patch_id,
            maxAttn: patch.max_attn,
            entropy: patch.entropy,
          });
        });
      });
    });

    const topPatches = rows.sort((a, b) => b.maxAttn - a.maxAttn).slice(0, 5);

    return {
      patchCount,
      avgEntropy: patchCount > 0 ? entropySum / patchCount : 0,
      avgMaxAttn: patchCount > 0 ? maxAttnSum / patchCount : 0,
      maxAttnPeak,
      topPatches,
    };
  }, [treeStats]);

  const topPatchColumns: ColumnsType<TopPatchRow> = [
    {
      title: 'Layer',
      dataIndex: 'layerId',
      key: 'layerId',
      render: (v: number) => `L${v}`,
      width: 90,
    },
    {
      title: 'Head',
      dataIndex: 'headId',
      key: 'headId',
      render: (v: number) => `H${v}`,
      width: 90,
    },
    {
      title: 'Patch',
      dataIndex: 'patchId',
      key: 'patchId',
      width: 90,
    },
    {
      title: 'max_attn',
      dataIndex: 'maxAttn',
      key: 'maxAttn',
      render: (v: number) => v.toFixed(4),
    },
    {
      title: 'entropy',
      dataIndex: 'entropy',
      key: 'entropy',
      render: (v: number) => v.toFixed(4),
    },
  ];

  if (klLoading || funnelLoading || treeLoading || barLoading) {
    return <Loading />;
  }

  return (
    <div className={styles.page}>
      <h1 className={styles.title}>Model Overview</h1>

      <div className={styles.section}>
        <Row gutter={16}>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Number of Layers" value={numLayers} prefix={<BarsOutlined />} suffix="layers" />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Heads per Layer" value={numHeads} prefix={<ClusterOutlined />} suffix="heads" />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic title="Total Attention Heads" value={totalHeads} prefix={<BranchesOutlined />} suffix="heads" />
            </Card>
          </Col>
          <Col xs={24} sm={12} lg={6}>
            <Card>
              <Statistic
                title="Patches Analyzed"
                value={treeSummary?.patchCount ?? 0}
                prefix={<DatabaseOutlined />}
                suffix="patches"
              />
            </Card>
          </Col>
        </Row>
      </div>

      <div className={styles.section}>
        <Row gutter={16}>
          <Col xs={24} lg={12}>
            <Card title="KL Divergence & Locality">
              {klLocality && (
                <KLLocalityChart
                  data={klLocality}
                  config={{ xAxisLabel: 'Layer', yAxisLabel: 'Value', showLegend: true }}
                  height={360}
                />
              )}
            </Card>
          </Col>
          <Col xs={24} lg={12}>
            <Card title="Effective Rank & Singular Energy">
              {funnel && (
                <FunnelChart
                  data={funnel}
                  config={{ xAxisLabel: 'Layer', yAxisLabel: 'Percentage', showLegend: true }}
                  height={360}
                />
              )}
            </Card>
          </Col>
        </Row>
      </div>

      <div className={styles.section}>
        <Card title="3D Bar Metrics Overview">
          {threeDBar && (
            <ThreeDBarChart
              data={threeDBar}
              config={{ xAxisLabel: 'Layer', yAxisLabel: 'Relative (%)', showLegend: true }}
              height={380}
              baseline={100}
            />
          )}
        </Card>
      </div>

      <Card title="Tree Stats">
        <Row gutter={16} className={styles.treeStatsGrid}>
          <Col span={6}>
            <Statistic title="Total patches" value={treeSummary?.patchCount ?? 0} />
          </Col>
          <Col span={6}>
            <Statistic title="Avg entropy" value={treeSummary?.avgEntropy ?? 0} precision={4} />
          </Col>
          <Col span={6}>
            <Statistic title="Avg max_attn" value={treeSummary?.avgMaxAttn ?? 0} precision={4} />
          </Col>
          <Col span={6}>
            <Statistic title="Peak max_attn" value={treeSummary?.maxAttnPeak ?? 0} precision={4} />
          </Col>
        </Row>

        <div className={styles.tableWrap}>
          <Table<TopPatchRow>
            rowKey="key"
            size="small"
            pagination={false}
            scroll={{ x: 'max-content' }}
            columns={topPatchColumns}
            dataSource={treeSummary?.topPatches ?? []}
          />
        </div>
      </Card>
    </div>
  );
};

export default Overview;

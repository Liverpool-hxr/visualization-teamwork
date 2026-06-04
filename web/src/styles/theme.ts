import type { ThemeConfig } from 'antd';

export const theme: ThemeConfig = {
  token: {
    colorPrimary: '#00d4aa',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#f5222d',
    colorInfo: '#1890ff',
    
    colorBgBase: '#0d1117',
    colorBgContainer: '#161b22',
    colorBgElevated: '#21262d',
    colorBgLayout: '#0d1117',
    
    colorTextBase: '#e8edf5',
    colorTextSecondary: '#8b949e',
    colorTextPlaceholder: '#484f58',
    colorTextDisabled: '#30363d',
    
    colorBorder: '#30363d',
    colorBorderSecondary: '#21262d',
    
    borderRadius: 8,
    borderRadiusSM: 4,
    borderRadiusLG: 12,
    
    fontFamily: "'Inter', -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif",
    fontSize: 14,
    fontSizeSM: 12,
    fontSizeLG: 16,
    fontSizeXL: 18,
    
    lineHeight: 1.5,
    lineHeightSM: 1.4,
    lineHeightLG: 1.6,
    
    paddingXS: 4,
    paddingSM: 8,
    paddingMD: 16,
    paddingLG: 24,
    paddingXL: 32,
    
    colorBgTextHover: '#21262d',
    colorBgTextActive: '#30363d',
  },
  components: {
    Layout: {
      siderBg: '#161b22',
      headerBg: '#161b22',
      bodyBg: '#0d1117',
    },
    Menu: {
      itemBg: '#161b22',
      itemHoverBg: '#21262d',
    },
    Card: {
      colorBgContainer: '#161b22',
      borderRadiusLG: 12,
    },
    Button: {
      colorPrimary: '#00d4aa',
      colorPrimaryHover: '#00d4aa',
      colorPrimaryActive: '#00d4aa',
      colorPrimaryBg: '#00d4aa',
    },
  },
};

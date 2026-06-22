import { ConfigProvider, theme as antdTheme, ThemeConfig } from 'antd'

export const themeConfig: ThemeConfig = {
  algorithm: antdTheme.darkAlgorithm,
  token: {
    colorPrimary: '#c8a96e',
    colorInfo: '#c8a96e',
    colorSuccess: '#52c41a',
    colorWarning: '#faad14',
    colorError: '#ff4d4f',
    colorBgBase: '#1a1a2e',
    colorBgContainer: '#16213e',
    colorBgElevated: '#0f3460',
    colorBorder: '#2d3a4f',
    colorBorderSecondary: '#1f2d3d',
    colorText: '#e8e8e8',
    colorTextSecondary: '#a0a0a0',
    colorTextTertiary: '#707070',
    colorTextQuaternary: '#505050',
    borderRadius: 8,
    fontSize: 14,
    fontFamily: "'PingFang SC', 'Microsoft YaHei', -apple-system, BlinkMacSystemFont, sans-serif",
  },
  components: {
    Layout: {
      headerBg: '#0f3460',
      siderBg: '#16213e',
      bodyBg: '#1a1a2e',
      triggerBg: '#0f3460',
      headerHeight: 64,
    },
    Menu: {
      darkItemBg: '#16213e',
      darkSubMenuItemBg: '#1a1a2e',
      darkItemSelectedBg: '#0f3460',
      darkItemSelectedColor: '#c8a96e',
      darkItemHoverBg: '#1f2d3d',
    },
    Card: {
      colorBgContainer: '#16213e',
      colorBorderSecondary: '#2d3a4f',
    },
    Table: {
      colorBgContainer: '#16213e',
      colorBorderSecondary: '#2d3a4f',
      headerBg: '#0f3460',
      headerColor: '#e8e8e8',
    },
    Button: {
      colorPrimary: '#c8a96e',
      colorPrimaryHover: '#d4b87a',
      colorPrimaryActive: '#b8995e',
    },
    Input: {
      colorBgContainer: '#1a1a2e',
      colorBorder: '#2d3a4f',
      colorText: '#e8e8e8',
    },
    Select: {
      colorBgContainer: '#1a1a2e',
      colorBorder: '#2d3a4f',
    },
    Modal: {
      contentBg: '#16213e',
      headerBg: '#0f3460',
    },
    Drawer: {
      colorBgBody: '#16213e',
      colorBgHeader: '#0f3460',
    },
    Pagination: {
      itemBg: '#1a1a2e',
      colorPrimary: '#c8a96e',
    },
    Tag: {
      defaultBg: '#1a1a2e',
      defaultColor: '#c8a96e',
    },
    Calendar: {
      fullBg: '#16213e',
      fullPanelBg: '#1a1a2e',
      itemActiveBg: '#0f3460',
    },
  },
}

export default ConfigProvider

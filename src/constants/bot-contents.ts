type TTabsTitle = {
    [key: string]: string | number;
};

type TDashboardTabIndex = {
    [key: string]: number;
};

export const tabs_title: TTabsTitle = Object.freeze({
    WORKSPACE: 'Workspace',
    CHART: 'Chart',
});

export const DBOT_TABS: TDashboardTabIndex = Object.freeze({
    DASHBOARD: 0,
    BOT_BUILDER: 1,
    TRADING_BOTS: 2,
    BULK_TRADER: 3,
    MANUAL_TRADER: 4,
    PRO_AI: 5,
    DUAL_EDGE: 6,
    ANALYSIS_TOOL: 7,
    RISK_CALCULATOR: 8,
    COPY_TRADING: 9,
    CHART: 10,
    TRADING_VIEW: 11,
    TUTORIAL: 12,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-trading-bots',
    'id-bulk-trader',
    'id-manual-trader',
    'id-pro-ai',
    'id-dual-edge',
    'id-analysis-tool',
    'id-risk-calculator',
    'id-copy-trading',
    'id-charts',
    'id-trading-view',
    'id-tutorials',
];

export const DEBOUNCE_INTERVAL_TIME = 500;

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
    CHART: 2,
    TUTORIAL: 3,
    ANALYSIS_TOOL: 4,
    TRADING_BOTS: 5,
    BULK_TRADER: 6,
    PRO_AI: 7,
    DUAL_EDGE: 8,
    COPY_TRADING: 9,
});

export const MAX_STRATEGIES = 10;

export const TAB_IDS = [
    'id-dbot-dashboard',
    'id-bot-builder',
    'id-charts',
    'id-tutorials',
    'id-analysis-tool',
    'id-trading-bots',
    'id-bulk-trader',
    'id-pro-ai',
    'id-dual-edge',
    'id-copy-trading',
];

export const DEBOUNCE_INTERVAL_TIME = 500;

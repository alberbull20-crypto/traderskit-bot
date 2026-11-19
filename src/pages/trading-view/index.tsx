// @ts-nocheck — reuses the template's chart component, which has no type definitions
import { Component } from 'react';
import TradingViewComponent from '@/components/trading-view-chart/trading-view';
import '../analysis-tool/analysis-tool.scss';
import './trading-view.scss';

/** If the chart fails to load, show a short message instead of breaking the whole page. */
class ChartBoundary extends Component {
    state = { failed: false };

    static getDerivedStateFromError() {
        return { failed: true };
    }

    componentDidCatch(error) {
        console.error('The TradingView chart failed to load:', error);
    }

    render() {
        if (this.state.failed) {
            return (
                <div className='trading-view-tab__error'>
                    The TradingView chart could not load. Refresh the page and try again.
                </div>
            );
        }
        return this.props.children;
    }
}

const TradingViewTab = () => (
    <div className='analysis-tool trading-view-tab'>
        <div className='trading-view-tab__head'>
            <span className='analysis-tool__label'>Charts</span>
            <h2>TradingView</h2>
        </div>

        <div className='trading-view-tab__chart'>
            <ChartBoundary>
                <TradingViewComponent />
            </ChartBoundary>
        </div>

        <p className='analysis-tool__note'>
            Charts are for information only and do not predict the next price. Nothing here is financial advice.
            Trading involves risk and you can lose money.
        </p>
    </div>
);

export default TradingViewTab;

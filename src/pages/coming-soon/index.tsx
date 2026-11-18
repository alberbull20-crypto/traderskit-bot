import { lazy, Suspense } from 'react';
import './coming-soon.scss';

type TComingSoonProps = {
    title: string;
    text: string;
};

// Tabs that already have a working page. Add one line here for each new tab we finish.
const WORKING_PAGES = {
    'Trading Bots': lazy(() => import('../trading-bots')),
    'Bulk Trader': lazy(() => import('../bulk-trader')),
    'Pro AI': lazy(() => import('../pro-ai')),
    'Dual Edge': lazy(() => import('../dual-edge')),
    'Copy Trading': lazy(() => import('../copy-trading')),
};

const ComingSoon = ({ title, text }: TComingSoonProps) => {
    const WorkingPage = WORKING_PAGES[title];

    if (WorkingPage) {
        return (
            <Suspense fallback={null}>
                <WorkingPage />
            </Suspense>
        );
    }

    return (
        <div className='coming-soon'>
            <div className='coming-soon__card'>
                <span className='coming-soon__label'>Coming soon</span>
                <h2>{title}</h2>
                <p>{text}</p>
            </div>
        </div>
    );
};

export default ComingSoon;

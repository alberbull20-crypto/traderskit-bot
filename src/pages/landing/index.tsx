import { useEffect, useState } from 'react';
import './landing.scss';

const HEADLINE = 'Welcome to TradersKit';
const PLAIN_LENGTH = 'Welcome to '.length;

const TICKER_ITEMS = [
    'Volatility 10 Index',
    'Volatility 25 Index',
    'Volatility 50 Index',
    'Volatility 75 Index',
    'Volatility 100 Index',
    'Volatility 10 (1s) Index',
    'Volatility 100 (1s) Index',
    'Bull Market Index',
    'Bear Market Index',
];

/**
 * Types the text out one letter at a time.
 * Shows the full text straight away for people who prefer reduced motion.
 */
const useTypedText = (text: string, speed = 70) => {
    const prefersReducedMotion =
        typeof window !== 'undefined' &&
        typeof window.matchMedia === 'function' &&
        window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const [count, setCount] = useState(prefersReducedMotion ? text.length : 0);

    useEffect(() => {
        if (count >= text.length) return;
        const timer = window.setTimeout(() => setCount(count + 1), speed);
        return () => window.clearTimeout(timer);
    }, [count, text, speed]);

    return text.slice(0, count);
};

/* ---------- Icons ---------- */

const ArrowIcon = () => (
    <svg width='18' height='18' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <path
            d='M5 12h14M13 6l6 6-6 6'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
    </svg>
);

const CheckIcon = () => (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <path
            d='M5 13l4 4L19 7'
            stroke='currentColor'
            strokeWidth='2.5'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
    </svg>
);

const ShieldIcon = () => (
    <svg width='16' height='16' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <path
            d='M12 3l8 3v6c0 4.5-3.2 8.2-8 9-4.8-.8-8-4.5-8-9V6l8-3z'
            stroke='currentColor'
            strokeWidth='2'
            strokeLinejoin='round'
        />
        <path d='M9 12l2 2 4-4' stroke='currentColor' strokeWidth='2' strokeLinecap='round' strokeLinejoin='round' />
    </svg>
);

const BlocksIcon = () => (
    <svg width='28' height='28' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <rect x='3' y='3' width='8' height='8' rx='2' stroke='currentColor' strokeWidth='1.8' />
        <rect x='13' y='3' width='8' height='8' rx='2' stroke='currentColor' strokeWidth='1.8' />
        <rect x='3' y='13' width='8' height='8' rx='2' stroke='currentColor' strokeWidth='1.8' />
        <path d='M17 13v8M13 17h8' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
    </svg>
);

const ChartIcon = () => (
    <svg width='28' height='28' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <path d='M3 3v18h18' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        <path
            d='M7 15l4-4 3 3 5-6'
            stroke='currentColor'
            strokeWidth='1.8'
            strokeLinecap='round'
            strokeLinejoin='round'
        />
    </svg>
);

const BotIcon = () => (
    <svg width='28' height='28' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <rect x='4' y='8' width='16' height='11' rx='3' stroke='currentColor' strokeWidth='1.8' />
        <path d='M12 8V4M9 4h6' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        <circle cx='9' cy='13.5' r='1.3' fill='currentColor' />
        <circle cx='15' cy='13.5' r='1.3' fill='currentColor' />
    </svg>
);

const AccountsIcon = () => (
    <svg width='28' height='28' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <circle cx='12' cy='8' r='3.5' stroke='currentColor' strokeWidth='1.8' />
        <path d='M5 20c0-3.6 3.1-6 7-6s7 2.4 7 6' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
    </svg>
);

/* ---------- Content ---------- */

const FEATURES = [
    {
        icon: <BlocksIcon />,
        title: 'Visual Bot Builder',
        tag: 'Build Without Code',
        text: 'Drag and drop blocks to design your own trading strategy. Start from a quick strategy or import a bot you already have.',
    },
    {
        icon: <ChartIcon />,
        title: 'Live Market Charts',
        tag: 'See The Market',
        text: 'Follow Deriv markets on interactive charts, so you can watch price action while you build and test your ideas.',
    },
    {
        icon: <BotIcon />,
        title: 'Automated Execution',
        tag: 'Let Your Bot Work',
        text: 'Run the strategy you built and let it place trades by your own rules, while you keep full control to stop it any time.',
    },
    {
        icon: <AccountsIcon />,
        title: 'Demo and Real Accounts',
        tag: 'Practise First',
        text: 'Log in with your Deriv account, test ideas on a demo account, and switch accounts when you are ready.',
    },
];

const WHY_ITEMS = [
    'Log in through Deriv’s own secure login page',
    'Practise on a demo account before using real money',
    'Import your existing bots or start from a quick strategy',
    'Interactive charts for Deriv markets',
    'Guides and tutorials built into the workspace',
    'Runs in your browser, with nothing to install',
];

const LandingPage = () => {
    const typed = useTypedText(HEADLINE);
    const plainPart = typed.slice(0, PLAIN_LENGTH);
    const brandPart = typed.slice(PLAIN_LENGTH);

    return (
        <main className='landing-page'>
            {/* Navigation bar */}
            <header className='landing-page__nav'>
                <a className='landing-page__brand' href='/'>
                    <span className='landing-page__brand-badge'>T</span>
                    <span className='landing-page__brand-name'>
                        Traders<span>Kit</span>
                    </span>
                </a>

                <nav className='landing-page__nav-links' aria-label='Main'>
                    <a href='#features'>Features</a>
                    <a href='#how-it-works'>How it works</a>
                    <a href='#security'>Security</a>
                </nav>

                <a className='landing-page__nav-cta' href='/bot'>
                    Open Workspace
                    <ArrowIcon />
                </a>
            </header>

            {/* Scrolling market ticker */}
            <div className='landing-page__ticker' aria-hidden='true'>
                <div className='landing-page__ticker-track'>
                    {[...TICKER_ITEMS, ...TICKER_ITEMS].map((item, index) => (
                        <span className='landing-page__ticker-item' key={`${item}-${index}`}>
                            {item}
                            <i>---</i>
                        </span>
                    ))}
                </div>
            </div>

            {/* Hero */}
            <section className='landing-page__hero'>
                <div className='landing-page__badge'>
                    <ShieldIcon />
                    Built on the official Deriv API
                </div>

                <h1 className='landing-page__title' aria-label={HEADLINE}>
                    <span aria-hidden='true'>
                        {plainPart}
                        <span className='landing-page__gradient-text'>{brandPart}</span>
                        <span className='landing-page__cursor' />
                    </span>
                </h1>

                <p className='landing-page__subtitle'>
                    Your all-in-one workspace for building bots, automating strategies and following the markets,
                    connected securely to your Deriv account.
                </p>

                <div className='landing-page__actions'>
                    <a className='landing-page__btn landing-page__btn--primary' href='/bot'>
                        Open Trading Workspace
                        <ArrowIcon />
                    </a>
                    <a className='landing-page__btn landing-page__btn--ghost' href='#features'>
                        Explore features
                    </a>
                </div>

                <ul className='landing-page__checks'>
                    <li>
                        <CheckIcon /> Demo and real accounts
                    </li>
                    <li>
                        <CheckIcon /> Visual bot builder
                    </li>
                    <li>
                        <CheckIcon /> Log in with Deriv
                    </li>
                </ul>

                <p className='landing-page__risk'>
                    Trading involves risk and you can lose money. Practise on a demo account first.
                </p>
            </section>

            {/* Features */}
            <section className='landing-page__section' id='features'>
                <div className='landing-page__section-head'>
                    <span className='landing-page__label'>Platform</span>
                    <h2 className='landing-page__section-title'>Powerful Tools for Modern Traders</h2>
                    <p className='landing-page__section-sub'>Everything you need to build, test and run your strategies</p>
                    <p className='landing-page__section-text'>
                        Whether you like to design your own strategy or start from a ready-made one, TradersKit gives you
                        practical tools to find setups and keep your trading workflow simple.
                    </p>
                </div>

                <div className='landing-page__features'>
                    {FEATURES.map(feature => (
                        <article className='landing-page__card' key={feature.title}>
                            <div className='landing-page__card-icon'>{feature.icon}</div>
                            <h3>{feature.title}</h3>
                            <span className='landing-page__card-tag'>{feature.tag}</span>
                            <p>{feature.text}</p>
                        </article>
                    ))}
                </div>
            </section>

            {/* Why TradersKit */}
            <section className='landing-page__section landing-page__section--why'>
                <div className='landing-page__why'>
                    <div className='landing-page__section-head'>
                        <h2 className='landing-page__section-title'>Why TradersKit?</h2>
                        <p className='landing-page__section-sub'>A focused workspace built on the official Deriv Bot</p>
                    </div>

                    <div className='landing-page__why-grid'>
                        {WHY_ITEMS.map(item => (
                            <div className='landing-page__why-item' key={item}>
                                <span className='landing-page__why-icon'>
                                    <CheckIcon />
                                </span>
                                {item}
                            </div>
                        ))}
                    </div>
                </div>
            </section>
        </main>
    );
};

export default LandingPage;

import { useCallback, useEffect, useState } from 'react';
import type { MouseEvent } from 'react';
import { generateOAuthURL } from '@/components/shared';
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

/**
 * True when the browser already holds a logged-in Deriv account.
 * App.tsx stores `active_loginid` after a successful OAuth login.
 */
const hasActiveAccount = () => {
    try {
        return Boolean(window.localStorage.getItem('active_loginid'));
    } catch {
        return false;
    }
};

/**
 * Builds click handlers that send the visitor to Deriv's login or registration page
 * (using the same OAuth helper as the header's buttons), or straight to the workspace
 * if they are already logged in. The OAuth settings are not changed here.
 */
const useWorkspaceEntry = () => {
    const [isRedirecting, setIsRedirecting] = useState(false);

    const createHandler = useCallback(
        (mode: 'login' | 'registration') => async (event: MouseEvent<HTMLAnchorElement>) => {
            // Let the browser handle ctrl/cmd-click and middle-click normally.
            if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0) return;

            event.preventDefault();
            if (isRedirecting) return;

            if (hasActiveAccount()) {
                window.location.assign('/bot');
                return;
            }

            try {
                setIsRedirecting(true);
                const oauthUrl = mode === 'registration' ? await generateOAuthURL('registration') : await generateOAuthURL();

                if (oauthUrl) {
                    window.location.replace(oauthUrl);
                    return;
                }

                console.error('Failed to generate OAuth URL');
            } catch (error) {
                console.error('Redirection to Deriv failed:', error);
            }

            // Fallback: open the workspace, where the header still has Log in / Sign up.
            setIsRedirecting(false);
            window.location.assign('/bot');
        },
        [isRedirecting]
    );

    return {
        openWorkspace: createHandler('login'),
        openSignup: createHandler('registration'),
    };
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

const LockIcon = () => (
    <svg width='28' height='28' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <rect x='5' y='11' width='14' height='9' rx='2.5' stroke='currentColor' strokeWidth='1.8' />
        <path d='M8 11V8a4 4 0 018 0v3' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        <circle cx='12' cy='15.5' r='1.3' fill='currentColor' />
    </svg>
);

const FlaskIcon = () => (
    <svg width='28' height='28' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <path d='M9 3h6M10 3v6l-5 9a2 2 0 001.8 3h10.4a2 2 0 001.8-3l-5-9V3' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' strokeLinejoin='round' />
        <path d='M8 15h8' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
    </svg>
);

const PowerIcon = () => (
    <svg width='28' height='28' viewBox='0 0 24 24' fill='none' aria-hidden='true'>
        <path d='M12 3v8' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
        <path d='M6.3 6.8a8 8 0 1011.4 0' stroke='currentColor' strokeWidth='1.8' strokeLinecap='round' />
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

const STEPS = [
    {
        title: 'Open the workspace',
        text: 'Go to the TradersKit trading workspace. It runs in your browser, so there is nothing to download.',
    },
    {
        title: 'Log in with Deriv',
        text: 'Use your Deriv account to log in on Deriv’s own page. You can also sign up there if you are new.',
    },
    {
        title: 'Build or load a bot',
        text: 'Design a strategy with the visual builder, or start from a quick strategy. Test it on your demo account first.',
    },
    {
        title: 'Run and monitor',
        text: 'Start your bot, watch the charts and your results, and stop it whenever you want.',
    },
];

const SECURITY_POINTS = [
    {
        icon: <LockIcon />,
        title: 'Deriv’s own login',
        text: 'You log in on Deriv’s page, not ours. TradersKit never sees or stores your Deriv password.',
    },
    {
        icon: <FlaskIcon />,
        title: 'Demo first',
        text: 'Your Deriv demo account works here too, so you can test your strategies without risking real money.',
    },
    {
        icon: <PowerIcon />,
        title: 'You stay in control',
        text: 'You choose the account, you start the bot, and you can stop it or log out at any time.',
    },
];

const LandingPage = () => {
    const typed = useTypedText(HEADLINE);
    const plainPart = typed.slice(0, PLAIN_LENGTH);
    const brandPart = typed.slice(PLAIN_LENGTH);
    const { openWorkspace, openSignup } = useWorkspaceEntry();

    // When Deriv sends the visitor back with ?code=...&state=..., App.tsx finishes
    // the login and then redirects to /bot. Show a short message while that happens.
    const [isSigningIn, setIsSigningIn] = useState(() => {
        const params = new URLSearchParams(window.location.search);
        return Boolean(params.get('code') && params.get('state'));
    });

    useEffect(() => {
        if (!isSigningIn) return;
        // Safety net: if the login never completes, show the landing page again.
        const timer = window.setTimeout(() => setIsSigningIn(false), 30000);
        return () => window.clearTimeout(timer);
    }, [isSigningIn]);

    if (isSigningIn) {
        return (
            <main
                className='landing-page'
                style={{
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    padding: '0 24px',
                }}
            >
                <p style={{ fontSize: 20, color: '#a8b6cc' }}>Signing you in to Deriv…</p>
            </main>
        );
    }

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

                <a className='landing-page__nav-cta' href='/bot' onClick={openWorkspace}>
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
                    <a className='landing-page__btn landing-page__btn--primary' href='/bot' onClick={openWorkspace}>
                        Open Trading Workspace
                        <ArrowIcon />
                    </a>
                    <a className='landing-page__btn landing-page__btn--ghost' href='/bot' onClick={openSignup}>
                        Sign up
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

            {/* How it works */}
            <section className='landing-page__section' id='how-it-works'>
                <div className='landing-page__section-head'>
                    <span className='landing-page__label'>How it works</span>
                    <h2 className='landing-page__section-title'>From login to live bot in four steps</h2>
                    <p className='landing-page__section-sub'>Simple to start, with you in control the whole way</p>
                </div>

                <ol className='landing-page__steps'>
                    {STEPS.map((step, index) => (
                        <li className='landing-page__step' key={step.title}>
                            <span className='landing-page__step-number'>{index + 1}</span>
                            <h3>{step.title}</h3>
                            <p>{step.text}</p>
                        </li>
                    ))}
                </ol>
            </section>

            {/* Security and account connection */}
            <section className='landing-page__section' id='security'>
                <div className='landing-page__section-head'>
                    <span className='landing-page__label'>Security</span>
                    <h2 className='landing-page__section-title'>Your account stays yours</h2>
                    <p className='landing-page__section-sub'>How TradersKit connects to your Deriv account</p>
                </div>

                <div className='landing-page__security'>
                    {SECURITY_POINTS.map(point => (
                        <article className='landing-page__card' key={point.title}>
                            <div className='landing-page__card-icon'>{point.icon}</div>
                            <h3>{point.title}</h3>
                            <p>{point.text}</p>
                        </article>
                    ))}
                </div>

                <p className='landing-page__security-note'>
                    Never share your Deriv password or API token with anyone, including us.
                </p>
            </section>

            {/* Final call to action */}
            <section className='landing-page__section landing-page__section--cta'>
                <div className='landing-page__cta'>
                    <span className='landing-page__label'>Get started</span>
                    <h2 className='landing-page__section-title'>Ready to build your first bot?</h2>
                    <p className='landing-page__section-sub'>Open the workspace and start on your demo account today.</p>

                    <div className='landing-page__actions'>
                        <a className='landing-page__btn landing-page__btn--primary' href='/bot' onClick={openWorkspace}>
                            Open Trading Workspace
                            <ArrowIcon />
                        </a>
                        <a className='landing-page__btn landing-page__btn--ghost' href='/bot' onClick={openSignup}>
                            Sign up
                        </a>
                    </div>

                    <ul className='landing-page__checks landing-page__checks--small'>
                        <li>
                            <CheckIcon /> Runs in your browser
                        </li>
                        <li>
                            <CheckIcon /> Demo account supported
                        </li>
                        <li>
                            <CheckIcon /> Full workspace access
                        </li>
                    </ul>
                </div>
            </section>

            {/* Footer */}
            <footer className='landing-page__footer'>
                <div className='landing-page__footer-top'>
                    <a className='landing-page__brand' href='/'>
                        <span className='landing-page__brand-badge'>T</span>
                        <span className='landing-page__brand-name'>
                            Traders<span>Kit</span>
                        </span>
                    </a>

                    <nav className='landing-page__footer-links' aria-label='Footer'>
                        <a href='#features'>Features</a>
                        <a href='#how-it-works'>How it works</a>
                        <a href='#security'>Security</a>
                        <a href='/bot' onClick={openWorkspace}>
                            Open Workspace
                        </a>
                    </nav>
                </div>

                <p className='landing-page__footer-risk'>
                    Risk warning: trading involves risk and you can lose some or all of your money. Only trade with money
                    you can afford to lose, and practise on a demo account first. Nothing on this site is financial advice.
                </p>

                <p className='landing-page__footer-note'>
                    TradersKit is an independent third-party platform and is not operated by Deriv. © {new Date().getFullYear()}{' '}
                    TradersKit.
                </p>
            </footer>
        </main>
    );
};

export default LandingPage;

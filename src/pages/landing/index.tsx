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
        </main>
    );
};

export default LandingPage;

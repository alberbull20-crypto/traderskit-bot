// @ts-nocheck — talks to the vendored bot API, which has no type definitions
import { useEffect, useMemo, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import './analysis-tool.scss';

const MARKETS = [
    { symbol: 'R_10', name: 'Volatility 10 Index' },
    { symbol: 'R_25', name: 'Volatility 25 Index' },
    { symbol: 'R_50', name: 'Volatility 50 Index' },
    { symbol: 'R_75', name: 'Volatility 75 Index' },
    { symbol: 'R_100', name: 'Volatility 100 Index' },
    { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index' },
    { symbol: '1HZ15V', name: 'Volatility 15 (1s) Index' },
    { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index' },
    { symbol: '1HZ30V', name: 'Volatility 30 (1s) Index' },
    { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index' },
    { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index' },
    { symbol: '1HZ90V', name: 'Volatility 90 (1s) Index' },
    { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index' },
];

const MIN_WINDOW = 50;
const MAX_WINDOW = 5000;
const DEFAULT_WINDOW = 1000;
const POLL_MS = 2000;
const RETRY_MS = 3000;
const POLL_COUNT = 20;
const LATEST_DIGITS = 20;
const RING_RADIUS = 34;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const clampWindow = value => {
    const number = parseInt(value, 10);
    if (Number.isNaN(number)) return DEFAULT_WINDOW;
    return Math.min(MAX_WINDOW, Math.max(MIN_WINDOW, number));
};

/**
 * Asks Deriv for the latest ticks of one market.
 * This is a plain request (no subscription), so it cannot clash with a running bot
 * and nothing needs to be cancelled afterwards.
 */
const fetchTicks = async (symbol, count) => {
    if (!api_base?.api) throw new Error('Waiting for the Deriv connection...');

    const response = await api_base.api.send({
        ticks_history: symbol,
        end: 'latest',
        count,
        style: 'ticks',
    });

    if (response?.error) throw response;

    const prices = response?.history?.prices ?? [];
    const times = response?.history?.times ?? [];
    const pip = Number.isInteger(response?.pip_size) ? response.pip_size : 2;

    const ticks = prices.map((price, index) => {
        const quote = Number(price);
        return {
            epoch: Number(times[index]),
            quote,
            digit: Number(quote.toFixed(pip).slice(-1)),
        };
    });

    return { ticks, pip };
};

const getErrorText = error => error?.error?.message || error?.message || 'Could not load ticks.';

const AnalysisTool = () => {
    const [symbol, setSymbol] = useState('R_100');
    const [windowSize, setWindowSize] = useState(DEFAULT_WINDOW);
    const [windowInput, setWindowInput] = useState(String(DEFAULT_WINDOW));
    const [ticks, setTicks] = useState([]);
    const [pip, setPip] = useState(2);
    const [error, setError] = useState('');
    const [is_loading, setIsLoading] = useState(true);
    const rootRef = useRef(null);

    // Load the window of ticks, then refresh it every couple of seconds.
    useEffect(() => {
        let cancelled = false;
        let timer = null;
        let loaded = false;

        setTicks([]);
        setError('');
        setIsLoading(true);

        const run = async () => {
            // Skip refreshing while this tab is not on screen.
            const is_visible = rootRef.current && rootRef.current.offsetParent !== null && !document.hidden;
            if (loaded && !is_visible) {
                timer = setTimeout(run, POLL_MS);
                return;
            }

            const was_loaded = loaded;

            try {
                const { ticks: fresh, pip: pip_size } = await fetchTicks(symbol, was_loaded ? POLL_COUNT : windowSize);
                if (cancelled) return;

                loaded = true;
                setPip(pip_size);
                setError('');
                setIsLoading(false);
                setTicks(previous => {
                    const base = was_loaded ? previous : [];
                    const last_epoch = base.length ? base[base.length - 1].epoch : 0;
                    return base.concat(fresh.filter(tick => tick.epoch > last_epoch)).slice(-windowSize);
                });
            } catch (e) {
                if (cancelled) return;
                setError(getErrorText(e));
            }

            if (!cancelled) timer = setTimeout(run, loaded ? POLL_MS : RETRY_MS);
        };

        run();

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [symbol, windowSize]);

    const stats = useMemo(() => {
        const counts = Array(10).fill(0);
        ticks.forEach(tick => {
            counts[tick.digit] += 1;
        });

        const total = ticks.length;
        const percents = counts.map(count => (total ? (count / total) * 100 : 0));
        const max = Math.max(...percents);
        const min = Math.min(...percents);
        const even_count = counts.reduce((sum, count, digit) => (digit % 2 === 0 ? sum + count : sum), 0);

        return {
            total,
            percents,
            max,
            min,
            even_percent: total ? (even_count / total) * 100 : 0,
        };
    }, [ticks]);

    const last_tick = ticks.length ? ticks[ticks.length - 1] : null;
    const price_text = last_tick ? last_tick.quote.toFixed(pip) : '--';
    const latest_digits = ticks.slice(-LATEST_DIGITS);

    const commitWindow = () => {
        const value = clampWindow(windowInput);
        setWindowInput(String(value));
        setWindowSize(value);
    };

    return (
        <div className='analysis-tool' ref={rootRef}>
            <div className='analysis-tool__header'>
                <span className='analysis-tool__label'>Analysis</span>
                <h2>Digit Analysis</h2>
                <p>See how often each last digit has appeared in the latest ticks of a market.</p>
            </div>

            <div className='analysis-tool__controls'>
                <label className='analysis-tool__field'>
                    <span>Market</span>
                    <select value={symbol} onChange={event => setSymbol(event.target.value)}>
                        {MARKETS.map(market => (
                            <option key={market.symbol} value={market.symbol}>
                                {market.name}
                            </option>
                        ))}
                    </select>
                </label>

                <label className='analysis-tool__field'>
                    <span>
                        Ticks window ({MIN_WINDOW}–{MAX_WINDOW})
                    </span>
                    <input
                        type='number'
                        min={MIN_WINDOW}
                        max={MAX_WINDOW}
                        value={windowInput}
                        onChange={event => setWindowInput(event.target.value)}
                        onBlur={commitWindow}
                        onKeyDown={event => {
                            if (event.key === 'Enter') commitWindow();
                        }}
                    />
                </label>
            </div>

            <div className='analysis-tool__price'>
                <div>
                    <span className='analysis-tool__price-label'>Current tick</span>
                    <div className='analysis-tool__price-value'>
                        {last_tick ? (
                            <>
                                {price_text.slice(0, -1)}
                                <em>{price_text.slice(-1)}</em>
                            </>
                        ) : (
                            '--'
                        )}
                    </div>
                </div>
                <div className='analysis-tool__status'>
                    <i className={error ? 'is-error' : is_loading ? 'is-loading' : 'is-live'} />
                    {error ? error : is_loading ? 'Loading ticks...' : `Live, ${stats.total} ticks analysed`}
                </div>
            </div>

            <div className='analysis-tool__digits'>
                {stats.percents.map((percent, digit) => {
                    const is_highest = stats.total > 0 && percent === stats.max;
                    const is_lowest = stats.total > 0 && percent === stats.min;
                    const is_current = last_tick && last_tick.digit === digit;
                    const fill = stats.max > 0 ? (percent / stats.max) * RING_LENGTH : 0;

                    return (
                        <div
                            className={[
                                'analysis-tool__digit',
                                is_highest ? 'is-highest' : '',
                                is_lowest ? 'is-lowest' : '',
                                is_current ? 'is-current' : '',
                            ].join(' ')}
                            key={digit}
                            aria-label={`Digit ${digit}: ${percent.toFixed(2)} percent`}
                        >
                            <svg viewBox='0 0 80 80' className='analysis-tool__ring'>
                                <circle className='analysis-tool__ring-track' cx='40' cy='40' r={RING_RADIUS} />
                                <circle
                                    className='analysis-tool__ring-fill'
                                    cx='40'
                                    cy='40'
                                    r={RING_RADIUS}
                                    strokeDasharray={`${fill} ${RING_LENGTH}`}
                                    transform='rotate(-90 40 40)'
                                />
                            </svg>
                            <div className='analysis-tool__digit-text'>
                                <strong>{digit}</strong>
                                <span>{percent.toFixed(2)}%</span>
                            </div>
                            {is_current && <i className='analysis-tool__marker' />}
                        </div>
                    );
                })}
            </div>

            <p className='analysis-tool__legend'>
                <span className='is-highest'>Most frequent</span>
                <span className='is-lowest'>Least frequent</span>
                <span>Rings are scaled to the most frequent digit.</span>
            </p>

            <div className='analysis-tool__strip'>
                <span className='analysis-tool__strip-title'>Latest digits</span>
                <div className='analysis-tool__chips'>
                    {latest_digits.map((tick, index) => (
                        <span
                            className={tick.digit % 2 === 0 ? 'is-even' : 'is-odd'}
                            key={`${tick.epoch}-${index}`}
                            title={tick.digit % 2 === 0 ? 'Even' : 'Odd'}
                        >
                            {tick.digit}
                        </span>
                    ))}
                </div>
            </div>

            <div className='analysis-tool__summary'>
                <div>
                    <span>Even</span>
                    <strong>{stats.even_percent.toFixed(1)}%</strong>
                </div>
                <div>
                    <span>Odd</span>
                    <strong>{stats.total ? (100 - stats.even_percent).toFixed(1) : '0.0'}%</strong>
                </div>
                <div>
                    <span>Ticks analysed</span>
                    <strong>{stats.total}</strong>
                </div>
            </div>

            <p className='analysis-tool__note'>
                This shows what has already happened. Past digit frequency does not predict the next tick, and it is not
                financial advice.
            </p>
        </div>
    );
};

export default AnalysisTool;

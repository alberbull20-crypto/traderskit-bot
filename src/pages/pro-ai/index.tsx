// @ts-nocheck — talks to the vendored bot API, which has no type definitions
import { useEffect, useMemo, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { useApiBase } from '@/hooks/useApiBase';
import { isVirtualAccount } from '@/utils/account-helpers';
import {
    buyDigitContract,
    digitFromQuote,
    getContractResult,
    getErrorCode,
    getErrorText,
} from '@/utils/traderskit-trading';
import '../analysis-tool/analysis-tool.scss';
import '../bulk-trader/bulk-trader.scss';
import './pro-ai.scss';

const MARKETS = [
    { symbol: 'R_10', name: 'Volatility 10 Index', group: 'standard' },
    { symbol: 'R_25', name: 'Volatility 25 Index', group: 'standard' },
    { symbol: 'R_50', name: 'Volatility 50 Index', group: 'standard' },
    { symbol: 'R_75', name: 'Volatility 75 Index', group: 'standard' },
    { symbol: 'R_100', name: 'Volatility 100 Index', group: 'standard' },
    { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index', group: 'onesec' },
    { symbol: '1HZ15V', name: 'Volatility 15 (1s) Index', group: 'onesec' },
    { symbol: '1HZ25V', name: 'Volatility 25 (1s) Index', group: 'onesec' },
    { symbol: '1HZ30V', name: 'Volatility 30 (1s) Index', group: 'onesec' },
    { symbol: '1HZ50V', name: 'Volatility 50 (1s) Index', group: 'onesec' },
    { symbol: '1HZ75V', name: 'Volatility 75 (1s) Index', group: 'onesec' },
    { symbol: '1HZ90V', name: 'Volatility 90 (1s) Index', group: 'onesec' },
    { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index', group: 'onesec' },
];

// mode 'low': wait for digits at or below the threshold. mode 'high': wait for digits at or above it.
const STRATEGIES = [
    { id: 'over1', name: 'Over 1 Pro', contract: 'DIGITOVER', barrier: 1, buy_label: 'Over 1', mode: 'low', digits: 3 },
    { id: 'under8', name: 'Under 8 Pro', contract: 'DIGITUNDER', barrier: 8, buy_label: 'Under 8', mode: 'high', digits: 3 },
    { id: 'over2', name: 'Over 2 Pro', contract: 'DIGITOVER', barrier: 2, buy_label: 'Over 2', mode: 'low', digits: 4 },
    { id: 'under7', name: 'Under 7 Pro', contract: 'DIGITUNDER', barrier: 7, buy_label: 'Under 7', mode: 'high', digits: 4 },
    { id: 'over3', name: 'Over 3 Pro', contract: 'DIGITOVER', barrier: 3, buy_label: 'Over 3', mode: 'low', digits: 5 },
    { id: 'under6', name: 'Under 6 Pro', contract: 'DIGITUNDER', barrier: 6, buy_label: 'Under 6', mode: 'high', digits: 5 },
];

const MARKET_SETS = [
    { id: 'all', name: 'All volatility markets' },
    { id: 'standard', name: 'Standard indices (R_10 to R_100)' },
    { id: 'onesec', name: '1-second indices' },
];

const WINDOW_KEEP = 10;
const SHOWN_DIGITS = 8;
const MIN_STAKE = 0.35;
const MAX_STAKE = 50;
const MAX_TOTAL_TRADES = 50;
const MIN_DIGITS = 2;
const MAX_DIGITS = 8;
const SETTLE_POLL_MS = 2000;
const WATCHDOG_MS = 10000;
const STALE_MS = 15000;
const MAX_HISTORY = 40;
const MAX_EVENTS = 12;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));

const describeEntry = strategy =>
    `Waits for ${strategy.digits} digits at or ${strategy.mode === 'low' ? 'below' : 'above'} ${strategy.barrier}`;

const matchesRule = (digit, strategy) => (strategy.mode === 'low' ? digit <= strategy.barrier : digit >= strategy.barrier);

const createEngine = () => ({
    running: false,
    cfg: null,
    symbols: [],
    windows: {},
    pips: {},
    own: {},
    subs: {},
    remaining: 0,
    feeds: 0,
    matches: 0,
    sent: 0,
    errors: 0,
    error_streak: 0,
    last_tick_at: 0,
    listener: null,
    watchdog: null,
});

const ProAI = () => {
    const { activeLoginid, authData } = useApiBase();

    const [view, setView] = useState('list');
    const [strategy_id, setStrategyId] = useState('over1');
    const [stake, setStake] = useState('1');
    const [total_trades, setTotalTrades] = useState('5');
    const [market_set, setMarketSet] = useState('all');
    const [digits_to_check, setDigitsToCheck] = useState('3');

    const [running, setRunning] = useState(false);
    const [counters, setCounters] = useState({ feeds: 0, matches: 0, sent: 0, errors: 0 });
    const [rows, setRows] = useState({});
    const [events, setEvents] = useState([]);
    const [trades, setTrades] = useState([]);
    const [message, setMessage] = useState('');

    const engine = useRef(createEngine());
    const mounted = useRef(true);

    const login_prefix = activeLoginid ? String(activeLoginid).slice(0, 3).toUpperCase() : '';
    const is_demo = Boolean(activeLoginid) && Boolean(isVirtualAccount(String(activeLoginid)));
    const currency = authData?.currency || 'USD';
    const base_strategy = STRATEGIES.find(item => item.id === strategy_id) || STRATEGIES[0];

    const safe = fn => {
        if (mounted.current) fn();
    };

    const addEvent = (text, kind = 'info') => {
        safe(() =>
            setEvents(previous =>
                [{ id: `${Date.now()}-${Math.random()}`, time: new Date().toLocaleTimeString(), text, kind }, ...previous].slice(
                    0,
                    MAX_EVENTS
                )
            )
        );
    };

    const refreshCounters = () => {
        const e = engine.current;
        safe(() => setCounters({ feeds: e.feeds, matches: e.matches, sent: e.sent, errors: e.errors }));
    };

    // ---------- Feeds ----------

    const subscribeSymbol = async symbol => {
        const e = engine.current;
        try {
            const response = await api_base.api.send({
                ticks_history: symbol,
                end: 'latest',
                count: 20,
                style: 'ticks',
                subscribe: 1,
            });
            if (response?.error) throw response;

            const subscription_id = response?.subscription?.id;

            // The scanner was stopped while this request was in flight: clean up our own subscription.
            if (!e.running) {
                if (subscription_id) {
                    try {
                        await api_base.api.forget(subscription_id);
                    } catch (x) {
                        // Nothing more to do.
                    }
                }
                return;
            }

            const pip = Number.isInteger(response?.pip_size) ? response.pip_size : 2;
            const prices = response?.history?.prices ?? [];
            e.pips[symbol] = pip;
            e.own[symbol] = true;
            if (subscription_id) e.subs[symbol] = subscription_id;
            e.windows[symbol] = prices.slice(-WINDOW_KEEP).map(price => digitFromQuote(price, pip));

            const last_price = prices.length ? Number(prices[prices.length - 1]).toFixed(pip) : '--';
            safe(() =>
                setRows(previous => ({
                    ...previous,
                    [symbol]: { digits: e.windows[symbol], quote: last_price, status: 'live' },
                }))
            );
        } catch (error) {
            if (getErrorCode(error) === 'AlreadySubscribed') {
                // Another part of the app already streams this market. Its ticks still reach us.
                safe(() =>
                    setRows(previous => ({
                        ...previous,
                        [symbol]: { ...(previous[symbol] || { digits: [], quote: '--' }), status: 'shared' },
                    }))
                );
            } else {
                e.errors += 1;
                refreshCounters();
                safe(() =>
                    setRows(previous => ({
                        ...previous,
                        [symbol]: { ...(previous[symbol] || { digits: [], quote: '--' }), status: 'error' },
                    }))
                );
                addEvent(`${symbol}: ${getErrorText(error)}`, 'error');
            }
        }
    };

    const subscribeAll = async () => {
        const e = engine.current;
        for (const symbol of e.symbols) {
            if (!e.running) break;
            await subscribeSymbol(symbol);
            await sleep(150);
        }
    };

    // ---------- Trading ----------

    const placeEntry = async (symbol, last_digits) => {
        const e = engine.current;
        const { strategy, stake: stake_value, currency: account_currency } = e.cfg;

        e.matches += 1;
        refreshCounters();
        addEvent(`${symbol}: digits ${last_digits.join(', ')} matched. Buying ${strategy.buy_label}.`, 'match');

        const id = `${Date.now()}-${symbol}-${e.matches}`;
        safe(() =>
            setTrades(previous =>
                [
                    {
                        id,
                        label: `${symbol} · ${strategy.buy_label}`,
                        stake: stake_value,
                        status: 'pending',
                        profit: 0,
                        time: new Date().toLocaleTimeString(),
                    },
                    ...previous,
                ].slice(0, MAX_HISTORY)
            )
        );

        try {
            const response = await buyDigitContract({
                contract_type: strategy.contract,
                stake: stake_value,
                currency: account_currency,
                symbol,
                barrier: strategy.barrier,
            });
            const contract_id = response?.buy?.contract_id;
            if (!contract_id) throw response;

            e.sent += 1;
            e.error_streak = 0;
            safe(() =>
                setTrades(previous =>
                    previous.map(trade => (trade.id === id ? { ...trade, status: 'open', contract_id } : trade))
                )
            );
        } catch (error) {
            e.errors += 1;
            e.error_streak += 1;
            e.remaining += 1; // give the trade back so the limit only counts real purchases
            const text = getErrorText(error);
            safe(() =>
                setTrades(previous =>
                    previous.map(trade => (trade.id === id ? { ...trade, status: 'error', message: text } : trade))
                )
            );
            addEvent(`${symbol}: ${text}`, 'error');
            if (e.error_streak >= 3) stopScanner('Stopped after 3 errors in a row.');
        }

        refreshCounters();
        if (e.running && e.remaining <= 0) stopScanner('Trade limit reached. Open trades will still settle.');
    };

    const handleMessage = ({ data }) => {
        if (data?.msg_type !== 'tick') return;
        const e = engine.current;
        if (!e.running) return;

        const tick = data.tick;
        const symbol = tick?.symbol || tick?.underlying_symbol;
        if (!symbol || !e.symbols.includes(symbol)) return;

        e.last_tick_at = Date.now();
        e.feeds += 1;
        if (e.own[symbol] && !e.subs[symbol] && tick.id) e.subs[symbol] = tick.id;

        const pip = Number.isInteger(tick.pip_size) ? tick.pip_size : e.pips[symbol] ?? 2;
        e.pips[symbol] = pip;
        const digit = digitFromQuote(tick.quote, pip);
        const window_digits = [...(e.windows[symbol] || []), digit].slice(-WINDOW_KEEP);
        e.windows[symbol] = window_digits;

        safe(() =>
            setRows(previous => ({
                ...previous,
                [symbol]: {
                    digits: window_digits,
                    quote: Number(tick.quote).toFixed(pip),
                    status: previous[symbol]?.status === 'shared' ? 'shared' : 'live',
                },
            }))
        );
        if (e.feeds % 10 === 0) refreshCounters();

        const { strategy } = e.cfg;
        const last_digits = window_digits.slice(-strategy.digits);
        const is_match = last_digits.length === strategy.digits && last_digits.every(item => matchesRule(item, strategy));

        if (is_match && e.remaining > 0) {
            e.remaining -= 1;
            e.windows[symbol] = []; // a new pattern needs fresh ticks
            placeEntry(symbol, last_digits);
        }
    };

    const checkFeeds = () => {
        const e = engine.current;
        if (!e.running) return;
        if (Date.now() - e.last_tick_at > STALE_MS) {
            e.last_tick_at = Date.now();
            e.own = {};
            e.subs = {};
            addEvent('No ticks received. Reconnecting feeds...', 'info');
            subscribeAll();
        }
    };

    // ---------- Start and stop ----------

    const stopScanner = async (reason = '', silent = false) => {
        const e = engine.current;
        if (!e.running) return;
        e.running = false;

        if (e.listener) {
            try {
                e.listener.unsubscribe();
            } catch (x) {
                // Already closed.
            }
            e.listener = null;
        }
        if (e.watchdog) {
            clearInterval(e.watchdog);
            e.watchdog = null;
        }

        if (!silent) {
            safe(() => setRunning(false));
            if (reason) addEvent(reason, 'info');
            refreshCounters();
        }

        // Only forget the streams this scanner opened itself.
        const ids = Object.keys(e.own)
            .filter(symbol => e.own[symbol] && e.subs[symbol])
            .map(symbol => e.subs[symbol]);
        for (const id of ids) {
            try {
                await api_base.api.forget(id);
            } catch (x) {
                // Nothing more to do.
            }
        }
    };

    const startScanner = async () => {
        setMessage('');

        if (!is_demo) {
            setMessage('Pro AI runs on demo accounts only for now. Switch to your demo account to use it.');
            return;
        }
        if (!api_base?.api) {
            setMessage('Waiting for the Deriv connection. Try again in a moment.');
            return;
        }

        const stake_value = Number(stake);
        const total_value = parseInt(total_trades, 10);
        const digits_value = parseInt(digits_to_check, 10);

        if (!Number.isFinite(stake_value) || stake_value < MIN_STAKE || stake_value > MAX_STAKE) {
            setMessage(`Stake must be between ${MIN_STAKE} and ${MAX_STAKE}.`);
            return;
        }
        if (!Number.isInteger(total_value) || total_value < 1 || total_value > MAX_TOTAL_TRADES) {
            setMessage(`Number of trades must be between 1 and ${MAX_TOTAL_TRADES}.`);
            return;
        }
        if (!Number.isInteger(digits_value) || digits_value < MIN_DIGITS || digits_value > MAX_DIGITS) {
            setMessage(`Digits to check must be between ${MIN_DIGITS} and ${MAX_DIGITS}.`);
            return;
        }

        const e = engine.current;
        if (e.running) return;

        const symbols = MARKETS.filter(market => market_set === 'all' || market.group === market_set).map(
            market => market.symbol
        );

        Object.assign(e, {
            running: true,
            cfg: { strategy: { ...base_strategy, digits: digits_value }, stake: stake_value, currency },
            symbols,
            windows: {},
            pips: {},
            own: {},
            subs: {},
            remaining: total_value,
            feeds: 0,
            matches: 0,
            sent: 0,
            errors: 0,
            error_streak: 0,
            last_tick_at: Date.now(),
        });

        setRows({});
        setEvents([]);
        setCounters({ feeds: 0, matches: 0, sent: 0, errors: 0 });
        setRunning(true);

        e.listener = api_base.api.onMessage().subscribe(handleMessage);
        e.watchdog = setInterval(checkFeeds, WATCHDOG_MS);
        addEvent(`Scanner started on ${symbols.length} markets.`, 'info');

        await subscribeAll();
    };

    // Stop the scanner if the page is closed.
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            stopScanner('', true);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // Check open contracts every couple of seconds until they settle.
    useEffect(() => {
        const open_trades = trades.filter(trade => trade.status === 'open' && trade.contract_id);
        if (!open_trades.length) return undefined;

        let cancelled = false;

        const timer = setInterval(async () => {
            const updates = {};

            await Promise.all(
                open_trades.map(async trade => {
                    try {
                        const result = await getContractResult(trade.contract_id);
                        if (result) updates[trade.id] = result;
                    } catch (error) {
                        // Try again on the next round.
                    }
                })
            );

            if (cancelled || !Object.keys(updates).length) return;
            setTrades(previous => previous.map(trade => (updates[trade.id] ? { ...trade, ...updates[trade.id] } : trade)));
        }, SETTLE_POLL_MS);

        return () => {
            cancelled = true;
            clearInterval(timer);
        };
    }, [trades]);

    const summary = useMemo(() => {
        const wins = trades.filter(trade => trade.status === 'won').length;
        const losses = trades.filter(trade => trade.status === 'lost').length;
        const open = trades.filter(trade => trade.status === 'open' || trade.status === 'pending').length;
        const profit = trades.reduce((sum, trade) => sum + (trade.profit || 0), 0);
        return { wins, losses, open, profit };
    }, [trades]);

    const shown_markets = MARKETS.filter(market => market_set === 'all' || market.group === market_set);
    const live_strategy = { ...base_strategy, digits: parseInt(digits_to_check, 10) || base_strategy.digits };

    const openStrategy = id => {
        const chosen = STRATEGIES.find(item => item.id === id);
        setStrategyId(id);
        setDigitsToCheck(String(chosen.digits));
        setMessage('');
        setView('detail');
    };

    const banner = (
        <div className={`bulk-trader__banner ${is_demo ? 'is-demo' : 'is-blocked'}`}>
            {is_demo
                ? 'Demo account detected. Trades here use virtual money.'
                : `Trading is switched off: Pro AI runs on demo accounts only for now. ${
                      login_prefix ? `(Active account starts with ${login_prefix}.)` : '(No active account yet.)'
                  }`}
        </div>
    );

    // ---------- Strategy list ----------
    if (view === 'list') {
        return (
            <div className='analysis-tool bulk-trader pro-ai'>
                <div className='analysis-tool__header'>
                    <span className='analysis-tool__label'>Automated digit entries</span>
                    <h2>Pro AI</h2>
                    <p>Select a strategy, set your limits, and let the scanner watch every volatility market for you.</p>
                </div>

                {banner}

                <div className='pro-ai__strategies'>
                    {STRATEGIES.map(item => (
                        <button type='button' className='pro-ai__strategy' key={item.id} onClick={() => openStrategy(item.id)}>
                            <span className='pro-ai__strategy-icon'>{item.mode === 'low' ? '↑' : '↓'}</span>
                            <span className='pro-ai__strategy-body'>
                                <strong>{item.name}</strong>
                                <span>{describeEntry(item)}</span>
                                <em>Buys {item.buy_label} · 1 tick</em>
                            </span>
                            <span className='pro-ai__strategy-open'>Select</span>
                        </button>
                    ))}
                </div>

                <p className='analysis-tool__note'>
                    The scanner follows fixed rules. Patterns only decide when a trade is placed: they do not change the
                    odds of winning, and past digits do not predict the next one. Trading involves risk.
                </p>
            </div>
        );
    }

    // ---------- Strategy detail ----------
    return (
        <div className='analysis-tool bulk-trader pro-ai'>
            <div className='pro-ai__top'>
                <button type='button' className='pro-ai__back' disabled={running} onClick={() => setView('list')}>
                    ← Back
                </button>
                <div className='pro-ai__top-title'>
                    <span className='analysis-tool__label'>Pro AI bot</span>
                    <h2>{base_strategy.name}</h2>
                </div>
            </div>

            {banner}

            <div className='pro-ai__layout'>
                <div className='pro-ai__panel'>
                    <div className='pro-ai__form'>
                        <label className='analysis-tool__field'>
                            <span>
                                Stake ({currency}, {MIN_STAKE}–{MAX_STAKE})
                            </span>
                            <input
                                type='number'
                                min={MIN_STAKE}
                                max={MAX_STAKE}
                                step='0.01'
                                value={stake}
                                disabled={running}
                                onChange={event => setStake(event.target.value)}
                            />
                        </label>

                        <label className='analysis-tool__field'>
                            <span>No. of trades (1–{MAX_TOTAL_TRADES})</span>
                            <input
                                type='number'
                                min={1}
                                max={MAX_TOTAL_TRADES}
                                step='1'
                                value={total_trades}
                                disabled={running}
                                onChange={event => setTotalTrades(event.target.value)}
                            />
                        </label>

                        <label className='analysis-tool__field'>
                            <span>Markets</span>
                            <select value={market_set} disabled={running} onChange={event => setMarketSet(event.target.value)}>
                                {MARKET_SETS.map(set => (
                                    <option key={set.id} value={set.id}>
                                        {set.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className='analysis-tool__field'>
                            <span>
                                Digits to check ({MIN_DIGITS}–{MAX_DIGITS})
                            </span>
                            <input
                                type='number'
                                min={MIN_DIGITS}
                                max={MAX_DIGITS}
                                step='1'
                                value={digits_to_check}
                                disabled={running}
                                onChange={event => setDigitsToCheck(event.target.value)}
                            />
                        </label>
                    </div>

                    <div className='pro-ai__status'>
                        <i className={running ? 'is-running' : 'is-stopped'} />
                        <div>
                            <strong>{running ? 'Scanner running' : 'Scanner stopped'}</strong>
                            <span>
                                Entry: {describeEntry(live_strategy)}. Buys {base_strategy.buy_label}.
                            </span>
                        </div>
                    </div>

                    {running ? (
                        <button
                            type='button'
                            className='bulk-trader__btn is-stop pro-ai__start'
                            onClick={() => stopScanner('Stopped by you.')}
                        >
                            Stop scanner
                        </button>
                    ) : (
                        <button
                            type='button'
                            className='bulk-trader__btn is-primary pro-ai__start'
                            disabled={!is_demo}
                            onClick={startScanner}
                        >
                            Start scanner
                        </button>
                    )}

                    {message && <p className='bulk-trader__message'>{message}</p>}

                    <div className='pro-ai__counters'>
                        <div>
                            <span>Feeds</span>
                            <strong>{counters.feeds}</strong>
                        </div>
                        <div>
                            <span>Matches</span>
                            <strong>{counters.matches}</strong>
                        </div>
                        <div>
                            <span>Trades sent</span>
                            <strong>{counters.sent}</strong>
                        </div>
                        <div>
                            <span>Errors</span>
                            <strong>{counters.errors}</strong>
                        </div>
                    </div>

                    <p className='pro-ai__hint'>Stop the scanner before running a bot from Bot Builder.</p>
                </div>

                <div className='pro-ai__panel'>
                    <div className='pro-ai__feed-head'>
                        <span className='pro-ai__feed-label'>Live pattern feed</span>
                        <strong>Scanned markets</strong>
                        <em>Entry: last {live_strategy.digits} digits {base_strategy.mode === 'low' ? '≤' : '≥'} {base_strategy.barrier}</em>
                    </div>

                    <div className='pro-ai__table'>
                        <table>
                            <thead>
                                <tr>
                                    <th>Market</th>
                                    <th>Last digits</th>
                                    <th>Price</th>
                                    <th>Feed</th>
                                </tr>
                            </thead>
                            <tbody>
                                {shown_markets.map(market => {
                                    const row = rows[market.symbol];
                                    const digits = row?.digits ? row.digits.slice(-SHOWN_DIGITS) : [];
                                    return (
                                        <tr key={market.symbol}>
                                            <td>{market.name}</td>
                                            <td>
                                                <span className='pro-ai__digits'>
                                                    {digits.length === 0 && <span className='is-empty'>-</span>}
                                                    {digits.map((digit, index) => (
                                                        <span
                                                            key={`${market.symbol}-${index}`}
                                                            className={matchesRule(digit, base_strategy) ? 'is-hit' : ''}
                                                        >
                                                            {digit}
                                                        </span>
                                                    ))}
                                                </span>
                                            </td>
                                            <td>{row?.quote ?? '-'}</td>
                                            <td className={`is-${row?.status || 'idle'}`}>{row?.status || 'idle'}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>

                    <div className='pro-ai__events'>
                        {events.length === 0 && <p className='is-empty'>No scanner activity yet. Press Start scanner.</p>}
                        {events.map(item => (
                            <p key={item.id} className={`is-${item.kind}`}>
                                <span>{item.time}</span> {item.text}
                            </p>
                        ))}
                    </div>
                </div>
            </div>

            <div className='analysis-tool__summary'>
                <div>
                    <span>Won</span>
                    <strong>{summary.wins}</strong>
                </div>
                <div>
                    <span>Lost</span>
                    <strong>{summary.losses}</strong>
                </div>
                <div>
                    <span>Profit / loss ({currency})</span>
                    <strong className={summary.profit >= 0 ? 'bulk-trader__profit' : 'bulk-trader__loss'}>
                        {summary.profit.toFixed(2)}
                    </strong>
                </div>
            </div>

            {trades.length > 0 && (
                <div className='bulk-trader__results'>
                    <div className='bulk-trader__results-head'>
                        <span>Trades ({summary.open} open)</span>
                        <button type='button' onClick={() => setTrades([])}>
                            Clear
                        </button>
                    </div>
                    <table>
                        <thead>
                            <tr>
                                <th>Time</th>
                                <th>Trade</th>
                                <th>Stake</th>
                                <th>Result</th>
                                <th>Profit</th>
                            </tr>
                        </thead>
                        <tbody>
                            {trades.map(trade => (
                                <tr key={trade.id}>
                                    <td>{trade.time}</td>
                                    <td>{trade.label}</td>
                                    <td>{trade.stake.toFixed(2)}</td>
                                    <td className={`is-${trade.status}`}>
                                        {trade.status === 'error' ? trade.message : trade.status}
                                    </td>
                                    <td>{trade.status === 'won' || trade.status === 'lost' ? trade.profit.toFixed(2) : '-'}</td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            )}

            <p className='analysis-tool__note'>
                The scanner follows fixed rules. Patterns only decide when a trade is placed: they do not change the odds
                of winning, and past digits do not predict the next one. Trading involves risk.
            </p>
        </div>
    );
};

export default ProAI;

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
import '../pro-ai/pro-ai.scss';
import './dual-edge.scss';

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

// low: buy Over `low` after low digits. high: buy Under `high` after high digits.
const INITIAL_TYPES = [
    { id: '1-8', name: 'Over 1 / Under 8', low: 1, high: 8 },
    { id: '2-7', name: 'Over 2 / Under 7', low: 2, high: 7 },
    { id: '3-6', name: 'Over 3 / Under 6', low: 3, high: 6 },
];

const MIN_STAKE = 0.35;
const MAX_STAKE = 50;
const MIN_INIT_DIGITS = 2;
const MAX_INIT_DIGITS = 5;
const MIN_REC_DIGITS = 3;
const MAX_REC_DIGITS = 10;
const KEEP = 12;
const MAX_HISTORY = 40;
const MAX_EVENTS = 14;
const RESULT_POLL_MS = 1500;
const RESULT_TRIES = 25;
const WATCHDOG_MS = 10000;
const STALE_MS = 15000;

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms));
const round2 = value => Math.round(value * 100) / 100;

const createEngine = () => ({
    running: false,
    cfg: null,
    window: [],
    pip: 2,
    own: false,
    sub_id: null,
    state: 'scan_initial', // scan_initial | scan_recovery | in_trade
    step: 0,
    stake: 0,
    won: 0,
    lost: 0,
    pl: 0,
    error_streak: 0,
    last_tick_at: 0,
    feed_ready: false,
    listener: null,
    watchdog: null,
});

const DualEdge = () => {
    const { activeLoginid, authData } = useApiBase();

    const [market, setMarket] = useState('1HZ100V');
    const [initial_id, setInitialId] = useState('1-8');
    const [init_digits, setInitDigits] = useState('2');
    const [rec_digits, setRecDigits] = useState('7');
    const [stake, setStake] = useState('1');
    const [take_profit, setTakeProfit] = useState('5');
    const [stop_loss, setStopLoss] = useState('30');
    const [use_martingale, setUseMartingale] = useState(true);
    const [multiplier, setMultiplier] = useState('2');
    const [max_steps, setMaxSteps] = useState('5');

    const [running, setRunning] = useState(false);
    const [stage, setStage] = useState('Stopped');
    const [stats, setStats] = useState({ won: 0, lost: 0, pl: 0, stake: 0 });
    const [feed_ready, setFeedReady] = useState(false);
    const [digits, setDigits] = useState([]);
    const [events, setEvents] = useState([]);
    const [trades, setTrades] = useState([]);
    const [message, setMessage] = useState('');

    const engine = useRef(createEngine());
    const mounted = useRef(true);

    const login_prefix = activeLoginid ? String(activeLoginid).slice(0, 3).toUpperCase() : '';
    const is_demo = Boolean(activeLoginid) && Boolean(isVirtualAccount(String(activeLoginid)));
    const currency = authData?.currency || 'USD';
    const initial_type = INITIAL_TYPES.find(item => item.id === initial_id) || INITIAL_TYPES[0];
    const api_connected = Boolean(api_base?.api);

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

    const pushStats = () => {
        const e = engine.current;
        safe(() => setStats({ won: e.won, lost: e.lost, pl: e.pl, stake: e.stake }));
    };

    const stageText = () => {
        const e = engine.current;
        if (!e.running) return 'Stopped';
        if (e.state === 'in_trade') return 'Trade in progress';
        if (e.state === 'scan_recovery') return `Recovery scan (step ${e.step})`;
        return 'Scanning for an entry';
    };

    const refreshStage = () => safe(() => setStage(stageText()));

    // ---------- Feed ----------

    const subscribeFeed = async () => {
        const e = engine.current;
        const symbol = e.cfg.symbol;
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

            e.pip = Number.isInteger(response?.pip_size) ? response.pip_size : 2;
            e.own = true;
            if (subscription_id) e.sub_id = subscription_id;
            const prices = response?.history?.prices ?? [];
            e.window = prices.slice(-KEEP).map(price => digitFromQuote(price, e.pip));
            safe(() => setDigits(e.window));
        } catch (error) {
            if (getErrorCode(error) === 'AlreadySubscribed') {
                // Another part of the app already streams this market. Its ticks still reach us.
                return;
            }
            addEvent(`Feed error: ${getErrorText(error)}`, 'error');
            stopSession('Stopped: could not open the market feed.');
        }
    };

    // ---------- Trading ----------

    const waitForResult = async contract_id => {
        for (let attempt = 0; attempt < RESULT_TRIES; attempt += 1) {
            await sleep(RESULT_POLL_MS);
            if (!mounted.current) return null;
            try {
                const result = await getContractResult(contract_id);
                if (result) return result;
            } catch (error) {
                // Try again.
            }
        }
        return null;
    };

    const enterTrade = async side => {
        const e = engine.current;
        const { cfg } = e;
        const stake_value = e.stake;

        // Strict stop loss: never place a trade that could take the session past the limit.
        if (e.pl - stake_value < -cfg.stop_loss) {
            stopSession('Stopped: the next trade could pass your stop loss.');
            return;
        }

        e.state = 'in_trade';
        e.window = [];
        refreshStage();
        addEvent(`Entry matched. Buying ${side.label} with stake ${stake_value.toFixed(2)}.`, 'match');

        const id = `${Date.now()}-${e.won + e.lost}`;
        safe(() =>
            setTrades(previous =>
                [
                    {
                        id,
                        label: `${cfg.symbol} · ${side.label}`,
                        stake: stake_value,
                        status: 'pending',
                        profit: 0,
                        time: new Date().toLocaleTimeString(),
                    },
                    ...previous,
                ].slice(0, MAX_HISTORY)
            )
        );

        let contract_id = null;
        try {
            const response = await buyDigitContract({
                contract_type: side.contract,
                stake: stake_value,
                currency: cfg.currency,
                symbol: cfg.symbol,
                barrier: side.barrier,
            });
            contract_id = response?.buy?.contract_id;
            if (!contract_id) throw response;
            e.error_streak = 0;
            safe(() =>
                setTrades(previous =>
                    previous.map(trade => (trade.id === id ? { ...trade, status: 'open', contract_id } : trade))
                )
            );
        } catch (error) {
            const text = getErrorText(error);
            e.error_streak += 1;
            safe(() =>
                setTrades(previous =>
                    previous.map(trade => (trade.id === id ? { ...trade, status: 'error', message: text } : trade))
                )
            );
            addEvent(text, 'error');
            if (e.error_streak >= 3) {
                stopSession('Stopped after 3 errors in a row.');
            } else if (e.running) {
                e.state = e.step > 0 ? 'scan_recovery' : 'scan_initial';
                refreshStage();
            }
            return;
        }

        const result = await waitForResult(contract_id);

        if (!result) {
            safe(() =>
                setTrades(previous =>
                    previous.map(trade =>
                        trade.id === id ? { ...trade, status: 'error', message: 'Result not confirmed' } : trade
                    )
                )
            );
            stopSession('Stopped: could not confirm the last trade result.');
            return;
        }

        safe(() =>
            setTrades(previous =>
                previous.map(trade =>
                    trade.id === id ? { ...trade, status: result.status, profit: result.profit } : trade
                )
            )
        );

        e.pl = round2(e.pl + result.profit);
        if (result.status === 'won') e.won += 1;
        else e.lost += 1;
        e.window = [];

        if (!e.running) {
            pushStats();
            return;
        }

        if (e.pl >= cfg.take_profit) {
            pushStats();
            stopSession('Take profit reached.');
            return;
        }
        if (e.pl <= -cfg.stop_loss) {
            pushStats();
            stopSession('Stop loss reached.');
            return;
        }

        if (result.status === 'won') {
            e.step = 0;
            e.stake = cfg.base_stake;
            e.state = 'scan_initial';
            addEvent(`Won ${result.profit.toFixed(2)}. Back to the initial scan.`, 'info');
        } else {
            e.step += 1;
            if (e.step > cfg.max_steps) {
                pushStats();
                stopSession('Recovery step limit reached.');
                return;
            }
            const next_stake = cfg.use_martingale ? round2(e.stake * cfg.multiplier) : e.stake;
            if (next_stake > MAX_STAKE) {
                pushStats();
                stopSession(`Stopped: the next stake would be above the ${MAX_STAKE} cap.`);
                return;
            }
            e.stake = next_stake;
            e.state = 'scan_recovery';
            addEvent(`Lost ${Math.abs(result.profit).toFixed(2)}. Recovery scan, next stake ${e.stake.toFixed(2)}.`, 'info');
        }

        pushStats();
        refreshStage();
    };

    const findEntry = () => {
        const e = engine.current;
        const { cfg } = e;

        if (e.state === 'scan_initial') {
            const last = e.window.slice(-cfg.init_digits);
            if (last.length < cfg.init_digits) return null;
            if (last.every(digit => digit <= cfg.low)) {
                return { label: `Over ${cfg.low}`, contract: 'DIGITOVER', barrier: cfg.low };
            }
            if (last.every(digit => digit >= cfg.high)) {
                return { label: `Under ${cfg.high}`, contract: 'DIGITUNDER', barrier: cfg.high };
            }
            return null;
        }

        if (e.state === 'scan_recovery') {
            const last = e.window.slice(-cfg.rec_digits);
            if (last.length < cfg.rec_digits) return null;
            if (last.every(digit => digit % 2 === 0)) return { label: 'Odd', contract: 'DIGITODD' };
            if (last.every(digit => digit % 2 === 1)) return { label: 'Even', contract: 'DIGITEVEN' };
        }

        return null;
    };

    const handleMessage = ({ data }) => {
        if (data?.msg_type !== 'tick') return;
        const e = engine.current;
        if (!e.running) return;

        const tick = data.tick;
        const symbol = tick?.symbol || tick?.underlying_symbol;
        if (symbol !== e.cfg.symbol) return;

        e.last_tick_at = Date.now();
        if (e.own && !e.sub_id && tick.id) e.sub_id = tick.id;

        e.pip = Number.isInteger(tick.pip_size) ? tick.pip_size : e.pip;
        const digit = digitFromQuote(tick.quote, e.pip);
        e.window = [...e.window, digit].slice(-KEEP);

        if (!e.feed_ready) {
            e.feed_ready = true;
            safe(() => setFeedReady(true));
        }
        safe(() => setDigits(e.window));

        if (e.state === 'in_trade') return;

        const side = findEntry();
        if (side) enterTrade(side);
    };

    const checkFeed = () => {
        const e = engine.current;
        if (!e.running) return;
        if (Date.now() - e.last_tick_at > STALE_MS) {
            e.last_tick_at = Date.now();
            e.own = false;
            e.sub_id = null;
            addEvent('No ticks received. Reconnecting the feed...', 'info');
            subscribeFeed();
        }
    };

    // ---------- Start and stop ----------

    const stopSession = async (reason = '', silent = false) => {
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
            safe(() => {
                setRunning(false);
                setStage('Stopped');
            });
            if (reason) addEvent(reason, 'info');
        }

        // Only forget the stream this session opened itself.
        if (e.own && e.sub_id) {
            try {
                await api_base.api.forget(e.sub_id);
            } catch (x) {
                // Nothing more to do.
            }
        }
    };

    const startSession = async () => {
        setMessage('');

        if (!is_demo) {
            setMessage('Dual Edge runs on demo accounts only for now. Switch to your demo account to use it.');
            return;
        }
        if (!api_base?.api) {
            setMessage('Waiting for the Deriv connection. Try again in a moment.');
            return;
        }

        const stake_value = Number(stake);
        const tp_value = Number(take_profit);
        const sl_value = Number(stop_loss);
        const mult_value = Number(multiplier);
        const steps_value = parseInt(max_steps, 10);
        const init_value = parseInt(init_digits, 10);
        const rec_value = parseInt(rec_digits, 10);

        if (!Number.isFinite(stake_value) || stake_value < MIN_STAKE || stake_value > MAX_STAKE) {
            setMessage(`Stake must be between ${MIN_STAKE} and ${MAX_STAKE}.`);
            return;
        }
        if (!Number.isFinite(tp_value) || tp_value < 0.5 || tp_value > 1000) {
            setMessage('Take profit must be between 0.5 and 1000.');
            return;
        }
        if (!Number.isFinite(sl_value) || sl_value < 1 || sl_value > 1000) {
            setMessage('Stop loss must be between 1 and 1000.');
            return;
        }
        if (sl_value < stake_value) {
            setMessage('Stop loss must be at least as large as one stake.');
            return;
        }
        if (use_martingale && (!Number.isFinite(mult_value) || mult_value < 1.1 || mult_value > 3)) {
            setMessage('Martingale multiplier must be between 1.1 and 3.');
            return;
        }
        if (!Number.isInteger(steps_value) || steps_value < 1 || steps_value > 8) {
            setMessage('Recovery steps must be between 1 and 8.');
            return;
        }
        if (!Number.isInteger(init_value) || init_value < MIN_INIT_DIGITS || init_value > MAX_INIT_DIGITS) {
            setMessage(`Initial digits must be between ${MIN_INIT_DIGITS} and ${MAX_INIT_DIGITS}.`);
            return;
        }
        if (!Number.isInteger(rec_value) || rec_value < MIN_REC_DIGITS || rec_value > MAX_REC_DIGITS) {
            setMessage(`Recovery digits must be between ${MIN_REC_DIGITS} and ${MAX_REC_DIGITS}.`);
            return;
        }

        const e = engine.current;
        if (e.running) return;

        Object.assign(e, {
            running: true,
            cfg: {
                symbol: market,
                currency,
                base_stake: stake_value,
                take_profit: tp_value,
                stop_loss: sl_value,
                use_martingale,
                multiplier: mult_value,
                max_steps: steps_value,
                init_digits: init_value,
                rec_digits: rec_value,
                low: initial_type.low,
                high: initial_type.high,
            },
            window: [],
            pip: 2,
            own: false,
            sub_id: null,
            state: 'scan_initial',
            step: 0,
            stake: stake_value,
            won: 0,
            lost: 0,
            pl: 0,
            error_streak: 0,
            last_tick_at: Date.now(),
            feed_ready: false,
        });

        setEvents([]);
        setDigits([]);
        setFeedReady(false);
        setRunning(true);
        pushStats();
        refreshStage();

        e.listener = api_base.api.onMessage().subscribe(handleMessage);
        e.watchdog = setInterval(checkFeed, WATCHDOG_MS);
        addEvent(`Session started on ${market}.`, 'info');

        await subscribeFeed();
    };

    // Stop the session if the page is closed.
    useEffect(() => {
        mounted.current = true;
        return () => {
            mounted.current = false;
            stopSession('', true);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const summary_open = useMemo(
        () => trades.filter(trade => trade.status === 'open' || trade.status === 'pending').length,
        [trades]
    );

    const init_text = `Initial: ${initial_type.name} (last ${parseInt(init_digits, 10) || '?'} digits)`;
    const rec_text = `Recovery: Even/Odd streak (last ${parseInt(rec_digits, 10) || '?'} digits)`;

    return (
        <div className='analysis-tool bulk-trader dual-edge'>
            <div className={`bulk-trader__banner ${is_demo ? 'is-demo' : 'is-blocked'}`}>
                {is_demo
                    ? 'Demo account detected. Trades here use virtual money.'
                    : `Trading is switched off: Dual Edge runs on demo accounts only for now. ${
                          login_prefix ? `(Active account starts with ${login_prefix}.)` : '(No active account yet.)'
                      }`}
            </div>

            <div className='dual-edge__hero'>
                <div>
                    <h2>Dual Edge</h2>
                    <p>
                        {init_text} · {rec_text}
                    </p>
                </div>
                <div className='dual-edge__chips'>
                    <span className={running ? 'is-on' : ''}>{running ? 'Running' : 'Stopped'}</span>
                    <span className={api_connected ? 'is-on' : ''}>{api_connected ? 'API connected' : 'Waiting for API'}</span>
                    <span className={feed_ready ? 'is-on' : ''}>{feed_ready ? 'Market ready' : 'Waiting for feed'}</span>
                </div>
            </div>

            <div className='dual-edge__stats'>
                <div>
                    <span>Won trades</span>
                    <strong className='bulk-trader__profit'>{stats.won}</strong>
                </div>
                <div>
                    <span>Lost trades</span>
                    <strong className='bulk-trader__loss'>{stats.lost}</strong>
                </div>
                <div>
                    <span>Session P/L ({currency})</span>
                    <strong className={stats.pl >= 0 ? 'bulk-trader__profit' : 'bulk-trader__loss'}>
                        {stats.pl.toFixed(2)}
                    </strong>
                </div>
                <div>
                    <span>Current stake ({currency})</span>
                    <strong>{(running ? stats.stake : Number(stake) || 0).toFixed(2)}</strong>
                </div>
            </div>

            <div className='pro-ai__layout'>
                <div className='pro-ai__panel'>
                    <div className='pro-ai__form'>
                        <label className='analysis-tool__field'>
                            <span>Market</span>
                            <select value={market} disabled={running} onChange={event => setMarket(event.target.value)}>
                                {MARKETS.map(item => (
                                    <option key={item.symbol} value={item.symbol}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className='analysis-tool__field'>
                            <span>Initial trade type</span>
                            <select value={initial_id} disabled={running} onChange={event => setInitialId(event.target.value)}>
                                {INITIAL_TYPES.map(item => (
                                    <option key={item.id} value={item.id}>
                                        {item.name}
                                    </option>
                                ))}
                            </select>
                        </label>

                        <label className='analysis-tool__field'>
                            <span>
                                Initial digits ({MIN_INIT_DIGITS}–{MAX_INIT_DIGITS})
                            </span>
                            <input
                                type='number'
                                min={MIN_INIT_DIGITS}
                                max={MAX_INIT_DIGITS}
                                value={init_digits}
                                disabled={running}
                                onChange={event => setInitDigits(event.target.value)}
                            />
                        </label>

                        <label className='analysis-tool__field'>
                            <span>
                                Recovery digits ({MIN_REC_DIGITS}–{MAX_REC_DIGITS})
                            </span>
                            <input
                                type='number'
                                min={MIN_REC_DIGITS}
                                max={MAX_REC_DIGITS}
                                value={rec_digits}
                                disabled={running}
                                onChange={event => setRecDigits(event.target.value)}
                            />
                        </label>

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
                            <span>Take profit ({currency})</span>
                            <input
                                type='number'
                                min='0.5'
                                step='0.5'
                                value={take_profit}
                                disabled={running}
                                onChange={event => setTakeProfit(event.target.value)}
                            />
                        </label>

                        <label className='analysis-tool__field'>
                            <span>Stop loss ({currency})</span>
                            <input
                                type='number'
                                min='1'
                                step='1'
                                value={stop_loss}
                                disabled={running}
                                onChange={event => setStopLoss(event.target.value)}
                            />
                        </label>

                        <label className='analysis-tool__field'>
                            <span>Recovery steps (1–8)</span>
                            <input
                                type='number'
                                min={1}
                                max={8}
                                value={max_steps}
                                disabled={running}
                                onChange={event => setMaxSteps(event.target.value)}
                            />
                        </label>
                    </div>

                    <div className='dual-edge__toggle'>
                        <label>
                            <input
                                type='checkbox'
                                checked={use_martingale}
                                disabled={running}
                                onChange={event => setUseMartingale(event.target.checked)}
                            />
                            <span>Enable martingale (multiply the stake after each loss)</span>
                        </label>
                        {use_martingale && (
                            <input
                                type='number'
                                min='1.1'
                                max='3'
                                step='0.1'
                                value={multiplier}
                                disabled={running}
                                onChange={event => setMultiplier(event.target.value)}
                                aria-label='Martingale multiplier'
                            />
                        )}
                    </div>

                    <div className='pro-ai__status'>
                        <i className={running ? 'is-running' : 'is-stopped'} />
                        <div>
                            <strong>{stage}</strong>
                            <span>
                                After a loss it waits for {parseInt(rec_digits, 10) || '?'} digits in a row of the same
                                parity and buys the opposite.
                            </span>
                        </div>
                    </div>

                    {running ? (
                        <button
                            type='button'
                            className='bulk-trader__btn is-stop pro-ai__start'
                            onClick={() => stopSession('Stopped by you.')}
                        >
                            Stop
                        </button>
                    ) : (
                        <button
                            type='button'
                            className='bulk-trader__btn is-primary pro-ai__start'
                            disabled={!is_demo}
                            onClick={startSession}
                        >
                            Start Dual Edge
                        </button>
                    )}

                    {message && <p className='bulk-trader__message'>{message}</p>}
                </div>

                <div className='pro-ai__panel'>
                    <div className='pro-ai__feed-head'>
                        <span className='pro-ai__feed-label'>Live digits</span>
                        <strong>{MARKETS.find(item => item.symbol === market)?.name}</strong>
                    </div>

                    <div className='dual-edge__digits'>
                        {digits.length === 0 && <span className='is-empty'>Press Start to see live digits.</span>}
                        {digits.map((digit, index) => (
                            <span key={`${index}-${digit}`} className={digit % 2 === 0 ? 'is-even' : 'is-odd'}>
                                {digit}
                            </span>
                        ))}
                    </div>

                    <div className='pro-ai__events'>
                        {events.length === 0 && <p className='is-empty'>No activity yet.</p>}
                        {events.map(item => (
                            <p key={item.id} className={`is-${item.kind}`}>
                                <span>{item.time}</span> {item.text}
                            </p>
                        ))}
                    </div>
                </div>
            </div>

            {trades.length > 0 && (
                <div className='bulk-trader__results'>
                    <div className='bulk-trader__results-head'>
                        <span>Trades ({summary_open} open)</span>
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
                Raising the stake after a loss (martingale) does not improve the odds: a long losing streak can grow
                stakes quickly, which is why the stop loss, recovery step limit and stake cap above matter. Patterns only
                decide when a trade is placed. Trading involves risk. Stop this bot before running one from Bot Builder.
            </p>
        </div>
    );
};

export default DualEdge;

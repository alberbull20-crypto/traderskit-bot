// @ts-nocheck — talks to the vendored bot API, which has no type definitions
import { useEffect, useMemo, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { useApiBase } from '@/hooks/useApiBase';
import { buyContract, getContractResult, getErrorText, getProposal } from '@/utils/traderskit-trading';
import { getTradingAccess } from '@/utils/trading-access';
import '../analysis-tool/analysis-tool.scss';
import '../bulk-trader/bulk-trader.scss';
import './manual-trader.scss';

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

const CONTRACT_TYPES = {
    risefall: {
        name: 'Rise / Fall',
        needs_digit: false,
        default_duration: 5,
        sides: [
            { label: 'Rise', contract: 'CALL' },
            { label: 'Fall', contract: 'PUT' },
        ],
    },
    evenodd: {
        name: 'Even / Odd',
        needs_digit: false,
        default_duration: 1,
        sides: [
            { label: 'Even', contract: 'DIGITEVEN' },
            { label: 'Odd', contract: 'DIGITODD' },
        ],
    },
    overunder: {
        name: 'Over / Under',
        needs_digit: true,
        default_duration: 1,
        sides: [
            { label: 'Over', contract: 'DIGITOVER' },
            { label: 'Under', contract: 'DIGITUNDER' },
        ],
    },
    matchdiff: {
        name: 'Matches / Differs',
        needs_digit: true,
        default_duration: 1,
        sides: [
            { label: 'Matches', contract: 'DIGITMATCH' },
            { label: 'Differs', contract: 'DIGITDIFF' },
        ],
    },
};

const MIN_STAKE = 0.35;
const MAX_STAKE = 50;
const MIN_DURATION = 1;
const MAX_DURATION = 10;
const POLL_MS = 2000;
const RETRY_MS = 3000;
const INITIAL_COUNT = 20;
const POLL_COUNT = 5;
const SHOWN_DIGITS = 20;
const SETTLE_POLL_MS = 2000;
const PREVIEW_DELAY_MS = 700;
const MAX_HISTORY = 30;

/**
 * Plain request for the latest ticks of one market (no subscription),
 * so it cannot clash with a running bot.
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

const ManualTrader = () => {
    const { activeLoginid, authData } = useApiBase();

    const [symbol, setSymbol] = useState('R_100');
    const [contract_type, setContractType] = useState('risefall');
    const [digit, setDigit] = useState('4');
    const [duration, setDuration] = useState('5');
    const [stake, setStake] = useState('1');

    const [ticks, setTicks] = useState([]);
    const [pip, setPip] = useState(2);
    const [feed_error, setFeedError] = useState('');
    const [is_loading, setIsLoading] = useState(true);

    const [previews, setPreviews] = useState({});
    const [trades, setTrades] = useState([]);
    const [is_busy, setIsBusy] = useState(false);
    const [message, setMessage] = useState('');

    const rootRef = useRef(null);

    const currency = authData?.currency || 'USD';
    // One shared rule for all trading tools (see src/utils/trading-access.ts)
    const access = getTradingAccess(activeLoginid, currency);
    const can_trade = access.allowed;
    const type_config = CONTRACT_TYPES[contract_type];

    // Live price: load a few ticks, then refresh every couple of seconds.
    useEffect(() => {
        let cancelled = false;
        let timer = null;
        let loaded = false;

        setTicks([]);
        setFeedError('');
        setIsLoading(true);

        const run = async () => {
            const is_visible = rootRef.current && rootRef.current.offsetParent !== null && !document.hidden;
            if (loaded && !is_visible) {
                timer = setTimeout(run, POLL_MS);
                return;
            }

            const was_loaded = loaded;

            try {
                const { ticks: fresh, pip: pip_size } = await fetchTicks(symbol, was_loaded ? POLL_COUNT : INITIAL_COUNT);
                if (cancelled) return;

                loaded = true;
                setPip(pip_size);
                setFeedError('');
                setIsLoading(false);
                setTicks(previous => {
                    const base = was_loaded ? previous : [];
                    const last_epoch = base.length ? base[base.length - 1].epoch : 0;
                    return base.concat(fresh.filter(tick => tick.epoch > last_epoch)).slice(-SHOWN_DIGITS);
                });
            } catch (e) {
                if (cancelled) return;
                setFeedError(getErrorText(e));
            }

            if (!cancelled) timer = setTimeout(run, loaded ? POLL_MS : RETRY_MS);
        };

        run();

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, [symbol]);

    // Payout preview for both sides. These are price requests only: nothing is bought.
    useEffect(() => {
        let cancelled = false;
        setPreviews({});

        const stake_value = Number(stake);
        const duration_value = parseInt(duration, 10);
        const digit_value = parseInt(digit, 10);

        const inputs_ok =
            Number.isFinite(stake_value) &&
            stake_value >= MIN_STAKE &&
            stake_value <= MAX_STAKE &&
            Number.isInteger(duration_value) &&
            duration_value >= MIN_DURATION &&
            duration_value <= MAX_DURATION;

        if (!inputs_ok) return undefined;

        const timer = setTimeout(async () => {
            const entries = await Promise.all(
                type_config.sides.map(async side => {
                    const invalid_pick =
                        type_config.needs_digit &&
                        ((side.contract === 'DIGITOVER' && digit_value > 8) ||
                            (side.contract === 'DIGITUNDER' && digit_value < 1));
                    if (invalid_pick) return [side.contract, { error: 'This pick can never win.' }];

                    try {
                        const proposal = await getProposal({
                            contract_type: side.contract,
                            stake: stake_value,
                            currency,
                            symbol,
                            barrier: type_config.needs_digit ? digit_value : undefined,
                            duration: duration_value,
                        });
                        return [
                            side.contract,
                            { payout: Number(proposal?.payout), ask_price: Number(proposal?.ask_price) },
                        ];
                    } catch (e) {
                        return [side.contract, { error: getErrorText(e) }];
                    }
                })
            );
            if (!cancelled) setPreviews(Object.fromEntries(entries));
        }, PREVIEW_DELAY_MS);

        return () => {
            cancelled = true;
            clearTimeout(timer);
        };
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [symbol, contract_type, digit, duration, stake, currency]);

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
                    } catch (e) {
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

    const last_tick = ticks.length ? ticks[ticks.length - 1] : null;
    const price_text = last_tick ? last_tick.quote.toFixed(pip) : '--';

    const changeContractType = value => {
        setContractType(value);
        setDuration(String(CONTRACT_TYPES[value].default_duration));
        setMessage('');
    };

    const placeTrade = async side => {
        setMessage('');

        if (!can_trade) {
            setMessage(access.reason || 'Trading is not available for this account.');
            return;
        }

        const stake_value = Number(stake);
        const duration_value = parseInt(duration, 10);
        const digit_value = parseInt(digit, 10);

        if (!Number.isFinite(stake_value) || stake_value < MIN_STAKE || stake_value > MAX_STAKE) {
            setMessage(`Stake must be between ${MIN_STAKE} and ${MAX_STAKE}.`);
            return;
        }
        if (!Number.isInteger(duration_value) || duration_value < MIN_DURATION || duration_value > MAX_DURATION) {
            setMessage(`Duration must be between ${MIN_DURATION} and ${MAX_DURATION} ticks.`);
            return;
        }
        if (type_config.needs_digit) {
            if (!Number.isInteger(digit_value) || digit_value < 0 || digit_value > 9) {
                setMessage('Pick a digit from 0 to 9.');
                return;
            }
            if (side.contract === 'DIGITOVER' && digit_value > 8) {
                setMessage('Over 9 can never win. Pick a digit from 0 to 8.');
                return;
            }
            if (side.contract === 'DIGITUNDER' && digit_value < 1) {
                setMessage('Under 0 can never win. Pick a digit from 1 to 9.');
                return;
            }
        }

        setIsBusy(true);

        const id = `${Date.now()}-${Math.random()}`;
        const label = `${symbol} · ${side.label}${type_config.needs_digit ? ` ${digit_value}` : ''} · ${duration_value}t`;

        setTrades(previous =>
            [
                { id, label, stake: stake_value, status: 'pending', profit: 0, time: new Date().toLocaleTimeString() },
                ...previous,
            ].slice(0, MAX_HISTORY)
        );

        try {
            const response = await buyContract({
                contract_type: side.contract,
                stake: stake_value,
                currency,
                symbol,
                barrier: type_config.needs_digit ? digit_value : undefined,
                duration: duration_value,
            });
            const contract_id = response?.buy?.contract_id;
            if (!contract_id) throw response;
            setTrades(previous =>
                previous.map(trade => (trade.id === id ? { ...trade, status: 'open', contract_id } : trade))
            );
        } catch (e) {
            const text = getErrorText(e);
            setTrades(previous =>
                previous.map(trade => (trade.id === id ? { ...trade, status: 'error', message: text } : trade))
            );
        }

        setIsBusy(false);
    };

    return (
        <div className='analysis-tool bulk-trader manual-trader' ref={rootRef}>
            <div className='analysis-tool__header'>
                <span className='analysis-tool__label'>Trading</span>
                <h2>Manual Trader</h2>
                <p>Choose a contract, check the payout, and place a trade yourself.</p>
            </div>

            {!can_trade && <div className='bulk-trader__banner is-blocked'>{access.reason}</div>}

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
                    <span>Trade type</span>
                    <select value={contract_type} onChange={event => changeContractType(event.target.value)}>
                        {Object.entries(CONTRACT_TYPES).map(([key, config]) => (
                            <option key={key} value={key}>
                                {config.name}
                            </option>
                        ))}
                    </select>
                </label>

                {type_config.needs_digit && (
                    <label className='analysis-tool__field'>
                        <span>Digit</span>
                        <select value={digit} onChange={event => setDigit(event.target.value)}>
                            {Array.from({ length: 10 }, (_, value) => (
                                <option key={value} value={String(value)}>
                                    {value}
                                </option>
                            ))}
                        </select>
                    </label>
                )}

                <label className='analysis-tool__field'>
                    <span>
                        Duration in ticks ({MIN_DURATION}–{MAX_DURATION})
                    </span>
                    <input
                        type='number'
                        min={MIN_DURATION}
                        max={MAX_DURATION}
                        step='1'
                        value={duration}
                        onChange={event => setDuration(event.target.value)}
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
                        onChange={event => setStake(event.target.value)}
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
                    <i className={feed_error ? 'is-error' : is_loading ? 'is-loading' : 'is-live'} />
                    {feed_error ? feed_error : is_loading ? 'Loading price...' : 'Live'}
                </div>
            </div>

            <div className='analysis-tool__strip'>
                <span className='analysis-tool__strip-title'>Latest digits</span>
                <div className='analysis-tool__chips'>
                    {ticks.map((tick, index) => (
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

            <div className='manual-trader__previews'>
                {type_config.sides.map(side => {
                    const preview = previews[side.contract];
                    return (
                        <div className='manual-trader__preview' key={side.contract}>
                            <h4>
                                {side.label}
                                {type_config.needs_digit ? ` ${digit}` : ''}
                            </h4>
                            {!preview && <p className='is-muted'>Checking the payout...</p>}
                            {preview?.error && <p className='is-error'>{preview.error}</p>}
                            {preview && !preview.error && (
                                <>
                                    <p>
                                        Payout: <strong>{preview.payout.toFixed(2)}</strong> {currency}
                                    </p>
                                    <p>
                                        Profit if it wins:{' '}
                                        <strong>{(preview.payout - preview.ask_price).toFixed(2)}</strong> {currency}
                                    </p>
                                    <p className='is-muted'>Cost: {preview.ask_price.toFixed(2)}</p>
                                </>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className='bulk-trader__panel'>
                <div className='bulk-trader__buttons manual-trader__buttons'>
                    {type_config.sides.map((side, index) => (
                        <button
                            type='button'
                            key={side.contract}
                            className={`bulk-trader__btn ${index === 0 ? 'is-primary' : 'is-alt'}`}
                            disabled={is_busy || !can_trade}
                            onClick={() => placeTrade(side)}
                        >
                            Buy {side.label}
                            {type_config.needs_digit ? ` ${digit}` : ''}
                        </button>
                    ))}
                </div>
            </div>

            {message && <p className='bulk-trader__message'>{message}</p>}

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
                        <button type='button' onClick={() => setTrades([])} disabled={is_busy}>
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
                Trading involves risk and you can lose money. Past digits and prices do not predict the next tick, and
                nothing here is financial advice. Stop any bot running in Bot Builder before using this page.
            </p>
        </div>
    );
};

export default ManualTrader;

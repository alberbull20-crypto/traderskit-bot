// @ts-nocheck — talks to the vendored bot API, which has no type definitions
import { useEffect, useMemo, useRef, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { useApiBase } from '@/hooks/useApiBase';
import { getTradingAccess } from '@/utils/trading-access';
import '../analysis-tool/analysis-tool.scss';
import './bulk-trader.scss';

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

const TRADE_TYPES = {
    evenodd: {
        name: 'Even / Odd',
        needs_digit: false,
        sides: [
            { label: 'Even', contract: 'DIGITEVEN' },
            { label: 'Odd', contract: 'DIGITODD' },
        ],
    },
    overunder: {
        name: 'Over / Under',
        needs_digit: true,
        sides: [
            { label: 'Over', contract: 'DIGITOVER' },
            { label: 'Under', contract: 'DIGITUNDER' },
        ],
    },
    matchdiff: {
        name: 'Matches / Differs',
        needs_digit: true,
        sides: [
            { label: 'Matches', contract: 'DIGITMATCH' },
            { label: 'Differs', contract: 'DIGITDIFF' },
        ],
    },
};

const MIN_WINDOW = 50;
const MAX_WINDOW = 5000;
const DEFAULT_WINDOW = 1000;
const POLL_MS = 2000;
const RETRY_MS = 3000;
const POLL_COUNT = 20;
const LATEST_DIGITS = 20;
const SETTLE_POLL_MS = 2000;
const MIN_STAKE = 0.35;
const MAX_STAKE = 50;
const MAX_TRADES = 10;
const MAX_HISTORY = 30;
const RING_RADIUS = 34;
const RING_LENGTH = 2 * Math.PI * RING_RADIUS;

const clampWindow = value => {
    const number = parseInt(value, 10);
    if (Number.isNaN(number)) return DEFAULT_WINDOW;
    return Math.min(MAX_WINDOW, Math.max(MIN_WINDOW, number));
};

const getErrorText = error => {
    const source = error?.error ?? error;
    return source?.message || source?.code || 'Something went wrong.';
};

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

/**
 * Buys one digit contract directly (no proposal step).
 * Tries the field name used by the template's trade options first (underlying_symbol),
 * and retries once with the older name (symbol) if Deriv rejects the request format.
 */
const buyOne = async ({ contract_type, stake, currency, symbol, barrier }) => {
    const parameters = {
        amount: stake,
        basis: 'stake',
        contract_type,
        currency,
        duration: 1,
        duration_unit: 't',
    };
    if (barrier !== undefined) parameters.barrier = String(barrier);

    const send = async symbol_key => {
        const response = await api_base.api.send({
            buy: '1',
            price: stake,
            parameters: { ...parameters, [symbol_key]: symbol },
        });
        if (response?.error) throw response;
        return response;
    };

    try {
        return await send('underlying_symbol');
    } catch (error) {
        if ((error?.error ?? error)?.code === 'InputValidationFailed') {
            return await send('symbol');
        }
        throw error;
    }
};

const BulkTrader = () => {
    const { activeLoginid, authData } = useApiBase();

    const [symbol, setSymbol] = useState('R_100');
    const [windowSize, setWindowSize] = useState(DEFAULT_WINDOW);
    const [windowInput, setWindowInput] = useState(String(DEFAULT_WINDOW));
    const [ticks, setTicks] = useState([]);
    const [pip, setPip] = useState(2);
    const [error, setError] = useState('');
    const [is_loading, setIsLoading] = useState(true);

    const [trade_type, setTradeType] = useState('evenodd');
    const [digit, setDigit] = useState('4');
    const [stake, setStake] = useState('1');
    const [trade_count, setTradeCount] = useState('3');
    const [trades, setTrades] = useState([]);
    const [is_busy, setIsBusy] = useState(false);
    const [message, setMessage] = useState('');

    const rootRef = useRef(null);

    const currency = authData?.currency || 'USD';
    // One shared rule for all trading tools (see src/utils/trading-access.ts)
    const access = getTradingAccess(activeLoginid, currency);
    const can_trade = access.allowed;
    const type_config = TRADE_TYPES[trade_type];

    // Load the window of ticks, then refresh it every couple of seconds.
    useEffect(() => {
        let cancelled = false;
        let timer = null;
        let loaded = false;

        setTicks([]);
        setError('');
        setIsLoading(true);

        const run = async () => {
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
                        const response = await api_base.api.send({
                            proposal_open_contract: 1,
                            contract_id: trade.contract_id,
                        });
                        const contract = response?.proposal_open_contract;
                        if (contract && contract.status && contract.status !== 'open') {
                            updates[trade.id] = {
                                status: contract.status === 'won' ? 'won' : 'lost',
                                profit: Number(contract.profit) || 0,
                            };
                        }
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

    const stats = useMemo(() => {
        const counts = Array(10).fill(0);
        ticks.forEach(tick => {
            counts[tick.digit] += 1;
        });
        const total = ticks.length;
        const percents = counts.map(count => (total ? (count / total) * 100 : 0));
        return { total, percents, max: Math.max(...percents), min: Math.min(...percents) };
    }, [ticks]);

    const summary = useMemo(() => {
        const wins = trades.filter(trade => trade.status === 'won').length;
        const losses = trades.filter(trade => trade.status === 'lost').length;
        const open = trades.filter(trade => trade.status === 'open' || trade.status === 'pending').length;
        const profit = trades.reduce((sum, trade) => sum + (trade.profit || 0), 0);
        return { wins, losses, open, profit };
    }, [trades]);

    const last_tick = ticks.length ? ticks[ticks.length - 1] : null;
    const price_text = last_tick ? last_tick.quote.toFixed(pip) : '--';
    const latest_digits = ticks.slice(-LATEST_DIGITS);

    const commitWindow = () => {
        const value = clampWindow(windowInput);
        setWindowInput(String(value));
        setWindowSize(value);
    };

    const placeTrades = async side => {
        setMessage('');

        if (!can_trade) {
            setMessage(access.reason || 'Trading is not available for this account.');
            return;
        }

        const stake_value = Number(stake);
        const count = parseInt(trade_count, 10);
        const digit_value = parseInt(digit, 10);

        if (!Number.isFinite(stake_value) || stake_value < MIN_STAKE || stake_value > MAX_STAKE) {
            setMessage(`Stake must be between ${MIN_STAKE} and ${MAX_STAKE}.`);
            return;
        }
        if (!Number.isInteger(count) || count < 1 || count > MAX_TRADES) {
            setMessage(`Number of trades must be between 1 and ${MAX_TRADES}.`);
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

        const batch_id = Date.now();
        const label = type_config.needs_digit ? `${side.label} ${digit_value}` : side.label;
        const placeholders = Array.from({ length: count }, (_, index) => ({
            id: `${batch_id}-${index}`,
            label,
            stake: stake_value,
            status: 'pending',
            profit: 0,
            time: new Date().toLocaleTimeString(),
        }));

        setTrades(previous => [...placeholders.slice().reverse(), ...previous].slice(0, MAX_HISTORY));

        const results = await Promise.allSettled(
            placeholders.map(() =>
                buyOne({
                    contract_type: side.contract,
                    stake: stake_value,
                    currency,
                    symbol,
                    barrier: type_config.needs_digit ? digit_value : undefined,
                })
            )
        );

        setTrades(previous =>
            previous.map(trade => {
                const index = placeholders.findIndex(placeholder => placeholder.id === trade.id);
                if (index === -1) return trade;
                const result = results[index];
                const contract_id = result.status === 'fulfilled' ? result.value?.buy?.contract_id : null;
                if (contract_id) return { ...trade, status: 'open', contract_id };
                return {
                    ...trade,
                    status: 'error',
                    message: getErrorText(result.status === 'rejected' ? result.reason : result.value),
                };
            })
        );

        setIsBusy(false);
    };

    return (
        <div className='analysis-tool bulk-trader' ref={rootRef}>
            <div className='analysis-tool__header'>
                <span className='analysis-tool__label'>Trading</span>
                <h2>Bulk Trader</h2>
                <p>Place several digit trades at once and watch the last-digit pattern live.</p>
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
                    <select value={trade_type} onChange={event => setTradeType(event.target.value)}>
                        {Object.entries(TRADE_TYPES).map(([key, config]) => (
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
                {stats.percents.map((percent, digit_index) => {
                    const is_highest = stats.total > 0 && percent === stats.max;
                    const is_lowest = stats.total > 0 && percent === stats.min;
                    const is_current = last_tick && last_tick.digit === digit_index;
                    const fill = stats.max > 0 ? (percent / stats.max) * RING_LENGTH : 0;

                    return (
                        <div
                            className={[
                                'analysis-tool__digit',
                                is_highest ? 'is-highest' : '',
                                is_lowest ? 'is-lowest' : '',
                                is_current ? 'is-current' : '',
                            ].join(' ')}
                            key={digit_index}
                            aria-label={`Digit ${digit_index}: ${percent.toFixed(2)} percent`}
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
                                <strong>{digit_index}</strong>
                                <span>{percent.toFixed(2)}%</span>
                            </div>
                            {is_current && <i className='analysis-tool__marker' />}
                        </div>
                    );
                })}
            </div>

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

            <div className='bulk-trader__panel'>
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

                <label className='analysis-tool__field'>
                    <span>Number of trades (1–{MAX_TRADES})</span>
                    <input
                        type='number'
                        min={1}
                        max={MAX_TRADES}
                        step='1'
                        value={trade_count}
                        onChange={event => setTradeCount(event.target.value)}
                    />
                </label>

                <div className='bulk-trader__buttons'>
                    {type_config.sides.map((side, index) => (
                        <button
                            type='button'
                            key={side.contract}
                            className={`bulk-trader__btn ${index === 0 ? 'is-primary' : 'is-alt'}`}
                            disabled={is_busy || !can_trade}
                            onClick={() => placeTrades(side)}
                        >
                            Buy {parseInt(trade_count, 10) || 0} × {side.label}
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
                Trading involves risk and you can lose money. Past digit frequency does not predict the next tick, and
                nothing here is financial advice.
            </p>
        </div>
    );
};

export default BulkTrader;

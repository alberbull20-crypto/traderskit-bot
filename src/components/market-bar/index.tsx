// @ts-nocheck — talks to the vendored bot API, which has no type definitions
import { useEffect, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { api_base } from '@/external/bot-skeleton';
import { useApiBase } from '@/hooks/useApiBase';
import { useStore } from '@/hooks/useStore';
import { KES_RATE_NOTE, USD_TO_KES } from '@/utils/traderskit-rate';
import './market-bar.scss';

const MARKETS = [
    { symbol: 'R_25', name: 'Volatility 25 Index' },
    { symbol: 'R_50', name: 'Volatility 50 Index' },
    { symbol: 'R_75', name: 'Volatility 75 Index' },
    { symbol: 'R_100', name: 'Volatility 100 Index' },
    { symbol: '1HZ10V', name: 'Volatility 10 (1s) Index' },
    { symbol: '1HZ100V', name: 'Volatility 100 (1s) Index' },
];

const POLL_MS = 8000;
const FIRST_RETRY_MS = 2000;
const STORAGE_KEY = 'traderskit_balance_view';

/** Plain request for the latest price (no subscription), so it cannot clash with a running bot. */
const fetchQuote = async symbol => {
    const response = await api_base.api.send({
        ticks_history: symbol,
        end: 'latest',
        count: 1,
        style: 'ticks',
    });
    if (response?.error) throw response;

    const price = Number(response?.history?.prices?.[0]);
    const pip = Number.isInteger(response?.pip_size) ? response.pip_size : 2;
    if (!Number.isFinite(price)) throw new Error('No price');

    return { price, pip };
};

const formatMoney = value =>
    new Intl.NumberFormat('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(value);

const MarketBar = observer(() => {
    const { client } = useStore() ?? {};
    const { activeLoginid, authData } = useApiBase();

    const [quotes, setQuotes] = useState({});
    const [show_kes, setShowKes] = useState(() => {
        try {
            return localStorage.getItem(STORAGE_KEY) === 'KES';
        } catch (e) {
            return false;
        }
    });

    // Live prices: one small request per market every few seconds, only while the page is visible.
    useEffect(() => {
        let cancelled = false;
        let timer = null;
        let got_data = false;

        const run = async () => {
            if (!document.hidden && api_base?.api) {
                const results = await Promise.all(
                    MARKETS.map(async market => {
                        try {
                            return [market.symbol, await fetchQuote(market.symbol)];
                        } catch (e) {
                            return [market.symbol, null];
                        }
                    })
                );
                if (cancelled) return;

                setQuotes(previous => {
                    const next = { ...previous };
                    results.forEach(([symbol, quote]) => {
                        if (!quote) return;
                        got_data = true;
                        const before = previous[symbol];
                        let direction = before?.direction || '';
                        if (before && quote.price !== before.price) {
                            direction = quote.price > before.price ? 'up' : 'down';
                        }
                        next[symbol] = { ...quote, direction };
                    });
                    return next;
                });
            }

            if (!cancelled) timer = setTimeout(run, got_data ? POLL_MS : FIRST_RETRY_MS);
        };

        run();

        return () => {
            cancelled = true;
            if (timer) clearTimeout(timer);
        };
    }, []);

    const currency = authData?.currency;
    const balance = Number(client?.balance);
    const can_convert = Boolean(activeLoginid) && currency === 'USD' && Number.isFinite(balance);

    const chooseView = value => {
        setShowKes(value === 'KES');
        try {
            localStorage.setItem(STORAGE_KEY, value);
        } catch (e) {
            // Not saving the choice is fine.
        }
    };

    const renderGroup = hidden => (
        <div className='market-bar__group' aria-hidden={hidden ? 'true' : undefined}>
            {MARKETS.map(market => {
                const quote = quotes[market.symbol];
                return (
                    <span className='market-bar__item' key={market.symbol}>
                        {market.name}
                        {quote && (
                            <b className={quote.direction ? `is-${quote.direction}` : ''}>
                                {quote.price.toFixed(quote.pip)}
                                {quote.direction === 'up' ? ' ▲' : quote.direction === 'down' ? ' ▼' : ''}
                            </b>
                        )}
                        <i aria-hidden='true'>---</i>
                    </span>
                );
            })}
        </div>
    );

    return (
        <div className='market-bar'>
            <div className='market-bar__ticker' aria-label='Live market prices'>
                <div className='market-bar__track'>
                    {renderGroup(false)}
                    {renderGroup(true)}
                </div>
            </div>

            {can_convert && (
                <div className='market-bar__balance'>
                    <div className='market-bar__amount'>
                        <span>Balance</span>
                        <strong>
                            {show_kes ? 'KES' : 'USD'} {formatMoney(show_kes ? balance * USD_TO_KES : balance)}
                        </strong>
                        {show_kes && (
                            <small title={KES_RATE_NOTE}>≈ at 1 USD = {USD_TO_KES} KES (approx.)</small>
                        )}
                    </div>
                    <div className='market-bar__switch' role='group' aria-label='Balance currency'>
                        <button
                            type='button'
                            className={!show_kes ? 'is-active' : ''}
                            aria-pressed={!show_kes}
                            onClick={() => chooseView('USD')}
                        >
                            USD
                        </button>
                        <button
                            type='button'
                            className={show_kes ? 'is-active' : ''}
                            aria-pressed={show_kes}
                            onClick={() => chooseView('KES')}
                        >
                            KES
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
});

export default MarketBar;

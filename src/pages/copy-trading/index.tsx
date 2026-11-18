// @ts-nocheck — talks to the vendored bot API, which has no type definitions
import { useEffect, useState } from 'react';
import { api_base } from '@/external/bot-skeleton';
import { useApiBase } from '@/hooks/useApiBase';
import { getErrorText } from '@/utils/traderskit-trading';
import { getTradingAccess } from '@/utils/trading-access';
import '../analysis-tool/analysis-tool.scss';
import '../bulk-trader/bulk-trader.scss';
import '../pro-ai/pro-ai.scss';
import './copy-trading.scss';

const MIN_TOKEN_LENGTH = 8;

const maskId = id => (id ? `${String(id).slice(0, 3).toUpperCase()}*****` : '-');

/** Sends one request and throws if Deriv answers with an error. */
const send = async request => {
    if (!api_base?.api) throw new Error('Waiting for the Deriv connection...');
    const response = await api_base.api.send(request);
    if (response?.error) throw response;
    return response;
};

const CopyTrading = () => {
    const { activeLoginid, authData } = useApiBase();

    const [token, setToken] = useState('');
    const [min_stake, setMinStake] = useState('');
    const [max_stake, setMaxStake] = useState('');
    const [copiers, setCopiers] = useState([]);
    const [traders, setTraders] = useState([]);
    const [allow_copiers, setAllowCopiers] = useState(null);
    const [copying, setCopying] = useState(false);
    const [busy, setBusy] = useState(false);
    const [error, setError] = useState('');
    const [info, setInfo] = useState('');

    const currency = authData?.currency || 'USD';
    // One shared rule for all trading tools (see src/utils/trading-access.ts)
    const access = getTradingAccess(activeLoginid, currency);
    const can_trade = access.allowed;
    const is_copying = copying || traders.length > 0;

    const refresh = async (quiet = false) => {
        try {
            const list_response = await send({ copytrading_list: 1 });
            const list = list_response?.copytrading_list || {};
            setCopiers((list.copiers || []).map(item => item.loginid));
            setTraders((list.traders || []).map(item => item.loginid));
            if ((list.traders || []).length > 0) setCopying(true);
        } catch (e) {
            if (!quiet) setError(getErrorText(e));
        }

        try {
            const settings_response = await send({ get_settings: 1 });
            const value = settings_response?.get_settings?.allow_copiers;
            if (value !== undefined) setAllowCopiers(Number(value) === 1);
        } catch (e) {
            // The setting is optional to display.
        }
    };

    // Load the current state once when the tab opens.
    useEffect(() => {
        refresh(true);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const requireAccess = () => {
        if (can_trade) return true;
        setError(access.reason || 'Copy trading is not available for this account.');
        return false;
    };

    const startCopying = async () => {
        setError('');
        setInfo('');
        if (!requireAccess()) return;

        const trimmed = token.trim();
        if (trimmed.length < MIN_TOKEN_LENGTH) {
            setError("Paste the trader's read-only API token first.");
            return;
        }

        const request = { copy_start: trimmed };
        if (min_stake !== '') {
            const value = Number(min_stake);
            if (!Number.isFinite(value) || value <= 0) {
                setError('Minimum stake must be a positive number.');
                return;
            }
            request.min_trade_stake = value;
        }
        if (max_stake !== '') {
            const value = Number(max_stake);
            if (!Number.isFinite(value) || value <= 0) {
                setError('Maximum stake must be a positive number.');
                return;
            }
            request.max_trade_stake = value;
        }
        if (request.min_trade_stake && request.max_trade_stake && request.min_trade_stake > request.max_trade_stake) {
            setError('Minimum stake cannot be above the maximum stake.');
            return;
        }

        setBusy(true);
        try {
            await send(request);
            setCopying(true);
            setInfo('Copying started. New trades from this trader will be copied into your account.');
            await refresh(true);
        } catch (e) {
            setError(getErrorText(e));
        }
        setBusy(false);
    };

    const stopCopying = async () => {
        setError('');
        setInfo('');
        if (!requireAccess()) return;

        const trimmed = token.trim();
        if (trimmed.length < MIN_TOKEN_LENGTH) {
            setError('Paste the same read-only token you used to start, so Deriv knows which trader to stop copying.');
            return;
        }

        setBusy(true);
        try {
            await send({ copy_stop: trimmed });
            setCopying(false);
            setInfo('Copying stopped.');
            await refresh(true);
        } catch (e) {
            setError(getErrorText(e));
        }
        setBusy(false);
    };

    const toggleAllow = async next => {
        setError('');
        setInfo('');
        if (!requireAccess()) return;

        setBusy(true);
        try {
            await send({ set_settings: 1, allow_copiers: next ? 1 : 0 });
            setAllowCopiers(next);
            setInfo(next ? 'Others can now copy this account.' : 'Others can no longer copy this account.');
        } catch (e) {
            setError(getErrorText(e));
        }
        setBusy(false);
    };

    const clearToken = () => {
        setToken('');
        setInfo('Token cleared from this page.');
    };

    return (
        <div className='analysis-tool bulk-trader copy-trading'>
            {!can_trade && <div className='bulk-trader__banner is-blocked'>{access.reason}</div>}

            <div className='copy-trading__hero'>
                <div>
                    <h2>Copy Trading</h2>
                    <p>Copy another trader's trades into your account, using Deriv's own copy trading.</p>
                </div>
                <div className='copy-trading__chips'>
                    <span className={access.is_demo ? 'is-on' : ''}>
                        {!activeLoginid ? 'No account' : access.is_demo ? 'Demo account' : 'Real account'}
                    </span>
                    <span className={is_copying ? 'is-on' : ''}>{is_copying ? 'Copying' : 'Not copying'}</span>
                </div>
            </div>

            <div className='copy-trading__account'>
                <span>Your account</span>
                <strong>{maskId(activeLoginid)}</strong>
            </div>

            {error && <p className='bulk-trader__message'>{error}</p>}
            {info && <p className='copy-trading__info'>{info}</p>}

            <div className='pro-ai__layout'>
                <div className='pro-ai__panel'>
                    <div className='pro-ai__feed-head'>
                        <span className='pro-ai__feed-label'>Copy a trader</span>
                        <strong>Start or stop copying</strong>
                    </div>

                    <label className='analysis-tool__field copy-trading__token'>
                        <span>Trader's read-only API token</span>
                        <input
                            type='password'
                            autoComplete='off'
                            spellCheck='false'
                            placeholder="Paste the trader's read-only token"
                            value={token}
                            disabled={busy}
                            onChange={event => setToken(event.target.value)}
                        />
                    </label>

                    <div className='pro-ai__form'>
                        <label className='analysis-tool__field'>
                            <span>Minimum stake to copy (optional)</span>
                            <input
                                type='number'
                                min='0'
                                step='0.01'
                                value={min_stake}
                                disabled={busy}
                                onChange={event => setMinStake(event.target.value)}
                            />
                        </label>
                        <label className='analysis-tool__field'>
                            <span>Maximum stake to copy (optional)</span>
                            <input
                                type='number'
                                min='0'
                                step='0.01'
                                value={max_stake}
                                disabled={busy}
                                onChange={event => setMaxStake(event.target.value)}
                            />
                        </label>
                    </div>

                    <div className='copy-trading__buttons'>
                        <button
                            type='button'
                            className='bulk-trader__btn is-primary'
                            disabled={busy || !can_trade}
                            onClick={startCopying}
                        >
                            Start copying
                        </button>
                        <button
                            type='button'
                            className='bulk-trader__btn is-stop'
                            disabled={busy || !can_trade}
                            onClick={stopCopying}
                        >
                            Stop copying
                        </button>
                        <button type='button' className='copy-trading__link' disabled={!token} onClick={clearToken}>
                            Clear token
                        </button>
                    </div>

                    <p className='copy-trading__safety'>
                        Only paste a <strong>read-only</strong> token that the trader created for copiers. Never paste a token
                        that can trade or manage an account. This page keeps the token in memory only: it is never saved,
                        and it is gone when you leave the page. To stop copying after reloading, paste the same token again.
                    </p>
                </div>

                <div className='pro-ai__panel'>
                    <div className='pro-ai__feed-head'>
                        <span className='pro-ai__feed-label'>Your copy trading</span>
                        <strong>Copiers and traders</strong>
                    </div>

                    <div className='copy-trading__toggle'>
                        <label>
                            <input
                                type='checkbox'
                                checked={Boolean(allow_copiers)}
                                disabled={busy || !can_trade || allow_copiers === null}
                                onChange={event => toggleAllow(event.target.checked)}
                            />
                            <span>Allow others to copy me</span>
                        </label>
                        <p>
                            If you turn this on, you can create a read-only API token in your Deriv account settings and
                            share it with the people you want to copy you.
                        </p>
                    </div>

                    <div className='pro-ai__counters'>
                        <div>
                            <span>Copiers</span>
                            <strong>{copiers.length}</strong>
                        </div>
                        <div>
                            <span>Traders you copy</span>
                            <strong>{traders.length}</strong>
                        </div>
                    </div>

                    <div className='copy-trading__lists'>
                        <div>
                            <h4>Copiers</h4>
                            {copiers.length === 0 && <p className='is-empty'>Nobody is copying you yet.</p>}
                            {copiers.map(id => (
                                <p key={`c-${id}`}>{maskId(id)}</p>
                            ))}
                        </div>
                        <div>
                            <h4>Traders you copy</h4>
                            {traders.length === 0 && <p className='is-empty'>You are not copying anyone.</p>}
                            {traders.map(id => (
                                <p key={`t-${id}`}>{maskId(id)}</p>
                            ))}
                        </div>
                    </div>

                    <button type='button' className='copy-trading__refresh' disabled={busy} onClick={() => refresh(false)}>
                        Refresh
                    </button>
                </div>
            </div>

            <p className='analysis-tool__note'>
                Copy trading copies another trader's trades into your account, including their losses. Past results do not
                predict future trades, and nothing here is financial advice. Trading involves risk and you can lose money.
            </p>
        </div>
    );
};

export default CopyTrading;

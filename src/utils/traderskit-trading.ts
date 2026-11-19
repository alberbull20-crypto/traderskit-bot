// @ts-nocheck — talks to the vendored bot API, which has no type definitions
import { api_base } from '@/external/bot-skeleton';

export const getErrorText = error => {
    const source = error?.error ?? error;
    return source?.message || source?.code || 'Something went wrong.';
};

export const getErrorCode = error => (error?.error ?? error)?.code;

/** Last digit of a price, using the market's decimal places. */
export const digitFromQuote = (quote, pip) => Number(Number(quote).toFixed(pip).slice(-1));

/**
 * Buys one contract directly (no proposal step).
 * Tries the field name used by the template's trade options first (underlying_symbol),
 * and retries once with the older name (symbol) if Deriv rejects the request format.
 */
export const buyContract = async ({
    contract_type,
    stake,
    currency,
    symbol,
    barrier,
    duration = 1,
    duration_unit = 't',
}) => {
    const parameters = {
        amount: stake,
        basis: 'stake',
        contract_type,
        currency,
        duration,
        duration_unit,
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
        if (getErrorCode(error) === 'InputValidationFailed') {
            return await send('symbol');
        }
        throw error;
    }
};

/** Buys one digit contract for 1 tick. */
export const buyDigitContract = args => buyContract({ ...args, duration: 1, duration_unit: 't' });

/**
 * Asks Deriv for the price of a contract without buying it (a one-off request, no subscription).
 * Returns the proposal object, which includes ask_price and payout.
 */
export const getProposal = async ({
    contract_type,
    stake,
    currency,
    symbol,
    barrier,
    duration = 1,
    duration_unit = 't',
}) => {
    if (!api_base?.api) throw new Error('Waiting for the Deriv connection...');

    const request = {
        proposal: 1,
        amount: stake,
        basis: 'stake',
        contract_type,
        currency,
        duration,
        duration_unit,
    };
    if (barrier !== undefined) request.barrier = String(barrier);

    const send = async symbol_key => {
        const response = await api_base.api.send({ ...request, [symbol_key]: symbol });
        if (response?.error) throw response;
        return response?.proposal;
    };

    try {
        return await send('underlying_symbol');
    } catch (error) {
        if (getErrorCode(error) === 'InputValidationFailed') {
            return await send('symbol');
        }
        throw error;
    }
};

/** Returns { status: 'won' | 'lost', profit } once a contract has finished, or null while it is still open. */
export const getContractResult = async contract_id => {
    const response = await api_base.api.send({ proposal_open_contract: 1, contract_id });
    const contract = response?.proposal_open_contract;
    if (contract && contract.status && contract.status !== 'open') {
        return { status: contract.status === 'won' ? 'won' : 'lost', profit: Number(contract.profit) || 0 };
    }
    return null;
};

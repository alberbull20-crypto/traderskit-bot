// @ts-nocheck — uses the template's account helpers, which have no type definitions
import { isVirtualAccount } from '@/utils/account-helpers';

/**
 * One switch for all TradersKit trading tools.
 * true:  the tools work on demo accounts and on real accounts.
 * false: the tools work on demo accounts only.
 */
export const ALLOW_REAL_ACCOUNTS = true;

// The stake limits in the tools are written for normal currencies.
// Crypto accounts (BTC, ETH, ...) are left out on purpose, because a stake of "1" would mean one whole coin.
const SUPPORTED_REAL_CURRENCIES = ['USD', 'EUR', 'GBP', 'AUD', 'USDC', 'USDT', 'TUSDT', 'EUSDT', 'UST'];

/** Tells a trading page whether it may place trades for the active account. */
export const getTradingAccess = (loginid, currency) => {
    if (!loginid) {
        return { allowed: false, is_demo: false, reason: 'No active account yet.' };
    }

    const is_demo = Boolean(isVirtualAccount(String(loginid)));
    if (is_demo) {
        return { allowed: true, is_demo: true, reason: '' };
    }

    if (!ALLOW_REAL_ACCOUNTS) {
        return {
            allowed: false,
            is_demo: false,
            reason: 'The trading tools are limited to demo accounts. Switch to your demo account to use them.',
        };
    }

    const code = String(currency || '').toUpperCase();
    if (!SUPPORTED_REAL_CURRENCIES.includes(code)) {
        return {
            allowed: false,
            is_demo: false,
            reason: `The trading tools do not support ${code || 'this'} accounts yet. Switch to an account in USD, EUR, GBP or AUD.`,
        };
    }

    return { allowed: true, is_demo: false, reason: '' };
};

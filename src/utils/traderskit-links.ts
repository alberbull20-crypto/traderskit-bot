import { getDerivDomain, standalone_routes } from '@/components/shared/utils/routes/routes';

// Deposit opens Deriv's own deposit page. getDerivDomain picks the right Deriv address for the environment.
export const DEPOSIT_URL = `${getDerivDomain('derivHome')}/dashboard/deposit?depositSheet=1`;

// Withdraw opens the Wallet for now. Deriv's old /cashier page no longer exists.
// Once we have the exact withdraw link, only this line needs to change.
export const WITHDRAW_URL = standalone_routes.recent_transactions;

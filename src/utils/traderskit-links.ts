import { standalone_routes } from '@/components/shared/utils/routes/routes';

// Deriv now handles deposits and withdrawals inside the Wallet, so both buttons open it.
// The old /cashier/deposit page on DTrader no longer exists (it returns a 404).
export const DEPOSIT_URL = standalone_routes.recent_transactions;
export const WITHDRAW_URL = standalone_routes.recent_transactions;

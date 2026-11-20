import { standalone_routes } from '@/components/shared/utils/routes/routes';

// Where the header's Deposit and Withdraw buttons send people (Deriv's own cashier).
export const DEPOSIT_URL = standalone_routes.cashier_deposit;
export const WITHDRAW_URL = standalone_routes.cashier;

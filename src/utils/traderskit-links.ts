import { getDerivDomain } from '@/components/shared/utils/routes/routes';

// Deposit opens Deriv's own deposit page. getDerivDomain picks the right Deriv address for the environment.
export const DEPOSIT_URL = `${getDerivDomain('derivHome')}/dashboard/deposit?depositSheet=1`;

// Withdraw opens Deriv's overview page, which has the Withdraw button.
// Once we have the exact withdraw link, only this line needs to change.
export const WITHDRAW_URL = `${getDerivDomain('derivHome')}/dashboard/portfolio`;

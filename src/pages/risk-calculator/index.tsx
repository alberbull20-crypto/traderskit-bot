// @ts-nocheck — reads the account currency from the template's API hook, which has no type definitions
import { useMemo, useState } from 'react';
import { useApiBase } from '@/hooks/useApiBase';
import '../analysis-tool/analysis-tool.scss';
import '../bulk-trader/bulk-trader.scss';
import './risk-calculator.scss';

const MAX_STEPS = 12;

const round2 = value => Math.round(value * 100) / 100;
const money = value => value.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 });

const RiskCalculator = () => {
    const { authData } = useApiBase();
    const currency = authData?.currency || 'USD';

    const [balance, setBalance] = useState('100');
    const [stake, setStake] = useState('1');
    const [payout, setPayout] = useState('95');
    const [risk, setRisk] = useState('2');
    const [multiplier, setMultiplier] = useState('2');
    const [steps, setSteps] = useState('6');

    const result = useMemo(() => {
        const b = Number(balance);
        const s = Number(stake);
        const p = Number(payout) / 100;
        const r = Number(risk);
        const m = Number(multiplier);
        const n = parseInt(steps, 10);

        const valid =
            b > 0 && s > 0 && p > 0 && r > 0 && r <= 100 && m >= 1 && Number.isInteger(n) && n >= 1 && n <= MAX_STEPS;
        if (!valid) return null;

        const ladder = [];
        let cumulative = 0;
        for (let step = 1; step <= n; step += 1) {
            const step_stake = round2(s * m ** (step - 1));
            const before = cumulative;
            cumulative = round2(cumulative + step_stake);
            ladder.push({
                step,
                stake: step_stake,
                total_lost: cumulative,
                pct: (cumulative / b) * 100,
                win_profit: round2(step_stake * p - before),
                affordable: cumulative <= b,
            });
        }

        const first_no_recover = ladder.find(row => row.win_profit <= 0);

        return {
            stake_pct: (s / b) * 100,
            losses_to_ruin: Math.floor(b / s),
            break_even: (1 / (1 + p)) * 100,
            suggested_stake: round2((b * r) / 100),
            affordable_steps: ladder.filter(row => row.affordable).length,
            total_at_risk: cumulative,
            ladder,
            first_no_recover,
            over_balance: cumulative > b,
        };
    }, [balance, stake, payout, risk, multiplier, steps]);

    return (
        <div className='analysis-tool bulk-trader risk-calculator'>
            <div className='analysis-tool__header'>
                <span className='analysis-tool__label'>Planning</span>
                <h2>Risk Calculator</h2>
                <p>See how big your stake is compared with your balance, and what raising the stake after losses would cost.</p>
            </div>

            <div className='risk-calculator__panel'>
                <label className='analysis-tool__field'>
                    <span>Account balance ({currency})</span>
                    <input type='number' min='0' step='0.01' value={balance} onChange={event => setBalance(event.target.value)} />
                </label>

                <label className='analysis-tool__field'>
                    <span>Stake per trade ({currency})</span>
                    <input type='number' min='0' step='0.01' value={stake} onChange={event => setStake(event.target.value)} />
                </label>

                <label className='analysis-tool__field'>
                    <span>Payout: profit on a win (% of stake)</span>
                    <input type='number' min='0' step='0.1' value={payout} onChange={event => setPayout(event.target.value)} />
                </label>

                <label className='analysis-tool__field'>
                    <span>Risk per trade you accept (% of balance)</span>
                    <input type='number' min='0' max='100' step='0.1' value={risk} onChange={event => setRisk(event.target.value)} />
                </label>

                <label className='analysis-tool__field'>
                    <span>Multiplier after a loss (1 = same stake)</span>
                    <input
                        type='number'
                        min='1'
                        step='0.1'
                        value={multiplier}
                        onChange={event => setMultiplier(event.target.value)}
                    />
                </label>

                <label className='analysis-tool__field'>
                    <span>Losses in a row to plan for (1–{MAX_STEPS})</span>
                    <input type='number' min='1' max={MAX_STEPS} step='1' value={steps} onChange={event => setSteps(event.target.value)} />
                </label>
            </div>

            {!result && (
                <p className='risk-calculator__warning'>
                    Enter positive numbers. The multiplier must be at least 1, the risk between 0 and 100, and the number of
                    losses between 1 and {MAX_STEPS}.
                </p>
            )}

            {result && (
                <>
                    <div className='risk-calculator__results'>
                        <div>
                            <span>Stake as a share of balance</span>
                            <strong>{result.stake_pct.toFixed(2)}%</strong>
                        </div>
                        <div>
                            <span>Losses in a row to use the whole balance</span>
                            <strong>{result.losses_to_ruin}</strong>
                        </div>
                        <div>
                            <span>Win rate needed to break even</span>
                            <strong>{result.break_even.toFixed(2)}%</strong>
                        </div>
                        <div>
                            <span>Stake for your risk setting ({currency})</span>
                            <strong>{money(result.suggested_stake)}</strong>
                        </div>
                        <div>
                            <span>Steps your balance can cover</span>
                            <strong>
                                {result.affordable_steps} of {result.ladder.length}
                            </strong>
                        </div>
                        <div>
                            <span>Total at risk over {result.ladder.length} losses ({currency})</span>
                            <strong>{money(result.total_at_risk)}</strong>
                        </div>
                    </div>

                    {result.over_balance && (
                        <p className='risk-calculator__warning'>
                            The losses you chose would need {money(result.total_at_risk)} {currency}, which is more than your
                            balance. Lower the stake, the multiplier or the number of losses.
                        </p>
                    )}

                    {result.first_no_recover && result.ladder.length > 1 && (
                        <p className='risk-calculator__warning'>
                            From step {result.first_no_recover.step}, a win at this payout no longer covers the earlier
                            losses. Raising the stake after a loss only helps while a win pays back more than has been lost.
                        </p>
                    )}

                    <div className='bulk-trader__results'>
                        <div className='bulk-trader__results-head'>
                            <span>Stake ladder after each loss</span>
                        </div>
                        <table>
                            <thead>
                                <tr>
                                    <th>Step</th>
                                    <th>Stake</th>
                                    <th>Total lost if it loses</th>
                                    <th>Share of balance</th>
                                    <th>Profit if it wins</th>
                                    <th>Affordable</th>
                                </tr>
                            </thead>
                            <tbody>
                                {result.ladder.map(row => (
                                    <tr key={row.step}>
                                        <td>{row.step}</td>
                                        <td>{money(row.stake)}</td>
                                        <td>{money(row.total_lost)}</td>
                                        <td>{row.pct.toFixed(1)}%</td>
                                        <td className={row.win_profit > 0 ? 'is-won' : 'is-lost'}>{money(row.win_profit)}</td>
                                        <td className={row.affordable ? 'is-won' : 'is-error'}>{row.affordable ? 'Yes' : 'No'}</td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </>
            )}

            <p className='analysis-tool__note'>
                This is a planning calculator. It does not predict results and it is not financial advice. The payout
                changes with the contract and the market, so check the payout Deriv shows before you trade. Trading
                involves risk and you can lose money.
            </p>
        </div>
    );
};

export default RiskCalculator;

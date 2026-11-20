// @ts-nocheck — uses the template's Quick Strategy list, which has no type definitions
import { useMemo, useState } from 'react';
import { observer } from 'mobx-react-lite';
import { DBOT_TABS } from '@/constants/bot-contents';
import { useStore } from '@/hooks/useStore';
import { STRATEGIES } from '../bot-builder/quick-strategy/config';
import '../analysis-tool/analysis-tool.scss';
import './trading-bots.scss';
import { BOTS, CATEGORIES, TBot, TBotCategory } from './bots';

/** One card for each built-in Quick Strategy, read from the template's own list. */
const getStrategyBots = (): TBot[] => {
    try {
        return Object.entries(STRATEGIES()).map(([key, strategy]) => ({
            id: `qs-${key}`,
            name: String(strategy?.label ?? key),
            description:
                typeof strategy?.description === 'string' && strategy.description
                    ? strategy.description
                    : 'A built-in strategy. Load it to set your market, stake and limits, then test it on a demo account.',
            category: 'strategies' as TBotCategory,
            badge: 'Built-in',
            tags: ['Quick strategy', 'Demo first'],
            file: '',
            strategy: key,
        }));
    } catch (error) {
        console.error('Could not read the built-in strategies:', error);
        return [];
    }
};

const TradingBots = observer(() => {
    const { dashboard, quick_strategy } = useStore();
    const { setActiveTab } = dashboard;
    const { setFormVisibility, setSelectedStrategy } = quick_strategy;

    const [query, setQuery] = useState('');
    const [category, setCategory] = useState<'all' | TBotCategory>('all');
    const [notice, setNotice] = useState('');

    const all_bots = useMemo(() => [...BOTS, ...getStrategyBots()], []);

    const filtered = useMemo(() => {
        const text = query.trim().toLowerCase();
        return all_bots.filter(bot => {
            const in_category = category === 'all' || bot.category === category;
            const haystack = `${bot.name} ${bot.description} ${bot.tags.join(' ')}`.toLowerCase();
            return in_category && haystack.includes(text);
        });
    }, [all_bots, query, category]);

    const countFor = (id: 'all' | TBotCategory) =>
        id === 'all' ? all_bots.length : all_bots.filter(bot => bot.category === id).length;

    const canLoad = (bot: TBot) => Boolean(bot.strategy || bot.file);

    const handleLoad = (bot: TBot) => {
        setNotice('');

        if (bot.strategy) {
            // Open the Quick Strategy form with this strategy already selected.
            setSelectedStrategy(bot.strategy);
            setActiveTab(DBOT_TABS.BOT_BUILDER);
            setFormVisibility(true);
            return;
        }

        // File-based bots need a loader, which is added once real bot files exist.
        setNotice(`"${bot.name}" will open in Bot Builder once the loader is connected.`);
    };

    return (
        <div className='analysis-tool trading-bots'>
            <div className='analysis-tool__header'>
                <span className='analysis-tool__label'>Library</span>
                <h2>Trading Bots</h2>
                <p>Browse ready-made bots, then load one into Bot Builder to review it and test it on a demo account.</p>
            </div>

            <div className='trading-bots__search'>
                <input
                    type='search'
                    placeholder='Search for a bot...'
                    value={query}
                    onChange={event => setQuery(event.target.value)}
                    aria-label='Search for a bot'
                />
            </div>

            <div className='trading-bots__chips' role='tablist' aria-label='Bot categories'>
                <button
                    type='button'
                    role='tab'
                    aria-selected={category === 'all'}
                    className={category === 'all' ? 'is-active' : ''}
                    onClick={() => setCategory('all')}
                >
                    All <span>{countFor('all')}</span>
                </button>
                {CATEGORIES.map(item => (
                    <button
                        type='button'
                        role='tab'
                        aria-selected={category === item.id}
                        key={item.id}
                        className={category === item.id ? 'is-active' : ''}
                        onClick={() => setCategory(item.id)}
                    >
                        {item.name} <span>{countFor(item.id)}</span>
                    </button>
                ))}
            </div>

            {notice && <p className='trading-bots__notice'>{notice}</p>}

            {filtered.length === 0 ? (
                <div className='trading-bots__empty'>
                    <strong>No bots found</strong>
                    <span>Try a different search, or pick another category.</span>
                </div>
            ) : (
                <div className='trading-bots__grid'>
                    {filtered.map(bot => (
                        <article className='trading-bots__card' key={bot.id}>
                            <div className='trading-bots__card-top'>
                                <span className='trading-bots__icon' aria-hidden='true'>
                                    ⚙
                                </span>
                                <h3>{bot.name}</h3>
                                <span className='trading-bots__badge'>{bot.badge}</span>
                            </div>

                            <p className='trading-bots__text'>{bot.description}</p>

                            <div className='trading-bots__tags'>
                                {bot.tags.map(tag => (
                                    <span key={tag}>{tag}</span>
                                ))}
                            </div>

                            <button
                                type='button'
                                className='trading-bots__load'
                                disabled={!canLoad(bot)}
                                onClick={() => handleLoad(bot)}
                            >
                                {canLoad(bot) ? 'Load bot' : 'Coming soon'}
                            </button>
                        </article>
                    ))}
                </div>
            )}

            <p className='analysis-tool__note'>
                Trading involves risk. A bot is a set of rules that places trades for you: it does not guarantee any
                result. Test every bot on a demo account first.
            </p>
        </div>
    );
});

export default TradingBots;

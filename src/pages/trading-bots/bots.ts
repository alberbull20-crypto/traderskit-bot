export type TBotCategory = 'free' | 'scalper' | 'speed' | 'calculator' | 'strategies';

export type TBot = {
    id: string;
    name: string;
    description: string;
    category: TBotCategory;
    badge: string;
    tags: string[];
    /**
     * Path of the bot file once it exists, for example '/bots/my-bot.xml'.
     * Leave it empty while the bot is only a sample.
     */
    file: string;
};

export const CATEGORIES: { id: TBotCategory; name: string }[] = [
    { id: 'free', name: 'Free Bots' },
    { id: 'scalper', name: 'Scalper Bots' },
    { id: 'speed', name: 'Speed Bots' },
    { id: 'calculator', name: 'Calculator' },
    { id: 'strategies', name: 'Strategies' },
];

// Sample entries so the layout can be reviewed. Replace them with real bots as they are built and tested.
export const BOTS: TBot[] = [
    {
        id: 'sample-free-1',
        name: 'Sample bot · Free',
        description:
            'This card shows how a free bot will look in the library. Real bots are added here once they are built and tested on a demo account.',
        category: 'free',
        badge: 'Sample',
        tags: ['Digits', 'Demo first'],
        file: '',
    },
    {
        id: 'sample-free-2',
        name: 'Sample bot · Starter',
        description: 'A second sample card, to show how several bots sit side by side in the grid.',
        category: 'free',
        badge: 'Sample',
        tags: ['Rise/Fall', 'Beginner'],
        file: '',
    },
    {
        id: 'sample-scalper-1',
        name: 'Sample bot · Scalper',
        description: 'Scalper bots place quick, short trades. This is a placeholder until a real one is added.',
        category: 'scalper',
        badge: 'Sample',
        tags: ['1 tick', 'Fast'],
        file: '',
    },
    {
        id: 'sample-speed-1',
        name: 'Sample bot · Speed',
        description: 'Speed bots are built for quick execution. This is a placeholder until a real one is added.',
        category: 'speed',
        badge: 'Sample',
        tags: ['Fast', 'Digits'],
        file: '',
    },
    {
        id: 'sample-calculator-1',
        name: 'Sample tool · Calculator',
        description: 'Calculator tools help plan stakes and limits. This is a placeholder until a real one is added.',
        category: 'calculator',
        badge: 'Sample',
        tags: ['Planning'],
        file: '',
    },
    {
        id: 'sample-strategies-1',
        name: 'Sample strategy',
        description: 'Strategy templates show how a bot can be set up. This is a placeholder until a real one is added.',
        category: 'strategies',
        badge: 'Sample',
        tags: ['Template'],
        file: '',
    },
];

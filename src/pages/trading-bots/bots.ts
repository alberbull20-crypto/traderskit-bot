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
     * Leave it empty for bots that are not file-based.
     */
    file: string;
    /** Key of a built-in Quick Strategy (set automatically by the Trading Bots page). */
    strategy?: string;
};

export const CATEGORIES: { id: TBotCategory; name: string }[] = [
    { id: 'free', name: 'Free Bots' },
    { id: 'scalper', name: 'Scalper Bots' },
    { id: 'speed', name: 'Speed Bots' },
    { id: 'calculator', name: 'Calculator' },
    { id: 'strategies', name: 'Strategies' },
];

// Add real bot files here as they are built and tested on a demo account.
// The built-in Quick Strategies are added by the Trading Bots page itself.
export const BOTS: TBot[] = [];

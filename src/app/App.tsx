
import { lazy, Suspense } from 'react';
import React from 'react';
import {
    createBrowserRouter,
    createRoutesFromElements,
    Route,
    RouterProvider,
    Outlet,
} from 'react-router';
import { cleanupUrl, handleOAuthCallback } from '@/external/deriv-core';
import ChunkLoader from '@/components/loader/chunk-loader';
import LocalStorageSyncWrapper from '@/components/localStorage-sync-wrapper';
import RoutePromptDialog from '@/components/route-prompt-dialog';
import { useAccountSwitching } from '@/hooks/useAccountSwitching';
import { useLanguageFromURL } from '@/hooks/useLanguageFromURL';
import { StoreProvider } from '@/hooks/useStore';
import { isPreviewMode, PREVIEW_BASE_PATH } from '@/utils/is-preview-mode';
import { localize, TranslationProvider } from '@deriv-com/translations';
import CoreStoreProvider from './CoreStoreProvider';
import i18nInstance from './i18n';
import './app-root.scss';

const Layout = lazy(() => import('../components/layout'));
const AppRoot = lazy(() => import('./app-root'));
const LandingPage = lazy(() => import('../pages/landing'));

/**
 * Handles language switching from URL parameters.
 */
const LanguageHandler = ({ children }: { children: React.ReactNode }) => {
    useLanguageFromURL();
    return <>{children}</>;
};

/**
 * Shared providers for all application routes.
 */
const AppProviders = () => (
    <Suspense
        fallback={<ChunkLoader message={localize('Please wait while we connect to the server...')} />}
    >
        <TranslationProvider defaultLang='EN' i18nInstance={i18nInstance}>
            <LanguageHandler>
                <StoreProvider>
                    <LocalStorageSyncWrapper>
                        <RoutePromptDialog />
                        <CoreStoreProvider>
                            <Outlet />
                        </CoreStoreProvider>
                    </LocalStorageSyncWrapper>
                </StoreProvider>
            </LanguageHandler>
        </TranslationProvider>
    </Suspense>
);

// The static preview build is served under /bot/preview.
const routerBasename = isPreviewMode() ? PREVIEW_BASE_PATH : undefined;

const router = createBrowserRouter(
    createRoutesFromElements(
        <Route path='/' element={<AppProviders />}>
            {/* Public landing page */}
            <Route index element={<LandingPage />} />

            {/* Existing Deriv trading workspace */}
            <Route path='bot' element={<Layout />}>
                <Route index element={<AppRoot />} />
            </Route>

            {/* Deriv App Builder preview */}
            <Route path='preview' element={<Layout />}>
                <Route index element={<AppRoot />} />
            </Route>
        </Route>
    ),
    { basename: routerBasename }
);

/**
 * Main application component.
 */
function App() {
    useAccountSwitching();

    React.useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        if (!urlParams.has('code')) return;

        const handleCallback = async () => {
            let authenticationSucceeded = false;

            try {
                const authInfo = await handleOAuthCallback(window.location.href, {
                    clientId: process.env.NEXT_PUBLIC_DERIV_APP_ID || '',
                    redirectUri: window.location.origin,
                    scopes: 'trade',
                });

                const { DerivWSAccountsService } = await import('@/services/derivws-accounts.service');
                const accounts = await DerivWSAccountsService.fetchAccountsList(authInfo.access_token);

                if (accounts && accounts.length > 0) {
                    DerivWSAccountsService.storeAccounts(accounts);

                    const firstAccount = accounts[0];
                    localStorage.setItem('active_loginid', firstAccount.account_id);

                    const isDemo =
                        firstAccount.account_id.startsWith('VRT') ||
                        firstAccount.account_id.startsWith('VRTC');

                    localStorage.setItem('account_type', isDemo ? 'demo' : 'real');

                    const { api_base } = await import('@/external/bot-skeleton');
                    await api_base.init(true);

                    authenticationSucceeded = true;
                } else {
                    console.error('No accounts returned after authentication');
                }
            } catch (error) {
                console.error('OAuth callback error:', error);
            } finally {
                cleanupUrl(window.location.origin);

                if (authenticationSucceeded) {
                    window.location.replace(`${window.location.origin}/bot`);
                }
            }
        };

        handleCallback();
    }, []);

    return <RouterProvider router={router} />;
}

export default App;

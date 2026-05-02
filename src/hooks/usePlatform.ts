import { useIsWebView } from './useIsWebView';

export const usePlatform = (): 'android' | 'web' => {
    const isWebView = useIsWebView();

    if (isWebView && window.P2PBridge?.platform) {
        return window.P2PBridge.platform;
    }

    return 'web';
};

export const useIsWebView = (): boolean => {
    // Verificăm dacă obiectul bridge există injectat de Android
    const hasBridge = !!window.P2PBridge;

    // Opțional: Verificăm și User Agent-ul dacă bridge-ul nu s-a încărcat încă instantaneu
    const isAndroidWebView = /wv/.test(window.navigator.userAgent);

    return hasBridge || isAndroidWebView;
};

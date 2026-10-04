interface TelegramWebApp {
  initData: string;
  ready: () => void;
  expand: () => void;
  disableVerticalSwipes?: () => void;
}

declare global {
  interface Window {
    Telegram?: { WebApp?: TelegramWebApp };
  }
}

// Empty outside Telegram; signed by Telegram when the site is opened as a Mini App.
export const getTelegramInitData = (): string => window.Telegram?.WebApp?.initData || '';

export function initTelegramMiniApp(): boolean {
  const webApp = window.Telegram?.WebApp;
  if (!webApp?.initData) return false;

  webApp.ready();
  webApp.expand();
  // Scrolling down the page must not collapse or close the Mini App.
  webApp.disableVerticalSwipes?.();
  return true;
}

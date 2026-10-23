export interface TelegramUserInfo {
  id?: number;
  firstName?: string;
  username?: string;
  isAvailable: boolean;
}

class TelegramService {
  private webApp: any = null;
  private backButtonHandler: (() => void) | null = null;

  constructor() {
    this.init();
  }

  private init() {
    if (typeof window !== 'undefined' && window.Telegram && window.Telegram.WebApp) {
      this.webApp = window.Telegram.WebApp;
      try {
        this.webApp.ready();
        this.webApp.expand();
        if (this.webApp.setHeaderColor) {
          this.webApp.setHeaderColor('#090d16');
        }
        if (this.webApp.setBackgroundColor) {
          this.webApp.setBackgroundColor('#090d16');
        }
      } catch (e) {
        console.warn('Telegram WebApp setup error:', e);
      }
    }
  }

  public isAvailable(): boolean {
    return Boolean(this.webApp && this.webApp.initData);
  }

  public getUser(): TelegramUserInfo {
    if (!this.webApp?.initDataUnsafe?.user) {
      return {
        isAvailable: false,
        firstName: 'Rider',
        username: 'rider_guest',
      };
    }
    const user = this.webApp.initDataUnsafe.user;
    return {
      id: user.id,
      firstName: user.first_name || 'Rider',
      username: user.username,
      isAvailable: true,
    };
  }

  public setBackButton(visible: boolean, onClick?: () => void) {
    if (!this.webApp?.BackButton) return;

    if (this.backButtonHandler) {
      this.webApp.BackButton.offClick(this.backButtonHandler);
      this.backButtonHandler = null;
    }

    if (visible && onClick) {
      this.backButtonHandler = onClick;
      this.webApp.BackButton.onClick(this.backButtonHandler);
      this.webApp.BackButton.show();
    } else {
      this.webApp.BackButton.hide();
    }
  }

  public hapticImpact(style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft' = 'medium') {
    try {
      if (this.webApp?.HapticFeedback?.impactOccurred) {
        this.webApp.HapticFeedback.impactOccurred(style);
      } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        const duration = style === 'heavy' ? 45 : style === 'medium' ? 25 : 12;
        navigator.vibrate(duration);
      }
    } catch {
      // Haptics not allowed or unsupported
    }
  }

  public hapticNotification(type: 'error' | 'success' | 'warning') {
    try {
      if (this.webApp?.HapticFeedback?.notificationOccurred) {
        this.webApp.HapticFeedback.notificationOccurred(type);
      } else if (typeof navigator !== 'undefined' && 'vibrate' in navigator) {
        if (type === 'error') navigator.vibrate([40, 30, 60]);
        else if (type === 'success') navigator.vibrate([20, 20, 30]);
        else navigator.vibrate(30);
      }
    } catch {
      // Ignore
    }
  }
}

export const telegram = new TelegramService();

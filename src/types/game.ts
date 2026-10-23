export type GameState = 'title' | 'levelselect' | 'garage' | 'playing' | 'paused' | 'gameover' | 'victory';

export type EnvironmentTheme = 'dawn' | 'day' | 'sunset' | 'night' | 'rain' | 'cyber' | 'fog';

export type VehicleArchetype = 'sedan' | 'sportscar' | 'suv' | 'van' | 'truck' | 'tanker' | 'police' | 'bus';

export type HazardType = 'oil_slick' | 'cones' | 'barrier';

export interface LevelConfig {
  id: number;
  title: string;
  subtitle: string;
  targetDistance: number; // in meters (e.g. 1000m to 5500m)
  lanes: number; // 3, 4, or 5 lanes
  theme: EnvironmentTheme;
  trafficDensity: number; // base vehicles per km/time
  minSpeed: number; // traffic min speed
  maxSpeed: number; // traffic max speed
  allowedVehicles: VehicleArchetype[];
  hazardFrequency: number; // 0 to 1
  star2Score: number;
  star3Score: number;
  rewardCoins: number;
  description: string;
}

export interface BikeModel {
  id: string;
  name: string;
  type: string;
  color: string;
  accentColor: string;
  maxSpeedKmh: number;
  acceleration: number;
  handling: number;
  nitroCapacity: number;
  unlocked: boolean;
  price: number;
  description: string;
}

export interface PlayerStats {
  score: number;
  distance: number;
  speedKmh: number;
  nearMisses: number;
  coinsEarned: number;
  timeElapsedSeconds: number;
  nitroPercent: number;
}

export interface LevelRecord {
  levelId: number;
  unlocked: boolean;
  completed: boolean;
  highScore: number;
  stars: number; // 0 to 3
  bestDistance: number;
  bestNearMisses: number;
}

export interface UserProgress {
  selectedLevelId: number;
  selectedBikeId: string;
  totalCoins: number;
  totalDistanceMeters: number;
  totalNearMisses: number;
  unlockedBikes: string[];
  levels: Record<number, LevelRecord>;
  audioMuted: boolean;
  hapticsEnabled: boolean;
}

// Adsgram Types
export type AdsgramStatus = 'idle' | 'loading' | 'showing' | 'rewarded' | 'failed' | 'unsupported';

export interface AdsgramShowResult {
  done: boolean;
  description?: string;
  state?: string;
  error?: boolean;
}

export interface AdsgramInitParams {
  blockId: string;
  debug?: boolean;
  debugBannerType?: 'FullscreenMedia' | 'Rewarded';
}

export interface AdsgramAdController {
  show: () => Promise<AdsgramShowResult>;
  destroy?: () => void;
}

declare global {
  interface Window {
    Adsgram?: {
      init: (params: AdsgramInitParams) => AdsgramAdController;
    };
    Telegram?: {
      WebApp?: {
        ready: () => void;
        expand: () => void;
        close: () => void;
        isExpanded: boolean;
        viewportHeight: number;
        viewportStableHeight: number;
        headerColor: string;
        backgroundColor: string;
        setHeaderColor: (color: string) => void;
        setBackgroundColor: (color: string) => void;
        BackButton: {
          isVisible: boolean;
          show: () => void;
          hide: () => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
        };
        MainButton: {
          text: string;
          color: string;
          textColor: string;
          isVisible: boolean;
          isActive: boolean;
          isProgressVisible: boolean;
          setText: (text: string) => void;
          onClick: (callback: () => void) => void;
          offClick: (callback: () => void) => void;
          show: () => void;
          hide: () => void;
          enable: () => void;
          disable: () => void;
        };
        HapticFeedback: {
          impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void;
          notificationOccurred: (type: 'error' | 'success' | 'warning') => void;
          selectionChanged: () => void;
        };
        initData: string;
        initDataUnsafe?: {
          user?: {
            id: number;
            first_name: string;
            last_name?: string;
            username?: string;
            language_code?: string;
          };
        };
      };
    };
  }
}

import { UserProgress, LevelRecord } from '../types/game';
import { ALL_LEVELS } from '../game/levels';

const STORAGE_KEY = 'moto_rush_20_progress_v1';

function getDefaultLevels(): Record<number, LevelRecord> {
  const records: Record<number, LevelRecord> = {};
  ALL_LEVELS.forEach((level) => {
    records[level.id] = {
      levelId: level.id,
      unlocked: level.id === 1, // Only level 1 is initially unlocked
      completed: false,
      highScore: 0,
      stars: 0,
      bestDistance: 0,
      bestNearMisses: 0,
    };
  });
  return records;
}

const DEFAULT_PROGRESS: UserProgress = {
  selectedLevelId: 1,
  selectedBikeId: 'street_blade',
  totalCoins: 0,
  totalDistanceMeters: 0,
  totalNearMisses: 0,
  unlockedBikes: ['street_blade'],
  levels: getDefaultLevels(),
  audioMuted: false,
  hapticsEnabled: true,
};

export function loadUserProgress(): UserProgress {
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (!raw) {
      return DEFAULT_PROGRESS;
    }
    const parsed = JSON.parse(raw) as Partial<UserProgress>;
    // Merge with defaults to ensure any new levels or properties exist
    const mergedLevels = getDefaultLevels();
    if (parsed.levels) {
      Object.keys(parsed.levels).forEach((idStr) => {
        const id = parseInt(idStr, 10);
        if (mergedLevels[id] && parsed.levels![id]) {
          mergedLevels[id] = {
            ...mergedLevels[id],
            ...parsed.levels![id],
          };
        }
      });
    }

    return {
      selectedLevelId: parsed.selectedLevelId || 1,
      selectedBikeId: parsed.selectedBikeId || 'street_blade',
      totalCoins: parsed.totalCoins ?? 0,
      totalDistanceMeters: parsed.totalDistanceMeters ?? 0,
      totalNearMisses: parsed.totalNearMisses ?? 0,
      unlockedBikes: parsed.unlockedBikes && parsed.unlockedBikes.length > 0 ? parsed.unlockedBikes : ['street_blade'],
      levels: mergedLevels,
      audioMuted: parsed.audioMuted ?? false,
      hapticsEnabled: parsed.hapticsEnabled ?? true,
    };
  } catch (e) {
    console.warn('Failed to load user progress from localStorage', e);
    return DEFAULT_PROGRESS;
  }
}

export function saveUserProgress(progress: UserProgress): void {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(progress));
  } catch (e) {
    console.warn('Failed to save user progress to localStorage', e);
  }
}

export function recordLevelCompletion(
  current: UserProgress,
  levelId: number,
  score: number,
  distance: number,
  stars: number,
  nearMisses: number,
  coinsEarned: number
): UserProgress {
  const existingRecord = current.levels[levelId] || {
    levelId,
    unlocked: true,
    completed: false,
    highScore: 0,
    stars: 0,
    bestDistance: 0,
    bestNearMisses: 0,
  };

  const updatedRecord: LevelRecord = {
    levelId,
    unlocked: true,
    completed: true,
    highScore: Math.max(existingRecord.highScore, score),
    stars: Math.max(existingRecord.stars, stars),
    bestDistance: Math.max(existingRecord.bestDistance, distance),
    bestNearMisses: Math.max(existingRecord.bestNearMisses, nearMisses),
  };

  const updatedLevels = { ...current.levels, [levelId]: updatedRecord };

  // Unlock next level if levelId < 20
  const nextLevelId = levelId + 1;
  if (nextLevelId <= 20 && updatedLevels[nextLevelId]) {
    updatedLevels[nextLevelId] = {
      ...updatedLevels[nextLevelId],
      unlocked: true,
    };
  }

  const updatedProgress: UserProgress = {
    ...current,
    totalCoins: current.totalCoins + coinsEarned,
    totalDistanceMeters: current.totalDistanceMeters + distance,
    totalNearMisses: current.totalNearMisses + nearMisses,
    levels: updatedLevels,
  };

  saveUserProgress(updatedProgress);
  return updatedProgress;
}

export function unlockBike(current: UserProgress, bikeId: string, cost: number): UserProgress {
  if (current.totalCoins < cost) return current;
  if (current.unlockedBikes.includes(bikeId)) return current;

  const updated: UserProgress = {
    ...current,
    totalCoins: current.totalCoins - cost,
    unlockedBikes: [...current.unlockedBikes, bikeId],
    selectedBikeId: bikeId,
  };
  saveUserProgress(updated);
  return updated;
}

export function resetAllProgress(): UserProgress {
  try {
    localStorage.removeItem(STORAGE_KEY);
  } catch (e) {
    console.warn(e);
  }
  return DEFAULT_PROGRESS;
}

import { LevelConfig } from '../types/game';

export interface BoundingBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Calculates raw points accumulated from distance traveled.
 * Higher speed grants slightly more points per meter.
 */
export function calculateDistancePoints(distanceMeters: number, averageSpeedKmh: number): number {
  if (distanceMeters <= 0) return 0;
  const speedBonusMultiplier = Math.max(1, averageSpeedKmh / 100);
  return Math.round(distanceMeters * 2 * speedBonusMultiplier);
}

/**
 * Calculates bonus points awarded for a high-speed close pass ("Near Miss").
 * Rewarding risk: higher player speed and active combo yields exponential praise.
 */
export function calculateNearMissBonus(currentSpeedKmh: number, streakCombo: number): number {
  const base = 150;
  const speedScale = Math.max(1, currentSpeedKmh / 80);
  const comboMultiplier = Math.min(5, 1 + streakCombo * 0.25);
  return Math.round(base * speedScale * comboMultiplier);
}

/**
 * Calculates star rating (1 to 3 stars) upon level completion.
 * 1 Star: Reached the target distance.
 * 2 Stars: Met the star2Score threshold.
 * 3 Stars: Met the star3Score threshold OR completed with 0 crashes and at least 3 near misses.
 */
export function calculateStars(
  score: number,
  targetDistance: number,
  distanceReached: number,
  star2Score: number,
  star3Score: number,
  crashCount: number = 0,
  nearMissCount: number = 0
): number {
  if (distanceReached < targetDistance) {
    return 0; // Not finished yet
  }
  let stars = 1;
  if (score >= star2Score) {
    stars = 2;
  }
  if (score >= star3Score || (crashCount === 0 && nearMissCount >= 4 && score >= star2Score * 0.9)) {
    stars = 3;
  }
  return stars;
}

/**
 * Verifies whether a given level is unlocked based on completed levels.
 * Level 1 is always unlocked. Level N is unlocked if Level N-1 is completed.
 */
export function canUnlockLevel(completedLevelIds: number[], targetLevelId: number): boolean {
  if (targetLevelId === 1) return true;
  if (targetLevelId < 1 || targetLevelId > 20) return false;
  return completedLevelIds.includes(targetLevelId - 1);
}

/**
 * AABB collision detection between two 2D bounding boxes with optional padding.
 */
export function checkCollision(
  boxA: BoundingBox,
  boxB: BoundingBox,
  paddingX: number = 4,
  paddingY: number = 6
): boolean {
  const aLeft = boxA.x - boxA.width / 2 + paddingX;
  const aRight = boxA.x + boxA.width / 2 - paddingX;
  const aTop = boxA.y - boxA.height / 2 + paddingY;
  const aBottom = boxA.y + boxA.height / 2 - paddingY;

  const bLeft = boxB.x - boxB.width / 2 + paddingX;
  const bRight = boxB.x + boxB.width / 2 - paddingX;
  const bTop = boxB.y - boxB.height / 2 + paddingY;
  const bBottom = boxB.y + boxB.height / 2 - paddingY;

  return !(aRight < bLeft || aLeft > bRight || aBottom < bTop || aTop > bBottom);
}

/**
 * Checks if the bike just executed a Near Miss (passed alongside a vehicle with a tight gap without colliding).
 */
export function checkNearMiss(
  bike: BoundingBox,
  traffic: BoundingBox,
  nearMissProximityX: number = 28,
  nearMissProximityY: number = 20
): boolean {
  // Overlapping in Y (alongside) but closely adjacent in X (lane border proximity)
  const dy = Math.abs(bike.y - traffic.y);
  const dx = Math.abs(bike.x - traffic.x);

  const combinedHalfWidth = (bike.width + traffic.width) / 2;
  const combinedHalfHeight = (bike.height + traffic.height) / 2;

  const isAlongsideY = dy < combinedHalfHeight + nearMissProximityY;
  const isCloseGapX = dx > combinedHalfWidth - 4 && dx < combinedHalfWidth + nearMissProximityX;

  return isAlongsideY && isCloseGapX;
}

/**
 * Validates whether the player is eligible to request an Adsgram Rewarded Ad Continue.
 * Rules:
 * 1. Must NOT have already used a continue in this specific level run attempt (1 continue max per attempt).
 * 2. Adsgram status must not be currently in-flight ('loading' or 'showing').
 */
export function canRequestAdContinue(continueUsedInAttempt: boolean, adsgramStatus: string): boolean {
  if (continueUsedInAttempt) {
    return false;
  }
  if (adsgramStatus === 'loading' || adsgramStatus === 'showing') {
    return false;
  }
  return true;
}

/**
 * Formats distance in meters into human-readable representation.
 */
export function formatDistance(meters: number): string {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(2)} km`;
  }
  return `${Math.round(meters)} m`;
}

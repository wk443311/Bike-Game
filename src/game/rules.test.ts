import test from 'node:test';
import assert from 'node:assert/strict';
import {
  calculateDistancePoints,
  calculateNearMissBonus,
  calculateStars,
  canUnlockLevel,
  checkCollision,
  checkNearMiss,
  canRequestAdContinue,
  formatDistance,
} from './rules';

test('calculateDistancePoints scales with distance and speed', () => {
  assert.equal(calculateDistancePoints(0, 100), 0);
  assert.equal(calculateDistancePoints(100, 100), 200);
  // Higher speed gives bonus
  const highSpeedPoints = calculateDistancePoints(100, 150);
  assert.ok(highSpeedPoints > 200);
});

test('calculateNearMissBonus awards more for combos and speed', () => {
  const baseBonus = calculateNearMissBonus(80, 0);
  assert.equal(baseBonus, 150);

  const comboBonus = calculateNearMissBonus(80, 2);
  assert.ok(comboBonus > baseBonus);

  const speedBonus = calculateNearMissBonus(160, 0);
  assert.ok(speedBonus > baseBonus);
});

test('calculateStars awards correct stars for performance and targets', () => {
  // Not reached target distance
  assert.equal(calculateStars(5000, 1000, 800, 2000, 4000), 0);

  // Target reached, baseline score
  assert.equal(calculateStars(1500, 1000, 1000, 2000, 4000), 1);

  // Met star 2 score
  assert.equal(calculateStars(2500, 1000, 1000, 2000, 4000), 2);

  // Met star 3 score
  assert.equal(calculateStars(4500, 1000, 1000, 2000, 4000), 3);

  // Flawless run with 0 crashes and near misses
  assert.equal(calculateStars(1900, 1000, 1000, 2000, 4000, 0, 5), 3);
});

test('canUnlockLevel enforces sequential progression', () => {
  // Level 1 is always unlocked
  assert.equal(canUnlockLevel([], 1), true);

  // Level 2 requires level 1 completed
  assert.equal(canUnlockLevel([], 2), false);
  assert.equal(canUnlockLevel([1], 2), true);

  // Level 20 requires level 19 completed
  assert.equal(canUnlockLevel([1, 2, 3], 20), false);
  assert.equal(canUnlockLevel(Array.from({ length: 19 }, (_, i) => i + 1), 20), true);

  // Invalid level IDs
  assert.equal(canUnlockLevel([], 0), false);
  assert.equal(canUnlockLevel([], 21), false);
});

test('checkCollision correctly identifies box intersections', () => {
  const bike = { x: 100, y: 100, width: 24, height: 48 };

  // Directly on top of each other
  const obstacleDirect = { x: 100, y: 100, width: 30, height: 60 };
  assert.equal(checkCollision(bike, obstacleDirect), true);

  // Far apart
  const obstacleFar = { x: 300, y: 100, width: 30, height: 60 };
  assert.equal(checkCollision(bike, obstacleFar), false);

  // Marginally separated
  const obstacleAdjacent = { x: 100 + 24 + 10, y: 100, width: 24, height: 48 };
  assert.equal(checkCollision(bike, obstacleAdjacent), false);
});

test('checkNearMiss detects close lane passes without collision', () => {
  const bike = { x: 100, y: 100, width: 24, height: 48 };

  // Right next to bike horizontally, alongside in Y
  const trafficNear = { x: 130, y: 105, width: 30, height: 60 };
  assert.equal(checkNearMiss(bike, trafficNear), true);

  // Far away horizontally
  const trafficFar = { x: 250, y: 105, width: 30, height: 60 };
  assert.equal(checkNearMiss(bike, trafficFar), false);
});

test('canRequestAdContinue adheres strictly to the single-continue policy', () => {
  // Fresh attempt, idle adsgram -> Allowed
  assert.equal(canRequestAdContinue(false, 'idle'), true);

  // Already used continue in this attempt -> Forbidden
  assert.equal(canRequestAdContinue(true, 'idle'), false);

  // Already loading or showing -> Forbidden
  assert.equal(canRequestAdContinue(false, 'loading'), false);
  assert.equal(canRequestAdContinue(false, 'showing'), false);
});

test('formatDistance formats meters and kilometers properly', () => {
  assert.equal(formatDistance(450), '450 m');
  assert.equal(formatDistance(1250), '1.25 km');
  assert.equal(formatDistance(5500), '5.50 km');
});

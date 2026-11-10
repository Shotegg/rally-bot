import { calculateMarchTime } from './marchTime.js';
import { TARGET_COORDINATES } from './targets.js';

export const BASE_SPEED_BUFF = 1.25;

export function creatorSpeedBuff(creator, now = Date.now()) {
  const petBonus = Number(creator.pet_bonus_percent) || 0;
  return BASE_SPEED_BUFF + (Number(creator.pets_until) > now ? petBonus / 100 : 0);
}

export function creatorTravelTime(creator, target, now = Date.now()) {
  const destination = TARGET_COORDINATES[target];
  if (!destination) return null;
  return calculateMarchTime({
    fromX: creator.coord_x,
    fromY: creator.coord_y,
    toX: destination.x,
    toY: destination.y,
    speedBuff: creatorSpeedBuff(creator, now)
  });
}

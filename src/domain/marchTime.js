export const SATURATION_DISTANCE = 1300;
export const TRAVEL_TIME_SCALE = 60;
export const EXTRA_TIME = 5;

export function calculateMarchTime({ fromX, fromY, toX, toY, speedBuff }) {
  const values = [fromX, fromY, toX, toY, speedBuff].map(Number);
  if (!values.every(Number.isFinite) || values[4] <= 0) return null;

  const [x1, y1, x2, y2, buff] = values;
  const distance = Math.hypot(x1 - x2, y1 - y2);
  const speedEff = 11 * buff;

  return Math.ceil(
    EXTRA_TIME +
      (distance * SATURATION_DISTANCE / (SATURATION_DISTANCE + distance)) *
        TRAVEL_TIME_SCALE / speedEff
  );
}

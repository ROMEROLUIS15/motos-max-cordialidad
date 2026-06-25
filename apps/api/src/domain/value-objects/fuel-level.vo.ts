export enum FuelLevel {
  EMPTY = 'EMPTY',
  QUARTER = 'QUARTER',
  HALF = 'HALF',
  THREE_QUARTERS = 'THREE_QUARTERS',
  FULL = 'FULL',
}

export function isFuelLevel(value: string): value is FuelLevel {
  return Object.values(FuelLevel).includes(value as FuelLevel);
}

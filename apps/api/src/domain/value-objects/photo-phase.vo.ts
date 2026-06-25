export enum PhotoPhase {
  INGRESO = 'INGRESO',
  PROCESO = 'PROCESO',
  ENTREGA = 'ENTREGA',
}

export function isPhotoPhase(value: string): value is PhotoPhase {
  return Object.values(PhotoPhase).includes(value as PhotoPhase);
}

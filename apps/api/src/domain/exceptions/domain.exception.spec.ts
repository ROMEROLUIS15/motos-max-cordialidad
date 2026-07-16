import { InsufficientStockException, VehicleHasActiveOrderException } from './domain.exception';

const UUID = 'f6dbdd83-35df-409f-bc0f-8fa0c98d73f8';
const UUID_RE = /[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/i;

describe('domain exception messages', () => {
  describe('InsufficientStockException', () => {
    it('never leaks the part id into the user-facing message', () => {
      const e = new InsufficientStockException(UUID, 999, 11);
      expect(e.message).not.toMatch(UUID_RE);
      expect(e.message).toBe('Stock insuficiente para el repuesto: solicitado 999, disponible 11');
    });

    it('keeps the part id and quantities readable for logs', () => {
      const e = new InsufficientStockException(UUID, 999, 11);
      expect(e.partId).toBe(UUID);
      expect(e.requested).toBe(999);
      expect(e.available).toBe(11);
      expect(e.code).toBe('INSUFFICIENT_STOCK');
    });
  });

  describe('VehicleHasActiveOrderException', () => {
    it('names the plate when known and never an id', () => {
      const e = new VehicleHasActiveOrderException('VRF45G');
      expect(e.message).toContain('VRF45G');
      expect(e.message).not.toMatch(UUID_RE);
    });

    it('stays generic when the plate is unknown', () => {
      expect(new VehicleHasActiveOrderException(null).message).toContain('Esta moto');
    });
  });
});

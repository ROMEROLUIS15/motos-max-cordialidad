import { describe, it, expect, vi, beforeEach } from 'vitest';
import { renderHook, waitFor } from '@testing-library/react';

vi.mock('@/lib/api', () => ({ apiGet: vi.fn() }));
import { apiGet } from '@/lib/api';
import { useTeam } from '@/hooks/use-team';

const mockApi = apiGet as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockApi.mockImplementation((path: string) => {
    if (path === '/api/users')
      return Promise.resolve([
        { id: 't1', fullName: 'Tomás Técnico', roleId: 'r-tech', isActive: true },
        { id: 'o1', fullName: 'Olivia Owner', roleId: 'r-owner', isActive: true },
        { id: 't2', fullName: 'Inactivo', roleId: 'r-tech', isActive: false },
      ]);
    if (path === '/api/roles')
      return Promise.resolve([
        { id: 'r-tech', name: 'TECHNICIAN' },
        { id: 'r-owner', name: 'OWNER' },
      ]);
    return Promise.resolve([]);
  });
});

describe('useTeam', () => {
  it('filtra solo los técnicos activos y resuelve nombres por id', async () => {
    const { result } = renderHook(() => useTeam());
    await waitFor(() => expect(result.current.technicians.length).toBe(1));
    expect(result.current.technicians[0].fullName).toBe('Tomás Técnico');
    expect(result.current.nameOf('t1')).toBe('Tomás Técnico');
    expect(result.current.nameOf('o1')).toBe('Olivia Owner');
  });
});

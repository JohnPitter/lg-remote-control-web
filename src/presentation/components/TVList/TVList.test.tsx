import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { TVList } from './TVList';
import { TVConnectionStatus } from '@/core/entities/TV';

describe('TVList', () => {
  const mockTVs = [
    {
      id: 'tv-1',
      name: 'LG TV Living Room',
      ipAddress: '192.168.1.100',
      port: 3000,
      status: TVConnectionStatus.DISCONNECTED,
    },
    {
      id: 'tv-2',
      name: 'LG TV Bedroom',
      ipAddress: '192.168.1.101',
      port: 3000,
      status: TVConnectionStatus.DISCONNECTED,
    },
  ];

  it('should render loading state', () => {
    render(<TVList tvs={[]} onSelectTV={vi.fn()} isLoading={true} />);
    expect(screen.getByText('Procurando TVs na rede...')).toBeInTheDocument();
  });

  it('should render empty state when no TVs found', () => {
    render(<TVList tvs={[]} onSelectTV={vi.fn()} />);
    expect(screen.getByText('Nenhuma TV encontrada')).toBeInTheDocument();
  });

  it('should render list of TVs', () => {
    render(<TVList tvs={mockTVs} onSelectTV={vi.fn()} />);

    expect(screen.getByText('TVs Encontradas (2)')).toBeInTheDocument();
    expect(screen.getByText('LG TV Living Room')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.100')).toBeInTheDocument();
    expect(screen.getByText('LG TV Bedroom')).toBeInTheDocument();
    expect(screen.getByText('192.168.1.101')).toBeInTheDocument();
  });

  it('should call onSelectTV when TV is clicked', () => {
    const onSelectTV = vi.fn();
    render(<TVList tvs={mockTVs} onSelectTV={onSelectTV} />);

    const tvButton = screen.getByText('LG TV Living Room').closest('button');
    fireEvent.click(tvButton!);

    expect(onSelectTV).toHaveBeenCalledWith(mockTVs[0]);
  });
});

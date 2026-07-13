import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ZoneCard from '../ZoneCard';

describe('ZoneCard', () => {
  it('renders correctly for normal occupancy', () => {
    const zone = { zone: 'Gate 1', occupancy: 50 };
    render(<ZoneCard zone={zone} onAlertClick={() => {}} />);
    expect(screen.getByText('Gate 1')).toBeInTheDocument();
    expect(screen.getByText('50%')).toBeInTheDocument();
    expect(screen.queryByText(/View AI Action/i)).not.toBeInTheDocument();
  });

  it('renders alert state and triggers click', async () => {
    const zone = { zone: 'Gate 2', occupancy: 85 };
    const handleClick = jest.fn();
    render(<ZoneCard zone={zone} onAlertClick={handleClick} />);
    
    expect(screen.getByText('Gate 2')).toBeInTheDocument();
    expect(screen.getByText('85%')).toBeInTheDocument();
    expect(screen.getByText(/View AI Action/i)).toBeInTheDocument();
    
    const button = screen.getByRole('button');
    await userEvent.click(button);
    expect(handleClick).toHaveBeenCalledWith(zone);
  });
});

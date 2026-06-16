import type { Stand, StandPosition, Terminal } from '@/types/apron';
import { generateId } from './helpers';

interface TerminalLayout {
  terminal: Terminal;
  building: StandPosition;
  stands: Omit<Stand, 'id' | 'status' | 'currentFlight'>[];
}

const STAND_WIDTH = 55;
const STAND_HEIGHT = 95;
const CONTACT_GAP = 8;
const REMOTE_GAP_X = 30;
const REMOTE_GAP_Y = 15;

const generateContactStands = (
  terminal: Terminal,
  startX: number,
  startY: number,
  count: number,
  prefix: string,
  direction: 'left' | 'right' = 'right'
): Omit<Stand, 'id' | 'status' | 'currentFlight'>[] => {
  const stands: Omit<Stand, 'id' | 'status' | 'currentFlight'>[] = [];
  for (let i = 0; i < count; i++) {
    const x = direction === 'right' 
      ? startX + i * (STAND_WIDTH + CONTACT_GAP)
      : startX - i * (STAND_WIDTH + CONTACT_GAP);
    stands.push({
      number: `${prefix}${String(i + 1).padStart(2, '0')}`,
      terminal,
      type: 'contact',
      position: {
        x,
        y: startY,
        width: STAND_WIDTH,
        height: STAND_HEIGHT,
      },
    });
  }
  return stands;
};

const generateRemoteStands = (
  terminal: Terminal,
  startX: number,
  startY: number,
  rows: number,
  cols: number,
  prefix: string
): Omit<Stand, 'id' | 'status' | 'currentFlight'>[] => {
  const stands: Omit<Stand, 'id' | 'status' | 'currentFlight'>[] = [];
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const index = row * cols + col;
      stands.push({
        number: `${prefix}${String(index + 1).padStart(2, '0')}`,
        terminal,
        type: 'remote',
        position: {
          x: startX + col * (STAND_WIDTH + REMOTE_GAP_X),
          y: startY + row * (STAND_HEIGHT + REMOTE_GAP_Y),
          width: STAND_WIDTH,
          height: STAND_HEIGHT,
        },
      });
    }
  }
  return stands;
};

const terminalLayouts: TerminalLayout[] = [
  {
    terminal: 'T1',
    building: { x: 80, y: 120, width: 560, height: 120 },
    stands: [
      ...generateContactStands('T1', 100, 20, 15, '11', 'right'),
      ...generateContactStands('T1', 620, 20, 15, '12', 'left'),
      ...generateContactStands('T1', 100, 260, 15, '13', 'right'),
    ],
  },
  {
    terminal: 'T2',
    building: { x: 680, y: 120, width: 560, height: 120 },
    stands: [
      ...generateContactStands('T2', 700, 20, 15, '21', 'right'),
      ...generateContactStands('T2', 1220, 20, 14, '22', 'left'),
      ...generateContactStands('T2', 700, 260, 15, '23', 'right'),
    ],
  },
  {
    terminal: 'T3',
    building: { x: 1280, y: 400, width: 560, height: 120 },
    stands: [
      ...generateRemoteStands('T3', 1300, 550, 3, 8, '31'),
      ...generateRemoteStands('T3', 1300, 900, 3, 6, '32'),
    ],
  },
];

export const TERMINAL_BUILDINGS = terminalLayouts.map(tl => ({
  terminal: tl.terminal,
  position: tl.building,
}));

export const generateStands = (): Stand[] => {
  const stands: Stand[] = [];
  terminalLayouts.forEach(tl => {
    tl.stands.forEach(s => {
      stands.push({
        id: generateId(),
        ...s,
        status: 'available',
      });
    });
  });
  return stands;
};

export const getStandsByTerminal = (stands: Stand[], terminal: Terminal): Stand[] => {
  return stands.filter(s => s.terminal === terminal);
};

export const getStandById = (stands: Stand[], id: string): Stand | undefined => {
  return stands.find(s => s.id === id);
};

export const getStandByNumber = (stands: Stand[], number: string): Stand | undefined => {
  return stands.find(s => s.number === number);
};

export const getVehiclePoolArea = (): StandPosition => {
  return { x: 20, y: 600, width: 120, height: 400 };
};

export const getFuelDepotArea = (): StandPosition => {
  return { x: 20, y: 420, width: 120, height: 80 };
};

export const getServiceArea = (): StandPosition => {
  return { x: 1780, y: 20, width: 120, height: 200 };
};

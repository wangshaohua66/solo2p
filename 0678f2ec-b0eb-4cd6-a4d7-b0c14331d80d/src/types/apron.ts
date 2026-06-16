export type StandStatus = 'available' | 'occupied' | 'in-service' | 'maintenance';

export type StandType = 'contact' | 'remote';

export type Terminal = 'T1' | 'T2' | 'T3';

export type VehicleType = 'tug' | 'fuel' | 'water' | 'waste' | 'stairs';

export type ServiceType = 'towing' | 'fueling' | 'cleaning' | 'catering' | 'boarding';

export type AlertLevel = 'red' | 'orange' | 'blue';

export type UserRole = 'dispatcher' | 'ground-crew' | 'supervisor';

export interface Position {
  x: number;
  y: number;
}

export interface StandPosition extends Position {
  width: number;
  height: number;
}

export interface Stand {
  id: string;
  number: string;
  terminal: Terminal;
  type: StandType;
  status: StandStatus;
  position: StandPosition;
  currentFlight?: string;
  weatherAlert?: boolean;
}

export interface ServiceTask {
  id: string;
  type: ServiceType;
  startTime: number;
  endTime: number;
  duration: number;
  progress: number;
  status: 'pending' | 'in-progress' | 'completed' | 'delayed';
  vehicleId?: string;
  crew?: string;
}

export interface Flight {
  id: string;
  flightNo: string;
  airline: string;
  aircraftType: string;
  standId: string;
  arrivalTime: number;
  departureTime: number;
  passengerCount: number;
  services: ServiceTask[];
  status: 'scheduled' | 'arrived' | 'boarding' | 'departed';
  isDelayed?: boolean;
}

export interface Vehicle {
  id: string;
  type: VehicleType;
  plateNo: string;
  position: Position;
  targetPosition?: Position;
  prevPosition?: Position;
  heading: number;
  status: 'idle' | 'moving' | 'working';
  currentTask?: string;
  speed: number;
  trail: Position[];
}

export interface Alert {
  id: string;
  level: AlertLevel;
  type: string;
  message: string;
  standId?: string;
  flightId?: string;
  timestamp: number;
  acknowledged: boolean;
}

export interface Weather {
  windDirection: number;
  windSpeed: number;
  visibility: number;
  temperature: number;
  timestamp: number;
}

export interface LayoutConfig {
  role: UserRole;
  leftPanelCollapsed: boolean;
  rightPanelCollapsed: boolean;
  ganttCollapsed: boolean;
  weatherOverlayVisible: boolean;
  zoom: number;
  pan: Position;
  filters: {
    terminals: Terminal[];
    statuses: StandStatus[];
    airlines: string[];
  };
}

export interface ApronState {
  stands: Stand[];
  flights: Flight[];
  vehicles: Vehicle[];
  alerts: Alert[];
  weather: Weather | null;
  currentTime: number;
  selectedStandId: string | null;
  selectedFlightId: string | null;
  currentRole: UserRole;
  layoutConfig: LayoutConfig;
}

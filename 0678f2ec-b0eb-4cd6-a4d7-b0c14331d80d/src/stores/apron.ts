import { defineStore } from 'pinia';
import type {
  Stand,
  Flight,
  Vehicle,
  Alert,
  Weather,
  LayoutConfig,
  UserRole,
  Terminal,
  StandStatus,
  ServiceTask,
  Position,
} from '@/types/apron';
import { generateStands } from '@/utils/standLayout';
import { generateId, clamp } from '@/utils/helpers';
import {
  MAX_ALERTS,
  MIN_TURNAROUND_INTERVAL,
  WIND_CROSSWIND_THRESHOLD,
  VISIBILITY_THRESHOLD,
  ZOOM_RANGE,
  TERMINALS,
  STAND_STATUSES,
} from '@/utils/constants';

const defaultLayout: LayoutConfig = {
  role: 'dispatcher',
  leftPanelCollapsed: false,
  rightPanelCollapsed: false,
  ganttCollapsed: false,
  weatherOverlayVisible: false,
  zoom: ZOOM_RANGE.default,
  pan: { x: 0, y: 0 },
  filters: {
    terminals: [...TERMINALS],
    statuses: [...STAND_STATUSES],
    airlines: [],
  },
};

const rolePresets: Record<UserRole, Partial<LayoutConfig>> = {
  dispatcher: {
    leftPanelCollapsed: false,
    rightPanelCollapsed: true,
    ganttCollapsed: true,
  },
  'ground-crew': {
    leftPanelCollapsed: true,
    rightPanelCollapsed: false,
    ganttCollapsed: false,
  },
  supervisor: {
    leftPanelCollapsed: true,
    rightPanelCollapsed: false,
    ganttCollapsed: true,
  },
};

export const useApronStore = defineStore('apron', {
  state: () => ({
    stands: [] as Stand[],
    flights: [] as Flight[],
    vehicles: [] as Vehicle[],
    alerts: [] as Alert[],
    weather: null as Weather | null,
    currentTime: Date.now(),
    selectedStandId: null as string | null,
    selectedFlightId: null as string | null,
    currentRole: 'dispatcher' as UserRole,
    layoutConfig: { ...defaultLayout } as LayoutConfig,
  }),

  getters: {
    standsByTerminal: (state) => (terminal: Terminal) =>
      state.stands.filter((s) => s.terminal === terminal),

    filteredStands: (state) => {
      const { terminals, statuses, airlines } = state.layoutConfig.filters;
      return state.stands.filter((s) => {
        const terminalMatch = terminals.includes(s.terminal);
        const statusMatch = statuses.includes(s.status);
        let airlineMatch = true;
        if (airlines.length > 0 && s.currentFlight) {
          const flight = state.flights.find((f) => f.id === s.currentFlight);
          airlineMatch = flight ? airlines.includes(flight.airline) : false;
        }
        return terminalMatch && statusMatch && airlineMatch;
      });
    },

    activeFlights: (state) =>
      state.flights.filter((f) => f.status !== 'departed'),

    activeFlightsByStand: (state) => (standId: string) =>
      state.flights.filter(
        (f) => f.standId === standId && f.status !== 'departed'
      ),

    delayedFlights: (state) => {
      const now = state.currentTime;
      return state.flights.filter(
        (f) => f.departureTime < now && f.status !== 'departed'
      );
    },

    contactRate1h: (state) => {
      const oneHourAgo = state.currentTime - 3600000;
      const recent = state.flights.filter(
        (f) => f.arrivalTime > oneHourAgo && f.arrivalTime <= state.currentTime
      );
      if (recent.length === 0) return 0;
      const contact = recent.filter((f) => {
        const stand = state.stands.find((s) => s.id === f.standId);
        return stand?.type === 'contact';
      });
      return contact.length / recent.length;
    },

    contactRate24h: (state) => {
      const oneDayAgo = state.currentTime - 86400000;
      const recent = state.flights.filter(
        (f) => f.arrivalTime > oneDayAgo && f.arrivalTime <= state.currentTime
      );
      if (recent.length === 0) return 0;
      const contact = recent.filter((f) => {
        const stand = state.stands.find((s) => s.id === f.standId);
        return stand?.type === 'contact';
      });
      return contact.length / recent.length;
    },

    avgTurnaroundTime: (state) => {
      const completed = state.flights.filter((f) => f.status === 'departed');
      if (completed.length === 0) return 0;
      const total = completed.reduce(
        (sum, f) => sum + (f.departureTime - f.arrivalTime),
        0
      );
      return total / completed.length / 60000;
    },

    delayedFlightsCount: (state) => {
      const now = state.currentTime;
      return state.flights.filter(
        (f) => f.departureTime < now && f.status !== 'departed'
      ).length;
    },

    vehicleUtilization: (state) => {
      if (state.vehicles.length === 0) return 0;
      const working = state.vehicles.filter(
        (v) => v.status === 'working' || v.status === 'moving'
      );
      return working.length / state.vehicles.length;
    },

    unacknowledgedAlerts: (state) =>
      state.alerts.filter((a) => !a.acknowledged),

    selectedStand: (state) =>
      state.stands.find((s) => s.id === state.selectedStandId),

    selectedFlight: (state) =>
      state.flights.find((f) => f.id === state.selectedFlightId),

    flightById: (state) => (id: string) => state.flights.find((f) => f.id === id),

    standById: (state) => (id: string) => state.stands.find((s) => s.id === id),

    vehiclesByType: (state) => (type: string) =>
      state.vehicles.filter((v) => v.type === type),
  },

  actions: {
    initialize() {
      this.stands = generateStands();
      this.loadLayout();
    },

    updateCurrentTime() {
      this.currentTime = Date.now();
    },

    updateStand(standId: string, updates: Partial<Stand>) {
      const index = this.stands.findIndex((s) => s.id === standId);
      if (index !== -1) {
        this.stands[index] = { ...this.stands[index], ...updates };
      }
    },

    addFlight(flight: Omit<Flight, 'id'>) {
      const newFlight: Flight = {
        id: generateId(),
        ...flight,
      };
      this.flights.push(newFlight);
      return newFlight;
    },

    updateFlight(flightId: string, updates: Partial<Flight>) {
      const index = this.flights.findIndex((f) => f.id === flightId);
      if (index !== -1) {
        this.flights[index] = { ...this.flights[index], ...updates };
      }
    },

    updateFlightService(
      flightId: string,
      serviceId: string,
      updates: Partial<ServiceTask>
    ) {
      const flight = this.flights.find((f) => f.id === flightId);
      if (flight) {
        const serviceIndex = flight.services.findIndex(
          (s) => s.id === serviceId
        );
        if (serviceIndex !== -1) {
          flight.services[serviceIndex] = {
            ...flight.services[serviceIndex],
            ...updates,
          };
        }
      }
    },

    addVehicle(vehicle: Omit<Vehicle, 'id' | 'trail'>) {
      const newVehicle: Vehicle = {
        id: generateId(),
        trail: [],
        ...vehicle,
      };
      this.vehicles.push(newVehicle);
      return newVehicle;
    },

    updateVehicle(vehicleId: string, updates: Partial<Vehicle>) {
      const index = this.vehicles.findIndex((v) => v.id === vehicleId);
      if (index !== -1) {
        const vehicle = this.vehicles[index];
        if (updates.position && vehicle.position) {
          const trail = [
            ...vehicle.trail,
            { ...vehicle.position },
          ].slice(-10);
          this.vehicles[index] = {
            ...vehicle,
            ...updates,
            trail,
          };
        } else {
          this.vehicles[index] = { ...vehicle, ...updates };
        }
      }
    },

    addAlert(alert: Omit<Alert, 'id' | 'timestamp' | 'acknowledged'>) {
      const newAlert: Alert = {
        id: generateId(),
        timestamp: Date.now(),
        acknowledged: false,
        ...alert,
      };
      this.alerts.unshift(newAlert);
      if (this.alerts.length > MAX_ALERTS) {
        this.alerts = this.alerts.slice(0, MAX_ALERTS);
      }
      return newAlert;
    },

    acknowledgeAlert(alertId: string) {
      const alert = this.alerts.find((a) => a.id === alertId);
      if (alert) {
        alert.acknowledged = true;
      }
    },

    updateWeather(weather: Omit<Weather, 'timestamp'>) {
      this.weather = {
        timestamp: Date.now(),
        ...weather,
      };
      this.updateWeatherAlerts();
    },

    updateWeatherAlerts() {
      if (!this.weather) return;
      const { windSpeed, windDirection, visibility } = this.weather;
      const crosswind = Math.abs(
        windSpeed * Math.sin((windDirection * Math.PI) / 180)
      );
      const crosswindAlert = crosswind > WIND_CROSSWIND_THRESHOLD;
      const visibilityAlert = visibility < VISIBILITY_THRESHOLD;

      this.stands.forEach((stand) => {
        this.updateStand(stand.id, {
          weatherAlert: crosswindAlert || visibilityAlert,
        });
      });

      if (crosswindAlert) {
        this.addAlert({
          level: 'orange',
          type: 'weather',
          message: `侧风超标: ${crosswind.toFixed(1)}节，超过运行标准`,
        });
      }

      if (visibilityAlert) {
        this.addAlert({
          level: 'red',
          type: 'weather',
          message: `能见度不足: ${visibility}米，低于最低运行标准`,
        });
      }
    },

    setSelectedStand(standId: string | null) {
      this.selectedStandId = standId;
      if (standId) {
        const stand = this.stands.find((s) => s.id === standId);
        if (stand?.currentFlight) {
          this.selectedFlightId = stand.currentFlight;
        }
      }
    },

    setSelectedFlight(flightId: string | null) {
      this.selectedFlightId = flightId;
    },

    setCurrentRole(role: UserRole) {
      this.currentRole = role;
      const preset = rolePresets[role];
      this.layoutConfig = {
        ...this.layoutConfig,
        role,
        ...preset,
      };
      this.saveLayout();
    },

    setZoom(zoom: number) {
      this.layoutConfig.zoom = clamp(zoom, ZOOM_RANGE.min, ZOOM_RANGE.max);
    },

    setPan(pan: Position) {
      this.layoutConfig.pan = pan;
    },

    toggleLeftPanel() {
      this.layoutConfig.leftPanelCollapsed =
        !this.layoutConfig.leftPanelCollapsed;
      this.saveLayout();
    },

    toggleRightPanel() {
      this.layoutConfig.rightPanelCollapsed =
        !this.layoutConfig.rightPanelCollapsed;
      this.saveLayout();
    },

    toggleGantt() {
      this.layoutConfig.ganttCollapsed = !this.layoutConfig.ganttCollapsed;
      this.saveLayout();
    },

    toggleWeatherOverlay() {
      this.layoutConfig.weatherOverlayVisible =
        !this.layoutConfig.weatherOverlayVisible;
      this.saveLayout();
    },

    updateFilters(filters: Partial<LayoutConfig['filters']>) {
      this.layoutConfig.filters = {
        ...this.layoutConfig.filters,
        ...filters,
      };
      this.saveLayout();
    },

    detectConflicts() {
      this.stands.forEach((stand) => {
        const flights = this.flights
          .filter((f) => f.standId === stand.id)
          .sort((a, b) => a.arrivalTime - b.arrivalTime);

        for (let i = 0; i < flights.length - 1; i++) {
          const current = flights[i];
          const next = flights[i + 1];
          const interval = next.arrivalTime - current.departureTime;

          if (interval < MIN_TURNAROUND_INTERVAL) {
            const minutes = Math.round(interval / 60000);
            this.addAlert({
              level: 'red',
              type: 'conflict',
              message: `机位 ${stand.number} 航班间隔不足: ${minutes}分钟 (最小45分钟)`,
              standId: stand.id,
              flightId: current.id,
            });
          }
        }
      });

      this.flights.forEach((flight) => {
        if (flight.status === 'departed') return;
        flight.services.forEach((service) => {
          if (
            service.status === 'in-progress' &&
            this.currentTime > service.endTime
          ) {
            const delay = Math.round(
              (this.currentTime - service.endTime) / 60000
            );
            this.addAlert({
              level: 'orange',
              type: 'service-delay',
              message: `${flight.flightNo} 作业超时: ${service.type} 已延误${delay}分钟`,
              standId: flight.standId,
              flightId: flight.id,
            });
            service.status = 'delayed';
          }
        });
      });
    },

    saveLayout() {
      try {
        const layoutData = JSON.stringify(this.layoutConfig);
        if (layoutData.length < 50 * 1024) {
          localStorage.setItem('apron-layout', layoutData);
        }
      } catch (e) {
        console.error('Failed to save layout:', e);
      }
    },

    loadLayout() {
      try {
        const saved = localStorage.getItem('apron-layout');
        if (saved) {
          const parsed = JSON.parse(saved);
          this.layoutConfig = { ...defaultLayout, ...parsed };
          this.currentRole = parsed.role || 'dispatcher';
        }
      } catch (e) {
        console.error('Failed to load layout:', e);
      }
    },
  },
});

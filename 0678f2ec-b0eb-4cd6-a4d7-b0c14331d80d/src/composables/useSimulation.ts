import { ref, onMounted, onUnmounted } from 'vue';
import { useApronStore } from '@/stores/apron';
import type {
  Flight,
  Vehicle,
  ServiceTask,
  Stand,
  VehicleType,
  ServiceType,
} from '@/types/apron';
import {
  generateId,
  randomRange,
  randomInt,
  randomPick,
  headingTo,
  lerpPosition,
  distance,
} from '@/utils/helpers';
import {
  AIRLINES,
  AIRCRAFT_TYPES,
  SERVICE_TYPES,
  SERVICE_DURATIONS,
  VEHICLE_TYPES,
  SIMULATION_INTERVAL,
} from '@/utils/constants';
import {
  getVehiclePoolArea,
  getFuelDepotArea,
  getServiceArea,
} from '@/utils/standLayout';

export function useSimulation() {
  const store = useApronStore();
  const isRunning = ref(false);
  let simulationInterval: NodeJS.Timeout | null = null;
  let animationFrameId: number | null = null;
  let tickCounter = 0;

  const generateServiceTasks = (
    arrivalTime: number,
    departureTime: number
  ): ServiceTask[] => {
    const services: ServiceTask[] = [];
    const baseTime = arrivalTime + 5 * 60 * 1000;

    SERVICE_TYPES.forEach((type, index) => {
      const duration = SERVICE_DURATIONS[type] * 60 * 1000;
      const offset = index * 5 * 60 * 1000;
      const startTime = baseTime + offset;
      const endTime = Math.min(startTime + duration, departureTime - 5 * 60 * 1000);

      services.push({
        id: generateId(),
        type,
        startTime,
        endTime,
        duration: Math.round((endTime - startTime) / 60000),
        progress: 0,
        status: 'pending',
        crew: `地勤组${randomInt(1, 5)}`,
      });
    });

    return services;
  };

  const generateFlight = (stand: Stand, baseTime: number): Flight => {
    const airline = randomPick(AIRLINES);
    const flightNo = `${airline.code}${randomInt(1000, 9999)}`;
    const turnaround = randomRange(60, 120) * 60 * 1000;
    const arrivalTime = baseTime + randomRange(0, 10) * 60 * 1000;
    const departureTime = arrivalTime + turnaround;

    return {
      id: generateId(),
      flightNo,
      airline: airline.code,
      aircraftType: randomPick(AIRCRAFT_TYPES),
      standId: stand.id,
      arrivalTime,
      departureTime,
      passengerCount: randomInt(100, 350),
      services: generateServiceTasks(arrivalTime, departureTime),
      status: 'scheduled',
      isDelayed: Math.random() < 0.15,
    };
  };

  const generateVehicles = () => {
    const poolArea = getVehiclePoolArea();
    const vehicles: Omit<Vehicle, 'id' | 'trail'>[] = [];
    const vehicleCounts: Record<VehicleType, number> = {
      tug: 20,
      fuel: 15,
      water: 10,
      waste: 8,
      stairs: 7,
    };

    Object.entries(vehicleCounts).forEach(([type, count]) => {
      for (let i = 0; i < count; i++) {
        vehicles.push({
          type: type as VehicleType,
          plateNo: `${type.toUpperCase()}-${String(i + 1).padStart(3, '0')}`,
          position: {
            x: randomRange(poolArea.x + 10, poolArea.x + poolArea.width - 10),
            y: randomRange(poolArea.y + 10, poolArea.y + poolArea.height - 10),
          },
          heading: randomRange(0, 360),
          status: 'idle',
          speed: randomRange(2, 5),
        });
      }
    });

    vehicles.forEach((v) => store.addVehicle(v));
  };

  const spawnFlight = () => {
    const availableStands = store.stands.filter(
      (s) => s.status === 'available' && s.type === 'contact'
    );
    if (availableStands.length === 0) return;

    const stand = randomPick(availableStands);
    const flight = generateFlight(stand, store.currentTime);

    store.addFlight(flight);
    store.updateStand(stand.id, {
      status: 'occupied',
      currentFlight: flight.id,
    });
  };

  const updateFlightStatus = () => {
    const now = store.currentTime;

    store.flights.forEach((flight) => {
      if (flight.status === 'departed') return;

      const stand = store.stands.find((s) => s.id === flight.standId);
      if (!stand) return;

      if (flight.status === 'scheduled' && now >= flight.arrivalTime) {
        store.updateFlight(flight.id, { status: 'arrived' });
        store.updateStand(stand.id, { status: 'in-service' });

        const towingService = flight.services.find((s) => s.type === 'towing');
        if (towingService) {
          store.updateFlightService(flight.id, towingService.id, {
            status: 'in-progress',
          });
        }

        store.addAlert({
          level: 'blue',
          type: 'flight-arrival',
          message: `航班 ${flight.flightNo} 已到达机位 ${stand.number}`,
          standId: stand.id,
          flightId: flight.id,
        });
      }

      if (flight.status === 'arrived' || flight.status === 'boarding') {
        flight.services.forEach((service) => {
          if (service.status === 'pending' && now >= service.startTime) {
            store.updateFlightService(flight.id, service.id, {
              status: 'in-progress',
            });
          }

          if (service.status === 'in-progress') {
            const totalDuration = service.endTime - service.startTime;
            const elapsed = now - service.startTime;
            const progress = Math.min(100, Math.round((elapsed / totalDuration) * 100));

            store.updateFlightService(flight.id, service.id, {
              progress,
            });

            if (progress >= 100) {
              store.updateFlightService(flight.id, service.id, {
                status: 'completed',
                progress: 100,
              });
            }
          }

          if (service.type === 'boarding' && service.status === 'completed' && flight.status !== 'boarding') {
            store.updateFlight(flight.id, { status: 'boarding' });
          }
        });

        const allCompleted = flight.services.every((s) => s.status === 'completed');
        if (allCompleted && now >= flight.departureTime) {
          store.updateFlight(flight.id, { status: 'departed' });
          store.updateStand(stand.id, {
            status: 'available',
            currentFlight: undefined,
          });

          store.addAlert({
            level: 'blue',
            type: 'flight-departure',
            message: `航班 ${flight.flightNo} 已离港，机位 ${stand.number} 已释放`,
            standId: stand.id,
            flightId: flight.id,
          });
        }
      }
    });
  };

  const updateVehicles = () => {
    store.vehicles.forEach((vehicle) => {
      if (vehicle.status === 'idle' && Math.random() < 0.1) {
        const activeFlights = store.activeFlights;
        if (activeFlights.length > 0) {
          const targetFlight = randomPick(activeFlights);
          const stand = store.stands.find((s) => s.id === targetFlight.standId);
          if (stand) {
            const targetPosition = {
              x: stand.position.x + stand.position.width / 2,
              y: stand.position.y + stand.position.height / 2,
            };

            store.updateVehicle(vehicle.id, {
              status: 'moving',
              targetPosition,
              currentTask: targetFlight.id,
            });
          }
        }
      }

      if (vehicle.status === 'moving' && vehicle.targetPosition) {
        const dist = distance(vehicle.position, vehicle.targetPosition);

        if (dist < 5) {
          store.updateVehicle(vehicle.id, {
            status: 'working',
            targetPosition: undefined,
          });

          setTimeout(() => {
            if (Math.random() < 0.7) {
              const poolArea = getVehiclePoolArea();
              store.updateVehicle(vehicle.id, {
                status: 'moving',
                targetPosition: {
                  x: randomRange(poolArea.x + 10, poolArea.x + poolArea.width - 10),
                  y: randomRange(poolArea.y + 10, poolArea.y + poolArea.height - 10),
                },
                currentTask: undefined,
              });
            }
          }, randomRange(3000, 8000));
        } else {
          const moveAmount = vehicle.speed * 0.5;
          const t = Math.min(1, moveAmount / dist);
          const newPosition = lerpPosition(
            vehicle.position,
            vehicle.targetPosition,
            t
          );
          const newHeading = headingTo(vehicle.position, vehicle.targetPosition);

          store.updateVehicle(vehicle.id, {
            position: newPosition,
            heading: newHeading,
          });
        }
      }

      if (vehicle.status === 'moving' && !vehicle.targetPosition) {
        const poolArea = getVehiclePoolArea();
        const dist = distance(vehicle.position, {
          x: poolArea.x + poolArea.width / 2,
          y: poolArea.y + poolArea.height / 2,
        });
        if (dist < 20) {
          store.updateVehicle(vehicle.id, {
            status: 'idle',
            targetPosition: undefined,
          });
        }
      }
    });
  };

  const updateWeather = () => {
    if (Math.random() < 0.05) {
      store.updateWeather({
        windDirection: randomRange(0, 360),
        windSpeed: randomRange(5, 25),
        visibility: randomRange(500, 5000),
        temperature: randomRange(-10, 35),
      });
    }
  };

  const tick = () => {
    store.updateCurrentTime();
    updateFlightStatus();
    updateVehicles();
    updateWeather();

    if (Math.random() < 0.1) {
      spawnFlight();
    }

    if (Math.random() < 0.05) {
      store.detectConflicts();
    }

    tickCounter++;
    if (tickCounter % 60 === 0) {
      store.updateFlightHistory();
      store.updateAlertHistory();
      tickCounter = 0;
    }
  };

  const initializeData = () => {
    store.initialize();
    generateVehicles();

    const now = Date.now();
    const occupiedStands = store.stands.filter((s) => s.type === 'contact').slice(0, 40);

    occupiedStands.forEach((stand, index) => {
      const offset = -index * 15 * 60 * 1000;
      const flight = generateFlight(stand, now + offset);

      if (index < 20) {
        flight.status = 'arrived';
        flight.services.forEach((s, i) => {
          if (i < 2) {
            s.status = 'completed';
            s.progress = 100;
          } else if (i < 4) {
            s.status = 'in-progress';
            s.progress = randomInt(30, 70);
          }
        });
        store.updateStand(stand.id, {
          status: 'in-service',
          currentFlight: flight.id,
        });
      } else {
        store.updateStand(stand.id, {
          status: 'occupied',
          currentFlight: flight.id,
        });
      }

      store.addFlight(flight);
    });

    store.updateWeather({
      windDirection: 90,
      windSpeed: 12,
      visibility: 3000,
      temperature: 22,
    });
  };

  const start = () => {
    if (isRunning.value) return;
    isRunning.value = true;
    simulationInterval = setInterval(tick, SIMULATION_INTERVAL);
  };

  const stop = () => {
    isRunning.value = false;
    if (simulationInterval) {
      clearInterval(simulationInterval);
      simulationInterval = null;
    }
    if (animationFrameId) {
      cancelAnimationFrame(animationFrameId);
      animationFrameId = null;
    }
  };

  onMounted(() => {
    initializeData();
    start();
  });

  onUnmounted(() => {
    stop();
  });

  return {
    isRunning,
    start,
    stop,
    initializeData,
  };
}

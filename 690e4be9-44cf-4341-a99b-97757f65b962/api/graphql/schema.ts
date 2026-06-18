export const typeDefs = `#graphql
  type Line {
    id: ID!
    lineNo: Int!
    name: String!
    startStop: String!
    endStop: String!
    firstBusTime: String!
    lastBusTime: String!
    mileage: Float!
    peakInterval: Int!
    offPeakInterval: Int!
    vehicleCount: Int!
    routes: [Route!]!
    vehicles: [Vehicle!]!
    drivers: [Driver!]!
    trips: [Trip!]!
  }

  type Route {
    id: ID!
    lineId: String!
    direction: Int!
    stopIds: [String!]!
    distance: Float!
    stops: [Stop!]!
  }

  type Stop {
    id: ID!
    name: String!
    latitude: Float!
    longitude: Float!
  }

  type Trip {
    id: ID!
    lineId: String!
    routeId: String!
    vehicleId: String
    driverId: String
    departureTime: String!
    arrivalTime: String
    direction: Int!
    status: String!
    delayMinutes: Float!
    line: Line
    vehicle: Vehicle
    driver: Driver
    ridership: [RidershipRecord!]!
  }

  type Vehicle {
    id: ID!
    plateNumber: String!
    model: String!
    capacity: Int!
    status: String!
    lineId: String
    totalMileage: Float!
    line: Line
    gpsRecords: [GPSRecord!]!
    maintenanceRecords: [MaintenanceRecord!]!
  }

  type Driver {
    id: ID!
    name: String!
    employeeId: String!
    licenseType: String!
    status: String!
    lineId: String
    dailyWorkMinutes: Int!
    phone: String
    line: Line
  }

  type GPSRecord {
    id: ID!
    vehicleId: String!
    lineId: String!
    tripId: String
    latitude: Float!
    longitude: Float!
    speed: Float!
    heading: Float!
    timestamp: Float!
  }

  type RidershipRecord {
    id: ID!
    tripId: String!
    stopId: String!
    boarding: Int!
    alighting: Int!
    onboardCount: Int!
    loadFactor: Float!
    timestamp: Float!
  }

  type MaintenanceRecord {
    id: ID!
    vehicleId: String!
    type: String!
    startDate: String!
    endDate: String
    nextDate: String
    cost: Float!
    description: String
    status: String!
  }

  type AnomalyRecord {
    id: ID!
    type: String!
    lineId: String!
    tripId: String
    vehicleId: String
    driverId: String
    description: String
    severity: String!
    timestamp: Float!
    resolved: Boolean!
    recommendation: String
  }

  type Schedule {
    id: ID!
    lineId: String!
    date: String!
    trips: [ScheduleTripItem!]!
    status: String!
    createdAt: Float!
    updatedAt: Float!
    line: Line
  }

  type ScheduleTripItem {
    tripId: String!
    vehicleId: String!
    driverId: String!
    departureTime: String!
    direction: Int!
  }

  type ArrivalPrediction {
    vehicleId: String!
    stopId: String!
    stopName: String!
    estimatedArrivalMinutes: Float!
    estimatedArrivalTime: String!
    confidence: Float!
    distanceRemaining: Float!
    speedEstimate: Float!
  }

  type DailyReport {
    date: String!
    totalRidership: Int!
    averageLoadFactor: Float!
    onTimeRate: Float!
    totalTrips: Int!
    completedTrips: Int!
    delayedTrips: Int!
    totalMileageKm: Float!
    mileageUtilizationRate: Float!
    activeVehicles: Int!
    totalVehicles: Int!
    vehicleUtilizationRate: Float!
    activeDrivers: Int!
    totalDrivers: Int!
    driverUtilizationRate: Float!
    anomalyCount: Int!
  }

  type SubstituteCandidate {
    driver: Driver!
    score: Float!
    reasons: [String!]!
  }

  type SubstituteResult {
    absentDriverId: String!
    absentDriverName: String!
    lineId: String!
    candidates: [SubstituteCandidate!]!
  }

  type AnomalyDetectionResult {
    anomalies: [AnomalyRecord!]!
    recommendations: [AnomalyRecommendation!]!
  }

  type AnomalyRecommendation {
    lineId: String!
    lineName: String!
    type: String!
    description: String!
    action: String!
    priority: String!
  }

  type PaginatedTrips {
    items: [Trip!]!
    total: Int!
    page: Int!
    pageSize: Int!
  }

  type PaginatedVehicles {
    items: [Vehicle!]!
    total: Int!
    page: Int!
    pageSize: Int!
  }

  type PaginatedDrivers {
    items: [Driver!]!
    total: Int!
    page: Int!
    pageSize: Int!
  }

  type GPSPush {
    vehicleId: String!
    lineId: String!
    latitude: Float!
    longitude: Float!
    speed: Float!
    heading: Float!
    timestamp: Float!
  }

  type AnomalyAlert {
    id: String!
    type: String!
    lineId: String!
    description: String!
    severity: String!
    timestamp: Float!
  }

  type Query {
    line(id: ID!): Line
    lines(page: Int, pageSize: Int): [Line!]!
    route(id: ID!): Route
    stop(id: ID!): Stop
    stops(page: Int, pageSize: Int): [Stop!]!
    trip(id: ID!): Trip
    trips(lineId: String, page: Int, pageSize: Int): PaginatedTrips!
    vehicle(id: ID!): Vehicle
    vehicles(status: String, lineId: String, page: Int, pageSize: Int): PaginatedVehicles!
    driver(id: ID!): Driver
    drivers(status: String, lineId: String, page: Int, pageSize: Int): PaginatedDrivers!
    gpsRecords(vehicleId: String!, page: Int, pageSize: Int): [GPSRecord!]!
    ridershipRecords(tripId: String, page: Int, pageSize: Int): [RidershipRecord!]!
    schedule(lineId: String!, date: String!): Schedule
    schedules(date: String!): [Schedule!]!
    arrivalPrediction(vehicleId: String!, stopId: String!): ArrivalPrediction
    arrivalPredictionsByLine(lineId: String!, stopId: String!): [ArrivalPrediction!]!
    dailyReport(date: String!): DailyReport!
    anomalies(active: Boolean): AnomalyDetectionResult!
    substitute(driverId: String!): SubstituteResult
  }

  type Mutation {
    generateSchedule(lineId: String, date: String!): [Schedule!]!
    updateTrip(id: ID!, vehicleId: String, driverId: String, departureTime: String, status: String, delayMinutes: Float): Trip!
    reportGPS(vehicleId: String!, lineId: String!, latitude: Float!, longitude: Float!, speed: Float, heading: Float): GPSRecord!
    reportRidership(tripId: String!, stopId: String!, boarding: Int!, alighting: Int!, onboardCount: Int!, loadFactor: Float!): RidershipRecord!
    requestLeave(driverId: String!): SubstituteResult!
    applySubstitute(absentDriverId: String!, substituteDriverId: String!): Boolean!
    resolveAnomaly(id: ID!): Boolean!
  }

  type Subscription {
    gpsUpdated: GPSPush!
    anomalyAlert: AnomalyAlert!
  }
`

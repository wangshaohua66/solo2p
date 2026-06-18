import express from 'express'
import cors from 'cors'
import { createServer } from 'http'
import { Server as SocketIOServer } from 'socket.io'
import { ApolloServer } from '@apollo/server'
import { expressMiddleware } from '@apollo/server/express4'
import { createDepthLimitRule } from './graphql/depthLimit.js'
import dotenv from 'dotenv'
import scheduleRoutes from './routes/schedule.js'
import vehicleRoutes from './routes/vehicles.js'
import gpsRoutes from './routes/gps.js'
import ridershipRoutes from './routes/ridership.js'
import driverRoutes from './routes/drivers.js'
import reportRoutes from './routes/reports.js'
import { typeDefs } from './graphql/schema.js'
import { resolvers, pubsub, GPS_UPDATED, ANOMALY_ALERT } from './graphql/resolvers/opsResolver.js'
import { mockData } from './data/mockData.js'
import { detectAnomalies } from './services/anomalyDetector.js'

dotenv.config()

const app = express()
const httpServer = createServer(app)

const io = new SocketIOServer(httpServer, {
  cors: {
    origin: '*',
    methods: ['GET', 'POST'],
  },
})

const apolloServer = new ApolloServer({
  typeDefs,
  resolvers,
  validationRules: [createDepthLimitRule(4)],
})

await apolloServer.start()

app.use(cors())
app.use(express.json({ limit: '10mb' }))
app.use(express.urlencoded({ extended: true, limit: '10mb' }))

app.use('/graphql', expressMiddleware(apolloServer))

app.use('/api/schedule', scheduleRoutes)
app.use('/api/vehicles', vehicleRoutes)
app.use('/api/gps', gpsRoutes)
app.use('/api/ridership', ridershipRoutes)
app.use('/api/drivers', driverRoutes)
app.use('/api/reports', reportRoutes)

app.use('/api/health', (_req, res) => {
  res.json({
    success: true,
    message: 'ok',
    timestamp: Date.now(),
    stats: {
      lines: mockData.lines.length,
      vehicles: mockData.vehicles.length,
      drivers: mockData.drivers.length,
      gpsRecords: mockData.gpsRecords.length,
    },
  })
})

app.use((err: Error, _req: express.Request, res: express.Response, _next: express.NextFunction) => {
  console.error(err.stack)
  res.status(500).json({ success: false, error: 'Server internal error' })
})

app.use((_req, res) => {
  res.status(404).json({ success: false, error: 'API not found' })
})

const activeVehicles = mockData.vehicles.filter(v => v.status === 'active')

setInterval(() => {
  const vehicle = activeVehicles[Math.floor(Math.random() * activeVehicles.length)]
  const line = mockData.lines.find(l => l.id === vehicle.lineId)

  const gpsData = {
    vehicleId: vehicle.id,
    lineId: vehicle.lineId!,
    tripId: undefined as string | undefined,
    latitude: 39.85 + Math.random() * 0.25,
    longitude: 116.2 + Math.random() * 0.35,
    speed: Math.floor(Math.random() * 55),
    heading: Math.floor(Math.random() * 360),
    timestamp: Date.now(),
  }

  const record: import('./models/GPSRecord.js').GPSRecord = {
    id: `gps_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`,
    ...gpsData,
  }
  mockData.gpsRecords.push(record)

  if (mockData.gpsRecords.length > 10000) {
    mockData.gpsRecords.splice(0, mockData.gpsRecords.length - 5000)
  }

  io.emit('gps:update', gpsData)
  pubsub.publish(GPS_UPDATED, { gpsUpdated: gpsData })

  if (line) {
    io.emit(`gps:line:${line.id}`, gpsData)
  }
}, 3000)

setInterval(() => {
  try {
    const { anomalies, recommendations } = detectAnomalies()
    const newAnomalies = anomalies.filter(a => !a.resolved)

    for (const anomaly of newAnomalies.slice(0, 3)) {
      const alert = {
        id: anomaly.id,
        type: anomaly.type,
        lineId: anomaly.lineId,
        description: anomaly.description,
        severity: anomaly.severity,
        timestamp: anomaly.timestamp,
      }

      io.emit('anomaly:alert', alert)
      pubsub.publish(ANOMALY_ALERT, { anomalyAlert: alert })

      const existing = mockData.anomalyRecords.find(a => a.id === anomaly.id)
      if (!existing) {
        mockData.anomalyRecords.push(anomaly)
      }
    }

    if (recommendations.length > 0) {
      io.emit('anomaly:recommendations', recommendations)
    }
  } catch (error) {
    console.error('Anomaly detection error:', error)
  }
}, 30000)

io.on('connection', (socket) => {
  socket.emit('connected', { message: 'Bus Dispatch System Real-time Service' })

  socket.on('subscribe:line', (lineId: string) => {
    socket.join(`line:${lineId}`)
  })

  socket.on('unsubscribe:line', (lineId: string) => {
    socket.leave(`line:${lineId}`)
  })

  socket.on('subscribe:vehicle', (vehicleId: string) => {
    socket.join(`vehicle:${vehicleId}`)
  })

  socket.on('unsubscribe:vehicle', (vehicleId: string) => {
    socket.leave(`vehicle:${vehicleId}`)
  })
})

const PORT = process.env.PORT || 3001

httpServer.listen(PORT, () => {
  console.log(`Bus Dispatch System Server ready`)
  console.log(`  REST API:   http://localhost:${PORT}/api/*`)
  console.log(`  GraphQL:    http://localhost:${PORT}/graphql`)
  console.log(`  Socket.IO:  ws://localhost:${PORT}`)
  console.log(`  Data:       ${mockData.lines.length} lines, ${mockData.vehicles.length} vehicles, ${mockData.drivers.length} drivers`)
})

process.on('SIGTERM', () => {
  console.log('SIGTERM signal received')
  httpServer.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

process.on('SIGINT', () => {
  console.log('SIGINT signal received')
  httpServer.close(() => {
    console.log('Server closed')
    process.exit(0)
  })
})

export default app

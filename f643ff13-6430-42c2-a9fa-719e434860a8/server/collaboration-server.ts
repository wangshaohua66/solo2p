import { WebSocketServer, WebSocket } from 'ws'
import http from 'http'
import type { 
  WebSocketMessage, 
  WebSocketMessageType, 
  CollaborationUser, 
  CollaborationAction 
} from '../src/types'

const PORT = process.env.COLLABORATION_PORT || 8080

interface ClientConnection {
  ws: WebSocket
  user: CollaborationUser
  caseId: string
}

const clients = new Map<string, ClientConnection>()
const cases = new Map<string, Map<string, ClientConnection>>()

const getCaseClients = (caseId: string): Map<string, ClientConnection> => {
  if (!cases.has(caseId)) {
    cases.set(caseId, new Map())
  }
  return cases.get(caseId)!
}

const broadcastToCase = (caseId: string, message: WebSocketMessage, excludeUserId?: string) => {
  const caseClients = getCaseClients(caseId)
  caseClients.forEach((client, userId) => {
    if (userId !== excludeUserId && client.ws.readyState === WebSocket.OPEN) {
      client.ws.send(JSON.stringify(message))
    }
  })
}

const sendToClient = (userId: string, message: WebSocketMessage) => {
  const client = clients.get(userId)
  if (client && client.ws.readyState === WebSocket.OPEN) {
    client.ws.send(JSON.stringify(message))
  }
}

const getUsersInCase = (caseId: string): CollaborationUser[] => {
  const caseClients = getCaseClients(caseId)
  return Array.from(caseClients.values()).map(c => c.user)
}

const createMessage = (
  type: WebSocketMessageType,
  payload?: any,
  userId?: string,
  caseId?: string
): WebSocketMessage => ({
  type,
  payload,
  userId,
  timestamp: Date.now(),
  caseId
})

const handleJoin = (ws: WebSocket, message: WebSocketMessage) => {
  const user = message.payload?.user as CollaborationUser
  if (!user || !user.id || !user.caseId) {
    ws.send(JSON.stringify(createMessage('leave', { error: 'Invalid user data' })))
    return
  }

  const existingClient = clients.get(user.id)
  if (existingClient) {
    existingClient.ws.close(1000, 'User reconnected from another location')
    clients.delete(user.id)
    const caseClients = getCaseClients(user.caseId)
    caseClients.delete(user.id)
  }

  const client: ClientConnection = { ws, user, caseId: user.caseId }
  clients.set(user.id, client)
  
  const caseClients = getCaseClients(user.caseId)
  caseClients.set(user.id, client)

  console.log(`[Collaboration] User joined: ${user.name} (${user.role}) in case ${user.caseId}`)

  sendToClient(user.id, createMessage('users-list', { users: getUsersInCase(user.caseId) }, user.id, user.caseId))

  broadcastToCase(
    user.caseId,
    createMessage('user-joined', { user }, user.id, user.caseId),
    user.id
  )
}

const handleLeave = (userId: string) => {
  const client = clients.get(userId)
  if (!client) return

  const { user, caseId } = client
  
  clients.delete(userId)
  const caseClients = getCaseClients(caseId)
  caseClients.delete(userId)

  console.log(`[Collaboration] User left: ${user.name} (${user.role}) from case ${caseId}`)

  broadcastToCase(
    caseId,
    createMessage('user-left', { userId, user }, userId, caseId)
  )

  if (caseClients.size === 0) {
    cases.delete(caseId)
  }
}

const handleAction = (message: WebSocketMessage) => {
  const action = message.payload?.action as CollaborationAction
  if (!action || !action.caseId || !action.userId) return

  console.log(`[Collaboration] Action: ${action.type} from ${action.userId} in case ${action.caseId}`)

  broadcastToCase(
    action.caseId,
    createMessage('action', { action }, action.userId, action.caseId),
    action.userId
  )
}

const handleSyncRequest = (message: WebSocketMessage) => {
  const userId = message.userId
  const caseId = message.caseId
  if (!userId || !caseId) return

  sendToClient(userId, createMessage('sync-response', {
    users: getUsersInCase(caseId)
  }, userId, caseId))
}

const handlePing = (ws: WebSocket, message: WebSocketMessage) => {
  if (message.userId) {
    sendToClient(message.userId, createMessage('pong', undefined, message.userId, message.caseId))
  } else {
    ws.send(JSON.stringify(createMessage('pong')))
  }
}

export const startCollaborationServer = (server?: http.Server): WebSocketServer => {
  let wss: WebSocketServer

  if (server) {
    wss = new WebSocketServer({ server, path: '/collaboration' })
  } else {
    wss = new WebSocketServer({ port: PORT as number, path: '/collaboration' })
    console.log(`[Collaboration] WebSocket server started on ws://localhost:${PORT}/collaboration`)
  }

  wss.on('connection', (ws, req) => {
    let currentUserId: string | null = null

    console.log(`[Collaboration] New connection from ${req.socket.remoteAddress}`)

    ws.on('message', (data) => {
      try {
        const message = JSON.parse(data.toString()) as WebSocketMessage
        
        switch (message.type) {
          case 'join':
            handleJoin(ws, message)
            currentUserId = message.payload?.user?.id || null
            break
          case 'leave':
            if (message.userId) {
              handleLeave(message.userId)
              currentUserId = null
            }
            break
          case 'action':
            handleAction(message)
            break
          case 'sync-request':
            handleSyncRequest(message)
            break
          case 'ping':
            handlePing(ws, message)
            break
        }
      } catch (error) {
        console.error('[Collaboration] Error parsing message:', error)
      }
    })

    ws.on('close', (code, reason) => {
      console.log(`[Collaboration] Connection closed: ${code} - ${reason}`)
      if (currentUserId) {
        handleLeave(currentUserId)
      }
    })

    ws.on('error', (error) => {
      console.error('[Collaboration] WebSocket error:', error)
    })
  })

  return wss
}

if (require.main === module) {
  startCollaborationServer()
}

export { clients, cases }

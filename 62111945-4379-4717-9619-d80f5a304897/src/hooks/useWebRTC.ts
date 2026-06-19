import { useRef, useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { useSelector } from 'react-redux'
import type { RootState } from '@/store'

export interface WebRTCState {
  localStream: MediaStream | null
  remoteStreams: Map<string, MediaStream>
  isAudioEnabled: boolean
  isVideoEnabled: boolean
  isScreenSharing: boolean
  connectionState: 'new' | 'connecting' | 'connected' | 'disconnected' | 'failed'
  error: string | null
}

export interface UseWebRTCResult extends WebRTCState {
  startLocalStream: () => Promise<void>
  stopLocalStream: () => void
  toggleAudio: () => void
  toggleVideo: () => void
  startScreenShare: () => Promise<void>
  stopScreenShare: () => void
  sendChatMessage: (content: string) => void
  joinRoom: () => void
  leaveRoom: () => void
}

const ICE_SERVERS = [
  { urls: 'stun:stun.l.google.com:19302' },
  { urls: 'stun:stun1.l.google.com:19302' },
  {
    urls: 'turn:turn.example.com:3478',
    username: 'talent-market',
    credential: 'talent-market-2024'
  }
]

export const useWebRTC = (): UseWebRTCResult => {
  const { id: roomId = 'default' } = useParams<{ id: string }>()
  const userInfo = useSelector((state: RootState) => state.auth.userInfo)

  const [state, setState] = useState<WebRTCState>({
    localStream: null,
    remoteStreams: new Map(),
    isAudioEnabled: true,
    isVideoEnabled: true,
    isScreenSharing: false,
    connectionState: 'new',
    error: null
  })

  const wsRef = useRef<WebSocket | null>(null)
  const peerConnectionsRef = useRef<Map<string, RTCPeerConnection>>(new Map())
  const localStreamRef = useRef<MediaStream | null>(null)
  const screenStreamRef = useRef<MediaStream | null>(null)
  const localSendersRef = useRef<RTCRtpSender[]>([])
  const reconnectTimerRef = useRef<number | null>(null)

  const userId = userInfo?.id || 'user-' + Math.random().toString(36).slice(2, 9)
  const userName = userInfo?.name || '用户'
  const userRole = userInfo?.role || 'jobseeker'

  const getWsUrl = useCallback(() => {
    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:'
    const host = window.location.hostname
    return `${protocol}//${host}:8085/ws/webrtc?userId=${encodeURIComponent(userId)}&userName=${encodeURIComponent(userName)}&userRole=${userRole}`
  }, [userId, userName, userRole])

  const setStatePartial = useCallback((partial: Partial<WebRTCState>) => {
    setState(prev => ({ ...prev, ...partial }))
  }, [])

  const createPeerConnection = useCallback((remoteUserId: string): RTCPeerConnection => {
    const pc = new RTCPeerConnection({
      iceServers: ICE_SERVERS,
      iceCandidatePoolSize: 10
    })

    const localStream = localStreamRef.current
    if (localStream) {
      localStream.getTracks().forEach(track => {
        if (localStream) {
          const sender = pc.addTrack(track, localStream)
          localSendersRef.current.push(sender)
        }
      })
    }

    pc.onicecandidate = (event) => {
      if (event.candidate && wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({
          type: 'candidate',
          roomId,
          targetId: remoteUserId,
          data: event.candidate
        }))
      }
    }

    pc.onconnectionstatechange = () => {
      console.log('[WebRTC] 连接状态变更:', remoteUserId, pc.connectionState)
      if (pc.connectionState === 'connected') {
        setStatePartial({ connectionState: 'connected' })
      } else if (pc.connectionState === 'failed' || pc.connectionState === 'disconnected') {
        setStatePartial({ connectionState: pc.connectionState as WebRTCState['connectionState'] })
      }
    }

    pc.ontrack = (event) => {
      console.log('[WebRTC] 收到远程轨道:', remoteUserId, event.track.kind)
      const [remoteStream] = event.streams
      if (remoteStream) {
        setState(prev => {
          const newRemoteStreams = new Map(prev.remoteStreams)
          newRemoteStreams.set(remoteUserId, remoteStream)
          return { ...prev, remoteStreams: newRemoteStreams }
        })
      }
    }

    pc.onicegatheringstatechange = () => {
      console.log('[WebRTC] ICE收集状态:', pc.iceGatheringState)
    }

    peerConnectionsRef.current.set(remoteUserId, pc)
    return pc
  }, [roomId, setStatePartial])

  const closePeerConnections = useCallback(() => {
    peerConnectionsRef.current.forEach(pc => {
      pc.close()
    })
    peerConnectionsRef.current.clear()
    localSendersRef.current = []
  }, [])

  const sendWsMessage = useCallback((message: Record<string, unknown>) => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(message))
    }
  }, [])

  const handleSignalingMessage = useCallback(async (message: any) => {
    const { type, from, data } = message

    switch (type) {
      case 'user-joined': {
        console.log('[WebRTC] 用户加入:', from)
        const pc = createPeerConnection(from)
        try {
          const offer = await pc.createOffer({
            offerToReceiveAudio: true,
            offerToReceiveVideo: true
          })
          await pc.setLocalDescription(offer)
          sendWsMessage({
            type: 'offer',
            roomId,
            targetId: from,
            data: offer
          })
        } catch (err) {
          console.error('[WebRTC] 创建Offer失败:', err)
        }
        break
      }

      case 'offer': {
        console.log('[WebRTC] 收到Offer:', from)
        const pc = peerConnectionsRef.current.get(from) || createPeerConnection(from)
        try {
          await pc.setRemoteDescription(new RTCSessionDescription(data))
          const answer = await pc.createAnswer()
          await pc.setLocalDescription(answer)
          sendWsMessage({
            type: 'answer',
            roomId,
            targetId: from,
            data: answer
          })
        } catch (err) {
          console.error('[WebRTC] 处理Offer失败:', err)
        }
        break
      }

      case 'answer': {
        console.log('[WebRTC] 收到Answer:', from)
        const pc = peerConnectionsRef.current.get(from)
        if (pc) {
          try {
            await pc.setRemoteDescription(new RTCSessionDescription(data))
          } catch (err) {
            console.error('[WebRTC] 处理Answer失败:', err)
          }
        }
        break
      }

      case 'candidate': {
        const pc = peerConnectionsRef.current.get(from)
        if (pc && data) {
          try {
            await pc.addIceCandidate(new RTCIceCandidate(data))
          } catch (err) {
            console.error('[WebRTC] 添加ICE候选失败:', err)
          }
        }
        break
      }

      case 'user-left': {
        console.log('[WebRTC] 用户离开:', from)
        const pc = peerConnectionsRef.current.get(from)
        if (pc) {
          pc.close()
          peerConnectionsRef.current.delete(from)
        }
        setState(prev => {
          const newRemoteStreams = new Map(prev.remoteStreams)
          newRemoteStreams.delete(from)
          return { ...prev, remoteStreams: newRemoteStreams }
        })
        break
      }
    }
  }, [createPeerConnection, roomId, sendWsMessage])

  const connectWebSocket = useCallback(() => {
    if (wsRef.current && wsRef.current.readyState === WebSocket.OPEN) {
      return
    }

    setStatePartial({ connectionState: 'connecting' })
    console.log('[WebRTC] 连接WebSocket:', getWsUrl())

    const ws = new WebSocket(getWsUrl())
    wsRef.current = ws

    ws.onopen = () => {
      console.log('[WebRTC] WebSocket连接已建立')
      sendWsMessage({ type: 'join', roomId })
    }

    ws.onmessage = (event) => {
      try {
        const message = JSON.parse(event.data)
        handleSignalingMessage(message)
      } catch (err) {
        console.error('[WebRTC] 解析信令消息失败:', err)
      }
    }

    ws.onerror = (event) => {
      console.error('[WebRTC] WebSocket错误:', event)
      setStatePartial({ error: 'WebSocket连接失败' })
    }

    ws.onclose = (event) => {
      console.log('[WebRTC] WebSocket关闭:', event.code, event.reason)
      setStatePartial({ connectionState: 'disconnected' })
      
      if (reconnectTimerRef.current) {
        clearTimeout(reconnectTimerRef.current)
      }
      reconnectTimerRef.current = window.setTimeout(() => {
        if (wsRef.current?.readyState !== WebSocket.OPEN) {
          console.log('[WebRTC] 尝试重连...')
          connectWebSocket()
        }
      }, 3000)
    }
  }, [getWsUrl(), handleSignalingMessage, sendWsMessage, setStatePartial])

  const startLocalStream = useCallback(async () => {
    try {
      console.log('[WebRTC] 获取本地媒体流...')
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          sampleRate: 48000
        },
        video: {
          width: { ideal: 1280 },
          height: { ideal: 720 },
          frameRate: { ideal: 30 },
          facingMode: 'user'
        }
      })

      console.log('[WebRTC] 本地媒体流获取成功, 音轨:', stream.getAudioTracks().length, '视频轨:', stream.getVideoTracks().length)
      
      localStreamRef.current = stream

      stream.getAudioTracks().forEach(track => {
        track.enabled = state.isAudioEnabled
      })
      stream.getVideoTracks().forEach(track => {
        track.enabled = state.isVideoEnabled
      })

      peerConnectionsRef.current.forEach(pc => {
        localSendersRef.current = []
        stream.getTracks().forEach(track => {
          try {
            const sender = pc.addTrack(track, stream)
            localSendersRef.current.push(sender)
          } catch (err) {
            console.error('[WebRTC] 添加轨道失败:', err)
          }
        })
      })

      setStatePartial({ localStream: stream })
    } catch (err: any) {
      console.error('[WebRTC] 获取本地媒体流失败:', err)
      let errorMsg = '无法访问摄像头和麦克风'
      if (err.name === 'NotAllowedError') {
        errorMsg = '您已拒绝访问摄像头和麦克风，请在浏览器设置中授权'
      } else if (err.name === 'NotFoundError') {
        errorMsg = '未检测到可用的摄像头或麦克风设备'
      } else if (err.name === 'NotReadableError') {
        errorMsg = '摄像头或麦克风被其他应用占用'
      }
      setStatePartial({ error: errorMsg })
      throw new Error(errorMsg)
    }
  }, [state.isAudioEnabled, state.isVideoEnabled, setStatePartial])

  const stopLocalStream = useCallback(() => {
    const localStream = localStreamRef.current
    if (localStream) {
      localStream.getTracks().forEach(track => {
        track.stop()
      })
      localStreamRef.current = null
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop())
      screenStreamRef.current = null
    }

    closePeerConnections()
    setStatePartial({
      localStream: null,
      isScreenSharing: false,
      connectionState: 'new'
    })
  }, [closePeerConnections, setStatePartial])

  const toggleAudio = useCallback(() => {
    const newState = !state.isAudioEnabled
    const localStream = localStreamRef.current
    
    if (localStream) {
      localStream.getAudioTracks().forEach(track => {
        track.enabled = newState
      })
    }

    sendWsMessage({
      type: 'status',
      roomId,
      audioEnabled: newState,
      videoEnabled: state.isVideoEnabled,
      screenSharing: state.isScreenSharing
    })

    setStatePartial({ isAudioEnabled: newState })
  }, [roomId, sendWsMessage, setStatePartial, state.isAudioEnabled, state.isScreenSharing, state.isVideoEnabled])

  const toggleVideo = useCallback(() => {
    const newState = !state.isVideoEnabled
    const localStream = localStreamRef.current
    
    if (localStream) {
      localStream.getVideoTracks().forEach(track => {
        track.enabled = newState
      })
    }

    sendWsMessage({
      type: 'status',
      roomId,
      audioEnabled: state.isAudioEnabled,
      videoEnabled: newState,
      screenSharing: state.isScreenSharing
    })

    setStatePartial({ isVideoEnabled: newState })
  }, [roomId, sendWsMessage, setStatePartial, state.isAudioEnabled, state.isScreenSharing, state.isVideoEnabled])

  const startScreenShare = useCallback(async () => {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: {
          cursor: 'always'
        },
        audio: true
      })

      screenStreamRef.current = screenStream
      
      const videoTrack = screenStream.getVideoTracks()[0]
      if (videoTrack) {
        localSendersRef.current.forEach(sender => {
          if (sender.track?.kind === 'video') {
            sender.replaceTrack(videoTrack)
          }
        })
      }

      screenStream.getVideoTracks()[0].onended = () => {
        stopScreenShare()
      }

      sendWsMessage({
        type: 'status',
        roomId,
        audioEnabled: state.isAudioEnabled,
        videoEnabled: state.isVideoEnabled,
        screenSharing: true
      })

      setStatePartial({ isScreenSharing: true })
    } catch (err) {
      console.error('[WebRTC] 屏幕共享失败:', err)
      setStatePartial({ error: '屏幕共享失败' })
    }
  }, [roomId, sendWsMessage, setStatePartial, state.isAudioEnabled, state.isVideoEnabled, stopScreenShare])

  const stopScreenShare = useCallback(() => {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach(track => track.stop())
      screenStreamRef.current = null
    }

    const localStream = localStreamRef.current
    if (localStream) {
      const videoTrack = localStream.getVideoTracks()[0]
      if (videoTrack) {
        localSendersRef.current.forEach(sender => {
          if (sender.track?.kind === 'video') {
            sender.replaceTrack(videoTrack)
          }
        })
      }
    }

    sendWsMessage({
      type: 'status',
      roomId,
      audioEnabled: state.isAudioEnabled,
      videoEnabled: state.isVideoEnabled,
      screenSharing: false
    })

    setStatePartial({ isScreenSharing: false })
  }, [roomId, sendWsMessage, setStatePartial, state.isAudioEnabled, state.isVideoEnabled])

  const sendChatMessage = useCallback((content: string) => {
    sendWsMessage({
      type: 'chat',
      roomId,
      content
    })
  }, [roomId, sendWsMessage])

  const joinRoom = useCallback(() => {
    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      connectWebSocket()
    } else {
      sendWsMessage({ type: 'join', roomId })
    }
  }, [connectWebSocket, roomId, sendWsMessage])

  const leaveRoom = useCallback(() => {
    sendWsMessage({ type: 'leave', roomId })
    
    if (reconnectTimerRef.current) {
      clearTimeout(reconnectTimerRef.current)
      reconnectTimerRef.current = null
    }

    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }

    stopLocalStream()
    setState(prev => {
      const newRemoteStreams = new Map(prev.remoteStreams)
      newRemoteStreams.clear()
      return { ...prev, remoteStreams: newRemoteStreams }
    })
  }, [roomId, sendWsMessage, stopLocalStream])

  useEffect(() => {
    return () => {
      leaveRoom()
    }
  }, [leaveRoom])

  return {
    ...state,
    startLocalStream,
    stopLocalStream,
    toggleAudio,
    toggleVideo,
    startScreenShare,
    stopScreenShare,
    sendChatMessage,
    joinRoom,
    leaveRoom
  }
}

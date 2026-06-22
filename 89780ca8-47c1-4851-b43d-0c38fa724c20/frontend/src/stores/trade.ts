import { defineStore } from 'pinia'
import { ref } from 'vue'

export interface OrderEntry {
  price: number
  quantity: number
  total: number
}

export interface TradeRecord {
  id: string
  price: number
  quantity: number
  side: 'buy' | 'sell'
  time: string
}

function generateOrderBook(basePrice: number) {
  const asks: OrderEntry[] = []
  const bids: OrderEntry[] = []
  for (let i = 0; i < 10; i++) {
    const askPrice = basePrice + (i + 1) * 0.05
    const bidPrice = basePrice - (i + 1) * 0.05
    const askQty = Math.round(Math.random() * 200 + 20)
    const bidQty = Math.round(Math.random() * 200 + 20)
    asks.push({ price: +askPrice.toFixed(2), quantity: askQty, total: +(askPrice * askQty).toFixed(2) })
    bids.push({ price: +bidPrice.toFixed(2), quantity: bidQty, total: +(bidPrice * bidQty).toFixed(2) })
  }
  asks.sort((a, b) => b.price - a.price)
  bids.sort((a, b) => b.price - a.price)
  return { asks, bids }
}

function generateTrades(basePrice: number): TradeRecord[] {
  const trades: TradeRecord[] = []
  for (let i = 0; i < 20; i++) {
    const side = Math.random() > 0.5 ? 'buy' : 'sell' as const
    const price = +(basePrice + (Math.random() - 0.5) * 2).toFixed(2)
    const quantity = +(Math.random() * 5 + 0.1).toFixed(2)
    const mins = Math.floor(Math.random() * 60)
    trades.push({
      id: `t-${i}`,
      price,
      quantity,
      side,
      time: `${mins}m ago`,
    })
  }
  return trades
}

export interface KLineData {
  time: string
  open: number
  close: number
  high: number
  low: number
  volume: number
}

function generateKLineData(basePrice: number): KLineData[] {
  const data: KLineData[] = []
  let price = basePrice
  for (let i = 0; i < 60; i++) {
    const change = (Math.random() - 0.48) * 1.5
    const open = price
    const close = +(price + change).toFixed(2)
    const high = +(Math.max(open, close) + Math.random() * 0.8).toFixed(2)
    const low = +(Math.min(open, close) - Math.random() * 0.8).toFixed(2)
    const volume = Math.round(Math.random() * 500 + 50)
    data.push({
      time: `${String(Math.floor(i / 4)).padStart(2, '0')}:${String((i % 4) * 15).padStart(2, '0')}`,
      open,
      close,
      high,
      low,
      volume,
    })
    price = close
  }
  return data
}

export const useTradeStore = defineStore('trade', () => {
  const currentPrice = ref(12.85)
  const orderBook = ref(generateOrderBook(currentPrice.value))
  const currentTrades = ref<TradeRecord[]>(generateTrades(currentPrice.value))
  const klineData = ref<KLineData[]>(generateKLineData(currentPrice.value))
  const klinePeriod = ref<'1m' | '5m' | '1h' | '1d'>('1h')
  const loading = ref(false)
  const wsConnected = ref(false)
  let wsTimer: ReturnType<typeof setInterval> | null = null

  function simulateUpdate() {
    const change = (Math.random() - 0.48) * 0.3
    currentPrice.value = +(currentPrice.value + change).toFixed(2)
    orderBook.value = generateOrderBook(currentPrice.value)

    const newTrade: TradeRecord = {
      id: `t-${Date.now()}`,
      price: currentPrice.value,
      quantity: +(Math.random() * 3 + 0.1).toFixed(2),
      side: Math.random() > 0.5 ? 'buy' : 'sell',
      time: 'just now',
    }
    currentTrades.value = [newTrade, ...currentTrades.value.slice(0, 19)]

    const last = klineData.value[klineData.value.length - 1]
    if (last) {
      last.close = currentPrice.value
      last.high = Math.max(last.high, currentPrice.value)
      last.low = Math.min(last.low, currentPrice.value)
      last.volume += Math.round(Math.random() * 20)
    }
  }

  function connectWebSocket() {
    if (wsConnected.value) return
    wsConnected.value = true
    wsTimer = setInterval(simulateUpdate, 2000)
  }

  function disconnectWebSocket() {
    if (wsTimer) {
      clearInterval(wsTimer)
      wsTimer = null
    }
    wsConnected.value = false
  }

  async function placeOrder(side: 'buy' | 'sell', type: 'limit' | 'market', price: number, quantity: number) {
    loading.value = true
    try {
      await new Promise(r => setTimeout(r, 500))
      const order = { side, type, price: type === 'market' ? currentPrice.value : price, quantity }
      console.log('Order placed:', order)
      simulateUpdate()
      return { success: true, orderId: `ORD-${Date.now()}` }
    } finally {
      loading.value = false
    }
  }

  function setKlinePeriod(period: '1m' | '5m' | '1h' | '1d') {
    klinePeriod.value = period
    klineData.value = generateKLineData(currentPrice.value)
  }

  function setCurrentPrice(price: number) {
    currentPrice.value = price
    orderBook.value = generateOrderBook(price)
    currentTrades.value = generateTrades(price)
    klineData.value = generateKLineData(price)
  }

  return {
    currentPrice,
    orderBook,
    currentTrades,
    klineData,
    klinePeriod,
    loading,
    wsConnected,
    connectWebSocket,
    disconnectWebSocket,
    placeOrder,
    setKlinePeriod,
    setCurrentPrice,
  }
})

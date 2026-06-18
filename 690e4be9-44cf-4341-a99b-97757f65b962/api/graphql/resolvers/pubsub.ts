import { EventEmitter } from 'events'

export class PubSub {
  private emitter: EventEmitter
  private subs: Map<string, Set<AsyncIterator<unknown>>>

  constructor() {
    this.emitter = new EventEmitter()
    this.emitter.setMaxListeners(0)
    this.subs = new Map()
  }

  publish(triggerName: string, payload: unknown): void {
    this.emitter.emit(triggerName, payload)
  }

  subscribe(triggerName: string): AsyncIterator<unknown> {
    const listeners = this.subs.get(triggerName) || new Set()
    const listener = (_: unknown, value: unknown): void => {}

    const iterator = new PubSubAsyncIterator(this.emitter, triggerName)
    listeners.add(iterator)
    this.subs.set(triggerName, listeners)

    return iterator
  }

  asyncIterator(triggerName: string): AsyncIterableIterator<unknown> {
    return this.subscribe(triggerName) as AsyncIterableIterator<unknown>
  }
}

class PubSubAsyncIterator implements AsyncIterableIterator<unknown> {
  private emitter: EventEmitter
  private triggerName: string
  private pullQueue: Array<{ resolve: (value: IteratorResult<unknown>) => void; reject: (error: Error) => void }>
  private pushQueue: unknown[]
  private listening: boolean
  private listener: ((payload: unknown) => void) | null

  constructor(emitter: EventEmitter, triggerName: string) {
    this.emitter = emitter
    this.triggerName = triggerName
    this.pullQueue = []
    this.pushQueue = []
    this.listening = true
    this.listener = this.pushValue.bind(this)
    this.emitter.on(triggerName, this.listener)
  }

  [Symbol.asyncIterator](): AsyncIterableIterator<unknown> {
    return this
  }

  async next(): Promise<IteratorResult<unknown>> {
    if (!this.listening) {
      return { value: undefined, done: true }
    }

    if (this.pushQueue.length > 0) {
      return { value: this.pushQueue.shift(), done: false }
    }

    return new Promise<IteratorResult<unknown>>((resolve, reject) => {
      this.pullQueue.push({ resolve, reject })
    })
  }

  async return(): Promise<IteratorResult<unknown>> {
    this.listening = false
    if (this.listener) {
      this.emitter.off(this.triggerName, this.listener)
      this.listener = null
    }
    for (const { resolve } of this.pullQueue) {
      resolve({ value: undefined, done: true })
    }
    this.pullQueue = []
    return { value: undefined, done: true }
  }

  async throw(error: Error): Promise<IteratorResult<unknown>> {
    this.listening = false
    if (this.listener) {
      this.emitter.off(this.triggerName, this.listener)
      this.listener = null
    }
    for (const { reject } of this.pullQueue) {
      reject(error)
    }
    this.pullQueue = []
    throw error
  }

  private pushValue(payload: unknown): void {
    if (this.pullQueue.length > 0) {
      const { resolve } = this.pullQueue.shift()!
      resolve({ value: payload, done: false })
    } else {
      this.pushQueue.push(payload)
    }
  }
}

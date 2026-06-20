import { TaskPriority } from './types';
import logger from './logger';

interface PriorityTask<T = any> {
  id: string;
  priority: TaskPriority;
  fn: () => Promise<T>;
  createdAt: number;
  resolve: (value: T) => void;
  reject: (reason?: any) => void;
}

const PRIORITY_WEIGHT: Record<TaskPriority, number> = {
  high: 0,
  medium: 1,
  low: 2,
};

export class PriorityQueue {
  private queue: PriorityTask[] = [];
  private runningCount: number = 0;
  private concurrency: number;
  private taskCounter: number = 0;
  private isPaused: boolean = false;

  constructor(concurrency: number = 4) {
    this.concurrency = concurrency;
  }

  get size(): number {
    return this.queue.length;
  }

  get pending(): number {
    return this.runningCount;
  }

  public setConcurrency(concurrency: number): void {
    this.concurrency = concurrency;
    this.processQueue();
  }

  public getConcurrency(): number {
    return this.concurrency;
  }

  public add<T>(fn: () => Promise<T>, priority: TaskPriority = 'medium'): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      const task: PriorityTask = {
        id: `task-${++this.taskCounter}`,
        priority,
        fn,
        createdAt: Date.now(),
        resolve: resolve as any,
        reject: reject as any,
      };

      this.queue.push(task);
      this.sortQueue();
      this.processQueue();
    });
  }

  private sortQueue(): void {
    this.queue.sort((a, b) => {
      const weightDiff = PRIORITY_WEIGHT[a.priority] - PRIORITY_WEIGHT[b.priority];
      if (weightDiff !== 0) return weightDiff;
      return a.createdAt - b.createdAt;
    });
  }

  private processQueue(): void {
    if (this.isPaused) return;
    if (this.runningCount >= this.concurrency) return;
    if (this.queue.length === 0) return;

    const task = this.queue.shift();
    if (!task) return;

    this.runningCount++;
    this.runTask(task);
  }

  private async runTask(task: PriorityTask): Promise<void> {
    try {
      const result = await task.fn();
      task.resolve(result);
    } catch (error) {
      task.reject(error);
    } finally {
      this.runningCount--;
      this.processQueue();
    }
  }

  public addAll<T>(fns: (() => Promise<T>)[], priority: TaskPriority = 'medium'): Promise<T[]> {
    const promises = fns.map(fn => this.add(fn, priority));
    return Promise.all(promises);
  }

  public pause(): void {
    this.isPaused = true;
    logger.debug('优先级队列已暂停');
  }

  public start(): void {
    this.isPaused = false;
    logger.debug('优先级队列已启动');
    this.processQueue();
  }

  public clear(): void {
    this.queue = [];
    logger.debug('优先级队列已清空');
  }

  public async onIdle(): Promise<void> {
    if (this.runningCount === 0 && this.queue.length === 0) {
      return;
    }

    return new Promise<void>(resolve => {
      const checkIdle = setInterval(() => {
        if (this.runningCount === 0 && this.queue.length === 0) {
          clearInterval(checkIdle);
          resolve();
        }
      }, 100);
    });
  }

  public getQueueStats(): { size: number; pending: number; concurrency: number; highPriority: number; mediumPriority: number; lowPriority: number } {
    const highPriority = this.queue.filter(t => t.priority === 'high').length;
    const mediumPriority = this.queue.filter(t => t.priority === 'medium').length;
    const lowPriority = this.queue.filter(t => t.priority === 'low').length;

    return {
      size: this.queue.length,
      pending: this.runningCount,
      concurrency: this.concurrency,
      highPriority,
      mediumPriority,
      lowPriority,
    };
  }
}

export default PriorityQueue;

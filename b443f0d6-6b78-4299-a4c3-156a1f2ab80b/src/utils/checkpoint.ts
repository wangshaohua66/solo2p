import * as fs from 'fs';
import * as path from 'path';
import logger from './logger';
import { generateId, sanitizeFileName } from './helpers';

export interface CheckpointData {
  taskId: string;
  taskType: 'quote' | 'policy' | 'renewal';
  status: 'pending' | 'in-progress' | 'completed' | 'failed';
  progress: {
    total: number;
    current: number;
    completedItems: string[];
    failedItems: string[];
  };
  data: Record<string, any>;
  createdAt: string;
  updatedAt: string;
}

export class CheckpointManager {
  private static instance: CheckpointManager;
  private checkpointDir: string;
  private checkpoints: Map<string, CheckpointData> = new Map();
  private autoSaveInterval: NodeJS.Timeout | null = null;

  private constructor() {
    this.checkpointDir = path.join(process.cwd(), process.env.CHECKPOINT_DIR || '.checkpoints');
    this.ensureCheckpointDir();
    this.loadAllCheckpoints();
    this.startAutoSave();
  }

  public static getInstance(): CheckpointManager {
    if (!CheckpointManager.instance) {
      CheckpointManager.instance = new CheckpointManager();
    }
    return CheckpointManager.instance;
  }

  private ensureCheckpointDir(): void {
    if (!fs.existsSync(this.checkpointDir)) {
      fs.mkdirSync(this.checkpointDir, { recursive: true });
      logger.info(`创建检查点目录: ${this.checkpointDir}`);
    }
  }

  private loadAllCheckpoints(): void {
    try {
      if (!fs.existsSync(this.checkpointDir)) return;

      const files = fs.readdirSync(this.checkpointDir).filter(f => f.endsWith('.json'));
      for (const file of files) {
        try {
          const filePath = path.join(this.checkpointDir, file);
          const content = fs.readFileSync(filePath, 'utf-8');
          const data = JSON.parse(content) as CheckpointData;
          this.checkpoints.set(data.taskId, data);
        } catch (error) {
          logger.warn(`加载检查点文件失败: ${file}`, { error: (error as Error).message });
        }
      }
      logger.info(`已加载 ${this.checkpoints.size} 个检查点`);
    } catch (error) {
      logger.error('加载检查点失败', { error: (error as Error).message });
    }
  }

  private startAutoSave(): void {
    const interval = parseInt(process.env.CHECKPOINT_AUTO_SAVE_INTERVAL || '30000', 10);
    this.autoSaveInterval = setInterval(() => {
      this.saveAllCheckpoints().catch(error => {
        logger.error('自动保存检查点失败', { error: error.message });
      });
    }, interval);
  }

  public async saveAllCheckpoints(): Promise<void> {
    for (const [taskId, checkpoint] of this.checkpoints.entries()) {
      await this.saveCheckpointToFile(taskId, checkpoint);
    }
  }

  private async saveCheckpointToFile(taskId: string, checkpoint: CheckpointData): Promise<void> {
    try {
      const fileName = `${sanitizeFileName(taskId)}.json`;
      const filePath = path.join(this.checkpointDir, fileName);
      const tempPath = `${filePath}.tmp`;
      
      checkpoint.updatedAt = new Date().toISOString();
      fs.writeFileSync(tempPath, JSON.stringify(checkpoint, null, 2));
      fs.renameSync(tempPath, filePath);
    } catch (error) {
      logger.error(`保存检查点失败: ${taskId}`, { error: (error as Error).message });
    }
  }

  public createCheckpoint(
    taskType: 'quote' | 'policy' | 'renewal',
    total: number,
    data: Record<string, any> = {}
  ): CheckpointData {
    const taskId = generateId();
    return this.createCheckpointWithId(taskId, taskType, total, data);
  }

  public createCheckpointWithId(
    taskId: string,
    taskType: 'quote' | 'policy' | 'renewal',
    total: number,
    data: Record<string, any> = {}
  ): CheckpointData {
    const existing = this.checkpoints.get(taskId);
    if (existing) {
      logger.debug(`检查点已存在，复用: ${taskId}`);
      return existing;
    }
    const checkpoint: CheckpointData = {
      taskId,
      taskType,
      status: 'pending',
      progress: {
        total,
        current: 0,
        completedItems: [],
        failedItems: [],
      },
      data,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.checkpoints.set(taskId, checkpoint);
    this.saveCheckpointToFile(taskId, checkpoint);
    logger.debug(`创建检查点: ${taskId} (${taskType})`);
    return checkpoint;
  }

  public getCheckpoint(taskId: string): CheckpointData | undefined {
    return this.checkpoints.get(taskId);
  }

  public getCheckpointsByType(taskType: 'quote' | 'policy' | 'renewal'): CheckpointData[] {
    return Array.from(this.checkpoints.values()).filter(c => c.taskType === taskType);
  }

  public getIncompleteCheckpoints(): CheckpointData[] {
    return Array.from(this.checkpoints.values()).filter(
      c => c.status === 'pending' || c.status === 'in-progress'
    );
  }

  public updateProgress(taskId: string, itemId: string, success: boolean): void {
    const checkpoint = this.checkpoints.get(taskId);
    if (!checkpoint) return;

    checkpoint.progress.current++;
    if (success) {
      checkpoint.progress.completedItems.push(itemId);
    } else {
      checkpoint.progress.failedItems.push(itemId);
    }

    if (checkpoint.progress.current >= checkpoint.progress.total) {
      checkpoint.status = checkpoint.progress.failedItems.length === 0 ? 'completed' : 'failed';
    } else {
      checkpoint.status = 'in-progress';
    }

    this.saveCheckpointToFile(taskId, checkpoint);
  }

  public setStatus(taskId: string, status: CheckpointData['status']): void {
    const checkpoint = this.checkpoints.get(taskId);
    if (checkpoint) {
      checkpoint.status = status;
      this.saveCheckpointToFile(taskId, checkpoint);
    }
  }

  public setData(taskId: string, data: Record<string, any>): void {
    const checkpoint = this.checkpoints.get(taskId);
    if (checkpoint) {
      checkpoint.data = { ...checkpoint.data, ...data };
      this.saveCheckpointToFile(taskId, checkpoint);
    }
  }

  public isItemCompleted(taskId: string, itemId: string): boolean {
    const checkpoint = this.checkpoints.get(taskId);
    return checkpoint ? checkpoint.progress.completedItems.includes(itemId) : false;
  }

  public removeCheckpoint(taskId: string): void {
    this.checkpoints.delete(taskId);
    try {
      const fileName = `${sanitizeFileName(taskId)}.json`;
      const filePath = path.join(this.checkpointDir, fileName);
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    } catch (error) {
      logger.warn(`删除检查点文件失败: ${taskId}`, { error: (error as Error).message });
    }
  }

  public cleanupOldCheckpoints(maxAgeDays: number = 7): number {
    const now = Date.now();
    const maxAgeMs = maxAgeDays * 24 * 60 * 60 * 1000;
    let removed = 0;

    for (const [taskId, checkpoint] of this.checkpoints.entries()) {
      const age = now - new Date(checkpoint.updatedAt).getTime();
      if (age > maxAgeMs) {
        this.removeCheckpoint(taskId);
        removed++;
      }
    }

    logger.info(`清理过期检查点: 移除 ${removed} 个`);
    return removed;
  }

  public async shutdown(): Promise<void> {
    if (this.autoSaveInterval) {
      clearInterval(this.autoSaveInterval);
      this.autoSaveInterval = null;
    }
    await this.saveAllCheckpoints();
    logger.info('检查点管理器已关闭');
  }
}

export default CheckpointManager;

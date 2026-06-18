import Dexie, { Table } from 'dexie';
import type { AudioRecording, TimelineProject, TimelineClip, OperationLog } from '@/types';

export class SoundScapeDB extends Dexie {
  audioRecordings!: Table<AudioRecording>;
  timelineProjects!: Table<TimelineProject>;
  timelineClips!: Table<TimelineClip>;
  operationLogs!: Table<OperationLog>;

  constructor() {
    super('SoundScapeArchive');
    this.version(1).stores({
      audioRecordings:
        '&id, title, timePeriod, sceneCategory, weatherCondition, administrativeDistrict, recordingDevice, lineName, recordedAt, createdAt, duration, fileSize, [administrativeDistrict+timePeriod], [lineName+recordedAt]',
      timelineProjects: '&id, name, createdAt, updatedAt',
      timelineClips: '&id, projectId, audioId, trackIndex, startTime',
      operationLogs: '&id, actionType, entityType, entityId, timestamp',
    });
  }
}

export const db = new SoundScapeDB();

export const initializeDB = async (): Promise<void> => {
  try {
    await db.open();
    console.debug('Database initialized successfully');
  } catch (error) {
    console.error('Failed to initialize database:', error);
    throw error;
  }
};

export const clearAllData = async (): Promise<void> => {
  await db.transaction('rw', db.audioRecordings, db.timelineProjects, db.timelineClips, db.operationLogs, async () => {
    await db.audioRecordings.clear();
    await db.timelineProjects.clear();
    await db.timelineClips.clear();
    await db.operationLogs.clear();
  });
};

export const exportAllData = async (): Promise<Record<string, unknown>> => {
  const [audioRecordings, timelineProjects, timelineClips, operationLogs] = await Promise.all([
    db.audioRecordings.toArray(),
    db.timelineProjects.toArray(),
    db.timelineClips.toArray(),
    db.operationLogs.toArray(),
  ]);

  return {
    version: 1,
    exportedAt: new Date().toISOString(),
    data: {
      audioRecordings,
      timelineProjects,
      timelineClips,
      operationLogs,
    },
  };
};

export const importAllData = async (data: Record<string, unknown>): Promise<void> => {
  if (!data || typeof data !== 'object' || !('data' in data)) {
    throw new Error('Invalid import data format');
  }

  const importData = data.data as Record<string, unknown[]>;

  await db.transaction(
    'rw',
    db.audioRecordings,
    db.timelineProjects,
    db.timelineClips,
    db.operationLogs,
    async () => {
      if (importData.audioRecordings) {
        await db.audioRecordings.bulkPut(importData.audioRecordings as AudioRecording[]);
      }
      if (importData.timelineProjects) {
        await db.timelineProjects.bulkPut(importData.timelineProjects as TimelineProject[]);
      }
      if (importData.timelineClips) {
        await db.timelineClips.bulkPut(importData.timelineClips as TimelineClip[]);
      }
      if (importData.operationLogs) {
        await db.operationLogs.bulkPut(importData.operationLogs as OperationLog[]);
      }
    },
  );
};

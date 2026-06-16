import Dexie, { Table } from 'dexie';
import type {
  Project,
  Scene,
  Shot,
  Dialogue,
  SfxTag,
  ReferenceImage,
} from '@/types';

export class StoryboardDB extends Dexie {
  projects!: Table<Project, string>;
  scenes!: Table<Scene, string>;
  shots!: Table<Shot, string>;
  dialogues!: Table<Dialogue, string>;
  sfxTags!: Table<SfxTag, string>;
  referenceImages!: Table<ReferenceImage, string>;

  constructor() {
    super('storyboard-db');
    this.version(1).stores({
      projects: '&id, name, createdAt, updatedAt',
      scenes: '&id, projectId, order',
      shots: '&id, sceneId, projectId, order, updatedAt',
      dialogues: '&id, shotId, order',
      sfxTags: '&id, shotId, type',
      referenceImages: '&id, projectId',
    });
  }
}

export const db = new StoryboardDB();

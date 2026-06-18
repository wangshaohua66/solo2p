import { db } from '../dexie';
import type { TimelineProject, TimelineClip } from '@/types';
import type { TimelineProjectInput, TimelineClipInput } from '../schemas';
import { v4 as uuidv4 } from 'uuid';

export const createTimelineProject = async (
  input: TimelineProjectInput,
): Promise<TimelineProject> => {
  const now = new Date().toISOString();
  const project: TimelineProject = {
    ...input,
    id: uuidv4(),
    createdAt: now,
    updatedAt: now,
  };

  await db.timelineProjects.add(project);
  return project;
};

export const getTimelineProject = async (id: string): Promise<TimelineProject | undefined> => {
  return db.timelineProjects.get(id);
};

export const updateTimelineProject = async (
  id: string,
  updates: Partial<TimelineProject>,
): Promise<TimelineProject | undefined> => {
  const project = await db.timelineProjects.get(id);
  if (!project) return undefined;

  const updated: TimelineProject = {
    ...project,
    ...updates,
    id,
    updatedAt: new Date().toISOString(),
  };

  await db.timelineProjects.update(id, updated);
  return updated;
};

export const deleteTimelineProject = async (id: string): Promise<void> => {
  await db.transaction('rw', db.timelineProjects, db.timelineClips, async () => {
    await db.timelineClips.where('projectId').equals(id).delete();
    await db.timelineProjects.delete(id);
  });
};

export const listTimelineProjects = async (): Promise<TimelineProject[]> => {
  return db.timelineProjects.orderBy('updatedAt').reverse().toArray();
};

export const createTimelineClip = async (input: TimelineClipInput): Promise<TimelineClip> => {
  const clip: TimelineClip = {
    ...input,
    id: uuidv4(),
  };

  await db.timelineClips.add(clip);

  await updateProjectDuration(input.projectId);

  return clip;
};

export const getTimelineClips = async (projectId: string): Promise<TimelineClip[]> => {
  return db.timelineClips.where('projectId').equals(projectId).sortBy('startTime');
};

export const updateTimelineClip = async (
  id: string,
  updates: Partial<TimelineClip>,
): Promise<TimelineClip | undefined> => {
  const clip = await db.timelineClips.get(id);
  if (!clip) return undefined;

  const updated: TimelineClip = {
    ...clip,
    ...updates,
    id,
  };

  await db.timelineClips.update(id, updated);

  if (updated.projectId) {
    await updateProjectDuration(updated.projectId);
  }

  return updated;
};

export const deleteTimelineClip = async (id: string): Promise<void> => {
  const clip = await db.timelineClips.get(id);
  const projectId = clip?.projectId;

  await db.timelineClips.delete(id);

  if (projectId) {
    await updateProjectDuration(projectId);
  }
};

export const batchCreateTimelineClips = async (
  inputs: TimelineClipInput[],
): Promise<TimelineClip[]> => {
  if (inputs.length === 0) return [];

  const clips: TimelineClip[] = inputs.map((input) => ({
    ...input,
    id: uuidv4(),
  }));

  await db.timelineClips.bulkAdd(clips);

  if (inputs[0]?.projectId) {
    await updateProjectDuration(inputs[0].projectId);
  }

  return clips;
};

const updateProjectDuration = async (projectId: string): Promise<void> => {
  const clips = await db.timelineClips.where('projectId').equals(projectId).toArray();
  const totalDuration = clips.reduce((max, clip) => Math.max(max, clip.endTime), 0);

  await db.timelineProjects.update(projectId, {
    totalDuration,
    updatedAt: new Date().toISOString(),
  });
};

export const duplicateTimelineProject = async (
  projectId: string,
  newName: string,
): Promise<TimelineProject | undefined> => {
  const project = await getTimelineProject(projectId);
  if (!project) return undefined;

  const clips = await getTimelineClips(projectId);

  return db.transaction('rw', db.timelineProjects, db.timelineClips, async () => {
    const newProject = await createTimelineProject({
      name: newName,
      description: project.description,
      totalDuration: project.totalDuration,
    });

    const newClips = clips.map((clip) => ({
      ...clip,
      projectId: newProject.id,
      id: uuidv4(),
    }));

    await db.timelineClips.bulkAdd(newClips);

    return newProject;
  });
};

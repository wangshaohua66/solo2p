import { AppState } from '@/types';

const STORAGE_KEY = 'archaeology_excavation_system';
const MAX_SIZE = 5 * 1024 * 1024;

export const saveToStorage = (state: Partial<AppState>): boolean => {
  try {
    const existing = loadFromStorage();
    const data = { ...existing, ...state };
    const serialized = JSON.stringify(data);
    
    if (new Blob([serialized]).size > MAX_SIZE) {
      console.warn('Storage size exceeds 5MB limit');
      return false;
    }
    
    localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (error) {
    console.error('Failed to save to localStorage:', error);
    return false;
  }
};

export const loadFromStorage = (): Partial<AppState> => {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) return {};
    
    const data = JSON.parse(serialized);
    return data as Partial<AppState>;
  } catch (error) {
    console.error('Failed to load from localStorage:', error);
    return {};
  }
};

export const clearStorage = (): boolean => {
  try {
    localStorage.removeItem(STORAGE_KEY);
    return true;
  } catch (error) {
    console.error('Failed to clear localStorage:', error);
    return false;
  }
};

export const exportData = (): string => {
  const data = loadFromStorage();
  return JSON.stringify(data, null, 2);
};

export const importData = (jsonString: string): boolean => {
  try {
    const data = JSON.parse(jsonString) as Partial<AppState>;
    
    const requiredKeys = ['sites', 'grids', 'strata', 'artifacts', 'users'];
    const isValid = requiredKeys.some(key => key in data);
    
    if (!isValid) {
      throw new Error('Invalid data format');
    }
    
    const serialized = JSON.stringify(data);
    if (new Blob([serialized]).size > MAX_SIZE) {
      throw new Error('Data size exceeds 5MB limit');
    }
    
    localStorage.setItem(STORAGE_KEY, serialized);
    return true;
  } catch (error) {
    console.error('Failed to import data:', error);
    return false;
  }
};

export const checkStorageSize = (): { used: number; total: number; percentage: number } => {
  const used = getStorageSize();
  const total = 5;
  return {
    used,
    total,
    percentage: Math.round((used / total) * 100),
  };
};

export const getStorageSize = (): number => {
  try {
    const serialized = localStorage.getItem(STORAGE_KEY);
    if (!serialized) return 0;
    return new Blob([serialized]).size;
  } catch {
    return 0;
  }
};

export const getStorageSizeFormatted = (): string => {
  const bytes = getStorageSize();
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(2)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
};

export const downloadExport = (): void => {
  const data = exportData();
  const blob = new Blob([data], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = `archaeology_data_${new Date().toISOString().split('T')[0]}.json`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

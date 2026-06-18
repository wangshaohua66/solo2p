let rootDirectory: FileSystemDirectoryHandle | null = null;

export const initializeOPFS = async (): Promise<void> => {
  if (!('storage' in navigator) || !('getDirectory' in navigator.storage)) {
    throw new Error('OPFS is not supported in this browser');
  }

  try {
    rootDirectory = await navigator.storage.getDirectory();
    console.debug('OPFS initialized successfully');
  } catch (error) {
    console.error('Failed to initialize OPFS:', error);
    throw error;
  }
};

const getRoot = (): FileSystemDirectoryHandle => {
  if (!rootDirectory) {
    throw new Error('OPFS not initialized. Call initializeOPFS() first.');
  }
  return rootDirectory;
};

const getDirectoryHandle = async (
  path: string,
  create: boolean = true,
): Promise<FileSystemDirectoryHandle> => {
  const root = getRoot();
  const parts = path.split('/').filter(Boolean);
  let current = root;

  for (const part of parts) {
    current = await current.getDirectoryHandle(part, { create });
  }

  return current;
};

export const writeFile = async (
  filePath: string,
  data: File | Blob | ArrayBuffer | string,
  onProgress?: (progress: number) => void,
): Promise<string> => {
  try {
    const parts = filePath.split('/');
    const fileName = parts.pop()!;
    const dirPath = parts.join('/');

    const dirHandle = await getDirectoryHandle(dirPath, true);
    const fileHandle = await dirHandle.getFileHandle(fileName, { create: true });

    const writable = await fileHandle.createWritable();

    if (data instanceof File || data instanceof Blob) {
      const totalSize = data.size;
      const chunkSize = 1024 * 1024;
      let uploaded = 0;

      for (let start = 0; start < totalSize; start += chunkSize) {
        const chunk = data.slice(start, Math.min(start + chunkSize, totalSize));
        await writable.write(chunk);
        uploaded += chunk.size;
        if (onProgress) {
          onProgress(Math.min(uploaded / totalSize, 1));
        }
      }
    } else if (data instanceof ArrayBuffer) {
      await writable.write(data);
      if (onProgress) onProgress(1);
    } else if (typeof data === 'string') {
      await writable.write(data);
      if (onProgress) onProgress(1);
    }

    await writable.close();
    return filePath;
  } catch (error) {
    console.error(`Failed to write file ${filePath}:`, error);
    throw error;
  }
};

export const readFile = async (filePath: string): Promise<File> => {
  try {
    const parts = filePath.split('/');
    const fileName = parts.pop()!;
    const dirPath = parts.join('/');

    const dirHandle = await getDirectoryHandle(dirPath, false);
    const fileHandle = await dirHandle.getFileHandle(fileName);

    return fileHandle.getFile();
  } catch (error) {
    console.error(`Failed to read file ${filePath}:`, error);
    throw error;
  }
};

export const readFileAsArrayBuffer = async (filePath: string): Promise<ArrayBuffer> => {
  const file = await readFile(filePath);
  return file.arrayBuffer();
};

export const readFileAsDataURL = async (filePath: string): Promise<string> => {
  const file = await readFile(filePath);
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
};

export const deleteFile = async (filePath: string): Promise<void> => {
  try {
    const parts = filePath.split('/');
    const fileName = parts.pop()!;
    const dirPath = parts.join('/');

    const dirHandle = await getDirectoryHandle(dirPath, false);
    await dirHandle.removeEntry(fileName);
  } catch (error) {
    console.error(`Failed to delete file ${filePath}:`, error);
    throw error;
  }
};

export const fileExists = async (filePath: string): Promise<boolean> => {
  try {
    const parts = filePath.split('/');
    const fileName = parts.pop()!;
    const dirPath = parts.join('/');

    const dirHandle = await getDirectoryHandle(dirPath, false);
    await dirHandle.getFileHandle(fileName);
    return true;
  } catch {
    return false;
  }
};

export const getFileSize = async (filePath: string): Promise<number> => {
  const file = await readFile(filePath);
  return file.size;
};

export const listFiles = async (dirPath: string): Promise<string[]> => {
  try {
    const dirHandle = await getDirectoryHandle(dirPath, false);
    const files: string[] = [];

    for await (const entry of dirHandle.values()) {
      if (entry.kind === 'file') {
        files.push(`${dirPath}/${entry.name}`);
      } else if (entry.kind === 'directory') {
        const subFiles = await listFiles(`${dirPath}/${entry.name}`);
        files.push(...subFiles);
      }
    }

    return files;
  } catch (error) {
    console.error(`Failed to list files in ${dirPath}:`, error);
    throw error;
  }
};

export const getStorageUsage = async (): Promise<{ used: number; quota: number }> => {
  if (!('storage' in navigator) || !('estimate' in navigator.storage)) {
    return { used: 0, quota: 0 };
  }

  const estimate = await navigator.storage.estimate();
  return {
    used: estimate.usage || 0,
    quota: estimate.quota || 0,
  };
};

export const requestStoragePermission = async (): Promise<boolean> => {
  if (!('storage' in navigator) || !('persisted' in navigator.storage)) {
    return false;
  }

  try {
    const persisted = await navigator.storage.persisted();
    if (persisted) return true;

    return navigator.storage.persist();
  } catch {
    return false;
  }
};

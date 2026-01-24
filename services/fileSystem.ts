import { Candidate, CandidateStatus } from '../types';

/**
 * Browser File System Access API Helper
 */

let rootHandle: FileSystemDirectoryHandle | null = null;
let resumesHandle: FileSystemDirectoryHandle | null = null;
let dbHandle: FileSystemFileHandle | null = null;

// Fallback state for iframe/restricted environments
let isMockMode = false;
const MOCK_DB_KEY = 'talentos_mock_db';
const mockFiles = new Map<string, File>();

export const getRootHandle = () => rootHandle;

/**
 * Request directory access from the user.
 * This MUST be called from a user gesture event handler.
 */
export const requestDirectoryAccess = async (): Promise<boolean> => {
  try {
    // Feature detection
    if (!('showDirectoryPicker' in window)) {
        console.warn("File System Access API not supported in this browser. Switching to Mock mode.");
        isMockMode = true;
        await initializeProjectStructure();
        return true;
    }

    rootHandle = await (window as any).showDirectoryPicker({
      mode: 'readwrite',
      id: 'talentos-root', // Helps browser remember the handle ID
    });
    
    isMockMode = false;
    await initializeProjectStructure();
    return true;
  } catch (error: any) {
    // Handle iframe restriction or security error by falling back to mock mode
    if (error.name === 'SecurityError' || (error.message && error.message.includes('Cross origin sub frames'))) {
       console.warn("File System Access API blocked (likely running in iframe). Switching to Mock/InMemory mode.");
       isMockMode = true;
       await initializeProjectStructure();
       return true;
    }
    
    console.error("Error accessing directory:", error);
    // User cancelled
    if (error.name === 'AbortError') return false;
    
    return false;
  }
};

/**
 * Create necessary files and folders if they don't exist.
 */
const initializeProjectStructure = async () => {
  if (isMockMode) {
    // Initialize mock DB in localStorage if needed
    if (!localStorage.getItem(MOCK_DB_KEY)) {
      localStorage.setItem(MOCK_DB_KEY, JSON.stringify([]));
    }
    return;
  }

  if (!rootHandle) throw new Error("Root handle not initialized");

  // 1. Create or Get /resumes directory
  resumesHandle = await rootHandle.getDirectoryHandle('resumes', { create: true });

  // 2. Create or Get db.json
  try {
    dbHandle = await rootHandle.getFileHandle('db.json', { create: true });
    
    // Check if empty, if so, init with empty array
    const file = await dbHandle.getFile();
    if (file.size === 0) {
      const writable = await dbHandle.createWritable();
      await writable.write(JSON.stringify([]));
      await writable.close();
    }
  } catch (e) {
    console.error("Error initializing DB:", e);
  }
};

/**
 * Migration Utility
 * Ensures that any data loaded from JSON matches the current Candidate interface.
 * Fills in default values for missing fields from older versions.
 */
const ensureSchemaCompatibility = (rawData: any[]): Candidate[] => {
  if (!Array.isArray(rawData)) return [];

  return rawData.map((item) => ({
    id: item.id || crypto.randomUUID(),
    name: item.name || 'Unknown',
    gender: item.gender || '未知',
    age: item.age || '未知',
    education: item.education || '未知',
    yearsOfExperience: item.yearsOfExperience || '0个月',
    positionExperience: item.positionExperience || '',
    currentCompany: item.currentCompany || '',
    
    // Handle rename 'role' -> 'recentRole' if legacy data exists
    recentRole: item.recentRole || item.role || '候选人', 
    
    location: item.location || '',
    factoryExperience: item.factoryExperience || '',
    contact: item.contact || '',
    
    // Migration: New fields added in later versions
    intent: item.intent || '未知',
    isEmployed: item.isEmployed || '未知',
    source: item.source || '',
    notes: item.notes || '',
    aiPersona: item.aiPersona || '',
    aiTags: Array.isArray(item.aiTags) ? item.aiTags : [],

    status: item.status || CandidateStatus.NEW,
    dateAdded: item.dateAdded || new Date().toLocaleString('zh-CN'),
    lastModified: item.lastModified || item.dateAdded || new Date().toLocaleString('zh-CN'),
    fileName: item.fileName || '',
    tags: Array.isArray(item.tags) ? item.tags : []
  }));
};

/**
 * Read the entire candidate database.
 */
export const readDatabase = async (): Promise<Candidate[]> => {
  let rawData: any[] = [];

  if (isMockMode) {
    const data = localStorage.getItem(MOCK_DB_KEY);
    rawData = data ? JSON.parse(data) : [];
  } else {
    if (!dbHandle) throw new Error("DB handle missing");
    const file = await dbHandle.getFile();
    const text = await file.text();
    try {
      rawData = JSON.parse(text);
    } catch (e) {
      rawData = [];
    }
  }

  // Apply migration logic before returning to the app
  return ensureSchemaCompatibility(rawData);
};

/**
 * Write to the candidate database.
 */
export const writeDatabase = async (data: Candidate[]): Promise<void> => {
  if (isMockMode) {
    localStorage.setItem(MOCK_DB_KEY, JSON.stringify(data));
    return;
  }

  if (!dbHandle) throw new Error("DB handle missing");
  
  // Create a writable stream to the file.
  const writable = await dbHandle.createWritable();
  await writable.write(JSON.stringify(data, null, 2));
  await writable.close();
};

/**
 * Save a resume file to the /resumes folder.
 * Returns the final filename used (handling duplicates potentially).
 */
export const saveResumeFile = async (file: File, newName: string): Promise<string> => {
  if (isMockMode) {
    const ext = file.name.split('.').pop() || '';
    let finalName = `${newName}.${ext}`;
    // Simple conflict resolution
    if (mockFiles.has(finalName)) {
        finalName = `${newName}_${Date.now()}.${ext}`;
    }
    mockFiles.set(finalName, file);
    return finalName;
  }

  if (!resumesHandle) throw new Error("Resumes directory missing");

  // Determine extension
  const ext = file.name.split('.').pop() || '';
  let finalName = `${newName}.${ext}`;
  
  // Basic conflict resolution (append timestamp if exists)
  try {
    await resumesHandle.getFileHandle(finalName);
    // If we are here, file exists. Append timestamp.
    finalName = `${newName}_${Date.now()}.${ext}`;
  } catch (e) {
    // File doesn't exist, proceed.
  }

  const fileHandle = await resumesHandle.getFileHandle(finalName, { create: true });
  const writable = await fileHandle.createWritable();
  await writable.write(file);
  await writable.close();

  return finalName;
};

/**
 * Open a file from the resumes directory in the browser.
 */
export const openResumeFile = async (filename: string) => {
  if (isMockMode) {
    const file = mockFiles.get(filename);
    if (file) {
        const url = URL.createObjectURL(file);
        window.open(url, '_blank');
        setTimeout(() => URL.revokeObjectURL(url), 60000);
    } else {
        alert("Demo Mode: File not found in memory (files are lost on page refresh in demo mode).");
    }
    return;
  }

  if (!resumesHandle) throw new Error("Resumes directory missing");
  
  try {
    const fileHandle = await resumesHandle.getFileHandle(filename);
    const file = await fileHandle.getFile();
    const url = URL.createObjectURL(file);
    window.open(url, '_blank');
    
    // Cleanup URL after a delay (optional, but good practice)
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  } catch (e) {
    alert(`Could not find file: ${filename}. It may have been deleted externally.`);
  }
};

/**
 * Delete a resume file physically.
 */
export const deleteResumeFile = async (filename: string) => {
  if (isMockMode) {
    mockFiles.delete(filename);
    return;
  }

  if (!resumesHandle) return;
  try {
    await resumesHandle.removeEntry(filename);
  } catch (e) {
    console.warn("File already deleted or not found:", filename);
  }
};
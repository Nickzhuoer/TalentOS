export enum CandidateStatus {
  NEW = '新候选人',
  SCREENING = '初筛中',
  INTERVIEWING = '面试中',
  OFFER_SENT = '已发Offer',
  HIRED = '已录用',
  REJECTED = '已淘汰',
  OPEN_TO_WORK = '开放机会'
}

export interface Candidate {
  id: string;
  talentId: string; // 人才ID, format: YYYYMMDD#NN
  name: string;
  gender: string;
  age: string;
  education: string;
  yearsOfExperience: string; // Formatted as X年X个月
  positionExperience: string; // List of past roles/times
  currentCompany: string;
  recentRole: string; // Renamed from role
  location: string;
  factoryExperience: string;
  contact: string;
  
  // New Fields
  intent: string; // 意向
  isEmployed: string; // 是否在职 (在职/离职)
  source: string; // 人才来源
  notes: string; // 备注
  aiPersona: string; // AI画像 (100 words)
  aiTags: string[]; // 5 short tags

  status: CandidateStatus;
  dateAdded: string;
  lastModified: string; // 操作时间
  fileName: string; // Relative path (filename only)
  tags: string[]; // System tags
}

export interface AppConfig {
  username: string;
  apiKey: string;
  isConfigured: boolean;
}

export interface FileSystemContextType {
  dirHandle: FileSystemDirectoryHandle | null;
  resumesDirHandle: FileSystemDirectoryHandle | null;
  dbFileHandle: FileSystemFileHandle | null;
}
export type Department = 'COE' | 'CCS' | 'CHS' | 'CBM' | 'CAF';
export type HeatCategory = 'HEALTH' | 'ENVIRONMENT' | 'AGRICULTURE' | 'TOURISM';
export type UserRole = 'PARTICIPANT' | 'CEO' | 'ADMIN' | 'JUDGE';
export type HackathonPhase =
  | 'LOBBY'
  | 'CEO_CHALLENGE_ACTIVE'
  | 'DRAFTING'
  | 'SUBMISSIONS_OPEN'
  | 'SUBMISSIONS_LOCKED'
  | 'JUDGING'
  | 'COMPLETE';

export const ALL_DEPARTMENTS: Department[] = ['COE', 'CCS', 'CHS', 'CBM', 'CAF'];
export const ALL_HEAT_CATEGORIES: HeatCategory[] = ['HEALTH', 'ENVIRONMENT', 'AGRICULTURE', 'TOURISM'];

export type PublicUser = {
  id: string;
  fullName: string;
  email: string | null;
  homeDepartment: Department;
  slotDepartment: Department | null;
  role: UserRole;
  drafted: boolean;
  teamId: string | null;
};

export type HackathonStatePayload = {
  phase: HackathonPhase;
  phaseLabel: string;
  participantsLocked: boolean;
  currentChallengeRound: number;
  ceoSlotsForCurrentRound: number;
  challengeDurationSeconds: number;
  challengeStartedAt: string | null;
  challengeEndsAt: string | null;
  submissionsLocked: boolean;
  serverNow: string;
};

// ---------- CEO Selection Competition (quiz-based) ----------

// Participant-safe projection — never includes correctAnswer (see the
// backend's participant.service.ts#getMyCeoQuestions doc comment).
export type CeoQuestionForParticipant = {
  id: string;
  question: string;
  options: string[];
  order: number;
  points: number;
};

export type MyCeoChallengeResult = {
  round: number;
  challengeEndsAt: string | null;
  serverNow: string;
  questions: CeoQuestionForParticipant[];
  alreadySubmitted: boolean;
  myScore: number | null;
};

export type SubmitCeoAnswersResult = {
  submitted: true;
  score: number;
  answeredCount: number;
  totalQuestions: number;
};

// Admin-only — includes correctAnswer, since question management needs it.
export type CeoQuestion = {
  id: string;
  question: string;
  options: string[];
  correctAnswer: number;
  points: number;
  category: string | null;
  order: number;
  isActive: boolean;
  createdAt: string;
  updatedAt: string;
};

export type AdminHackathonStatePayload = HackathonStatePayload & {
  connectedParticipants: number;
};

export type TeamMember = {
  id: string;
  fullName: string;
  homeDepartment: Department;
  slotDepartment: Department | null;
  role: UserRole;
};

export type Deliverable = {
  id: string;
  teamId: string;
  logoUrl: string | null;
  logoPublicId: string | null;
  demoUrl: string | null;
  githubUrl: string | null;
  figmaUrl: string | null;
  elevatorPitch: string | null;
  currentPitchDeckVersionId: string | null;
  title: string | null;
  description: string | null;
  problemStatement: string | null;
  proposedSolution: string | null;
  targetUsers: string | null;
  technologyStack: string | null;
  status: SubmissionStatus;
  updatedAt: string;
};

export type Team = {
  id: string;
  name: string | null;
  ceoId: string;
  ceo: TeamMember;
  members: TeamMember[];
  category: HeatCategory | null;
  isComplete: boolean;
  finalizedAt: string | null;
  deliverable: Deliverable | null;
  createdAt: string;
};

export type PitchDeckVersion = {
  id: string;
  teamId: string;
  version: number;
  filename: string;
  fileUrl: string;
  fileFormat: string;
  mimeType: string;
  fileSizeBytes: number;
  createdAt: string;
  uploadedBy?: { id: string; fullName: string };
};

// ---------- Phase 10: file storage ----------

export type FileCategory = 'PITCH_DECK' | 'DOCUMENT' | 'PROJECT_ASSET';

// Mirrors the backend's safe metadata shape exactly — never a Cloudinary
// secret, DB password, QR token, or auth token.
export type FileMetadata = {
  id: string;
  filename: string;
  type: FileCategory;
  mimeType: string;
  size: number;
  version: number | null;
  uploadedBy: { id: string; name: string };
  createdAt: string;
  isCurrent: boolean;
};

export type FileDetail = FileMetadata & { fileUrl: string };

export type PitchDeckResponse = {
  current: FileMetadata | null;
  previousVersions: FileMetadata[];
};

export type TeamDeliverableStatus = {
  teamId: string;
  teamName: string | null;
  category: HeatCategory | null;
  pitchDeck: { status: 'UPLOADED' | 'NOT_UPLOADED'; latestVersion: number | null };
  documentation: { status: 'UPLOADED' | 'NOT_UPLOADED'; count: number };
};

export type CategoryUsage = { category: HeatCategory; used: number; capacity: number; available: number; full: boolean };

// ---------- Phase 11: AI mentor ----------

export type AiMessageRole = 'USER' | 'ASSISTANT' | 'SYSTEM';

export type AiMessage = {
  id: string;
  role: AiMessageRole;
  content: string;
  createdAt: string;
};

export type AiSessionSummary = {
  id: string;
  title: string | null;
  createdAt: string;
  updatedAt: string;
  createdBy: { id: string; name: string };
};

export type AiSessionDetail = AiSessionSummary & { messages: AiMessage[] };

export type AiSendMessageResponse = { userMessage: AiMessage; assistantMessage: AiMessage };

export type AdminOverview = {
  totalParticipants: number;
  draftedParticipants: number;
  undraftedParticipants: number;
  eligibleCeoParticipants: number;
  activeCeoQuestionCount: number;
  ceoQuestionsReady: boolean;
  totalTeams: number;
  completeTeams: number;
  finalizedTeams: number;
  ceoCount: number;
  categoryUsage: CategoryUsage[];
};

export type ApiErrorBody = {
  error: { code: string; message: string; issues?: { path: string; message: string }[] };
};

export type QrIdentity = {
  qrToken: string;
  qrPayload: string;
};

export type QrScanResult = {
  valid: true;
  participant: { id: string; name: string; department: Department };
  recruitment: { currentlyDrafted: boolean; departmentAvailable: boolean };
};

export type DepartmentOccupancy = Record<Department, 'CEO' | 'FILLED' | 'AVAILABLE'>;

export type RecruitResult = {
  success: true;
  member: { id: string; name: string; department: Department };
  team: { id: string; memberCount: number; maxMembers: number; departments: DepartmentOccupancy };
};

export type FinalizationStatus = {
  team: Team;
  memberCount: number;
  departmentComplete: Record<Department, boolean>;
  canFinalize: boolean;
  reason: string | null;
  categories: CategoryUsage[];
};

export type SubmissionStatus = 'DRAFT' | 'IN_PROGRESS' | 'READY_FOR_SUBMISSION' | 'SUBMITTED';

export type TeamStatus = 'FORMING' | 'COMPLETE' | 'FINALIZED';

export type ProjectData = {
  title: string | null;
  description: string | null;
  problemStatement: string | null;
  proposedSolution: string | null;
  targetUsers: string | null;
  technologyStack: string | null;
};

export type TeamOverview = {
  team: {
    id: string;
    name: string | null;
    category: HeatCategory | null;
    status: TeamStatus;
    finalizedAt: string | null;
    createdAt: string;
    memberCount: number;
    maxMembers: number;
  };
  ceo: { id: string; name: string };
  members: { id: string; name: string; department: Department | null; isCeo: boolean }[];
  project: ProjectData;
  submission: { status: SubmissionStatus };
  deliverables: {
    pitchDeck: { status: 'NOT_UPLOADED' | 'UPLOADED'; version: number | null; lastUpdated: string | null };
    documentation: { status: 'NOT_UPLOADED' };
    other: { status: 'NOT_UPLOADED' };
  };
};

// ---------- Phase 12: judge evaluation ----------

export type EvaluationStatus = 'NOT_STARTED' | 'IN_PROGRESS' | 'SUBMITTED';

export type JudgeCriterion = { id: string; label: string; min: number; max: number };

export type JudgeCriteriaResponse = { criteria: JudgeCriterion[]; minTotal: number; maxTotal: number };

export type JudgeTeamListItem = {
  id: string;
  name: string | null;
  category: HeatCategory | null;
  memberCount: number;
  ceo: { name: string };
  evaluationStatus: EvaluationStatus;
};

export type EvaluationPayload = {
  id: string | null;
  status: 'NOT_STARTED' | 'DRAFT' | 'SUBMITTED';
  scores: Record<string, number> | null;
  total: number | null;
  comments: string | null;
  submittedAt: string | null;
  updatedAt: string | null;
};

export type JudgeTeamDetail = {
  id: string;
  name: string | null;
  category: HeatCategory | null;
  finalizedAt: string | null;
  ceo: { id: string; name: string };
  members: { id: string; name: string; department: Department | null; isCeo: boolean }[];
  memberCount: number;
  project: {
    title: string | null;
    description: string | null;
    problemStatement: string | null;
    proposedSolution: string | null;
    targetUsers: string | null;
    technologyStack: string | null;
  };
  submission: { status: SubmissionStatus };
  deliverables: {
    pitchDeck:
      | { status: 'UPLOADED'; version: number; filename: string; fileUrl: string; uploadedBy: string; createdAt: string }
      | { status: 'NOT_UPLOADED' };
    documents: { id: string; filename: string; fileUrl: string; size: number; uploadedBy: string; createdAt: string }[];
    assets: { id: string; filename: string; fileUrl: string; size: number; uploadedBy: string; createdAt: string }[];
  };
  myEvaluation: EvaluationPayload;
};

export type AdminEvaluationOverview = {
  teamId: string;
  teamName: string | null;
  category: HeatCategory | null;
  totalJudges: number;
  evaluationsSubmitted: number;
  evaluationsInProgress: number;
};

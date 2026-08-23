import type { HackathonStatePayload as HackathonStatePayloadBase } from './api';

export type HackathonStatePayload = HackathonStatePayloadBase;

export type TeamUpdatedPayload = {
  teamId: string;
  isComplete: boolean;
  finalized: boolean;
  memberCount: number;
};

export type CategoryUpdatedPayload = {
  category: string;
  claimedSlots: number;
  totalSlots: number;
};

export type UserDraftedPayload = {
  userId: string;
  teamId: string;
  slotDepartment: string;
};

// Admin-room-only, unconditional on team membership — see backend events.ts's
// doc comment on PROFILE_UPDATED. Keeps the Presenter's Scanning Members
// roster (and anywhere else admin shows a participant's photo/name) fresh
// even for someone not yet recruited onto a team.
export type ProfileUpdatedPayload = {
  userId: string;
  fullName: string;
  avatarUrl: string | null;
};

export type ParticipantLockPayload = { locked: boolean };
export type SubmissionLockPayload = { locked: boolean };

export type ChallengeStartPayload = {
  round: number;
  durationSeconds: number;
  challengeEndsAt: string;
  serverNow: string;
};

export type ChallengeEndPayload = {
  round: number;
  winners: { userId: string; teamId: string; fullName: string; avatarUrl: string | null }[];
};

// Admin-room-only — never sent to participants (see backend events.ts's doc
// comment on CHALLENGE_ANSWER_SUBMITTED). Drives the presenter view's
// "name lights up when answered" live indicator.
export type ChallengeAnswerSubmittedPayload = {
  round: number;
  questionId: string;
  userId: string;
  fullName: string;
};

export type CeoDepartmentAssignedPayload = {
  teamId: string;
  userId: string;
  department: string;
  fullName: string;
};

export type MemberRecruitedPayload = {
  teamId: string;
  participantId: string;
  department: string;
  fullName: string;
  memberCount: number;
};

export type TeamFinalizedPayload = {
  teamId: string;
  name: string;
  category: string;
  ceoId: string;
};

export type FileMetadataPayload = {
  id: string;
  filename: string;
  type: 'PITCH_DECK' | 'DOCUMENT' | 'PROJECT_ASSET';
  mimeType: string;
  size: number;
  version: number | null;
  uploadedBy: { id: string; name: string };
  createdAt: string;
  isCurrent: boolean;
};

export type FileUploadedPayload = { teamId: string; file: FileMetadataPayload };
export type FileReplacedPayload = { teamId: string; file: FileMetadataPayload; previousVersion: number };
export type FileDeletedPayload = { teamId: string; fileId: string; type: FileMetadataPayload['type'] };

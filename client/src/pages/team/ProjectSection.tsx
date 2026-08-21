import { useState } from 'react';
import { useUpdateProject } from '../../hooks/useTeamHub';
import { getApiErrorMessage } from '../../lib/apiClient';
import { comicButton, comicHeading } from '../../lib/comic';
import type { ProjectData } from '../../types/api';

const FIELDS: { key: keyof ProjectData; label: string; maxLength: number; multiline?: boolean }[] = [
  { key: 'title', label: 'Project Title', maxLength: 200 },
  { key: 'description', label: 'Project Description', maxLength: 3000, multiline: true },
  { key: 'problemStatement', label: 'Problem Statement', maxLength: 3000, multiline: true },
  { key: 'proposedSolution', label: 'Proposed Solution', maxLength: 3000, multiline: true },
  { key: 'targetUsers', label: 'Target Users', maxLength: 1000, multiline: true },
  { key: 'technologyStack', label: 'Technology Stack', maxLength: 1000, multiline: true },
];

/**
 * Collaborative editing: any team member can save here — see the backend
 * comment in teamHub.service.ts for why (Phase 1's existing deliverable-links
 * endpoint already worked this way, no CEO-only gate).
 */
export function ProjectSection({ project }: { project: ProjectData }) {
  const updateProject = useUpdateProject();
  const [form, setForm] = useState<ProjectData>(project);

  function setField(key: keyof ProjectData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  return (
    <section className="comic-panel p-6" data-testid="project-section">
      <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-lime" aria-hidden="true" />
      <h2 className={`text-lg mb-4 ${comicHeading}`}>PROJECT</h2>
      <form
        className="flex flex-col gap-4"
        onSubmit={(e) => {
          e.preventDefault();
          updateProject.mutate(form);
        }}
      >
        {FIELDS.map(({ key, label, maxLength, multiline }) => (
          <label key={key} className="text-xs font-black uppercase text-forest">
            {label}
            {multiline ? (
              <textarea
                data-testid={`project-field-${key}`}
                value={form[key] ?? ''}
                maxLength={maxLength}
                rows={3}
                onChange={(e) => setField(key, e.target.value)}
                className="mt-1 w-full rounded-lg bg-white border-[3px] border-ink px-3 py-2 text-sm font-medium normal-case text-ink focus:outline-none focus:ring-2 focus:ring-crimson"
              />
            ) : (
              <input
                data-testid={`project-field-${key}`}
                value={form[key] ?? ''}
                maxLength={maxLength}
                onChange={(e) => setField(key, e.target.value)}
                className="mt-1 w-full rounded-lg bg-white border-[3px] border-ink px-3 py-2 text-sm font-medium normal-case text-ink focus:outline-none focus:ring-2 focus:ring-crimson"
              />
            )}
          </label>
        ))}

        <button type="submit" data-testid="save-project-button" disabled={updateProject.isPending} className={`self-start ${comicButton('crimson')}`}>
          {updateProject.isPending ? 'Saving…' : 'SAVE PROJECT'}
        </button>
        {updateProject.isError && (
          <p className="text-crimson font-bold text-sm" data-testid="save-project-error">
            {getApiErrorMessage(updateProject.error)}
          </p>
        )}
        {updateProject.isSuccess && !updateProject.isPending && (
          <p className="text-forest font-bold text-sm" data-testid="save-project-success">
            Saved.
          </p>
        )}
      </form>
    </section>
  );
}

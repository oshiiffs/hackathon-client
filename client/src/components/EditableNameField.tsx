import { useState } from 'react';
import { useUpdateMyProfile } from '../hooks/useAuth';
import { getApiErrorMessage } from '../lib/apiClient';

/** Self-service display-name editor for participants/CEOs — badge access
 * codes carry no name, so whatever an admin typed at registration is only
 * ever a starting point. Renders as a `<dd>` so it drops into the existing
 * `dt`/`dd` status grids on the participant and CEO dashboards. */
export function EditableNameField({ currentName }: { currentName: string }) {
  const updateName = useUpdateMyProfile();
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(currentName);

  if (!editing) {
    return (
      <dd className="flex items-center gap-2 mt-0.5">
        <span className="text-slate-100 font-medium">{currentName}</span>
        <button
          type="button"
          onClick={() => {
            setValue(currentName);
            setEditing(true);
          }}
          className="text-xs font-semibold text-primary-400 hover:text-primary-300 transition"
        >
          Edit
        </button>
      </dd>
    );
  }

  return (
    <dd className="mt-0.5">
      <form
        className="flex flex-wrap items-center gap-2"
        onSubmit={(e) => {
          e.preventDefault();
          const trimmed = value.trim();
          if (!trimmed || trimmed === currentName) {
            setEditing(false);
            return;
          }
          updateName.mutate({ fullName: trimmed }, { onSuccess: () => setEditing(false) });
        }}
      >
        <input
          autoFocus
          value={value}
          maxLength={100}
          onChange={(e) => setValue(e.target.value)}
          className="rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-sm text-slate-100"
        />
        <button
          type="submit"
          disabled={updateName.isPending || value.trim().length < 2}
          className="rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-semibold px-3 py-1.5 transition"
        >
          {updateName.isPending ? 'Saving…' : 'Save'}
        </button>
        <button
          type="button"
          disabled={updateName.isPending}
          onClick={() => setEditing(false)}
          className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5 transition"
        >
          Cancel
        </button>
      </form>
      {updateName.isError && <p className="text-red-400 text-xs mt-1">{getApiErrorMessage(updateName.error)}</p>}
    </dd>
  );
}

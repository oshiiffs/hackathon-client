import { useState } from 'react';
import { useUpdateMyProfile } from '../hooks/useAuth';
import { getApiErrorMessage } from '../lib/apiClient';
import { comicButton, comicLink } from '../lib/comic';

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
        <span className="text-ink font-bold">{currentName}</span>
        <button
          type="button"
          onClick={() => {
            setValue(currentName);
            setEditing(true);
          }}
          className={`text-xs ${comicLink}`}
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
          className="rounded-lg bg-white border-[3px] border-ink px-2 py-1 text-sm text-ink font-bold focus:outline-none focus:ring-2 focus:ring-crimson"
        />
        <button type="submit" disabled={updateName.isPending || value.trim().length < 2} className={comicButton('forest', 'sm')}>
          {updateName.isPending ? 'Saving…' : 'Save'}
        </button>
        <button type="button" disabled={updateName.isPending} onClick={() => setEditing(false)} className={comicButton('white', 'sm')}>
          Cancel
        </button>
      </form>
      {updateName.isError && <p className="text-crimson font-bold text-xs mt-1">{getApiErrorMessage(updateName.error)}</p>}
    </dd>
  );
}

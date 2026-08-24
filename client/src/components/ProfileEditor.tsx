import { useRef, useState } from 'react';
import { useUpdateMyProfile, useUploadAvatar } from '../hooks/useAuth';
import { getApiErrorMessage } from '../lib/apiClient';
import { comicButton, comicHeading, comicLink } from '../lib/comic';
import type { PublicUser } from '../types/api';

const BIO_MAX = 280;
const MAX_SKILLS = 10;

function Avatar({ url, name, size = 64 }: { url: string | null; name: string; size?: number }) {
  const initial = name.trim().charAt(0).toUpperCase() || '?';
  if (url) {
    return (
      <img
        src={url}
        alt={`${name}'s profile picture`}
        className="rounded-full object-cover bg-white border-[3px] border-ink shadow-[3px_3px_0px_#111111]"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-cream border-[3px] border-ink shadow-[3px_3px_0px_#111111] flex items-center justify-center text-ink font-black"
      style={{ width: size, height: size, fontSize: size / 2.5 }}
    >
      {initial}
    </div>
  );
}

/** Full self-service profile editor: nickname, bio (280-char limit), skills
 * (freeform tags, capped at 10), and profile picture. Distinct from
 * EditableNameField (legal/display name only) — this is the "editable
 * participant profile" surface requested for the participant dashboard. */
export function ProfileEditor({ user }: { user: PublicUser }) {
  const updateProfile = useUpdateMyProfile();
  const uploadAvatar = useUploadAvatar();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [editing, setEditing] = useState(false);
  const [nickname, setNickname] = useState(user.nickname ?? '');
  const [bio, setBio] = useState(user.bio ?? '');
  const [skillInput, setSkillInput] = useState('');
  const [skills, setSkills] = useState<string[]>(user.skills);

  function startEditing() {
    setNickname(user.nickname ?? '');
    setBio(user.bio ?? '');
    setSkills(user.skills);
    setSkillInput('');
    setEditing(true);
  }

  function addSkill() {
    const trimmed = skillInput.trim();
    if (!trimmed || skills.length >= MAX_SKILLS || skills.some((s) => s.toLowerCase() === trimmed.toLowerCase())) {
      setSkillInput('');
      return;
    }
    setSkills([...skills, trimmed]);
    setSkillInput('');
  }

  function removeSkill(skill: string) {
    setSkills(skills.filter((s) => s !== skill));
  }

  function handleAvatarPick(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (file) uploadAvatar.mutate(file);
  }

  return (
    <section className="comic-panel p-6">
      <span className="absolute -top-3 -left-3 w-6 h-6 border-[3px] border-ink bg-lime" aria-hidden="true" />
      <div className="flex items-center justify-between mb-4">
        <h2 className={`text-lg ${comicHeading}`}>My Profile</h2>
        {!editing && (
          <button type="button" onClick={startEditing} className={`text-xs ${comicLink}`}>
            Edit
          </button>
        )}
      </div>

      <div className="flex items-start gap-4">
        <div className="flex flex-col items-center gap-2">
          <Avatar url={user.avatarUrl} name={user.fullName} />
          <button
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadAvatar.isPending}
            className={`text-[11px] disabled:opacity-50 ${comicLink}`}
          >
            {uploadAvatar.isPending ? 'Uploading…' : 'Change photo'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleAvatarPick} />
        </div>

        <div className="flex-1 min-w-0">
          {!editing ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-forest text-xs uppercase font-black">Nickname</dt>
                <dd className="text-ink font-bold mt-0.5">{user.nickname || <span className="text-navy/40 font-medium">Not set</span>}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-forest text-xs uppercase font-black">Bio</dt>
                <dd className="text-navy mt-0.5 whitespace-pre-wrap">{user.bio || <span className="text-navy/40 font-medium">Not set</span>}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-forest text-xs uppercase font-black">Skills</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {user.skills.length === 0 && <span className="text-navy/40 text-sm">None added</span>}
                  {user.skills.map((skill) => (
                    <span key={skill} className="rounded-full bg-lime/40 text-ink border-2 border-ink px-2 py-0.5 text-xs font-bold">
                      {skill}
                    </span>
                  ))}
                </dd>
              </div>
            </dl>
          ) : (
            <form
              className="flex flex-col gap-4"
              onSubmit={(e) => {
                e.preventDefault();
                updateProfile.mutate(
                  { nickname: nickname.trim() || null, bio: bio.trim() || null, skills },
                  { onSuccess: () => setEditing(false) },
                );
              }}
            >
              <div>
                <label className="text-forest text-xs uppercase font-black block mb-1">Nickname</label>
                <input
                  value={nickname}
                  maxLength={50}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="What should people call you?"
                  className="w-full rounded-lg bg-white border-[3px] border-ink px-3 py-2 text-sm text-ink font-medium focus:outline-none focus:ring-2 focus:ring-crimson"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-forest text-xs uppercase font-black">Bio</label>
                  <span className={`text-[11px] font-bold ${bio.length > BIO_MAX ? 'text-crimson' : 'text-navy/50'}`}>
                    {bio.length}/{BIO_MAX}
                  </span>
                </div>
                <textarea
                  value={bio}
                  maxLength={BIO_MAX}
                  rows={3}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A short intro for other participants."
                  className="w-full rounded-lg bg-white border-[3px] border-ink px-3 py-2 text-sm text-ink font-medium resize-none focus:outline-none focus:ring-2 focus:ring-crimson"
                />
              </div>

              <div>
                <label className="text-forest text-xs uppercase font-black block mb-1">
                  Skills ({skills.length}/{MAX_SKILLS})
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 rounded-full bg-lime/40 text-ink border-2 border-ink px-2 py-0.5 text-xs font-bold"
                    >
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} className="hover:text-crimson font-black" aria-label={`Remove ${skill}`}>
                        ×
                      </button>
                    </span>
                  ))}
                </div>
                <div className="flex gap-2">
                  <input
                    value={skillInput}
                    maxLength={30}
                    disabled={skills.length >= MAX_SKILLS}
                    onChange={(e) => setSkillInput(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter' || e.key === ',') {
                        e.preventDefault();
                        addSkill();
                      }
                    }}
                    placeholder="Add a skill and press Enter"
                    className="flex-1 min-w-0 rounded-lg bg-white border-[3px] border-ink px-3 py-2 text-sm text-ink font-medium disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-crimson"
                  />
                  <button
                    type="button"
                    onClick={addSkill}
                    disabled={skills.length >= MAX_SKILLS || !skillInput.trim()}
                    className={comicButton('white', 'sm')}
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button type="submit" disabled={updateProfile.isPending || bio.length > BIO_MAX} className={comicButton('forest', 'sm')}>
                  {updateProfile.isPending ? 'Saving…' : 'Save profile'}
                </button>
                <button type="button" disabled={updateProfile.isPending} onClick={() => setEditing(false)} className={comicButton('white', 'sm')}>
                  Cancel
                </button>
              </div>

              {updateProfile.isError && <p className="text-crimson font-bold text-xs">{getApiErrorMessage(updateProfile.error)}</p>}
            </form>
          )}
          {uploadAvatar.isError && <p className="text-crimson font-bold text-xs mt-2">{getApiErrorMessage(uploadAvatar.error)}</p>}
        </div>
      </div>
    </section>
  );
}

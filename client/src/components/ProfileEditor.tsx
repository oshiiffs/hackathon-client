import { useRef, useState } from 'react';
import { useUpdateMyProfile, useUploadAvatar } from '../hooks/useAuth';
import { getApiErrorMessage } from '../lib/apiClient';
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
        className="rounded-full object-cover bg-slate-800 border border-slate-700"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-slate-400 font-black"
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
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-bold text-slate-100">My Profile</h2>
        {!editing && (
          <button
            type="button"
            onClick={startEditing}
            className="text-xs font-semibold text-primary-400 hover:text-primary-300 transition"
          >
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
            className="text-[11px] font-semibold text-primary-400 hover:text-primary-300 transition disabled:opacity-50"
          >
            {uploadAvatar.isPending ? 'Uploading…' : 'Change photo'}
          </button>
          <input ref={fileInputRef} type="file" accept="image/png,image/jpeg,image/webp" hidden onChange={handleAvatarPick} />
        </div>

        <div className="flex-1 min-w-0">
          {!editing ? (
            <dl className="grid grid-cols-1 sm:grid-cols-2 gap-4 text-sm">
              <div>
                <dt className="text-slate-500 text-xs uppercase font-semibold">Nickname</dt>
                <dd className="text-slate-100 font-medium mt-0.5">{user.nickname || <span className="text-slate-600">Not set</span>}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500 text-xs uppercase font-semibold">Bio</dt>
                <dd className="text-slate-300 mt-0.5 whitespace-pre-wrap">{user.bio || <span className="text-slate-600">Not set</span>}</dd>
              </div>
              <div className="sm:col-span-2">
                <dt className="text-slate-500 text-xs uppercase font-semibold">Skills</dt>
                <dd className="mt-1 flex flex-wrap gap-1.5">
                  {user.skills.length === 0 && <span className="text-slate-600 text-sm">None added</span>}
                  {user.skills.map((skill) => (
                    <span key={skill} className="rounded-full bg-primary-500/15 text-primary-300 border border-primary-600/40 px-2 py-0.5 text-xs font-semibold">
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
                <label className="text-slate-500 text-xs uppercase font-semibold block mb-1">Nickname</label>
                <input
                  value={nickname}
                  maxLength={50}
                  onChange={(e) => setNickname(e.target.value)}
                  placeholder="What should people call you?"
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label className="text-slate-500 text-xs uppercase font-semibold">Bio</label>
                  <span className={`text-[11px] font-semibold ${bio.length > BIO_MAX ? 'text-red-400' : 'text-slate-600'}`}>
                    {bio.length}/{BIO_MAX}
                  </span>
                </div>
                <textarea
                  value={bio}
                  maxLength={BIO_MAX}
                  rows={3}
                  onChange={(e) => setBio(e.target.value)}
                  placeholder="A short intro for other participants."
                  className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 resize-none"
                />
              </div>

              <div>
                <label className="text-slate-500 text-xs uppercase font-semibold block mb-1">
                  Skills ({skills.length}/{MAX_SKILLS})
                </label>
                <div className="flex flex-wrap gap-1.5 mb-2">
                  {skills.map((skill) => (
                    <span
                      key={skill}
                      className="inline-flex items-center gap-1 rounded-full bg-primary-500/15 text-primary-300 border border-primary-600/40 px-2 py-0.5 text-xs font-semibold"
                    >
                      {skill}
                      <button type="button" onClick={() => removeSkill(skill)} className="hover:text-primary-100" aria-label={`Remove ${skill}`}>
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
                    className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100 disabled:opacity-50"
                  />
                  <button
                    type="button"
                    onClick={addSkill}
                    disabled={skills.length >= MAX_SKILLS || !skillInput.trim()}
                    className="rounded-lg bg-slate-800 hover:bg-slate-700 disabled:opacity-50 text-slate-200 text-xs font-semibold px-3 transition"
                  >
                    Add
                  </button>
                </div>
              </div>

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={updateProfile.isPending || bio.length > BIO_MAX}
                  className="rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-50 text-white text-xs font-semibold px-4 py-2 transition"
                >
                  {updateProfile.isPending ? 'Saving…' : 'Save profile'}
                </button>
                <button
                  type="button"
                  disabled={updateProfile.isPending}
                  onClick={() => setEditing(false)}
                  className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-4 py-2 transition"
                >
                  Cancel
                </button>
              </div>

              {updateProfile.isError && <p className="text-red-400 text-xs">{getApiErrorMessage(updateProfile.error)}</p>}
            </form>
          )}
          {uploadAvatar.isError && <p className="text-red-400 text-xs mt-2">{getApiErrorMessage(uploadAvatar.error)}</p>}
        </div>
      </div>
    </section>
  );
}

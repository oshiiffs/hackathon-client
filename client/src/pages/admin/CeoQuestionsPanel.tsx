import { useState } from 'react';
import { Badge } from '../../components/Badge';
import { ConfirmDialog } from '../../components/ConfirmDialog';
import {
  useCeoQuestions,
  useCreateCeoQuestion,
  useDeleteCeoQuestion,
  useUpdateCeoQuestion,
} from '../../hooks/useAdmin';
import { getApiErrorMessage } from '../../lib/apiClient';
import type { CeoQuestion } from '../../types/api';

type QuestionForm = {
  question: string;
  acceptedAnswersText: string; // comma-separated, split into acceptedAnswers on submit
  points: number;
  category: string;
  order: number;
  isActive: boolean;
};

const EMPTY_FORM: QuestionForm = {
  question: '',
  acceptedAnswersText: '',
  points: 1,
  category: '',
  order: 1,
  isActive: true,
};

function toForm(q: CeoQuestion): QuestionForm {
  return {
    question: q.question,
    acceptedAnswersText: q.acceptedAnswers.join(', '),
    points: q.points,
    category: q.category ?? '',
    order: q.order,
    isActive: q.isActive,
  };
}

function parseAcceptedAnswers(text: string): string[] {
  return text
    .split(',')
    .map((a) => a.trim())
    .filter((a) => a.length > 0);
}

/** Question bank management (req. 41-53), identification format — the
 * architecture supports more than the 10-topic minimum without a code change
 * specifically because this exists: admin can add/edit/retire topics here,
 * not just via seed. */
export function CeoQuestionsPanel() {
  const questions = useCeoQuestions();
  const createQuestion = useCreateCeoQuestion();
  const updateQuestion = useUpdateCeoQuestion();
  const deleteQuestion = useDeleteCeoQuestion();

  const [showAddForm, setShowAddForm] = useState(false);
  const [addForm, setAddForm] = useState<QuestionForm>(EMPTY_FORM);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<QuestionForm>(EMPTY_FORM);
  const [deleteTarget, setDeleteTarget] = useState<{ id: string; question: string } | null>(null);

  const activeCount = questions.data?.filter((q) => q.isActive).length ?? 0;

  function buildPayload(form: QuestionForm) {
    return {
      question: form.question.trim(),
      acceptedAnswers: parseAcceptedAnswers(form.acceptedAnswersText),
      points: form.points,
      category: form.category.trim() || undefined,
      order: form.order,
      isActive: form.isActive,
    };
  }

  function isFormValid(form: QuestionForm) {
    return form.question.trim().length > 0 && parseAcceptedAnswers(form.acceptedAnswersText).length > 0;
  }

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6" data-testid="ceo-questions-panel">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h2 className="text-lg font-bold text-slate-100">CEO Topics</h2>
        <div className="flex items-center gap-2">
          <span className="text-xs text-slate-500">
            {activeCount} active / {questions.data?.length ?? 0} total (10 minimum to start)
          </span>
          <button
            onClick={() => {
              setAddForm({ ...EMPTY_FORM, order: (questions.data?.length ?? 0) + 1 });
              setShowAddForm((s) => !s);
            }}
            className="rounded-lg bg-primary-600 hover:bg-primary-700 text-white font-semibold px-3 py-1.5 text-xs transition"
          >
            {showAddForm ? 'Cancel' : 'Add topic'}
          </button>
        </div>
      </div>

      {showAddForm && (
        <form
          className="mb-5 pb-5 border-b border-slate-800 flex flex-col gap-3"
          onSubmit={(e) => {
            e.preventDefault();
            createQuestion.mutate(buildPayload(addForm), {
              onSuccess: () => {
                setShowAddForm(false);
                setAddForm(EMPTY_FORM);
              },
            });
          }}
        >
          <label className="text-xs font-bold uppercase text-slate-400">
            Topic / prompt
            <textarea
              value={addForm.question}
              onChange={(e) => setAddForm((f) => ({ ...f, question: e.target.value }))}
              placeholder='e.g. "The ability to guide and inspire a team toward a shared goal is called ___."'
              rows={2}
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm font-normal text-slate-100"
            />
          </label>

          <label className="text-xs font-bold uppercase text-slate-400">
            Accepted answers (comma-separated)
            <input
              value={addForm.acceptedAnswersText}
              onChange={(e) => setAddForm((f) => ({ ...f, acceptedAnswersText: e.target.value }))}
              placeholder="leadership, leading"
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm font-normal text-slate-100"
            />
          </label>
          <p className="text-[11px] text-slate-500 -mt-1">
            A submitted word counts as correct if it matches any of these, ignoring case and extra spaces.
          </p>

          <div className="flex flex-wrap gap-3">
            <label className="text-xs font-bold uppercase text-slate-400">
              Points
              <input
                type="number"
                min={1}
                max={10}
                value={addForm.points}
                onChange={(e) => setAddForm((f) => ({ ...f, points: Number(e.target.value) }))}
                className="mt-1 block w-20 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm font-normal text-slate-100"
              />
            </label>
            <label className="text-xs font-bold uppercase text-slate-400">
              Order
              <input
                type="number"
                min={1}
                value={addForm.order}
                onChange={(e) => setAddForm((f) => ({ ...f, order: Number(e.target.value) }))}
                className="mt-1 block w-20 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm font-normal text-slate-100"
              />
            </label>
            <label className="text-xs font-bold uppercase text-slate-400 flex-1 min-w-[10rem]">
              Category (optional)
              <input
                value={addForm.category}
                placeholder="Leadership, Ethics, ..."
                onChange={(e) => setAddForm((f) => ({ ...f, category: e.target.value }))}
                className="mt-1 block w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm font-normal text-slate-100"
              />
            </label>
          </div>

          <button
            type="submit"
            disabled={createQuestion.isPending || !isFormValid(addForm)}
            className="self-start rounded-lg bg-accent-500 hover:bg-accent-400 disabled:opacity-50 text-slate-950 font-black px-4 py-2 text-sm transition"
          >
            {createQuestion.isPending ? 'Adding…' : 'Add topic'}
          </button>
          {createQuestion.isError && <p className="text-red-400 text-sm">{getApiErrorMessage(createQuestion.error)}</p>}
        </form>
      )}

      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-slate-500 text-xs uppercase">
            <tr>
              <th className="py-1 w-10">#</th>
              <th>Topic</th>
              <th>Category</th>
              <th className="w-16">Points</th>
              <th className="w-20">Active</th>
              <th className="text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {questions.data?.map((q) => {
              const isEditing = editingId === q.id;
              if (isEditing) {
                return (
                  <tr key={q.id} className="border-t border-slate-800 text-slate-300 align-top">
                    <td colSpan={6} className="py-3">
                      <div className="flex flex-col gap-3 bg-slate-800/50 rounded-xl p-3">
                        <textarea
                          value={editForm.question}
                          onChange={(e) => setEditForm((f) => ({ ...f, question: e.target.value }))}
                          rows={2}
                          className="w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm text-slate-100"
                        />
                        <label className="text-xs text-slate-400">
                          Accepted answers (comma-separated)
                          <input
                            value={editForm.acceptedAnswersText}
                            onChange={(e) => setEditForm((f) => ({ ...f, acceptedAnswersText: e.target.value }))}
                            className="mt-1 block w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100"
                          />
                        </label>
                        <div className="flex flex-wrap gap-3">
                          <label className="text-xs text-slate-400">
                            Points
                            <input
                              type="number"
                              min={1}
                              max={10}
                              value={editForm.points}
                              onChange={(e) => setEditForm((f) => ({ ...f, points: Number(e.target.value) }))}
                              className="mt-1 block w-20 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-sm text-slate-100"
                            />
                          </label>
                          <label className="text-xs text-slate-400">
                            Order
                            <input
                              type="number"
                              min={1}
                              value={editForm.order}
                              onChange={(e) => setEditForm((f) => ({ ...f, order: Number(e.target.value) }))}
                              className="mt-1 block w-20 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-sm text-slate-100"
                            />
                          </label>
                          <label className="text-xs text-slate-400 flex-1 min-w-[10rem]">
                            Category
                            <input
                              value={editForm.category}
                              onChange={(e) => setEditForm((f) => ({ ...f, category: e.target.value }))}
                              className="mt-1 block w-full rounded-lg bg-slate-800 border border-slate-700 px-2 py-1 text-sm text-slate-100"
                            />
                          </label>
                        </div>
                        <div className="flex gap-2">
                          <button
                            disabled={updateQuestion.isPending || !isFormValid(editForm)}
                            onClick={() =>
                              updateQuestion.mutate(
                                { id: q.id, ...buildPayload(editForm) },
                                { onSuccess: () => setEditingId(null) },
                              )
                            }
                            className="rounded-lg bg-primary-600 hover:bg-primary-700 disabled:opacity-40 text-white text-xs font-semibold px-3 py-1.5"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingId(null)}
                            className="rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs font-semibold px-3 py-1.5"
                          >
                            Cancel
                          </button>
                        </div>
                        {updateQuestion.isError && (
                          <p className="text-red-400 text-xs">{getApiErrorMessage(updateQuestion.error)}</p>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              }
              return (
                <tr key={q.id} className="border-t border-slate-800 text-slate-300">
                  <td className="py-1.5">{q.order}</td>
                  <td className="max-w-xs truncate pr-2" title={q.question}>
                    {q.question}
                  </td>
                  <td>{q.category ?? <span className="text-slate-600">—</span>}</td>
                  <td>{q.points}</td>
                  <td>
                    <button
                      onClick={() => updateQuestion.mutate({ id: q.id, isActive: !q.isActive })}
                      disabled={updateQuestion.isPending}
                    >
                      <Badge tone={q.isActive ? 'primary' : 'neutral'}>{q.isActive ? 'Active' : 'Inactive'}</Badge>
                    </button>
                  </td>
                  <td className="text-right whitespace-nowrap">
                    <button
                      onClick={() => {
                        setEditingId(q.id);
                        setEditForm(toForm(q));
                      }}
                      className="text-primary-400 hover:text-primary-300 font-semibold text-xs mr-3"
                    >
                      Edit
                    </button>
                    <button
                      onClick={() => setDeleteTarget({ id: q.id, question: q.question })}
                      className="text-red-400 hover:text-red-300 font-semibold text-xs"
                    >
                      Delete
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      <ConfirmDialog
        open={deleteTarget !== null}
        title="Delete this topic?"
        description={deleteTarget ? `"${deleteTarget.question}" will be permanently removed.` : undefined}
        confirmLabel="Delete"
        tone="danger"
        pending={deleteQuestion.isPending}
        onCancel={() => setDeleteTarget(null)}
        onConfirm={() => {
          if (deleteTarget) deleteQuestion.mutate(deleteTarget.id);
          setDeleteTarget(null);
        }}
      />
    </section>
  );
}

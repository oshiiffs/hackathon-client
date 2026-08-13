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
  options: string[];
  correctAnswer: number;
  points: number;
  category: string;
  order: number;
  isActive: boolean;
};

const EMPTY_FORM: QuestionForm = {
  question: '',
  options: ['', '', '', ''],
  correctAnswer: 0,
  points: 1,
  category: '',
  order: 1,
  isActive: true,
};

function toForm(q: CeoQuestion): QuestionForm {
  return {
    question: q.question,
    options: [...q.options, '', '', '', ''].slice(0, Math.max(4, q.options.length)),
    correctAnswer: q.correctAnswer,
    points: q.points,
    category: q.category ?? '',
    order: q.order,
    isActive: q.isActive,
  };
}

/** Question bank management (req. 41-53) — the architecture supports more
 * than the 10-question minimum without a code change specifically because
 * this exists: admin can add/edit/retire questions here, not just via seed. */
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
      options: form.options.map((o) => o.trim()).filter((o) => o.length > 0),
      correctAnswer: form.correctAnswer,
      points: form.points,
      category: form.category.trim() || undefined,
      order: form.order,
      isActive: form.isActive,
    };
  }

  function isFormValid(form: QuestionForm) {
    const filled = form.options.map((o) => o.trim()).filter((o) => o.length > 0);
    return form.question.trim().length > 0 && filled.length >= 2 && form.correctAnswer < filled.length;
  }

  return (
    <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6" data-testid="ceo-questions-panel">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <h2 className="text-lg font-bold text-slate-100">CEO Questions</h2>
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
            {showAddForm ? 'Cancel' : 'Add question'}
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
            Question
            <textarea
              value={addForm.question}
              onChange={(e) => setAddForm((f) => ({ ...f, question: e.target.value }))}
              rows={2}
              className="mt-1 w-full rounded-lg bg-slate-800 border border-slate-700 px-3 py-2 text-sm font-normal text-slate-100"
            />
          </label>

          <div className="grid sm:grid-cols-2 gap-2">
            {addForm.options.map((option, i) => (
              <label key={i} className="text-xs font-bold uppercase text-slate-400 flex items-center gap-2">
                <input
                  type="radio"
                  name="add-correct-answer"
                  checked={addForm.correctAnswer === i}
                  onChange={() => setAddForm((f) => ({ ...f, correctAnswer: i }))}
                  title="Correct answer"
                />
                <input
                  value={option}
                  placeholder={`Option ${String.fromCharCode(65 + i)}`}
                  onChange={(e) =>
                    setAddForm((f) => ({ ...f, options: f.options.map((o, oi) => (oi === i ? e.target.value : o)) }))
                  }
                  className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm font-normal text-slate-100"
                />
              </label>
            ))}
          </div>
          <p className="text-[11px] text-slate-500 -mt-1">Select the radio button next to the correct option.</p>

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
            {createQuestion.isPending ? 'Adding…' : 'Add question'}
          </button>
          {createQuestion.isError && <p className="text-red-400 text-sm">{getApiErrorMessage(createQuestion.error)}</p>}
        </form>
      )}

      <div className="max-h-96 overflow-y-auto">
        <table className="w-full text-sm text-left">
          <thead className="text-slate-500 text-xs uppercase">
            <tr>
              <th className="py-1 w-10">#</th>
              <th>Question</th>
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
                        <div className="grid sm:grid-cols-2 gap-2">
                          {editForm.options.map((option, i) => (
                            <label key={i} className="flex items-center gap-2 text-xs text-slate-400">
                              <input
                                type="radio"
                                name={`edit-correct-answer-${q.id}`}
                                checked={editForm.correctAnswer === i}
                                onChange={() => setEditForm((f) => ({ ...f, correctAnswer: i }))}
                              />
                              <input
                                value={option}
                                placeholder={`Option ${String.fromCharCode(65 + i)}`}
                                onChange={(e) =>
                                  setEditForm((f) => ({
                                    ...f,
                                    options: f.options.map((o, oi) => (oi === i ? e.target.value : o)),
                                  }))
                                }
                                className="flex-1 rounded-lg bg-slate-800 border border-slate-700 px-2 py-1.5 text-sm text-slate-100"
                              />
                            </label>
                          ))}
                        </div>
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
        title="Delete this question?"
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

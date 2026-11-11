import { useCallback, useEffect, useMemo, useState, type FormEvent } from 'react';
import { useI18n } from '../i18n';
import { taskRepo } from '../taskStorage';
import { useDataVersion } from '../sync';
import { fill, formatDate, todayISO } from '../utils';
import { NEXT, appliesTo, buildSections, newId, progress, shiftDate, statusOn, withStatus } from '../taskUtils';
import { CheckIcon, ChevronLeftIcon, ChevronRightIcon, ClockIcon, FolderIcon, PencilIcon, PinIcon, PlusIcon, TrashIcon } from '../icons';
import type { Task } from '../types';

interface Draft { title: string; notes: string; time: string; endTime: string; group: string; pinned: boolean; date: string }

interface FormProps {
  initial?: Task;
  defaultDate: string;
  groups: string[];
  onSave: (task: Task) => Promise<void>;
  onCancel: () => void;
}

function TaskForm({ initial, defaultDate, groups, onSave, onCancel }: FormProps) {
  const { t } = useI18n();
  const [f, setF] = useState<Draft>({
    title: initial?.title ?? '', notes: initial?.notes ?? '', time: initial?.time ?? '', endTime: initial?.endTime ?? '',
    group: initial?.group ?? '', pinned: initial?.pinned ?? false, date: initial?.date ?? defaultDate,
  });
  const [error, setError] = useState('');
  const set = <K extends keyof Draft>(k: K, v: Draft[K]) => setF((s) => ({ ...s, [k]: v }));

  async function submit(ev: FormEvent) {
    ev.preventDefault();
    const title = f.title.trim();
    if (!title) { setError(t.titleRequired); return; }
    if (f.time && f.endTime && f.endTime <= f.time) { setError(t.timeError); return; }
    const now = new Date().toISOString();
    const base: Task = initial ?? {
      id: newId(), title, notes: '', date: f.date, time: '', endTime: '', group: '', pinned: false,
      status: 'todo', log: {}, createdAt: now, updatedAt: now,
    };
    await onSave({
      ...base, title, notes: f.notes.trim(), date: f.date, time: f.time, endTime: f.time ? f.endTime : '',
      group: f.group.trim(), pinned: f.pinned, updatedAt: now,
    });
  }

  return (
    <form className="card task-form" onSubmit={(e) => void submit(e)}>
      <label className="field">
        <span>{t.taskTitle}</span>
        <input type="text" autoFocus value={f.title} placeholder={t.taskTitlePh} onChange={(e) => set('title', e.target.value)} />
      </label>
      <div className="row">
        <label className="field"><span>{t.timeFrom}</span>
          <input type="time" value={f.time} onChange={(e) => set('time', e.target.value)} /></label>
        <label className="field"><span>{t.timeTo}</span>
          <input type="time" value={f.endTime} disabled={!f.time} onChange={(e) => set('endTime', e.target.value)} /></label>
      </div>
      <label className="field">
        <span>{t.groupLabel}</span>
        <input type="text" list="task-groups" value={f.group} placeholder={t.groupPh} onChange={(e) => set('group', e.target.value)} />
        <datalist id="task-groups">{groups.map((g) => <option key={g} value={g} />)}</datalist>
      </label>
      <label className="switch">
        <input type="checkbox" checked={f.pinned} onChange={(e) => set('pinned', e.target.checked)} />
        <span>{t.pinnedLabel}</span>
      </label>
      <label className="field">
        <span>{f.pinned ? t.startsOn : t.date}</span>
        <input type="date" value={f.date} required onChange={(e) => e.target.value && set('date', e.target.value)} />
      </label>
      <label className="field">
        <span>{t.taskNotes}</span>
        <textarea rows={2} value={f.notes} onChange={(e) => set('notes', e.target.value)} />
      </label>
      <p className="msg error" role="alert">{error}</p>
      <div className="actions">
        <button className="btn" type="submit">{t.saveTask}</button>
        <button className="btn ghost" type="button" onClick={onCancel}>{t.cancel}</button>
      </div>
    </form>
  );
}

interface RowProps { task: Task; day: string; onCycle: () => void; onEdit: () => void; onDelete: () => void }

function TaskRow({ task, day, onCycle, onEdit, onDelete }: RowProps) {
  const { t } = useI18n();
  const s = statusOn(task, day);
  const label = s === 'done' ? t.statusDone : s === 'partial' ? t.statusPartial : t.statusTodo;
  return (
    <li className={`task ${s}`}>
      <button type="button" className="check" data-state={s} aria-label={`${task.title}: ${label}`} title={label} onClick={onCycle}>
        {s === 'done' && <CheckIcon width={16} height={16} strokeWidth={3} />}
      </button>
      <div className="task-main">
        <span className="task-title">{task.title}</span>
        {(task.time || s === 'partial' || (task.pinned && task.group)) && (
          <div className="task-meta">
            {task.time && (
              <span className="chip"><ClockIcon width={14} height={14} /><span dir="ltr">{task.time}{task.endTime ? ` – ${task.endTime}` : ''}</span></span>
            )}
            {s === 'partial' && <span className="chip part">{t.statusPartial}</span>}
            {task.pinned && task.group && <span className="chip"><FolderIcon width={14} height={14} />{task.group}</span>}
          </div>
        )}
        {task.notes && <p className="task-notes">{task.notes}</p>}
      </div>
      <div className="task-actions">
        <button type="button" className="icon-btn" aria-label={t.edit} title={t.edit} onClick={onEdit}><PencilIcon width={18} height={18} /></button>
        <button type="button" className="icon-btn danger" aria-label={t.del} title={t.del} onClick={onDelete}><TrashIcon width={18} height={18} /></button>
      </div>
    </li>
  );
}

export function Tasks({ date }: { date?: string }) {
  const { t, lang } = useI18n();
  const today = todayISO();
  const day = date ?? today;
  const version = useDataVersion();
  const [tasks, setTasks] = useState<Task[] | null>(null);
  const [editing, setEditing] = useState<string | null>(null); // a task id, or 'new'

  const reload = useCallback(() => taskRepo.list().then(setTasks).catch(() => setTasks([])), []);
  useEffect(() => { void reload(); }, [reload, version]);

  const visible = useMemo(() => (tasks ?? []).filter((x) => appliesTo(x, day)), [tasks, day]);
  const sections = useMemo(() => buildSections(visible), [visible]);
  const stats = progress(visible, day);
  const nf = new Intl.NumberFormat(lang === 'ar' ? 'ar-EG' : 'en-US'); // digits match the language
  const allGroups = useMemo(
    () => Array.from(new Set((tasks ?? []).map((x) => x.group.trim()).filter(Boolean))).sort(),
    [tasks]
  );

  async function cycle(task: Task) {
    await taskRepo.save(withStatus(task, day, NEXT[statusOn(task, day)], new Date().toISOString()));
    await reload();
  }
  async function remove(task: Task) {
    if (!window.confirm(task.pinned ? t.confirmDeletePinned : t.confirmDeleteTask)) return;
    await taskRepo.remove(task.id);
    await reload();
  }
  async function save(task: Task) {
    await taskRepo.save(task);
    setEditing(null);
    await reload();
  }

  const rows = (list: Task[]) => (
    <ul className="tasklist">
      {list.map((task) =>
        editing === task.id ? (
          <li key={task.id}>
            <TaskForm initial={task} defaultDate={day} groups={allGroups} onSave={save} onCancel={() => setEditing(null)} />
          </li>
        ) : (
          <TaskRow key={task.id} task={task} day={day} onCycle={() => void cycle(task)}
            onEdit={() => setEditing(task.id)} onDelete={() => void remove(task)} />
        )
      )}
    </ul>
  );

  return (
    <section>
      <h1>{t.tasksTitle}</h1>

      <div className="daynav">
        <a className="icon-btn" href={`#/tasks/${shiftDate(day, -1)}`} aria-label={t.prevDay} title={t.prevDay}>
          <ChevronLeftIcon className="flip" />
        </a>
        <div className="daylabel">
          <strong>{formatDate(day, lang)}</strong>
          {day !== today && <a className="link" href="#/tasks">{t.today}</a>}
        </div>
        <a className="icon-btn" href={`#/tasks/${shiftDate(day, 1)}`} aria-label={t.nextDay} title={t.nextDay}>
          <ChevronRightIcon className="flip" />
        </a>
      </div>

      {stats.total > 0 && (
        <div className="card progress">
          <div className="track" role="progressbar" aria-valuemin={0} aria-valuemax={100} aria-valuenow={stats.percent}>
            <div className="fill" style={{ width: `${stats.percent}%` }} />
          </div>
          <p className="muted">
            {fill(t.progressText, { done: nf.format(stats.done), total: nf.format(stats.total) })}
            {stats.partial > 0 && <><br />{fill(t.progressPartial, { n: nf.format(stats.partial) })}</>}
          </p>
        </div>
      )}

      {editing === 'new' ? (
        <TaskForm defaultDate={day} groups={allGroups} onSave={save} onCancel={() => setEditing(null)} />
      ) : (
        <button type="button" className="add-btn" onClick={() => setEditing('new')}>
          <PlusIcon width={20} height={20} />{t.addTask}
        </button>
      )}

      {tasks === null && <p className="muted">{t.loading}</p>}
      {tasks !== null && visible.length === 0 && editing !== 'new' && <p className="muted empty-state">{t.noTasks}</p>}

      {sections.pinned.length > 0 && (
        <div>
          <h2 className="sec"><PinIcon width={18} height={18} />{t.sectionPinned}</h2>
          {rows(sections.pinned)}
        </div>
      )}
      {sections.groups.map((g) => (
        <div key={g.label}>
          <h2 className="sec">
            <FolderIcon width={18} height={18} />{g.label}
            <span className="count">{nf.format(g.tasks.filter((x) => statusOn(x, day) === 'done').length)}/{nf.format(g.tasks.length)}</span>
          </h2>
          {rows(g.tasks)}
        </div>
      ))}
      {sections.singles.length > 0 && (
        <div>
          <h2 className="sec">{t.sectionSingles}</h2>
          {rows(sections.singles)}
        </div>
      )}
    </section>
  );
}

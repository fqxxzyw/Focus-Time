import { useRef, useState } from "react";
import { Data, day, Interruption, Task, Template, uid } from "../model";
import { Button, Field, Modal } from "./ui";
const reasons = [
  "手机消息",
  "临时工作",
  "他人打扰",
  "疲劳",
  "环境因素",
  "其他",
  "未填写",
] as const;
const localInput = (at: number) => {
  const d = new Date(at);
  return `${day(at)}T${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
};
export function ReasonForm({
  close,
  onSubmit,
}: {
  close: () => void;
  onSubmit: (reason: Interruption["reason"], note: string) => void;
}) {
  const [reason, setReason] = useState<Interruption["reason"]>("未填写"),
    [note, setNote] = useState("");
  const sent = useRef(false);
  function submit(r = reason) {
    if (sent.current) return;
    sent.current = true;
    onSubmit(r, note);
  }
  return (
    <Modal title="是什么打断了你？" close={() => submit("未填写")}>
      <p className="muted">
        计时已经暂停或结束。记录原因，帮助你了解自己的节奏。
      </p>
      <div className="reason-grid">
        {reasons.map((r) => (
          <button
            key={r}
            className={reason === r ? "selected" : ""}
            onClick={() => setReason(r)}
          >
            {r}
          </button>
        ))}
      </div>
      {reason === "其他" && (
        <Field label="备注">
          <textarea
            maxLength={5000}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        </Field>
      )}
      <div className="actions">
        <Button onClick={() => submit("未填写")}>跳过</Button>
        <Button primary onClick={() => submit()}>
          保存原因
        </Button>
      </div>
    </Modal>
  );
}
export function TaskForm({
  data,
  task,
  template,
  close,
  submit,
}: {
  data: Data;
  task?: Task;
  template?: Template;
  close: () => void;
  submit: (task?: Task, template?: Template) => void;
}) {
  const source = task || template;
  const [name, setName] = useState(source?.name || ""),
    [description, setDescription] = useState(source?.description || ""),
    [category, setCategory] = useState(source?.category || "学习"),
    [listId, setList] = useState(source?.listId || data.lists[0].id),
    [date, setDate] = useState(task?.date || day()),
    [estimate, setEstimate] = useState(source?.estimate || 1),
    [frequency, setFreq] = useState(template?.frequency || "none"),
    [start, setStart] = useState(template?.start || day()),
    [end, setEnd] = useState(template?.end || ""),
    [weekdays, setWeek] = useState(template?.weekdays || [1, 2, 3, 4, 5]),
    [monthDay, setMonthDay] = useState(template?.monthDay || 1),
    [err, setErr] = useState("");
  return (
    <Modal title={source ? "编辑任务" : "添加任务"} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (!name.trim()) return;
          if (
            frequency !== "none" &&
            ((end && end < start) ||
              (frequency === "weekly" && !weekdays.length))
          ) {
            setErr("请检查日期范围，并选择至少一个星期。");
            return;
          }
          const base = {
            id: source?.id || uid(),
            name: name.trim(),
            description,
            category: category.trim() || "未分类",
            listId,
            estimate,
            order:
              source?.order ??
              data.tasks.reduce((max, t) => Math.max(max, t.order), -1) + 1,
          };
          if (frequency === "none")
            submit({
              ...base,
              date,
              done: task?.done || false,
              completedAt: task?.completedAt,
              templateId: task?.templateId,
            });
          else
            submit(undefined, {
              ...base,
              frequency: frequency as Template["frequency"],
              start,
              end: end || undefined,
              weekdays,
              monthDay,
            });
        }}
      >
        <Field label="任务名称">
          <input
            autoFocus
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="说明">
          <textarea
            maxLength={5000}
            value={description}
            onChange={(e) => setDescription(e.target.value)}
          />
        </Field>
        <div className="form-grid">
          <Field label="分类">
            <input
              maxLength={100}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            />
          </Field>
          <Field label="所属待办集">
            <select value={listId} onChange={(e) => setList(e.target.value)}>
              {data.lists.map((l) => (
                <option key={l.id} value={l.id}>
                  {l.name}
                </option>
              ))}
            </select>
          </Field>
          <Field label="预计番茄数">
            <input
              type="number"
              min="1"
              max="100"
              required
              value={estimate}
              onChange={(e) => setEstimate(Number(e.target.value))}
            />
          </Field>
          {!task && (
            <Field label="重复周期">
              <select
                value={frequency}
                onChange={(e) => setFreq(e.target.value)}
              >
                {[
                  ["none", "不重复"],
                  ["daily", "每天"],
                  ["weekly", "每周"],
                  ["monthly", "每月"],
                ].map(([k, v]) => (
                  <option key={k} value={k}>
                    {v}
                  </option>
                ))}
              </select>
            </Field>
          )}
        </div>
        {frequency === "none" ? (
          <Field label="计划日期">
            <input
              type="date"
              required
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
        ) : (
          <>
            <div className="form-grid">
              <Field label="开始日期">
                <input
                  type="date"
                  required
                  min="2000-01-01"
                  value={start}
                  onChange={(e) => setStart(e.target.value)}
                />
              </Field>
              <Field label="结束日期（可选）">
                <input
                  type="date"
                  min={start}
                  value={end}
                  onChange={(e) => setEnd(e.target.value)}
                />
              </Field>
            </div>
            {frequency === "weekly" && (
              <div className="weekday-buttons">
                {["日", "一", "二", "三", "四", "五", "六"].map((v, i) => (
                  <button
                    type="button"
                    key={i}
                    aria-pressed={weekdays.includes(i)}
                    className={weekdays.includes(i) ? "selected" : ""}
                    onClick={() =>
                      setWeek(
                        weekdays.includes(i)
                          ? weekdays.filter((x) => x !== i)
                          : [...weekdays, i],
                      )
                    }
                  >
                    {v}
                  </button>
                ))}
              </div>
            )}
            {frequency === "monthly" && (
              <Field label="每月日期（不存在的日期自动跳过）">
                <input
                  type="number"
                  min="1"
                  max="31"
                  required
                  value={monthDay}
                  onChange={(e) => setMonthDay(Number(e.target.value))}
                />
              </Field>
            )}
            <p className="muted">编辑周期模板只影响未来尚未生成的实例。</p>
          </>
        )}
        {err && <p role="alert">{err}</p>}
        <div className="actions">
          <Button onClick={close}>取消</Button>
          <button type="submit" className="primary">
            保存任务
          </button>
        </div>
      </form>
    </Modal>
  );
}
export function ListForm({
  initial = "",
  close,
  submit,
}: {
  initial?: string;
  close: () => void;
  submit: (name: string) => void;
}) {
  const [name, setName] = useState(initial);
  return (
    <Modal title="待办集" close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim()) submit(name.trim());
        }}
      >
        <Field label="名称">
          <input
            required
            autoFocus
            maxLength={100}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <button className="primary" type="submit">
          保存
        </button>
      </form>
    </Modal>
  );
}
export function FutureForm({
  event,
  close,
  submit,
}: {
  event?: Data["future"][number];
  close: () => void;
  submit: (item: Data["future"][number]) => void;
}) {
  const [name, setName] = useState(event?.name || ""),
    [target, setTarget] = useState(
      localInput(event?.target || Date.now() + 86400000),
    ),
    [description, setDesc] = useState(event?.description || ""),
    [pinned, setPinned] = useState(event?.pinned || false);
  return (
    <Modal title={event ? "编辑未来事件" : "添加未来事件"} close={close}>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (name.trim() && isFinite(+new Date(target)))
            submit({
              id: event?.id || uid(),
              name: name.trim(),
              target: +new Date(target),
              description,
              pinned,
            });
        }}
      >
        <Field label="事件名称">
          <input
            required
            maxLength={200}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label="目标日期时间（当前本地时区）">
          <input
            type="datetime-local"
            required
            value={target}
            onChange={(e) => setTarget(e.target.value)}
          />
        </Field>
        <Field label="说明">
          <textarea
            maxLength={5000}
            value={description}
            onChange={(e) => setDesc(e.target.value)}
          />
        </Field>
        <Field label="置顶">
          <input
            type="checkbox"
            checked={pinned}
            onChange={(e) => setPinned(e.target.checked)}
          />
        </Field>
        <button className="primary" type="submit">
          保存事件
        </button>
      </form>
    </Modal>
  );
}
export function CheckForm({
  kind,
  check,
  close,
  submit,
}: {
  kind: "bed" | "wake";
  check?: Data["checks"][number];
  close: () => void;
  submit: (item: Data["checks"][number]) => void;
}) {
  const [at, setAt] = useState(localInput(check?.at || Date.now()));
  return (
    <Modal
      title={kind === "bed" ? "准备睡觉 · 上床时间" : "已经起床 · 起床时间"}
      close={close}
    >
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (isFinite(+new Date(at)))
            submit({ id: check?.id || uid(), kind, at: +new Date(at) });
        }}
      >
        <Field label="日期与时间（允许补录）">
          <input
            required
            type="datetime-local"
            value={at}
            onChange={(e) => setAt(e.target.value)}
          />
        </Field>
        <p className="muted">睡眠打卡表示上床时间，不代表实际入睡时间。</p>
        <button type="submit" className="primary">
          保存打卡
        </button>
      </form>
    </Modal>
  );
}

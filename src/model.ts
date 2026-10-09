import { z } from "zod";
const id = z.string().min(1),
  timestamp = z.number().finite().nonnegative(),
  date = z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .refine((v) => {
      const d = new Date(v + "T12:00:00");
      return !isNaN(+d) && day(+d) === v;
    });
export const taskSchema = z.object({
  id,
  name: z.string().min(1).max(200),
  description: z.string().max(5000),
  category: z.string(),
  listId: id,
  date,
  estimate: z.number().int().min(1).max(100),
  done: z.boolean(),
  completedAt: timestamp.optional(),
  order: z.number().finite(),
  templateId: id.optional(),
});
const templateSchema = taskSchema
  .omit({ date: true, done: true, completedAt: true, templateId: true })
  .extend({
    frequency: z.enum(["daily", "weekly", "monthly"]),
    weekdays: z.array(z.number().int().min(0).max(6)),
    monthDay: z.number().int().min(1).max(31),
    start: date,
    end: date.optional(),
  })
  .refine((x) => !x.end || x.end >= x.start, "结束日期早于开始日期");
const intervalSchema = z
  .object({ start: timestamp, end: timestamp })
  .refine((x) => x.end >= x.start);
const snapshotSchema = z.object({
  taskId: id.optional(),
  name: z.string(),
  category: z.string(),
  listId: z.string(),
  listName: z.string(),
});
const sessionSchema = z.object({
  id,
  mode: z.enum(["pomodoro", "up", "down"]),
  phase: z.enum(["focus", "short", "long"]),
  status: z.enum(["running", "paused", "finished"]),
  target: z.number().finite().nonnegative(),
  startedAt: timestamp,
  endedAt: timestamp.optional(),
  anchor: timestamp.optional(),
  intervals: z.array(intervalSchema),
  snapshot: snapshotSchema,
  background: z.string(),
  natural: z.boolean(),
  recovered: z.boolean().optional(),
});
const eventSchema = z.object({
  id,
  sessionId: id,
  at: timestamp,
  action: z.enum(["pause", "end"]),
  reason: z.enum([
    "手机消息",
    "临时工作",
    "他人打扰",
    "疲劳",
    "环境因素",
    "其他",
    "未填写",
  ]),
  note: z.string().max(5000),
});
const image = z
  .string()
  .max(6000000)
  .refine(
    (v) =>
      !v || /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v),
    "图片必须为本地图片数据",
  );
const background = z
  .string()
  .max(6000000)
  .refine(
    (v) =>
      ["forest", "ocean", "dusk", "random"].includes(v) ||
      /^#[0-9a-fA-F]{6}$/.test(v) ||
      /^data:image\/(png|jpeg|webp|gif);base64,[A-Za-z0-9+/=]+$/.test(v),
    "背景格式错误",
  );
const settingsSchema = z.object({
  theme: z.enum(["light", "dark", "system"]),
  background,
  animation: z.enum(["roll", "flip"]),
  focus: z.number().min(1).max(180),
  short: z.number().min(1).max(60),
  long: z.number().min(1).max(120),
  cycles: z.number().int().min(1).max(12),
  auto: z.boolean(),
  sound: z.boolean(),
  volume: z.number().min(0).max(1),
  weekStart: z.union([z.literal(0), z.literal(1)]),
});
export const dataSchema = z
  .object({
    version: z.literal(1),
    profile: z.object({
      nickname: z.string().max(60),
      bio: z.string().max(500),
      avatar: image,
      goal: z.number().min(1).max(1440),
    }),
    settings: settingsSchema,
    lists: z.array(z.object({ id, name: z.string().min(1).max(100) })).min(1),
    tasks: z.array(taskSchema),
    templates: z.array(templateSchema),
    sessions: z.array(sessionSchema),
    interruptions: z.array(eventSchema),
    future: z.array(
      z.object({
        id,
        name: z.string().min(1),
        target: timestamp,
        description: z.string(),
        pinned: z.boolean(),
      }),
    ),
    checks: z.array(
      z.object({ id, kind: z.enum(["bed", "wake"]), at: timestamp }),
    ),
    badges: z.array(z.object({ id, unlockedAt: timestamp })),
    completionLedger: z.array(z.object({ taskId: id, at: timestamp })),
    generated: z.array(z.string()),
    cycle: z.number().int().nonnegative(),
  })
  .superRefine((d, c) => {
    for (const key of [
      "lists",
      "tasks",
      "templates",
      "sessions",
      "interruptions",
      "future",
      "checks",
      "badges",
    ] as const) {
      const ids = d[key].map((x) => x.id);
      if (new Set(ids).size !== ids.length)
        c.addIssue({ code: "custom", message: `${key} 含重复 ID` });
    }
    if (d.sessions.filter((s) => s.status !== "finished").length > 1)
      c.addIssue({ code: "custom", message: "只能有一个活动会话" });
    for (const t of d.tasks)
      if (!d.lists.some((l) => l.id === t.listId))
        c.addIssue({ code: "custom", message: "任务引用不存在的待办集" });
    for (const t of d.templates)
      if (
        !d.lists.some((l) => l.id === t.listId) ||
        t.start < "2000-01-01" ||
        t.start > "2100-12-31" ||
        (t.frequency === "weekly" && !t.weekdays.length)
      )
        c.addIssue({ code: "custom", message: "周期模板范围或待办集无效" });
    for (const e of d.interruptions)
      if (!d.sessions.some((s) => s.id === e.sessionId))
        c.addIssue({ code: "custom", message: "打断事件引用不存在的会话" });
    for (const s of d.sessions) {
      let end = 0;
      for (const i of s.intervals) {
        if (i.start < end)
          c.addIssue({ code: "custom", message: "计时区间重叠" });
        if (
          i.start < s.startedAt ||
          (s.endedAt !== undefined && i.end > s.endedAt)
        )
          c.addIssue({ code: "custom", message: "区间超出会话范围" });
        end = i.end;
      }
      if (s.status === "running" && s.anchor === undefined)
        c.addIssue({ code: "custom", message: "运行会话缺少时间戳" });
      if (s.anchor !== undefined && s.anchor < end)
        c.addIssue({ code: "custom", message: "时间戳重叠" });
      if (s.status === "finished" && s.endedAt === undefined)
        c.addIssue({ code: "custom", message: "缺少结束时间" });
      if (s.mode !== "up" && seconds(s) > s.target + 0.001)
        c.addIssue({ code: "custom", message: "超出目标时长" });
    }
  });
export type Data = z.infer<typeof dataSchema>;
export type Task = z.infer<typeof taskSchema>;
export type Session = z.infer<typeof sessionSchema>;
export type Template = z.infer<typeof templateSchema>;
export type Interruption = z.infer<typeof eventSchema>;
export const uid = () => crypto.randomUUID();
export function day(at = Date.now()) {
  const d = new Date(at);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}
export function empty(): Data {
  return {
    version: 1,
    profile: {
      nickname: "时光旅人",
      bio: "把时间留给重要的事。",
      avatar: "",
      goal: 120,
    },
    settings: {
      theme: "light",
      background: "forest",
      animation: "roll",
      focus: 25,
      short: 5,
      long: 15,
      cycles: 4,
      auto: false,
      sound: true,
      volume: 0.4,
      weekStart: 1,
    },
    lists: [
      { id: "study", name: "学习" },
      { id: "work", name: "工作" },
      { id: "life", name: "个人生活" },
    ],
    tasks: [],
    templates: [],
    sessions: [],
    interruptions: [],
    future: [],
    checks: [],
    badges: [],
    completionLedger: [],
    generated: [],
    cycle: 0,
  };
}
export function seconds(s: Session, now = Date.now()) {
  const saved = s.intervals.reduce((a, i) => a + (i.end - i.start) / 1000, 0);
  const total =
    saved +
    (s.status === "running" && s.anchor !== undefined
      ? Math.max(0, (now - s.anchor) / 1000)
      : 0);
  return s.mode === "up" ? total : Math.min(s.target, total);
}
export const valid = (s: Session) =>
  s.status === "finished" && s.phase === "focus" && seconds(s) >= 300;
export function settle(s: Session, now: number) {
  if (s.status !== "running" || s.anchor === undefined) return;
  const amount = seconds(s, now) - seconds({ ...s, status: "paused" }, now);
  if (amount > 0)
    s.intervals.push({ start: s.anchor, end: s.anchor + amount * 1000 });
  s.anchor = undefined;
}
export function pause(s: Session, now: number) {
  if (s.status !== "running") return false;
  settle(s, now);
  s.status = "paused";
  return true;
}
export function resume(s: Session, now: number) {
  if (s.status !== "paused") return false;
  s.anchor = now;
  s.status = "running";
  s.recovered = false;
  return true;
}
export function finish(s: Session, now: number, natural = false) {
  if (s.status === "finished") return false;
  settle(s, now);
  s.endedAt = natural && s.intervals.length ? s.intervals.at(-1)!.end : now;
  s.status = "finished";
  s.natural = natural;
  return true;
}
export function recover(d: Data, now: number) {
  const s = d.sessions.find((s) => s.status !== "finished");
  if (!s || s.status !== "running") return;
  if (s.mode === "up") {
    pause(s, now);
    s.recovered = true;
  } else if (seconds(s, now) >= s.target) {
    finish(s, now, true);
    if (s.phase === "focus" && s.mode === "pomodoro") d.cycle++;
  }
}
export function makeSession(
  d: Data,
  mode: Session["mode"],
  target: number,
  taskId: string,
  name: string,
  now: number,
  phase: Session["phase"] = "focus",
): Session {
  const t = d.tasks.find((t) => t.id === taskId);
  return {
    id: uid(),
    mode,
    phase,
    target,
    startedAt: now,
    anchor: now,
    status: "running",
    intervals: [],
    natural: false,
    background:
      d.settings.background === "random"
        ? ["forest", "dusk", "ocean"][Math.floor(Math.random() * 3)]
        : d.settings.background,
    snapshot: {
      taskId: t?.id,
      name: t?.name || name || "自由专注",
      category: t?.category || "未分类",
      listId: t?.listId || "",
      listName: d.lists.find((l) => l.id === t?.listId)?.name || "临时任务",
    },
  };
}
export function generate(d: Data, today = day()) {
  for (const t of d.templates) {
    const end = t.end && t.end < today ? t.end : today;
    for (
      let dt = new Date(t.start + "T12:00:00");
      day(+dt) <= end;
      dt.setDate(dt.getDate() + 1)
    ) {
      const key = day(+dt),
        token = t.id + ":" + key;
      const matches =
        t.frequency === "daily" ||
        (t.frequency === "weekly" && t.weekdays.includes(dt.getDay())) ||
        (t.frequency === "monthly" && dt.getDate() === t.monthDay);
      if (matches && !d.generated.includes(token)) {
        d.tasks.push({
          id: uid(),
          name: t.name,
          description: t.description,
          category: t.category,
          listId: t.listId,
          estimate: t.estimate,
          date: key,
          order: d.tasks.reduce((max, t) => Math.max(max, t.order), -1) + 1,
          done: false,
          templateId: t.id,
        });
        d.generated.push(token);
      }
    }
  }
}
export function completeTask(d: Data, t: Task, now: number) {
  t.done = !t.done;
  t.completedAt = t.done ? now : undefined;
  if (t.done && !d.completionLedger.some((x) => x.taskId === t.id))
    d.completionLedger.push({ taskId: t.id, at: now });
}
export function split(start: number, end: number, unit: "day" | "hour") {
  const out: { date: string; hour: number; seconds: number }[] = [];
  for (let cursor = start; cursor < end; ) {
    const dt = new Date(cursor),
      next = new Date(cursor);
    if (unit === "day") next.setHours(24, 0, 0, 0);
    else next.setHours(next.getHours() + 1, 0, 0, 0);
    const edge = Math.min(end, +next);
    if (edge <= cursor) break;
    out.push({
      date: day(cursor),
      hour: dt.getHours(),
      seconds: (edge - cursor) / 1000,
    });
    cursor = edge;
  }
  return out;
}
export function stats(
  d: Data,
  from = "0000-00-00",
  to = "9999-99-99",
  taskKey?: string,
) {
  const sessions = d.sessions.filter(
    (s) =>
      valid(s) &&
      (!taskKey || (s.snapshot.taskId || s.snapshot.name) === taskKey),
  );
  const daily: Record<string, { seconds: number; count: number }> = {},
    hours = Array(24).fill(0) as number[],
    tasks: Record<
      string,
      {
        name: string;
        category: string;
        seconds: number;
        count: number;
        key: string;
      }
    > = {};
  let total = 0,
    count = 0,
    pomodoros = 0;
  for (const s of sessions) {
    const key = s.snapshot.taskId || s.snapshot.name;
    const row = (tasks[key] ??= {
      key,
      name: s.snapshot.name,
      category: s.snapshot.category,
      seconds: 0,
      count: 0,
    });
    for (const i of s.intervals)
      for (const piece of split(i.start, i.end, "hour"))
        if (piece.date >= from && piece.date <= to) {
          total += piece.seconds;
          row.seconds += piece.seconds;
          hours[piece.hour] += piece.seconds;
          (daily[piece.date] ??= { seconds: 0, count: 0 }).seconds +=
            piece.seconds;
        }
    const date = day(s.endedAt);
    if (date >= from && date <= to) {
      count++;
      row.count++;
      (daily[date] ??= { seconds: 0, count: 0 }).count++;
      if (s.mode === "pomodoro" && s.natural) pomodoros++;
    }
  }
  return {
    total,
    count,
    pomodoros,
    average: count ? total / count : 0,
    daily,
    hours,
    tasks: Object.values(tasks).filter((x) => x.seconds || x.count),
    completed: d.completionLedger.filter(
      (x) =>
        (!taskKey || x.taskId === taskKey) &&
        day(x.at) >= from &&
        day(x.at) <= to,
    ).length,
  };
}
export function streak(d: Data, now = Date.now()) {
  const days = stats(d).daily;
  const dt = new Date(now);
  if (!days[day(now)]?.seconds) dt.setDate(dt.getDate() - 1);
  let n = 0;
  while (days[day(+dt)]?.seconds) {
    n++;
    dt.setDate(dt.getDate() - 1);
  }
  return n;
}
export const badgeDefs = [
  ["first", "🌱", "初见专注", "首次有效专注", 1],
  ["ten", "🪴", "渐入佳境", "累计 10 次有效专注", 10],
  ["hours", "⏳", "时间收藏家", "累计专注 10 小时", 36000],
  ["day", "☀️", "心流时刻", "单日专注 2 小时", 7200],
  ["three", "🔥", "三日之约", "连续 3 天专注", 3],
  ["seven", "🌟", "一周的坚持", "连续 7 天专注", 7],
  ["task", "✅", "踏出一步", "完成首个任务", 1],
  ["twenty", "🏆", "行动达人", "累计完成 20 个任务", 20],
] as const;
export function badgeProgress(d: Data, now = Date.now()) {
  const s = stats(d);
  const days = Object.keys(s.daily).sort();
  let run = 0,
    max = 0,
    last = "";
  for (const k of days) {
    if (!s.daily[k].seconds) continue;
    const prev = new Date(k + "T12:00:00");
    prev.setDate(prev.getDate() - 1);
    run = day(+prev) === last ? run + 1 : 1;
    max = Math.max(max, run);
    last = k;
  }
  return [
    s.count,
    s.count,
    s.total,
    Math.max(0, ...Object.values(s.daily).map((x) => x.seconds)),
    Math.max(max, streak(d, now)),
    Math.max(max, streak(d, now)),
    d.completionLedger.length,
    d.completionLedger.length,
  ];
}
export function unlock(d: Data, now: number) {
  const progress = badgeProgress(d, now),
    fresh: string[] = [];
  badgeDefs.forEach((b, i) => {
    if (progress[i] >= b[4] && !d.badges.some((x) => x.id === b[0])) {
      d.badges.push({ id: b[0], unlockedAt: now });
      fresh.push(b[2]);
    }
  });
  return fresh;
}
export function validate(input: unknown): Data {
  return dataSchema.parse(input);
}
export function format(sec: number) {
  const n = Math.floor(sec);
  return `${Math.floor(n / 3600)}小时 ${Math.floor((n % 3600) / 60)}分`;
}
export function clock(sec: number) {
  const n = Math.max(0, Math.floor(sec));
  return `${Math.floor(n / 60)
    .toString()
    .padStart(2, "0")}:${(n % 60).toString().padStart(2, "0")}`;
}
export function sleepPairs(d: Data) {
  const checks = [...d.checks].sort((a, b) => a.at - b.at);
  const rows: { bed?: number; wake?: number }[] = [];
  let pending: number | undefined;
  for (const c of checks) {
    if (c.kind === "bed") {
      if (pending !== undefined) rows.push({ bed: pending });
      pending = c.at;
    } else {
      rows.push({ bed: pending, wake: c.at });
      pending = undefined;
    }
  }
  if (pending !== undefined) rows.push({ bed: pending });
  return rows.reverse();
}
export function nightHour(at: number) {
  const dt = new Date(at),
    h = dt.getHours() + dt.getMinutes() / 60;
  return h < 18 ? h + 24 : h;
}

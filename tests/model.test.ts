import { describe, it, expect } from "vitest";
import {
  empty,
  makeSession,
  pause,
  resume,
  finish,
  seconds,
  valid,
  stats,
  recover,
  generate,
  day,
  completeTask,
  unlock,
  streak,
  validate,
  sleepPairs,
  nightHour,
} from "../src/model";
const at = (s: string) => +new Date(s);
const begin = at("2026-10-08T23:55:00");
function record(start = begin, duration = 600) {
  const d = empty(),
    s = makeSession(d, "up", 0, "", "读书", start);
  d.sessions.push(s);
  finish(s, start + duration * 1000);
  return d;
}
describe("会话状态与五分钟门槛", () => {
  it("299 秒不计，300 秒计入；正计时不计番茄", () => {
    expect(valid(record(begin, 299).sessions[0])).toBe(false);
    const d = record(begin, 300);
    expect(stats(d).count).toBe(1);
    expect(stats(d).pomodoros).toBe(0);
  });
  it("暂停期间不累计，继续保留原有有效时间", () => {
    const d = empty(),
      s = makeSession(d, "pomodoro", 1500, "", "", begin);
    pause(s, begin + 120000);
    expect(seconds(s, begin + 999000)).toBe(120);
    resume(s, begin + 600000);
    finish(s, begin + 780000);
    expect(seconds(s)).toBe(300);
    expect(s.intervals).toHaveLength(2);
    expect(valid(s)).toBe(true);
  });
  it("重复暂停、继续与完成均被忽略", () => {
    const s = makeSession(empty(), "up", 0, "", "", begin);
    expect(pause(s, begin + 1000)).toBe(true);
    expect(pause(s, begin + 2000)).toBe(false);
    expect(resume(s, begin + 5000)).toBe(true);
    expect(resume(s, begin + 6000)).toBe(false);
    expect(finish(s, begin + 305000)).toBe(true);
    expect(finish(s, begin + 400000)).toBe(false);
    expect(s.intervals).toHaveLength(2);
  });
  it("刷新恢复倒计时封顶且只完成一次", () => {
    const d = empty(),
      s = makeSession(d, "pomodoro", 1500, "", "", begin);
    d.sessions.push(s);
    recover(d, begin + 9000000);
    recover(d, begin + 9990000);
    expect(seconds(s)).toBe(1500);
    expect(s.endedAt).toBe(begin + 1500000);
    expect(d.cycle).toBe(1);
    expect(stats(d).pomodoros).toBe(1);
  });
  it("刷新恢复正计时累计并暂停等待确认", () => {
    const d = empty(),
      s = makeSession(d, "up", 0, "", "", begin);
    d.sessions.push(s);
    recover(d, begin + 900000);
    expect(s.status).toBe("paused");
    expect(s.recovered).toBe(true);
    expect(seconds(s, begin + 9990000)).toBe(900);
  });
  it("休息不计入任何专注统计", () => {
    const d = empty(),
      s = makeSession(d, "pomodoro", 600, "", "", begin, "short");
    d.sessions.push(s);
    finish(s, begin + 600000, true);
    expect(stats(d).total).toBe(0);
  });
});
describe("周期任务", () => {
  function template(frequency: "daily" | "weekly" | "monthly") {
    const d = empty();
    d.templates.push({
      id: "t",
      name: "周期",
      description: "",
      category: "学习",
      listId: "study",
      estimate: 1,
      order: 0,
      frequency,
      weekdays: [1, 3],
      monthDay: 31,
      start: "2026-01-01",
      end: "2026-03-31",
    });
    return d;
  }
  it("每天补齐，重复打开以及删除实例均不重新生成", () => {
    const d = template("daily");
    generate(d, "2026-01-03");
    expect(d.tasks).toHaveLength(3);
    d.tasks.pop();
    generate(d, "2026-01-03");
    expect(d.tasks).toHaveLength(2);
    generate(d, "2026-01-04");
    expect(d.tasks).toHaveLength(3);
  });
  it("每周指定星期、开始和结束边界", () => {
    const d = template("weekly");
    generate(d, "2026-01-10");
    expect(d.tasks.map((t) => t.date)).toEqual(["2026-01-05", "2026-01-07"]);
  });
  it("31 日不存在时跳过；结束后停止", () => {
    const d = template("monthly");
    generate(d, "2026-05-01");
    expect(d.tasks.map((t) => t.date)).toEqual(["2026-01-31", "2026-03-31"]);
  });
});
describe("统计区间归属", () => {
  it("跨午夜时长分别分配，次数归结束日期", () => {
    const d = record();
    const a = stats(d, "2026-10-08", "2026-10-08"),
      b = stats(d, "2026-10-09", "2026-10-09");
    expect(a.total).toBe(300);
    expect(a.count).toBe(0);
    expect(b.total).toBe(300);
    expect(b.count).toBe(1);
  });
  it("小时拆分、暂停排除、跨月和跨年", () => {
    const start = at("2026-12-31T23:50:00"),
      d = empty(),
      s = makeSession(d, "up", 0, "", "", start);
    d.sessions.push(s);
    pause(s, start + 600000);
    resume(s, start + 1200000);
    finish(s, start + 1800000);
    expect(stats(d, "2026-12-31", "2026-12-31").hours[23]).toBe(600);
    expect(stats(d, "2027-01-01", "2027-01-01").hours[0]).toBe(600);
    expect(stats(d, "2026-01-01", "2026-12-31").total).toBe(600);
    expect(stats(d).total).toBe(1200);
  });
  it("删除任务保留历史时长、次数、快照和完成记录", () => {
    const d = empty(),
      t = {
        id: "a",
        name: "学习",
        description: "",
        category: "编程",
        listId: "study",
        date: day(begin),
        estimate: 1,
        done: false,
        order: 0,
      };
    d.tasks.push(t);
    const s = makeSession(d, "pomodoro", 1500, t.id, "", begin);
    d.sessions.push(s);
    finish(s, begin + 1500000, true);
    completeTask(d, t, begin + 1500000);
    const before = stats(d);
    d.tasks = [];
    expect(stats(d)).toEqual(before);
    expect(s.snapshot).toMatchObject({
      name: "学习",
      category: "编程",
      listName: "学习",
    });
  });
});
describe("徽章与打卡", () => {
  it("首次有效专注解锁一次，删除任务不撤回", () => {
    const d = record();
    expect(unlock(d, begin + 600000)).toEqual(["初见专注"]);
    expect(unlock(d, begin + 700000)).toEqual([]);
    expect(d.badges[0].unlockedAt).toBe(begin + 600000);
  });
  it("昨日连续仍保留，当天未开始不会提前中断；断日才中断", () => {
    const now = at("2026-10-09T12:00:00"),
      d = record(at("2026-10-08T12:00:00"));
    expect(streak(d, now)).toBe(1);
    expect(streak(d, now + 86400000)).toBe(0);
  });
  it("八种成就可由真实数据解锁且保留", () => {
    const d = empty();
    for (let n = 0; n < 7; n++) {
      const start = at(`2026-10-${String(n + 1).padStart(2, "0")}T09:00:00`);
      for (let j = 0; j < 4; j++) {
        const s = makeSession(d, "up", 0, "", "", start + j * 3600000);
        finish(s, start + (j + 1) * 3600000);
        d.sessions.push(s);
      }
    }
    for (let i = 0; i < 20; i++)
      d.completionLedger.push({ taskId: String(i), at: begin });
    unlock(d, begin);
    expect(d.badges).toHaveLength(8);
    d.tasks = [];
    unlock(d, begin);
    expect(d.badges).toHaveLength(8);
  });
  it("不完整睡眠不制造时长，23:50 与 00:10 夜间轴相近", () => {
    const d = empty();
    d.checks.push({ id: "b", kind: "bed", at: begin });
    expect(sleepPairs(d)).toEqual([{ bed: begin }]);
    expect(
      nightHour(at("2026-10-09T00:10:00")) -
        nightHour(at("2026-10-08T23:50:00")),
    ).toBeCloseTo(1 / 3);
  });
});
describe("备份校验", () => {
  it("版本化完整往返", () => {
    const d = record();
    expect(validate(JSON.parse(JSON.stringify(d)))).toEqual(d);
  });
  it("拒绝版本错误、缺失数据、负时长、重复 ID、重叠区间、非法日期", () => {
    expect(() => validate({ ...empty(), version: 9 })).toThrow();
    expect(() => validate({})).toThrow();
    const d = record();
    d.sessions.push(structuredClone(d.sessions[0]));
    expect(() => validate(d)).toThrow();
    d.sessions.pop();
    d.sessions[0].intervals[0].end = begin - 1;
    expect(() => validate(d)).toThrow();
    const x = record();
    x.sessions[0].intervals.push({ start: begin, end: begin + 1000 });
    expect(() => validate(x)).toThrow();
    const y = empty();
    y.tasks.push({
      id: "a",
      name: "x",
      description: "",
      category: "x",
      listId: "study",
      date: "2026-02-30",
      estimate: 1,
      order: 0,
      done: false,
    });
    expect(() => validate(y)).toThrow();
  });
});

import { demo } from "../src/demo";
it("演示数据符合导入格式，包含多种打断原因与有效暂停区间", () => {
  const d = demo(at("2026-10-09T12:00:00"));
  expect(() => validate(d)).not.toThrow();
  expect(new Set(d.interruptions.map((x) => x.reason)).size).toBe(4);
  expect(d.sessions.some((s) => s.intervals.length === 2)).toBe(true);
  expect(stats(d).total).toBeGreaterThan(0);
});

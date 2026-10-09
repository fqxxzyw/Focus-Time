import { Data, day, empty, uid, unlock } from "./model";
export function demo(now = Date.now()): Data {
  const d = empty();
  d.profile.nickname = "时光旅人";
  d.tasks = ["阅读与笔记", "深度学习练习", "项目设计", "散步与放松"].map(
    (name, i) => ({
      id: uid(),
      name,
      description: "演示数据，可自由编辑",
      category: ["阅读", "编程", "工作", "生活"][i],
      listId: ["study", "study", "work", "life"][i],
      date: day(now),
      estimate: 2,
      done: i === 0,
      completedAt: i === 0 ? now : undefined,
      order: i,
    }),
  );
  d.completionLedger = [{ taskId: d.tasks[0].id, at: now }];
  for (let n = 28; n >= 0; n--) {
    const dt = new Date(now);
    dt.setDate(dt.getDate() - n);
    for (let j = 0; j < 1 + (n % 4); j++) {
      dt.setHours(8 + j * 3, (n * 7) % 60, 0, 0);
      const start = +dt,
        end = start + (20 + (n % 16)) * 60000 + (n % 2 === 0 ? 120000 : 0),
        t = d.tasks[(n + j) % 4];
      const sid = uid();
      d.sessions.push({
        id: sid,
        mode: "pomodoro",
        phase: "focus",
        status: "finished",
        target: (20 + (n % 16)) * 60,
        startedAt: start,
        endedAt: end,
        intervals:
          n % 2 === 0
            ? [
                { start, end: start + 300000 },
                { start: start + 420000, end },
              ]
            : [{ start, end }],
        natural: true,
        background: "forest",
        snapshot: {
          taskId: t.id,
          name: t.name,
          category: t.category,
          listId: t.listId,
          listName: d.lists.find((l) => l.id === t.listId)!.name,
        },
      });
      if (n % 2 === 0)
        d.interruptions.push({
          id: uid(),
          sessionId: sid,
          at: start + 5 * 60000,
          action: "pause",
          reason: ["手机消息", "疲劳", "未填写", "临时工作"][
            (Math.floor(n / 2) + j) % 4
          ] as Data["interruptions"][number]["reason"],
          note: "",
        });
    }
    dt.setHours(23, (n % 3) * 10, 0, 0);
    d.checks.push({ id: uid(), kind: "bed", at: +dt });
    dt.setDate(dt.getDate() + 1);
    dt.setHours(7, (n % 4) * 10, 0, 0);
    d.checks.push({ id: uid(), kind: "wake", at: +dt });
  }
  d.future = [
    {
      id: uid(),
      name: "下一次重要考试",
      target: now + 30 * 86400000,
      description: "每天前进一步",
      pinned: true,
    },
    {
      id: uid(),
      name: "期待的旅行",
      target: now + 65 * 86400000,
      description: "去看看新的风景",
      pinned: false,
    },
  ];
  unlock(d, now);
  return d;
}

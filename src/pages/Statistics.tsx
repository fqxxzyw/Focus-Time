import { ChevronRight } from "lucide-react";
import { useState } from "react";
import {
  Area,
  AreaChart,
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Button, Empty, Field, Metric } from "../components/ui";
import { Data, day, format, seconds, stats, valid } from "../model";
const colors = [
  "#438672",
  "#80ac91",
  "#d3ac6c",
  "#8095b1",
  "#ac88ad",
  "#df987b",
];
const reasons = [
  "手机消息",
  "临时工作",
  "他人打扰",
  "疲劳",
  "环境因素",
  "其他",
  "未填写",
] as const;
function dateRange(kind: string, from: string, to: string) {
  const now = new Date();
  if (kind === "today") return [day(), day()];
  if (kind === "month")
    return [day(+new Date(now.getFullYear(), now.getMonth(), 1)), day()];
  if (kind === "year") return [`${now.getFullYear()}-01-01`, day()];
  if (kind === "custom") return [from, to];
  return ["0000-00-00", "9999-99-99"];
}
export function Statistics({
  data: d,
  taskKey,
  choose,
}: {
  data: Data;
  taskKey?: string;
  choose: (key?: string) => void;
}) {
  const [range, setRange] = useState("month"),
    [from, setFrom] = useState(
      day(+new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
    ),
    [to, setTo] = useState(day()),
    [metric, setMetric] = useState("seconds"),
    [category, setCategory] = useState(""),
    [single, setSingle] = useState(""),
    [year, setYear] = useState(new Date().getFullYear());
  const [lo, hi] = dateRange(range, from, to),
    key = taskKey || single || undefined;
  const filtered: Data = category
    ? {
        ...d,
        sessions: d.sessions.filter((s) => s.snapshot.category === category),
      }
    : d;
  const s = stats(filtered, lo, hi, key),
    whole = stats(d),
    month = stats(
      d,
      day(+new Date(new Date().getFullYear(), new Date().getMonth(), 1)),
      day(),
    );
  const title = key
    ? d.tasks.find((t) => t.id === key)?.name ||
      d.sessions.find((s) => (s.snapshot.taskId || s.snapshot.name) === key)
        ?.snapshot.name
    : undefined;
  const deleted =
    key &&
    d.sessions.some((s) => s.snapshot.taskId === key) &&
    !d.tasks.some((t) => t.id === key);
  const dates = Object.keys(s.daily).sort(),
    start = lo === "0000-00-00" ? dates[0] || day() : lo,
    end = hi === "9999-99-99" ? dates.at(-1) || day() : hi;
  const trend: { date: string; value: number }[] = [];
  if (start <= end)
    for (
      let dt = new Date(start + "T12:00:00");
      day(+dt) <= end;
      dt.setDate(dt.getDate() + 1)
    ) {
      const date = day(+dt);
      trend.push({
        date,
        value:
          metric === "seconds"
            ? (s.daily[date]?.seconds || 0) / 60
            : s.daily[date]?.count || 0,
      });
    }
  const sorted = [...s.tasks].sort((a, b) => b.seconds - a.seconds),
    pie = sorted.slice(0, 6).map((t) => ({ name: t.name, value: t.seconds }));
  if (sorted.length > 6)
    pie.push({
      name: "其他",
      value: sorted.slice(6).reduce((sum, t) => sum + t.seconds, 0),
    });
  const interruptions = reasons.map((name) => ({
    name,
    count: d.interruptions.filter(
      (e) => day(e.at).slice(0, 7) === day().slice(0, 7) && e.reason === name,
    ).length,
  }));
  const heat = stats(d, `${year}-01-01`, `${year}-12-31`, key);
  const heatDays: { date: string; seconds: number }[] = [];
  for (
    let dt = new Date(year, 0, 1, 12);
    dt.getFullYear() === year;
    dt.setDate(dt.getDate() + 1)
  ) {
    const date = day(+dt);
    heatDays.push({ date, seconds: heat.daily[date]?.seconds || 0 });
  }
  const pad = (new Date(year, 0, 1).getDay() - d.settings.weekStart + 7) % 7;
  return (
    <>
      <div className="page-toolbar">
        <div>
          <h2>
            {title
              ? `${title}${deleted ? " · 已删除" : ""}`
              : "每一段专注，都有迹可循。"}
          </h2>
          <p className="muted">
            只统计累计满 5 分钟的有效专注 · 休息与暂停不计入
          </p>
        </div>
        {taskKey && (
          <Button onClick={() => choose(undefined)}>返回整体统计</Button>
        )}
      </div>
      <section className="panel filters">
        <Field label="统计范围">
          <select value={range} onChange={(e) => setRange(e.target.value)}>
            <option value="today">今日</option>
            <option value="month">本月</option>
            <option value="year">本年度</option>
            <option value="all">全部时间</option>
            <option value="custom">自定义</option>
          </select>
        </Field>
        {range === "custom" && (
          <>
            <Field label="开始日期">
              <input
                type="date"
                value={from}
                onChange={(e) => setFrom(e.target.value)}
              />
            </Field>
            <Field label="结束日期">
              <input
                type="date"
                min={from}
                value={to}
                onChange={(e) => setTo(e.target.value)}
              />
            </Field>
          </>
        )}
        <Field label="分类筛选">
          <select
            value={category}
            onChange={(e) => {
              setCategory(e.target.value);
              setSingle("");
            }}
          >
            <option value="">全部分类</option>
            {[...new Set(whole.tasks.map((t) => t.category))].map((c) => (
              <option key={c}>{c}</option>
            ))}
          </select>
        </Field>
        {!taskKey && (
          <Field label="单任务筛选">
            <select value={single} onChange={(e) => setSingle(e.target.value)}>
              <option value="">全部任务</option>
              {whole.tasks
                .filter((t) => !category || t.category === category)
                .map((t) => (
                  <option key={t.key} value={t.key}>
                    {t.name}
                    {d.sessions.some((s) => s.snapshot.taskId === t.key) &&
                    !d.tasks.some((x) => x.id === t.key)
                      ? "（已删除）"
                      : ""}
                  </option>
                ))}
            </select>
          </Field>
        )}
      </section>
      {lo > hi && <p role="alert">开始日期不得晚于结束日期</p>}
      <div className="metrics stats-metrics">
        <Metric label="有效专注次数" value={String(s.count)} unit="次" />
        <Metric
          label="有效专注时长"
          value={String(Math.floor(s.total / 60))}
          unit="分钟"
        />
        <Metric label="完成番茄数" value={String(s.pomodoros)} unit="个" />
        <Metric
          label="平均有效时长"
          value={(s.average / 60).toFixed(1)}
          unit="分钟"
        />
        <Metric label="已完成任务" value={String(s.completed)} unit="项" />
      </div>
      <div className="chart-grid">
        <section className="panel wide">
          <div className="section-heading">
            <h2>每日专注趋势</h2>
            <select
              aria-label="趋势指标"
              value={metric}
              onChange={(e) => setMetric(e.target.value)}
            >
              <option value="seconds">专注时长（分钟）</option>
              <option value="count">有效次数</option>
            </select>
          </div>
          <div className="chart">
            <ResponsiveContainer>
              <AreaChart data={trend}>
                <defs>
                  <linearGradient id="area" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="0%" stopColor="#438672" stopOpacity={0.3} />
                    <stop offset="100%" stopColor="#438672" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis
                  dataKey="date"
                  tickFormatter={(v) => v.slice(5)}
                  minTickGap={25}
                />
                <YAxis width={40} />
                <Tooltip
                  formatter={(v: number) => [
                    v.toFixed(2),
                    metric === "seconds" ? "分钟" : "次数",
                  ]}
                />
                <Area
                  type="monotone"
                  dataKey="value"
                  stroke="#438672"
                  fill="url(#area)"
                  strokeWidth={2}
                  isAnimationActive={false}
                />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <h2>任务时长占比</h2>
          {s.total > 0 ? (
            <>
              <div className="chart donut">
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={pie}
                      dataKey="value"
                      nameKey="name"
                      innerRadius="55%"
                      outerRadius="85%"
                      paddingAngle={3}
                      isAnimationActive={false}
                    >
                      {pie.map((_, i) => (
                        <Cell key={i} fill={colors[i % colors.length]} />
                      ))}
                    </Pie>
                    <Tooltip formatter={(v: number) => format(v)} />
                  </PieChart>
                </ResponsiveContainer>
              </div>
              <div className="legend">
                {pie.map((t, i) => (
                  <div key={i}>
                    <span style={{ background: colors[i % colors.length] }} />
                    <strong>{t.name}</strong>
                    <small>
                      {format(t.value)} ·{" "}
                      {((t.value / s.total) * 100).toFixed(1)}%
                    </small>
                  </div>
                ))}
              </div>
              {sorted.length > 6 && (
                <details>
                  <summary>查看“其他”任务明细</summary>
                  {sorted.slice(6).map((t) => (
                    <p key={t.key}>
                      {t.name} · {format(t.seconds)} ·{" "}
                      {((t.seconds / s.total) * 100).toFixed(1)}%
                    </p>
                  ))}
                </details>
              )}
            </>
          ) : (
            <Empty text="还没有有效专注记录" />
          )}
        </section>
        <section className="panel">
          <h2>分类统计</h2>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>分类</th>
                  <th>时长</th>
                  <th>次数</th>
                  <th>占比</th>
                </tr>
              </thead>
              <tbody>
                {[...new Set(s.tasks.map((t) => t.category))].map((c) => {
                  const rows = s.tasks.filter((t) => t.category === c),
                    total = rows.reduce((n, t) => n + t.seconds, 0);
                  return (
                    <tr key={c}>
                      <td>
                        <button className="link" onClick={() => setCategory(c)}>
                          {c}
                        </button>
                      </td>
                      <td>{format(total)}</td>
                      <td>{rows.reduce((n, t) => n + t.count, 0)}</td>
                      <td>
                        {s.total ? ((total / s.total) * 100).toFixed(1) : 0}%
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          <h3>独立任务统计</h3>
          {whole.tasks.map((t) => (
            <button
              className="task-stat-link"
              key={t.key}
              onClick={() => choose(t.key)}
            >
              <span>
                {t.name}
                {d.sessions.some((x) => x.snapshot.taskId === t.key) &&
                !d.tasks.some((x) => x.id === t.key)
                  ? "（已删除）"
                  : ""}
              </span>
              <ChevronRight size={15} />
            </button>
          ))}
        </section>
        <section className="panel wide">
          <div className="section-heading">
            <h2>年度专注热力图</h2>
            <input
              aria-label="热力图年份"
              type="number"
              min="2000"
              max="2100"
              value={year}
              onChange={(e) =>
                setYear(
                  Math.max(
                    2000,
                    Math.min(2100, Number(e.target.value) || 2026),
                  ),
                )
              }
            />
          </div>
          <div className="heat-scroll">
            <div className="heatmap">
              {Array.from({ length: pad }, (_, i) => (
                <span key={"p" + i} />
              ))}
              {heatDays.map((r) => (
                <button
                  key={r.date}
                  aria-label={`${r.date} ${format(r.seconds)}`}
                  title={`${r.date} · ${format(r.seconds)}`}
                  data-level={
                    r.seconds === 0
                      ? 0
                      : r.seconds < 1800
                        ? 1
                        : r.seconds < 3600
                          ? 2
                          : r.seconds < 7200
                            ? 3
                            : 4
                  }
                  onClick={() => {
                    setRange("custom");
                    setFrom(r.date);
                    setTo(r.date);
                  }}
                />
              ))}
            </div>
          </div>
          <div className="heat-legend">
            少 <span data-level="0" />
            <span data-level="1" />
            <span data-level="2" />
            <span data-level="3" />
            <span data-level="4" /> 多{" "}
            <small>悬停查看日期详情，点击查看当天统计</small>
          </div>
        </section>
        <section className="panel">
          <h2>本月打断原因</h2>
          <p className="muted">按打断事件次数统计，一个会话可发生多次打断。</p>
          <div className="chart">
            <ResponsiveContainer>
              <BarChart data={interruptions} layout="vertical">
                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                <XAxis type="number" allowDecimals={false} />
                <YAxis type="category" dataKey="name" width={72} />
                <Tooltip />
                <Bar
                  dataKey="count"
                  name="事件次数"
                  fill="#80ac91"
                  radius={[0, 5, 5, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
        <section className="panel">
          <h2>本月专注时段</h2>
          <p className="muted">有效区间按小时拆分，排除所有暂停时间。</p>
          <div className="chart">
            <ResponsiveContainer>
              <BarChart
                data={month.hours.map((seconds, hour) => ({
                  hour: `${hour}时`,
                  minutes: seconds / 60,
                }))}
              >
                <CartesianGrid vertical={false} strokeDasharray="3 3" />
                <XAxis dataKey="hour" interval={3} />
                <YAxis width={40} />
                <Tooltip formatter={(v: number) => [v.toFixed(2), "分钟"]} />
                <Bar
                  dataKey="minutes"
                  fill="#8095b1"
                  radius={[4, 4, 0, 0]}
                  isAnimationActive={false}
                />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </section>
      </div>
      <section className="panel">
        <h2>{key ? "任务历史记录" : "专注历史记录"}</h2>
        <p className="muted">
          未达标记录保留，但不计入有效时长和次数。次数归结束日期；时长按有效区间当地日期拆分。平均值
          = 范围内时长 ÷ 范围内结束次数。
        </p>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>结束时间</th>
                <th>任务快照</th>
                <th>有效计时</th>
                <th>类型</th>
                <th>统计状态</th>
              </tr>
            </thead>
            <tbody>
              {[...d.sessions]
                .filter(
                  (x) =>
                    x.status === "finished" &&
                    x.phase === "focus" &&
                    (!key || (x.snapshot.taskId || x.snapshot.name) === key) &&
                    day(x.endedAt) >= lo &&
                    day(x.endedAt) <= hi &&
                    (!category || x.snapshot.category === category),
                )
                .reverse()
                .map((x) => (
                  <tr key={x.id}>
                    <td>{new Date(x.endedAt!).toLocaleString("zh-CN")}</td>
                    <td>
                      {x.snapshot.name}
                      <small>
                        {x.snapshot.category} · {x.snapshot.listName}
                        {x.snapshot.taskId &&
                        !d.tasks.some((t) => t.id === x.snapshot.taskId)
                          ? " · 已删除"
                          : ""}
                      </small>
                    </td>
                    <td>
                      {format(seconds(x))}{" "}
                      <small>{seconds(x).toFixed(2)} 秒</small>
                    </td>
                    <td>
                      {
                        { pomodoro: "番茄钟", up: "正计时", down: "倒计时" }[
                          x.mode
                        ]
                      }
                    </td>
                    <td>
                      <span
                        className={`status-pill ${valid(x) ? "valid" : ""}`}
                      >
                        {valid(x)
                          ? x.mode === "pomodoro" && x.natural
                            ? "有效 · 完成番茄"
                            : "有效"
                          : "未达标"}
                      </span>
                    </td>
                  </tr>
                ))}
            </tbody>
          </table>
        </div>
        {!d.sessions.length && (
          <Empty text="开启一次专注，留下你的第一段时光。" />
        )}
      </section>
    </>
  );
}

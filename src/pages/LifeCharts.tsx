import {
  CartesianGrid,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { Data, day, nightHour } from "../model";
export function SleepCharts({ data: d }: { data: Data }) {
  const month = day().slice(0, 7);
  const rows = (kind: "bed" | "wake") =>
    d.checks
      .filter((c) => c.kind === kind && day(c.at).slice(0, 7) === month)
      .map((c) => ({
        date: Number(day(c.at).slice(-2)),
        hour: nightHour(c.at),
        at: new Date(c.at).toLocaleString("zh-CN"),
      }));
  return (
    <div className="chart-grid">
      {(["bed", "wake"] as const).map((kind) => (
        <section className="panel" key={kind}>
          <h2>本月{kind === "bed" ? "睡眠" : "起床"}打卡分布</h2>
          <p className="muted">
            连续夜间轴：18:00 → 次日 12:00；超出窗口仍按连续时间展示。
          </p>
          <div className="chart">
            <ResponsiveContainer>
              <ScatterChart>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  dataKey="date"
                  type="number"
                  domain={[1, 31]}
                  name="日期"
                />
                <YAxis
                  dataKey="hour"
                  type="number"
                  domain={[18, 36]}
                  ticks={[18, 21, 24, 27, 30, 33, 36]}
                  tickFormatter={(h) => `${h % 24}:00`}
                  width={50}
                  name="打卡时间"
                />
                <Tooltip
                  content={({ active, payload }) =>
                    active && payload?.length ? (
                      <div className="chart-tip">{payload[0].payload.at}</div>
                    ) : null
                  }
                />
                <Scatter
                  data={rows(kind)}
                  fill={kind === "bed" ? "#8095b1" : "#d3ac6c"}
                  isAnimationActive={false}
                />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </section>
      ))}
    </div>
  );
}

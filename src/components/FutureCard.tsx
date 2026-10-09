import { Calendar } from "lucide-react";
import { Data } from "../model";
export function FutureCard({
  event: e,
  now,
  edit,
  pin,
  remove,
}: {
  event: Data["future"][number];
  now: number;
  edit: () => void;
  pin: () => void;
  remove: () => void;
}) {
  const mins = Math.max(0, Math.floor((e.target - now) / 60000));
  return (
    <div className="future-card">
      <div className="future-heading">
        <Calendar size={18} />
        <strong>{e.name}</strong>
        {e.pinned && <small>置顶</small>}
      </div>
      <div className="countdown">
        {e.target <= now ? (
          "已到期"
        ) : (
          <>
            <strong>{Math.floor(mins / 1440)}</strong> 天{" "}
            <strong>{Math.floor((mins % 1440) / 60)}</strong> 小时{" "}
            <strong>{mins % 60}</strong> 分
          </>
        )}
      </div>
      <p>{e.description}</p>
      <small>{new Date(e.target).toLocaleString("zh-CN")}</small>
      <div className="future-actions">
        <button onClick={pin}>{e.pinned ? "取消置顶" : "置顶"}</button>
        <button onClick={edit}>编辑</button>
        <button onClick={remove}>删除</button>
      </div>
    </div>
  );
}

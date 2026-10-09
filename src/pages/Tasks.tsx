import { ArrowDown, ArrowUp, Check, Plus, Trash2 } from "lucide-react";
import { ReactNode, useState } from "react";
import { ListForm } from "../components/forms";
import { Button, Empty, Field, Modal } from "../components/ui";
import { completeTask, Data, Task, Template, uid } from "../model";
export function TasksPage({
  data: d,
  add,
  edit,
  remove,
  change,
  select,
  detail,
  confirm,
  setModal,
  close,
}: {
  data: Data;
  add: () => void;
  edit: (t?: Task, tp?: Template) => void;
  remove: (t: Task) => void;
  change: (f: (d: Data) => void) => void;
  select: (id: string) => void;
  detail: (id: string) => void;
  confirm: (t: string, text: string, f: () => void) => void;
  setModal: (m: ReactNode) => void;
  close: () => void;
}) {
  const [date, setDate] = useState(""),
    [category, setCategory] = useState(""),
    [list, setList] = useState(""),
    [status, setStatus] = useState("");
  const filtered = d.tasks
    .filter(
      (t) =>
        (!date || t.date === date) &&
        (!category || t.category === category) &&
        (!list || t.listId === list) &&
        (!status || (status === "done") === t.done),
    )
    .sort((a, b) => a.order - b.order);
  function move(t: Task, delta: number) {
    const neighbor = filtered[filtered.findIndex((x) => x.id === t.id) + delta];
    if (!neighbor) return;
    change((next) => {
      const a = next.tasks.find((x) => x.id === t.id)!,
        b = next.tasks.find((x) => x.id === neighbor.id)!;
      [a.order, b.order] = [b.order, a.order];
    });
  }
  return (
    <>
      <div className="page-toolbar">
        <div>
          <h2>把想做的事，变成做过的事。</h2>
          <p className="muted">每日计划与周期习惯，在这里慢慢完成。</p>
        </div>
        <Button primary onClick={add}>
          <Plus size={18} />
          添加任务
        </Button>
      </div>
      <div className="list-chips">
        <button className={!list ? "selected" : ""} onClick={() => setList("")}>
          全部待办集
        </button>
        {d.lists.map((l) => (
          <button
            key={l.id}
            className={list === l.id ? "selected" : ""}
            onClick={() => setList(l.id)}
          >
            {l.name}
          </button>
        ))}
        <button
          aria-label="新建待办集"
          onClick={() =>
            setModal(
              <ListForm
                close={close}
                submit={(name) => {
                  change((next) => next.lists.push({ id: uid(), name }));
                  close();
                }}
              />,
            )
          }
        >
          <Plus size={16} />
        </button>
      </div>
      <section className="panel">
        <div className="filters">
          <Field label="日期">
            <input
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
            />
          </Field>
          <Field label="分类">
            <select
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              <option value="">全部分类</option>
              {[...new Set(d.tasks.map((t) => t.category))].map((c) => (
                <option key={c}>{c}</option>
              ))}
            </select>
          </Field>
          <Field label="状态">
            <select value={status} onChange={(e) => setStatus(e.target.value)}>
              <option value="">全部状态</option>
              <option value="todo">未完成</option>
              <option value="done">已完成</option>
            </select>
          </Field>
          <Button
            onClick={() => {
              setDate("");
              setCategory("");
              setStatus("");
              setList("");
            }}
          >
            重置
          </Button>
        </div>
        {filtered.map((t, i) => (
          <div className="task-row" key={t.id}>
            <button
              className={`checkbox ${t.done ? "checked" : ""}`}
              aria-label={`标记${t.name}${t.done ? "未完成" : "完成"}`}
              onClick={() =>
                change((next) =>
                  completeTask(
                    next,
                    next.tasks.find((x) => x.id === t.id)!,
                    Date.now(),
                  ),
                )
              }
            >
              {t.done && <Check size={14} />}
            </button>
            <div className="task-text">
              <strong className={t.done ? "done" : ""}>{t.name}</strong>
              <p>{t.description}</p>
              <div className="tags">
                <span>{t.category}</span>
                <span>{d.lists.find((l) => l.id === t.listId)?.name}</span>
                <span>{t.date}</span>
                <span>{t.estimate} 🍅</span>
                {t.templateId && <span>周期实例</span>}
              </div>
            </div>
            <div className="row-actions">
              <button
                aria-label={`上移${t.name}`}
                disabled={!i}
                onClick={() => move(t, -1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                aria-label={`下移${t.name}`}
                disabled={i === filtered.length - 1}
                onClick={() => move(t, 1)}
              >
                <ArrowDown size={14} />
              </button>
              <button onClick={() => select(t.id)}>专注</button>
              <button onClick={() => detail(t.id)}>统计</button>
              <button onClick={() => edit(t)}>编辑</button>
              <button aria-label={`删除${t.name}`} onClick={() => remove(t)}>
                <Trash2 size={15} />
              </button>
            </div>
          </div>
        ))}
        {!filtered.length && (
          <Empty text="这里还没有任务，添加一件你想完成的事吧。" />
        )}
      </section>
      <section className="panel">
        <h2>周期模板</h2>
        <p className="muted">
          打开应用时补齐截至今天的每日实例；每月不存在的日期会跳过。
        </p>
        {d.templates.map((t) => (
          <div className="record-row" key={t.id}>
            <span>
              <strong>{t.name}</strong>
              <small>
                {
                  { daily: "每天", weekly: "每周", monthly: "每月" }[
                    t.frequency
                  ]
                }{" "}
                · {t.start} 起
              </small>
            </span>
            <Button onClick={() => edit(undefined, t)}>编辑</Button>
            <Button
              onClick={() =>
                setModal(
                  <Modal title="删除周期模板" close={close}>
                    <p>历史专注记录始终保留。选择如何处理已生成实例：</p>
                    <div className="actions">
                      <Button
                        onClick={() => {
                          change((next) => {
                            next.templates = next.templates.filter(
                              (x) => x.id !== t.id,
                            );
                          });
                          close();
                        }}
                      >
                        仅删除模板
                      </Button>
                      <Button
                        primary
                        onClick={() => {
                          change((next) => {
                            next.templates = next.templates.filter(
                              (x) => x.id !== t.id,
                            );
                            next.tasks = next.tasks.filter(
                              (x) => x.templateId !== t.id || x.done,
                            );
                          });
                          close();
                        }}
                      >
                        同时删除未完成实例
                      </Button>
                    </div>
                  </Modal>,
                )
              }
            >
              删除
            </Button>
          </div>
        ))}
        {!d.templates.length && <Empty text="还没有周期模板" />}
      </section>
      <section className="panel">
        <h2>管理待办集</h2>
        {d.lists.map((l) => (
          <div className="record-row" key={l.id}>
            <span>{l.name}</span>
            <Button
              onClick={() =>
                setModal(
                  <ListForm
                    initial={l.name}
                    close={close}
                    submit={(name) => {
                      change((next) => {
                        next.lists.find((x) => x.id === l.id)!.name = name;
                      });
                      close();
                    }}
                  />,
                )
              }
            >
              重命名
            </Button>
            <Button
              disabled={
                d.lists.length <= 1 ||
                d.tasks.some((t) => t.listId === l.id) ||
                d.templates.some((t) => t.listId === l.id)
              }
              onClick={() =>
                confirm(
                  "删除空待办集",
                  "删除这个空待办集？历史快照会保留。",
                  () =>
                    change((next) => {
                      next.lists = next.lists.filter((x) => x.id !== l.id);
                    }),
                )
              }
            >
              删除空集
            </Button>
          </div>
        ))}
      </section>
    </>
  );
}

import {
  BarChart3,
  Check,
  CheckSquare,
  ChevronRight,
  Clock,
  Download,
  Leaf,
  Medal,
  Moon,
  Pause,
  Play,
  Plus,
  Settings,
  Square,
  Sun,
  Target,
  Timer,
  Trash2,
  Upload,
  User,
} from "lucide-react";
import { ReactNode, Suspense, lazy, useEffect, useRef, useState } from "react";
import {
  CheckForm,
  FutureForm,
  ReasonForm,
  TaskForm,
} from "./components/forms";
import { FutureCard } from "./components/FutureCard";
import { Button, Empty, Field, Metric, Modal } from "./components/ui";
import { demo } from "./demo";
import {
  Data,
  Session,
  Task,
  Template,
  badgeDefs,
  badgeProgress,
  clock,
  completeTask,
  day,
  empty,
  finish,
  format,
  generate,
  makeSession,
  pause,
  recover,
  resume,
  seconds,
  sleepPairs,
  stats,
  streak,
  uid,
  unlock,
  validate,
} from "./model";
import { TasksPage } from "./pages/Tasks";
import { load, readRaw, save } from "./storage";
const pages = [
  ["focus", "专注", Timer],
  ["tasks", "任务", CheckSquare],
  ["stats", "统计", BarChart3],
  ["life", "生活打卡", Moon],
  ["badges", "成就", Medal],
  ["profile", "个人资料", User],
  ["settings", "设置", Settings],
] as const;
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
const backgrounds: Record<string, string> = {
  forest:
    "radial-gradient(ellipse at 15% 100%,#c2d9fc 0%,transparent 55%),radial-gradient(ellipse at 100% 0%,#eaf3ff 0%,transparent 65%),linear-gradient(125deg,#eaf3ff,#d6e7ff)",
  dusk: "radial-gradient(at 20% 80%,#d2a5b5,transparent 60%),linear-gradient(120deg,#e8d6ca,#c8c6e0)",
  ocean:
    "radial-gradient(at 100% 0%,#d6e9ed,transparent 60%),linear-gradient(135deg,#b4d3df,#dfe9e9)",
};
const Statistics = lazy(() =>
  import("./pages/Statistics").then((m) => ({ default: m.Statistics })),
);
const SleepCharts = lazy(() =>
  import("./pages/LifeCharts").then((m) => ({ default: m.SleepCharts })),
);
function App() {
  const [d, setD] = useState<Data | null>(null),
    [error, setError] = useState(""),
    [page, setPage] = useState("focus"),
    [now, setNow] = useState(Date.now()),
    [toast, setToast] = useState(""),
    [modal, setModal] = useState<ReactNode>(null),
    [mode, setMode] = useState<Session["mode"]>("pomodoro"),
    [taskId, setTaskId] = useState(""),
    [temp, setTemp] = useState(""),
    [down, setDown] = useState(30),
    [taskDetail, setTaskDetail] = useState<string>();
  const [immersive, setImmersive] = useState(false);
  const [homeList, setHomeList] = useState("");
  useEffect(() => {
    const escape = (e: KeyboardEvent) => {
      if (e.key === "Escape") setImmersive(false);
    };
    window.addEventListener("keydown", escape);
    return () => window.removeEventListener("keydown", escape);
  }, []);
  const current = useRef<Data | null>(null),
    queue = useRef(Promise.resolve()),
    busy = useRef(false);
  const [storageFailed, setStorageFailed] = useState(false);
  const close = () => setModal(null);
  function persist(next: Data) {
    current.current = next;
    setD(next);
    queue.current = queue.current
      .catch(() => {})
      .then(() => save(next))
      .then(() => {
        setStorageFailed(false);
      })
      .catch((e) => {
        setStorageFailed(true);
        setError(
          `数据保存失败：${e instanceof Error ? e.message : String(e)}。请立即导出备份，释放空间后重试。`,
        );
      });
  }
  function change(fn: (next: Data) => void) {
    if (!current.current) return;
    const next = structuredClone(current.current);
    fn(next);
    const fresh = unlock(next, Date.now());
    if (fresh.length) setToast("获得新徽章：" + fresh.join("、"));
    persist(next);
  }
  useEffect(() => {
    let active = true;
    let release: () => void = () => {};
    const init = async () => {
      try {
        const next = await load();
        if (!active) return;
        recover(next, Date.now());
        generate(next);
        unlock(next, Date.now());
        persist(next);
      } catch (e) {
        setError("数据读取失败，未覆盖原数据。" + String(e));
      }
    };
    if (navigator.locks) {
      void navigator.locks.request(
        "focus-time-owner",
        { ifAvailable: true },
        async (lock) => {
          if (!lock) {
            setError(
              "专注时光已在其他标签页打开。请关闭另一页后重试，以免覆盖记录。",
            );
            return;
          }
          await init();
          await new Promise<void>((resolve) => {
            release = resolve;
            if (!active) resolve();
          });
        },
      );
    } else void init();
    return () => {
      active = false;
      release();
    };
  }, []);
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 250);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (!toast) return;
    const id = setTimeout(() => setToast(""), 4500);
    return () => clearTimeout(id);
  }, [toast]);
  useEffect(() => {
    if (!d) return;
    const media = matchMedia("(prefers-color-scheme: dark)");
    const apply = () =>
      (document.documentElement.dataset.theme =
        d.settings.theme === "system"
          ? media.matches
            ? "dark"
            : "light"
          : d.settings.theme);
    apply();
    media.addEventListener("change", apply);
    return () => media.removeEventListener("change", apply);
  }, [d?.settings.theme]);
  useEffect(() => {
    window.scrollTo(0, 0);
  }, [page, taskDetail]);
  function sound() {
    const config = current.current?.settings;
    if (!config?.sound) return;
    try {
      const ctx = new AudioContext(),
        osc = ctx.createOscillator(),
        gain = ctx.createGain();
      gain.gain.value = config.volume * 0.2;
      osc.frequency.value = 660;
      osc.connect(gain);
      gain.connect(ctx.destination);
      osc.start();
      gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.7);
      osc.stop(ctx.currentTime + 0.7);
      osc.onended = () => void ctx.close();
    } catch {
      /* 浏览器可禁止无用户手势音频 */
    }
  }
  function start(phase: Session["phase"] = "focus", chosenMode = mode) {
    change((next) => {
      if (next.sessions.some((s) => s.status !== "finished")) return;
      const target =
        phase === "focus"
          ? chosenMode === "pomodoro"
            ? next.settings.focus * 60
            : chosenMode === "down"
              ? down * 60
              : 0
          : (phase === "short" ? next.settings.short : next.settings.long) * 60;
      next.sessions.push(
        makeSession(next, chosenMode, target, taskId, temp, Date.now(), phase),
      );
    });
  }
  function endSession(natural = false) {
    if (busy.current) return;
    busy.current = true;
    let phase: Session["phase"] = "focus";
    let done = false;
    change((next) => {
      const s = next.sessions.find((s) => s.status !== "finished");
      if (!s) return;
      if (!finish(s, Date.now(), natural)) return;
      done = true;
      if (natural && s.phase === "focus" && s.mode === "pomodoro") {
        next.cycle++;
        phase = next.cycle % next.settings.cycles === 0 ? "long" : "short";
      }
      if (
        natural &&
        next.settings.auto &&
        (s.mode === "pomodoro" || s.phase !== "focus")
      ) {
        const target =
          phase === "focus"
            ? next.settings.focus * 60
            : (phase === "long" ? next.settings.long : next.settings.short) *
              60;
        next.sessions.push(
          makeSession(
            next,
            "pomodoro",
            target,
            s.snapshot.taskId || "",
            s.snapshot.name,
            Date.now(),
            phase,
          ),
        );
      }
    });
    busy.current = false;
    if (done && natural) {
      sound();
      setToast(
        phase === "focus"
          ? "休息结束，新的专注可以开始了"
          : "专注已完成，给自己一点休息时间。",
      );
    }
  }
  const session = d?.sessions.find((s) => s.status !== "finished");
  useEffect(() => {
    if (
      session?.status === "running" &&
      session.mode !== "up" &&
      seconds(session, now) >= session.target
    )
      endSession(true);
  }, [now, session?.id, session?.status]);
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === "visible" && current.current) {
        const next = structuredClone(current.current);
        generate(next);
        persist(next);
      }
    };
    document.addEventListener("visibilitychange", onVisible);
    return () => document.removeEventListener("visibilitychange", onVisible);
  }, []);
  function interrupt(action: "pause" | "end") {
    const s = current.current?.sessions.find((x) => x.status !== "finished");
    if (!s) return;
    const eventId = uid(),
      at = Date.now();
    if (action === "pause") {
      change((next) => {
        const live = next.sessions.find((x) => x.id === s.id)!;
        if (pause(live, at) && seconds(live) < 300)
          setToast(
            "本次专注未满 5 分钟，暂不计入统计；继续累计满 5 分钟后可计入。",
          );
      });
    } else {
      endSession(false);
    }
    change((next) => {
      if (!next.interruptions.some((x) => x.id === eventId))
        next.interruptions.push({
          id: eventId,
          sessionId: s.id,
          at,
          action,
          reason: "未填写",
          note: "",
        });
    });
    setModal(
      <ReasonForm
        close={close}
        onSubmit={(reason, note) => {
          change((next) => {
            const event = next.interruptions.find((x) => x.id === eventId);
            if (event) {
              event.reason = reason;
              event.note = reason === "其他" ? note : "";
            }
          });
          close();
        }}
      />,
    );
  }
  function confirm(title: string, text: string, action: () => void) {
    setModal(
      <Modal title={title} close={close}>
        <p>{text}</p>
        <div className="actions">
          <Button onClick={close}>取消</Button>
          <Button
            primary
            onClick={() => {
              action();
              close();
            }}
          >
            确认
          </Button>
        </div>
      </Modal>,
    );
  }
  function taskForm(t?: Task, template?: Template) {
    if (!d) return;
    setModal(
      <TaskForm
        data={d}
        task={t}
        template={template}
        close={close}
        submit={(item, recurrence) => {
          change((next) => {
            if (recurrence) {
              const i = next.templates.findIndex((x) => x.id === recurrence.id);
              if (i >= 0) next.templates[i] = recurrence;
              else next.templates.push(recurrence);
              generate(next);
            } else if (item) {
              const i = next.tasks.findIndex((x) => x.id === item.id);
              if (i >= 0) next.tasks[i] = item;
              else next.tasks.push(item);
            }
          });
          close();
        }}
      />,
    );
  }
  function deleteTask(t: Task) {
    confirm(
      "删除任务",
      `删除「${t.name}」？历史专注及任务名称快照会保留。`,
      () =>
        change((next) => {
          next.tasks = next.tasks.filter((x) => x.id !== t.id);
        }),
    );
  }
  function futureForm(event?: Data["future"][number]) {
    setModal(
      <FutureForm
        event={event}
        close={close}
        submit={(item) => {
          change((next) => {
            const i = next.future.findIndex((x) => x.id === item.id);
            if (i >= 0) next.future[i] = item;
            else next.future.push(item);
          });
          close();
        }}
      />,
    );
  }
  function checkForm(kind: "bed" | "wake", check?: Data["checks"][number]) {
    setModal(
      <CheckForm
        kind={kind}
        check={check}
        close={close}
        submit={(item) => {
          change((next) => {
            const i = next.checks.findIndex((x) => x.id === item.id);
            if (i >= 0) next.checks[i] = item;
            else next.checks.push(item);
          });
          close();
        }}
      />,
    );
  }
  function exportData() {
    if (!current.current) return;
    const blob = new Blob([JSON.stringify(current.current, null, 2)], {
        type: "application/json",
      }),
      url = URL.createObjectURL(blob),
      a = document.createElement("a");
    a.href = url;
    a.download = `专注时光-${day()}.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 30 * 1024 * 1024) throw new Error("备份超过 30 MB");
      const data = validate(JSON.parse(await file.text()));
      confirm(
        "恢复备份",
        `格式校验通过：${data.tasks.length} 个任务，${data.templates.length} 个周期模板，${data.sessions.length} 个会话，${data.interruptions.length} 个打断事件，${data.checks.length} 条打卡，${data.future.length} 个未来事件，${data.badges.length} 个徽章。确认后整体替换当前数据。`,
        () => {
          recover(data, Date.now());
          generate(data);
          persist(data);
        },
      );
    } catch (e) {
      setToast("导入失败：" + String(e));
    }
  }
  async function imageFile(
    file: File | undefined,
    kind: "avatar" | "background",
  ) {
    if (!file) return;
    if (
      !["image/jpeg", "image/png", "image/webp", "image/gif"].includes(
        file.type,
      ) ||
      file.size > 4 * 1024 * 1024
    ) {
      setToast("请选择不超过 4 MB 的 PNG、JPG、WebP 或 GIF 图片");
      return;
    }
    const reader = new FileReader();
    reader.onload = () =>
      change((next) => {
        if (kind === "avatar") next.profile.avatar = String(reader.result);
        else next.settings.background = String(reader.result);
      });
    reader.onerror = () => setToast("图片读取失败");
    reader.readAsDataURL(file);
  }
  if (!d)
    return (
      <div className="loading">
        <Leaf size={40} />
        <h1>专注时光</h1>
        <p>{error || "正在打开你的时光…"}</p>
        {error && (
          <>
            <Button onClick={() => location.reload()}>重试读取</Button>
            {!error.includes("其他标签页") && (
              <>
                <Button
                  onClick={async () => {
                    try {
                      const raw = await readRaw(),
                        url = URL.createObjectURL(
                          new Blob([JSON.stringify(raw, null, 2)], {
                            type: "application/json",
                          }),
                        ),
                        a = document.createElement("a");
                      a.href = url;
                      a.download = "专注时光-原始数据.json";
                      a.click();
                      setTimeout(() => URL.revokeObjectURL(url), 1000);
                    } catch (e) {
                      setError("无法读取原始数据：" + String(e));
                    }
                  }}
                >
                  抢救导出原始数据
                </Button>
                <label className="file-button">
                  导入已校验备份
                  <input
                    type="file"
                    accept=".json"
                    onChange={async (e) => {
                      try {
                        const file = e.target.files?.[0];
                        if (!file || file.size > 30 * 1024 * 1024)
                          throw new Error("请选择小于 30 MB 的备份");
                        const next = validate(JSON.parse(await file.text()));
                        if (
                          window.confirm(
                            `备份包含 ${next.tasks.length} 个任务、${next.sessions.length} 个会话，确认替换原数据？`,
                          )
                        ) {
                          recover(next, Date.now());
                          generate(next);
                          persist(next);
                          setError("");
                        }
                      } catch (err) {
                        setError("备份恢复失败：" + String(err));
                      }
                    }}
                  />
                </label>
              </>
            )}
          </>
        )}
      </div>
    );
  const today = stats(d, day(), day()),
    all = stats(d),
    elapsed = session ? seconds(session, now) : 0;
  const last = d.sessions.at(-1);
  const nextPhase =
    last?.mode === "pomodoro" && last.natural
      ? last.phase === "focus"
        ? d.cycle % d.settings.cycles === 0
          ? "long"
          : "short"
        : "focus"
      : "focus";
  const bg = session?.background || d.settings.background;
  const timerText = clock(
    session
      ? session.mode === "up"
        ? elapsed
        : session.target - elapsed
      : mode === "up"
        ? 0
        : mode === "down"
          ? down * 60
          : d.settings.focus * 60,
  );
  const background = bg.startsWith("data:")
    ? `linear-gradient(#12251e55,#12251e55),url("${bg}")`
    : backgrounds[bg] ||
      (bg === "random"
        ? backgrounds.forest
        : bg.startsWith("#")
          ? bg
          : backgrounds.forest);
  return (
    <div className={`app ${immersive && page === "focus" ? "immersive" : ""}`}>
      <aside className="sidebar">
        <a className="brand" href="#focus" onClick={() => setPage("focus")}>
          <span className="brand-icon">
            <Leaf size={24} />
          </span>
          <span>
            专注时光<small>FOCUS TIME</small>
          </span>
        </a>
        <div className="nav-caption">我的空间</div>
        <nav>
          {pages.map(([key, label, Icon]) => (
            <button
              key={key}
              aria-label={label}
              aria-current={page === key ? "page" : undefined}
              className={page === key ? "active" : ""}
              onClick={() => {
                setPage(key);
                setTaskDetail(undefined);
              }}
            >
              <Icon size={20} />
              <span>
                {label === "生活打卡"
                  ? "打卡"
                  : label === "个人资料"
                    ? "我的"
                    : label}
              </span>
              {page === key && <span className="nav-dot" />}
            </button>
          ))}
        </nav>
        <div className="sidebar-bottom">
          <div className="quiet-note">
            一分一秒
            <br />
            慢慢成为想成为的自己。
          </div>
          <button className="profile-mini" onClick={() => setPage("profile")}>
            {d.profile.avatar ? (
              <img src={d.profile.avatar} alt="头像" />
            ) : (
              <span className="avatar">{d.profile.nickname[0]}</span>
            )}
            <span>
              {d.profile.nickname}
              <small>今天也向前一点</small>
            </span>
            <ChevronRight size={16} />
          </button>
        </div>
      </aside>
      <main>
        <header>
          <div>
            <span className="eyebrow">
              {new Intl.DateTimeFormat("zh-CN", {
                month: "long",
                day: "numeric",
                weekday: "long",
              }).format(now)}
            </span>
            <h1>
              {pages.find((x) => x[0] === page)?.[1]}
              {page === "focus" && (
                <span className="header-sub">今日计划与专注</span>
              )}
            </h1>
          </div>
          <button
            className="icon-button"
            aria-label="切换浅色与深色主题"
            onClick={() =>
              change((next) => {
                next.settings.theme =
                  document.documentElement.dataset.theme === "dark"
                    ? "light"
                    : "dark";
              })
            }
          >
            {d.settings.theme === "dark" ? (
              <Sun size={20} />
            ) : (
              <Moon size={20} />
            )}
          </button>
        </header>
        {error && (
          <div role="alert" className="error">
            {error}
            <Button
              onClick={() => {
                persist(structuredClone(d));
                setError("");
              }}
            >
              重试保存
            </Button>
            <Button onClick={exportData}>导出当前数据</Button>
          </div>
        )}
        {page === "focus" && (
          <div className="focus-home">
            <div className="focus-layout">
              <section
                className={`timer-card ${bg.startsWith("data:") ? "photo" : bg.startsWith("#") ? "solid" : ""}`}
                style={{
                  background:
                    document.documentElement.dataset.theme === "dark" &&
                    !bg.startsWith("data:") &&
                    !bg.startsWith("#")
                      ? `linear-gradient(#13243dcc,#13243dcc),${background}`
                      : background,
                  containerType: "inline-size",
                }}
              >
                <div className="timer-top">
                  <span>
                    <span className="pulse-dot" />{" "}
                    {session
                      ? session.phase === "focus"
                        ? "专注时间"
                        : "休息时间"
                      : "自由专注"}
                  </span>
                  <button
                    className="immersive-toggle"
                    aria-pressed={immersive}
                    onClick={() => setImmersive(!immersive)}
                  >
                    {immersive ? "退出沉浸" : "沉浸专注"}
                  </button>
                </div>
                <div className="mode-tabs">
                  {(["pomodoro", "up", "down"] as const).map((m, i) => (
                    <button
                      key={m}
                      disabled={!!session}
                      className={
                        (session?.mode || mode) === m ? "selected" : ""
                      }
                      onClick={() => setMode(m)}
                    >
                      {["番茄钟", "正计时", "倒计时"][i]}
                    </button>
                  ))}
                </div>
                <p className="timer-task">
                  {session?.snapshot.name ||
                    d.tasks.find((t) => t.id === taskId)?.name ||
                    temp ||
                    "此刻，只做一件事"}
                </p>
                <div
                  className={`digits ${d.settings.animation}`}
                  aria-label={`计时 ${clock(session ? (session.mode === "up" ? elapsed : session.target - elapsed) : mode === "up" ? 0 : mode === "down" ? down * 60 : d.settings.focus * 60)}`}
                  style={{
                    fontSize: `clamp(24px,calc(86cqw / ${timerText.length * 0.66 - 0.31}),122px)`,
                  }}
                  role="timer"
                >
                  {timerText.split("").map((digit, i) => (
                    <span className={digit === ":" ? "colon" : "digit"} key={i}>
                      <span key={digit}>{digit}</span>
                    </span>
                  ))}
                </div>
                <div className="timer-status">
                  {session?.recovered
                    ? "刷新前后的累计时间已恢复并暂停，请确认后继续或结束。"
                    : session?.status === "paused"
                      ? "已暂停 · 暂停期间不累计"
                      : session?.phase && session.phase !== "focus"
                        ? "好好休息，休息时间不计入统计"
                        : session
                          ? "保持专注，你正在积累自己的时光"
                          : "放下纷扰，让专注自然发生"}
                </div>
                <div className="timer-buttons">
                  {!session ? (
                    <Button primary onClick={() => start()}>
                      <Play size={18} />
                      开始专注
                    </Button>
                  ) : (
                    <>
                      <Button
                        primary
                        onClick={() =>
                          session.status === "paused"
                            ? change((next) => {
                                resume(
                                  next.sessions.find(
                                    (s) => s.id === session.id,
                                  )!,
                                  Date.now(),
                                );
                              })
                            : session.phase === "focus"
                              ? interrupt("pause")
                              : change((next) => {
                                  pause(
                                    next.sessions.find(
                                      (s) => s.id === session.id,
                                    )!,
                                    Date.now(),
                                  );
                                })
                        }
                      >
                        {session.status === "paused" ? (
                          <Play size={18} />
                        ) : (
                          <Pause size={18} />
                        )}{" "}
                        {session.status === "paused" ? "继续专注" : "暂停"}
                      </Button>
                      <Button
                        onClick={() =>
                          session.phase === "focus"
                            ? interrupt("end")
                            : endSession()
                        }
                      >
                        <Square size={17} />
                        结束
                      </Button>
                    </>
                  )}
                </div>
                <div className="cycle-dots">
                  {Array.from({ length: d.settings.cycles }, (_, i) => (
                    <span
                      key={i}
                      className={
                        i < d.cycle % d.settings.cycles ? "filled" : ""
                      }
                    />
                  ))}
                  <small>每 {d.settings.cycles} 次专注，给自己一次长休息</small>
                </div>
              </section>
              <section className="panel selection">
                <div className="section-heading">
                  <h2>这次，专注什么？</h2>
                  <Target size={19} />
                </div>
                <Field label="关联任务">
                  <select
                    value={taskId}
                    disabled={!!session}
                    onChange={(e) => setTaskId(e.target.value)}
                  >
                    <option value="">自由专注 / 临时任务</option>
                    {d.tasks
                      .filter((t) => !t.done)
                      .map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                  </select>
                </Field>
                {!taskId && (
                  <Field label="临时任务名称">
                    <input
                      value={temp}
                      disabled={!!session}
                      placeholder="例如：读完一章书"
                      maxLength={200}
                      onChange={(e) => setTemp(e.target.value)}
                    />
                  </Field>
                )}
                {mode === "down" && (
                  <Field label="目标分钟">
                    <input
                      type="number"
                      min="1"
                      max="1440"
                      disabled={!!session}
                      value={down}
                      onChange={(e) =>
                        setDown(
                          Math.max(
                            1,
                            Math.min(1440, Number(e.target.value) || 1),
                          ),
                        )
                      }
                    />
                  </Field>
                )}
                <div className="gentle-box">
                  <Leaf size={20} />
                  <p>
                    专注满 <strong>5 分钟</strong>后计入统计。
                    <br />
                    短暂暂停，也不会丢失你的努力。
                  </p>
                </div>
                {!session && nextPhase !== "focus" && (
                  <Button onClick={() => start(nextPhase, "pomodoro")}>
                    开始{nextPhase === "long" ? "长" : "短"}休息
                  </Button>
                )}
                <div className="daily-goal">
                  <span>
                    今日目标{" "}
                    <strong>
                      {Math.round(today.total / 60)} / {d.profile.goal} 分钟
                    </strong>
                  </span>
                  <progress max={d.profile.goal * 60} value={today.total} />
                  <small>不必急，进步正在发生。</small>
                </div>
              </section>
            </div>
            <div className="metrics">
              <Metric
                label="今日有效专注"
                value={String(today.count)}
                unit="次"
                icon={<Timer />}
              />
              <Metric
                label="今日专注时长"
                value={String(Math.floor(today.total / 60))}
                unit="分钟"
                icon={<Clock />}
              />
              <Metric
                label="完成番茄"
                value={String(today.pomodoros)}
                unit="个"
                icon={<Leaf />}
              />
              <Metric
                label="连续专注"
                value={String(streak(d))}
                unit="天"
                icon={<Sun />}
              />
            </div>
            <div className="bottom-grid">
              <section className="panel">
                <div className="section-heading">
                  <h2>
                    今日任务{" "}
                    <small>
                      {
                        d.tasks.filter((t) => t.date === day() && !t.done)
                          .length
                      }{" "}
                      项待完成
                    </small>
                  </h2>
                  <button className="link" onClick={() => taskForm()}>
                    <Plus size={16} />
                    添加任务
                  </button>
                </div>
                <div className="list-chips home-list-chips">
                  <button
                    className={!homeList ? "selected" : ""}
                    onClick={() => setHomeList("")}
                  >
                    全部
                  </button>
                  {d.lists.map((l) => (
                    <button
                      key={l.id}
                      className={homeList === l.id ? "selected" : ""}
                      onClick={() => setHomeList(l.id)}
                    >
                      {l.name}
                    </button>
                  ))}
                </div>
                <div className="today-cards">
                  {d.tasks
                    .filter((t) => t.date === day())
                    .filter((t) => !homeList || t.listId === homeList)
                    .map((t) => (
                      <div className="compact-task" key={t.id}>
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
                        <span className={t.done ? "done" : ""}>
                          {t.name}
                          <small>
                            {t.category} · {t.estimate} 个番茄
                          </small>
                        </span>
                        <button
                          className="icon-button"
                          aria-label={`专注${t.name}`}
                          disabled={!!session}
                          onClick={() => {
                            setTaskId(t.id);
                            document
                              .querySelector(".timer-card")
                              ?.scrollIntoView({
                                behavior: window.matchMedia(
                                  "(prefers-reduced-motion: reduce)",
                                ).matches
                                  ? "auto"
                                  : "smooth",
                                block: "center",
                              });
                          }}
                        >
                          <Play size={16} />
                        </button>
                      </div>
                    ))}
                </div>
                {!d.tasks.some(
                  (t) =>
                    t.date === day() && (!homeList || t.listId === homeList),
                ) && <Empty text="今天还是一张白纸，写下你的第一件事。" />}
                <button className="link more" onClick={() => setPage("tasks")}>
                  查看全部任务 <ChevronRight size={15} />
                </button>
              </section>
              <section className="panel">
                <div className="section-heading">
                  <h2>值得期待</h2>
                  <button
                    className="icon-button"
                    aria-label="添加未来倒计时"
                    onClick={() => futureForm()}
                  >
                    <Plus size={18} />
                  </button>
                </div>
                {[...d.future]
                  .sort(
                    (a, b) =>
                      Number(b.pinned) - Number(a.pinned) ||
                      a.target - b.target,
                  )
                  .slice(0, 2)
                  .map((e) => (
                    <FutureCard
                      key={e.id}
                      event={e}
                      now={now}
                      edit={() => futureForm(e)}
                      pin={() =>
                        change((next) => {
                          next.future.find((x) => x.id === e.id)!.pinned =
                            !e.pinned;
                        })
                      }
                      remove={() =>
                        confirm("删除未来事件", `删除「${e.name}」？`, () =>
                          change((next) => {
                            next.future = next.future.filter(
                              (x) => x.id !== e.id,
                            );
                          }),
                        )
                      }
                    />
                  ))}
                {!d.future.length && (
                  <Empty text="考试、旅行、一个约定… 为未来留个位置。" />
                )}
                <button className="link more" onClick={() => setPage("life")}>
                  管理未来事件 <ChevronRight size={15} />
                </button>
              </section>
            </div>
            {!d.tasks.length && !d.sessions.length && (
              <div className="welcome">
                <Leaf size={22} />
                <span>欢迎来到专注时光。你的数据只留在这台设备。</span>
                <button
                  className="link"
                  onClick={() =>
                    confirm(
                      "加载演示数据",
                      "演示数据将替换当前数据。你可以先导出备份，再体验全部图表。",
                      () => persist(demo()),
                    )
                  }
                >
                  体验演示数据
                </button>
              </div>
            )}
          </div>
        )}
        {page === "tasks" && (
          <TasksPage
            data={d}
            add={() => taskForm()}
            edit={taskForm}
            remove={deleteTask}
            change={change}
            select={(id) => {
              setTaskId(id);
              setPage("focus");
            }}
            detail={(id) => {
              setTaskDetail(id);
              setPage("stats");
            }}
            confirm={confirm}
            setModal={setModal}
            close={close}
          />
        )}
        {page === "stats" && (
          <Suspense fallback={<Empty text="正在展开统计…" />}>
            <Statistics data={d} taskKey={taskDetail} choose={setTaskDetail} />
          </Suspense>
        )}
        {page === "life" && (
          <>
            <div className="life-buttons">
              <div className="panel">
                <Moon size={28} />
                <h2>准备睡觉</h2>
                <p>记录上床时间，给今天一个温柔的句点。</p>
                <Button primary onClick={() => checkForm("bed")}>
                  睡眠打卡 / 补录
                </Button>
              </div>
              <div className="panel">
                <Sun size={28} />
                <h2>已经起床</h2>
                <p>新的一天，慢慢开始。</p>
                <Button primary onClick={() => checkForm("wake")}>
                  起床打卡 / 补录
                </Button>
              </div>
            </div>
            <Suspense fallback={<Empty text="正在展开打卡图表…" />}>
              <SleepCharts data={d} />
            </Suspense>
            <section className="panel">
              <h2>
                卧床记录 <small>估算卧床时长，不代表实际睡眠时长</small>
              </h2>
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>上床时间</th>
                      <th>起床时间</th>
                      <th>估算卧床</th>
                    </tr>
                  </thead>
                  <tbody>
                    {sleepPairs(d)
                      .slice(0, 60)
                      .map((r, i) => (
                        <tr key={i}>
                          <td>
                            {r.bed
                              ? new Date(r.bed).toLocaleString("zh-CN")
                              : "缺少记录"}
                          </td>
                          <td>
                            {r.wake
                              ? new Date(r.wake).toLocaleString("zh-CN")
                              : "缺少记录"}
                          </td>
                          <td>
                            {r.bed && r.wake
                              ? format((r.wake - r.bed) / 1000)
                              : "数据不完整"}
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
              {!d.checks.length && <Empty text="还没有生活打卡记录" />}
              <details>
                <summary>编辑所有打卡</summary>
                {[...d.checks]
                  .sort((a, b) => b.at - a.at)
                  .map((c) => (
                    <div className="record-row" key={c.id}>
                      <span>
                        {c.kind === "bed" ? "准备睡觉" : "已经起床"} ·{" "}
                        {new Date(c.at).toLocaleString("zh-CN")}
                      </span>
                      <Button onClick={() => checkForm(c.kind, c)}>编辑</Button>
                      <Button
                        onClick={() =>
                          confirm("删除打卡", "删除这条记录？", () =>
                            change((next) => {
                              next.checks = next.checks.filter(
                                (x) => x.id !== c.id,
                              );
                            }),
                          )
                        }
                      >
                        删除
                      </Button>
                    </div>
                  ))}
              </details>
            </section>
            <section className="panel">
              <div className="section-heading">
                <h2>未来倒计时</h2>
                <Button onClick={() => futureForm()}>
                  <Plus size={16} />
                  添加事件
                </Button>
              </div>
              <div className="event-grid">
                {[...d.future]
                  .sort(
                    (a, b) =>
                      Number(b.pinned) - Number(a.pinned) ||
                      a.target - b.target,
                  )
                  .map((e) => (
                    <FutureCard
                      key={e.id}
                      event={e}
                      now={now}
                      edit={() => futureForm(e)}
                      pin={() =>
                        change((next) => {
                          next.future.find((x) => x.id === e.id)!.pinned =
                            !e.pinned;
                        })
                      }
                      remove={() =>
                        confirm("删除事件", `删除「${e.name}」？`, () =>
                          change((next) => {
                            next.future = next.future.filter(
                              (x) => x.id !== e.id,
                            );
                          }),
                        )
                      }
                    />
                  ))}
              </div>
            </section>
          </>
        )}
        {page === "badges" && (
          <>
            <div className="intro-panel">
              <Medal size={36} />
              <h2>每一份坚持，都值得被看见。</h2>
              <p>
                已获得 {d.badges.length} / {badgeDefs.length} 枚徽章
              </p>
            </div>
            <div className="badge-grid">
              {badgeDefs.map((b, i) => {
                const badge = d.badges.find((x) => x.id === b[0]),
                  p = badgeProgress(d)[i];
                return (
                  <section
                    className={`panel badge ${badge ? "unlocked" : ""}`}
                    key={b[0]}
                  >
                    <span className="badge-icon">{b[1]}</span>
                    <h2>{b[2]}</h2>
                    <p>{b[3]}</p>
                    <progress max={b[4]} value={p} />
                    <small>
                      {badge
                        ? `获得于 ${new Date(badge.unlockedAt).toLocaleDateString("zh-CN")}`
                        : `${Math.min(Math.floor(p), b[4])} / ${b[4]}${i === 2 || i === 3 ? " 秒" : ""}`}
                    </small>
                  </section>
                );
              })}
            </div>
          </>
        )}
        {page === "profile" && (
          <>
            <section className="panel profile-card">
              <div className="avatar large">
                {d.profile.avatar ? (
                  <img src={d.profile.avatar} alt="个人头像" />
                ) : (
                  d.profile.nickname[0]
                )}
              </div>
              <h2>{d.profile.nickname}</h2>
              <p>{d.profile.bio}</p>
              <div className="metrics">
                <Metric
                  label="累计专注"
                  value={String(Math.floor(all.total / 60))}
                  unit="分钟"
                />
                <Metric label="有效次数" value={String(all.count)} unit="次" />
                <Metric label="连续专注" value={String(streak(d))} unit="天" />
                <Metric
                  label="获得徽章"
                  value={String(d.badges.length)}
                  unit="枚"
                />
              </div>
            </section>
            <section className="panel form-grid">
              <Field label="昵称">
                <input
                  maxLength={60}
                  value={d.profile.nickname}
                  onChange={(e) =>
                    change((next) => {
                      next.profile.nickname = e.target.value;
                    })
                  }
                />
              </Field>
              <Field label="每日专注目标（分钟）">
                <input
                  type="number"
                  min="1"
                  max="1440"
                  value={d.profile.goal}
                  onChange={(e) =>
                    change((next) => {
                      next.profile.goal = Math.max(
                        1,
                        Math.min(1440, Number(e.target.value) || 1),
                      );
                    })
                  }
                />
              </Field>
              <Field label="个人简介">
                <textarea
                  maxLength={500}
                  value={d.profile.bio}
                  onChange={(e) =>
                    change((next) => {
                      next.profile.bio = e.target.value;
                    })
                  }
                />
              </Field>
              <Field label="上传头像（本地保存，≤4MB）">
                <input
                  type="file"
                  accept="image/png,image/jpeg,image/webp,image/gif"
                  onChange={(e) =>
                    void imageFile(e.target.files?.[0], "avatar")
                  }
                />
              </Field>
            </section>
            <div className="profile-badges">
              {badgeDefs
                .filter((b) => d.badges.some((x) => x.id === b[0]))
                .map((b) => (
                  <span key={b[0]}>
                    {b[1]} {b[2]}
                  </span>
                ))}
            </div>
          </>
        )}
        {page === "settings" && (
          <>
            <section className="panel">
              <h2>外观与体验</h2>
              <div className="form-grid">
                <Field label="主题">
                  <select
                    value={d.settings.theme}
                    onChange={(e) =>
                      change((next) => {
                        next.settings.theme = e.target
                          .value as Data["settings"]["theme"];
                      })
                    }
                  >
                    <option value="light">浅色</option>
                    <option value="dark">深色</option>
                    <option value="system">跟随系统</option>
                  </select>
                </Field>
                <Field label="计时数字效果">
                  <select
                    value={d.settings.animation}
                    onChange={(e) =>
                      change((next) => {
                        next.settings.animation = e.target.value as
                          | "roll"
                          | "flip";
                      })
                    }
                  >
                    <option value="roll">滚动数字</option>
                    <option value="flip">翻页数字</option>
                  </select>
                </Field>
                <Field label="内置背景">
                  <select
                    value={
                      bg.startsWith("data:")
                        ? "upload"
                        : bg.startsWith("#")
                          ? "solid"
                          : d.settings.background
                    }
                    onChange={(e) =>
                      change((next) => {
                        next.settings.background =
                          e.target.value === "solid"
                            ? "#b8d0c4"
                            : e.target.value;
                      })
                    }
                  >
                    <option value="forest">晴空晨光</option>
                    <option value="ocean">海岸微风</option>
                    <option value="dusk">暮色云霞</option>
                    <option value="random">每次专注随机</option>
                    <option value="solid">纯色背景</option>
                    {bg.startsWith("data:") && (
                      <option value="upload">个人背景</option>
                    )}
                  </select>
                </Field>
                <Field label="自选纯色">
                  <input
                    type="color"
                    value={
                      d.settings.background.startsWith("#")
                        ? d.settings.background
                        : "#b8d0c4"
                    }
                    onChange={(e) =>
                      change((next) => {
                        next.settings.background = e.target.value;
                      })
                    }
                  />
                </Field>
                <Field label="上传个人背景（本地保存，≤4MB）">
                  <input
                    type="file"
                    accept="image/png,image/jpeg,image/webp,image/gif"
                    onChange={(e) =>
                      void imageFile(e.target.files?.[0], "background")
                    }
                  />
                </Field>
                <Field label="一周起始日">
                  <select
                    value={d.settings.weekStart}
                    onChange={(e) =>
                      change((next) => {
                        next.settings.weekStart = Number(e.target.value) as
                          | 0
                          | 1;
                      })
                    }
                  >
                    <option value="1">星期一</option>
                    <option value="0">星期日</option>
                  </select>
                </Field>
              </div>
            </section>
            <section className="panel">
              <h2>番茄钟与声音</h2>
              <div className="form-grid">
                {(["focus", "short", "long", "cycles"] as const).map(
                  (key, i) => (
                    <Field
                      key={key}
                      label={
                        [
                          "专注时长（分钟）",
                          "短休息（分钟）",
                          "长休息（分钟）",
                          "长休息间隔（次数）",
                        ][i]
                      }
                    >
                      <input
                        type="number"
                        min="1"
                        max={[180, 60, 120, 12][i]}
                        value={d.settings[key]}
                        onChange={(e) =>
                          change((next) => {
                            next.settings[key] = Math.max(
                              1,
                              Math.min(
                                [180, 60, 120, 12][i],
                                (key === "cycles"
                                  ? Math.round(Number(e.target.value))
                                  : Number(e.target.value)) || 1,
                              ),
                            );
                          })
                        }
                      />
                    </Field>
                  ),
                )}
                <Field label="自动开始下一阶段">
                  <input
                    type="checkbox"
                    checked={d.settings.auto}
                    onChange={(e) =>
                      change((next) => {
                        next.settings.auto = e.target.checked;
                      })
                    }
                  />
                </Field>
                <Field label="声音提醒">
                  <input
                    type="checkbox"
                    checked={d.settings.sound}
                    onChange={(e) =>
                      change((next) => {
                        next.settings.sound = e.target.checked;
                      })
                    }
                  />
                </Field>
                <Field label="音量">
                  <input
                    type="range"
                    min="0"
                    max="1"
                    step="0.05"
                    value={d.settings.volume}
                    onChange={(e) =>
                      change((next) => {
                        next.settings.volume = Number(e.target.value);
                      })
                    }
                  />
                </Field>
              </div>
              <p className="muted">
                当前会话使用开始时的时长与背景。系统减少动态效果时自动关闭数字动画。
              </p>
            </section>
            <section className="panel">
              <h2>你的数据，由你保管</h2>
              <p>
                数据仅保存在当前浏览器，清理网站数据会使记录丢失。建议定期导出备份。
              </p>
              <div className="actions">
                <Button onClick={exportData}>
                  <Download size={16} />
                  导出 JSON 备份
                </Button>
                <label className="file-button">
                  <Upload size={16} />
                  导入备份
                  <input
                    type="file"
                    accept=".json,application/json"
                    onChange={(e) => {
                      void importFile(e.target.files?.[0]);
                      e.target.value = "";
                    }}
                  />
                </label>
                <Button
                  onClick={() =>
                    confirm(
                      "加载演示数据",
                      "将整体替换当前数据，请先导出备份。",
                      () => persist(demo()),
                    )
                  }
                >
                  加载演示数据
                </Button>
                <Button
                  onClick={() =>
                    confirm(
                      "清空全部数据",
                      "任务、计时记录、资料、设置、徽章及图片都将清空，无法撤销。建议先导出备份。",
                      () => {
                        persist(empty());
                        setTaskId("");
                      },
                    )
                  }
                >
                  <Trash2 size={16} />
                  清空全部数据
                </Button>
              </div>
              {storageFailed && (
                <p role="alert">当前变更尚未保存，请导出备份。</p>
              )}
            </section>
          </>
        )}
        <footer>
          专注时光 <span>·</span> 不赶时间，认真生活。{" "}
          <small>v1.1.0 · 本地存储</small>
        </footer>
      </main>
      {modal}
      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
export default App;

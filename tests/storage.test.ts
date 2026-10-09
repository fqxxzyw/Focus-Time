import "fake-indexeddb/auto";
import { it, expect, vi } from "vitest";
import { save, load } from "../src/storage";
import { empty, makeSession, finish, stats } from "../src/model";
vi.stubGlobal("localStorage", { getItem: () => null, setItem: () => {} });
it("IndexedDB 事务保存、读取及整体替换，记录 ID 完成去重", async () => {
  const d = empty(),
    start = 1000000000,
    s = makeSession(d, "up", 0, "", "测试", start);
  d.sessions.push(s);
  finish(s, start + 300000);
  finish(s, start + 600000);
  await save(d);
  const restored = await load();
  expect(stats(restored).count).toBe(1);
  expect(stats(restored).total).toBe(300);
  await save(empty());
  expect((await load()).sessions).toHaveLength(0);
});

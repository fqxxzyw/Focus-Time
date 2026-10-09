import { Data, empty, validate } from "./model";
const DB = "focus-time-v1";
export function openDB(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => r.result.createObjectStore("state");
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error);
    r.onblocked = () => reject(new Error("请关闭其他标签页再重试"));
  });
}
export async function load(): Promise<Data> {
  const db = await openDB();
  try {
    return await new Promise((res, rej) => {
      const r = db.transaction("state").objectStore("state").get("data");
      r.onsuccess = () => {
        try {
          const d = r.result ? validate(r.result) : empty();
          const settings = localStorage.getItem("focus-settings");
          if (settings) {
            try {
              const cached = JSON.parse(settings);
              if (JSON.stringify(cached) === JSON.stringify(d.settings))
                d.settings = cached;
            } catch {
              /* 主数据仍可使用 */
            }
          }
          res(d);
        } catch (e) {
          rej(e);
        }
      };
      r.onerror = () => rej(r.error);
    });
  } finally {
    db.close();
  }
}
export async function save(d: Data) {
  const db = await openDB();
  try {
    await new Promise<void>((res, rej) => {
      const t = db.transaction("state", "readwrite");
      t.objectStore("state").put(d, "data");
      t.oncomplete = () => res();
      t.onerror = () => rej(t.error);
      t.onabort = () => rej(t.error);
    });
    try {
      localStorage.setItem("focus-settings", JSON.stringify(d.settings));
    } catch {
      /* IndexedDB 中已有同一设置的完整备份 */
    }
  } finally {
    db.close();
  }
}

export async function readRaw(): Promise<unknown> {
  const db = await openDB();
  try {
    return await new Promise((res, rej) => {
      const r = db.transaction("state").objectStore("state").get("data");
      r.onsuccess = () => res(r.result);
      r.onerror = () => rej(r.error);
    });
  } finally {
    db.close();
  }
}

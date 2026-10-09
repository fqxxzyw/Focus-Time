import { test, expect, _electron as electron } from "@playwright/test";
import { mkdir } from "node:fs/promises";
import path from "node:path";
test("真实打包桌面窗口：安全 origin、计时、数据存储、主题与重开恢复", async () => {
  const executable = process.env.DESKTOP_EXECUTABLE;
  if (!executable)
    throw new Error("请指定 DESKTOP_EXECUTABLE 为打包后的可执行文件");
  const launch = () =>
    electron.launch({
      executablePath: path.resolve(executable),
      env: { ...process.env, NODE_ENV: "test" },
    });
  let app = await launch();
  try {
    let page = await app.firstWindow();
    await expect(
      page.getByRole("button", { name: "开始专注", exact: true }),
    ).toBeVisible();
    expect(new URL(page.url()).origin).toBe("null"); // 自定义协议在 Node URL 中为 null，Chromium 内按注册的标准安全 scheme 处理。
    expect(page.url()).toContain("focus://app/");
    expect(await page.evaluate(() => window.isSecureContext)).toBe(true);
    await page
      .locator("nav")
      .getByRole("button", { name: "任务", exact: true })
      .click();
    await page.getByRole("button", { name: "添加任务", exact: true }).click();
    await page.getByLabel("任务名称").fill("桌面打包验收");
    await page.getByRole("button", { name: "保存任务" }).click();
    await expect(page.getByText("桌面打包验收", { exact: true })).toBeVisible();
    await page
      .locator("nav")
      .getByRole("button", { name: "专注", exact: true })
      .click();
    await page.getByRole("button", { name: "开始专注", exact: true }).click();
    await page.getByRole("button", { name: "暂停", exact: true }).click();
    await page.getByRole("button", { name: "跳过", exact: true }).click();
    // 保存完成后再关闭，验证数据能在再次启动时恢复。
    await page.evaluate(
      () =>
        new Promise<void>((resolve, reject) => {
          const r = indexedDB.open("focus-time-v1");
          r.onsuccess = () => {
            const db = r.result;
            const tx = db.transaction("state");
            const get = tx.objectStore("state").get("data");
            get.onsuccess = () => {
              db.close();
              get.result?.sessions.some(
                (s: { status: string }) => s.status === "paused",
              )
                ? resolve()
                : reject(new Error("暂停未保存"));
            };
          };
          r.onerror = () => reject(r.error);
        }),
    );
    await app.close();
    app = await launch();
    page = await app.firstWindow();
    await expect(
      page.getByRole("button", { name: "继续专注", exact: true }),
    ).toBeVisible();
    await page
      .locator("nav")
      .getByRole("button", { name: "设置", exact: true })
      .click();
    await page.getByLabel("主题", { exact: true }).selectOption("dark");
    await page
      .locator("nav")
      .getByRole("button", { name: "专注", exact: true })
      .click();
    await mkdir("docs/desktop-screenshots", { recursive: true });
    await page.screenshot({
      path: "docs/desktop-screenshots/windows-dark.png",
      animations: "disabled",
    });
    expect(
      await page.evaluate(
        () => typeof (window as unknown as { require?: unknown }).require,
      ),
    ).toBe("undefined");
  } finally {
    await app.close();
  }
});

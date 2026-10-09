import { test, expect } from "@playwright/test";
import { mkdir } from "node:fs/promises";
async function navigate(page: any, label: string) {
  await page
    .locator("nav")
    .getByRole("button", { name: label, exact: true })
    .click();
}
async function backup(page: any) {
  await navigate(page, "设置");
  const downloading = page.waitForEvent("download");
  await page.getByRole("button", { name: "导出 JSON 备份" }).click();
  const file = await downloading;
  const path = await file.path();
  const fs = await import("node:fs/promises");
  return JSON.parse(await fs.readFile(path!, "utf8"));
}
test("每日任务 → 暂停原因 → 有效入账 → 任务统计 → 删除保留 → 导出恢复", async ({
  page,
}) => {
  await page.clock.install({ time: new Date("2026-10-09T10:00:00+08:00") });
  await page.goto("/");
  await expect(
    page.getByRole("button", { name: "开始专注", exact: true }),
  ).toBeVisible();
  await navigate(page, "任务");
  await page.getByRole("button", { name: "添加任务", exact: true }).click();
  await page.getByLabel("任务名称").fill("验收学习任务");
  await page.getByLabel("说明", { exact: true }).fill("删除后仍保留历史");
  await page.getByRole("button", { name: "保存任务" }).click();
  await page.getByRole("button", { name: "专注", exact: true }).last().click();
  await page.getByRole("button", { name: "开始专注", exact: true }).click();
  await page.clock.fastForward(120000);
  await page.getByRole("button", { name: "暂停", exact: true }).click();
  await expect(
    page.getByText(
      "本次专注未满 5 分钟，暂不计入统计；继续累计满 5 分钟后可计入。",
    ),
  ).toBeVisible();
  await page.getByRole("button", { name: "手机消息", exact: true }).click();
  await page.getByRole("button", { name: "保存原因" }).click();
  await page.clock.fastForward(600000);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "继续专注", exact: true }),
  ).toBeVisible();
  await page.getByRole("button", { name: "继续专注", exact: true }).click();
  await page.clock.fastForward(180000);
  await page.getByRole("button", { name: "结束", exact: true }).click();
  await page.getByRole("button", { name: "跳过", exact: true }).click();
  await navigate(page, "统计");
  await page.getByRole("button", { name: "验收学习任务", exact: true }).click();
  await expect(
    page.getByRole("heading", { name: "验收学习任务", exact: true }),
  ).toBeVisible();
  const before = await backup(page);
  expect(before.sessions).toHaveLength(1);
  expect(before.interruptions).toHaveLength(2);
  expect(before.interruptions[0].reason).toBe("手机消息");
  expect(
    before.sessions[0].intervals.reduce(
      (a: any, i: any) => a + (i.end - i.start) / 1000,
      0,
    ),
  ).toBeCloseTo(300, 0);
  await navigate(page, "任务");
  await page.getByRole("button", { name: "删除验收学习任务" }).click();
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await navigate(page, "统计");
  await expect(
    page.getByRole("button", { name: "验收学习任务（已删除）" }),
  ).toBeVisible();
  const after = await backup(page);
  expect(after.sessions).toEqual(before.sessions);
  expect(after.tasks).toHaveLength(0);
  await page.getByRole("button", { name: "清空全部数据" }).click();
  await page.getByRole("button", { name: "确认", exact: true }).click();
  await page
    .locator("input[type=file]")
    .last()
    .setInputFiles({
      name: "restore.json",
      mimeType: "application/json",
      buffer: Buffer.from(JSON.stringify(after)),
    });
  await expect(page.getByText(/格式校验通过/)).toBeVisible();
  await page.getByRole("button", { name: "确认", exact: true }).click();
  const restored = await backup(page);
  expect(restored.sessions).toEqual(after.sessions);
  expect(restored.interruptions).toEqual(after.interruptions);
});
test("周期任务生成去重、倒计时刷新封顶、正计时恢复确认", async ({ page }) => {
  await page.clock.install({ time: new Date("2026-10-09T10:00:00+08:00") });
  await page.goto("/");
  await navigate(page, "任务");
  await page.getByRole("button", { name: "添加任务", exact: true }).click();
  await page.getByLabel("任务名称").fill("每日读书");
  await page.getByLabel("重复周期").selectOption("daily");
  await page.getByRole("button", { name: "保存任务" }).click();
  await page.reload();
  await navigate(page, "任务");
  await expect(page.locator(".task-row")).toHaveCount(1);
  await navigate(page, "专注");
  await page.getByRole("button", { name: "倒计时", exact: true }).click();
  await page.getByLabel("目标分钟").fill("5");
  await page.getByRole("button", { name: "开始专注", exact: true }).click();
  await page.clock.fastForward(900000);
  await page.reload();
  await expect(
    page.getByRole("button", { name: "开始专注", exact: true }),
  ).toBeVisible();
  let d = await backup(page);
  expect(
    d.sessions[0].intervals[0].end - d.sessions[0].intervals[0].start,
  ).toBe(300000);
  await navigate(page, "专注");
  await page.getByRole("button", { name: "正计时", exact: true }).click();
  await page.getByRole("button", { name: "开始专注", exact: true }).click();
  await page.clock.fastForward(360000);
  await page.reload();
  await expect(
    page.getByText("刷新前后的累计时间已恢复并暂停，请确认后继续或结束。"),
  ).toBeVisible();
  await expect(
    page.getByRole("button", { name: "继续专注", exact: true }),
  ).toBeVisible();
});
test("桌面与手机、明暗主题全部核心页面无横向溢出并截图", async ({ page }) => {
  test.setTimeout(90000);
  await mkdir("docs/screenshots", { recursive: true });
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await navigate(page, "设置");
  await page.getByRole("button", { name: "加载演示数据", exact: true }).click();
  await page.getByRole("button", { name: "确认", exact: true }).click();
  for (const width of [1440, 390]) {
    await page.setViewportSize({ width, height: width === 1440 ? 1000 : 844 });
    for (const theme of ["light", "dark"]) {
      await navigate(page, "设置");
      await page.getByLabel("主题", { exact: true }).selectOption(theme);
      for (const label of [
        "专注",
        "任务",
        "统计",
        "生活打卡",
        "成就",
        "个人资料",
        "设置",
      ]) {
        await navigate(page, label);
        await expect(page.locator("main>header h1")).toContainText(label);
        expect(
          await page.evaluate(
            () => document.documentElement.scrollWidth <= window.innerWidth,
          ),
          `${width} ${theme} ${label} 页面溢出`,
        ).toBe(true);
        await page.screenshot({
          path: `docs/screenshots/${width}-${theme}-${label}.png`,
          fullPage: true,
          animations: "disabled",
        });
      }
    }
  }
  expect(errors).toEqual([]);
});

test("手机最大倒计时与翻页数字均完整可见", async ({ page }) => {
  await page.setViewportSize({ width: 320, height: 700 });
  await page.goto("/");
  await page.getByRole("button", { name: "倒计时", exact: true }).click();
  await page.getByLabel("目标分钟").fill("1440");
  await expect(page.getByRole("timer")).toHaveText("1440:00");
  const contained = () =>
    page.evaluate(() => {
      const parent = document
        .querySelector(".timer-card")!
        .getBoundingClientRect();
      return [...document.querySelectorAll(".digit,.colon")].every((el) => {
        const r = el.getBoundingClientRect();
        return r.left >= parent.left && r.right <= parent.right;
      });
    });
  expect(await contained()).toBe(true);
  await navigate(page, "设置");
  await page.getByLabel("计时数字效果").selectOption("flip");
  await navigate(page, "专注");
  expect(await contained()).toBe(true);
});

test("沉浸专注可进入、退出并保留计时", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("button", { name: "开始专注", exact: true }).click();
  await page.getByRole("button", { name: "沉浸专注", exact: true }).click();
  await expect(page.locator(".app")).toHaveClass(/immersive/);
  await expect(page.locator(".sidebar")).toBeHidden();
  await expect(
    page.getByRole("button", { name: "暂停", exact: true }),
  ).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator(".sidebar")).toBeVisible();
  await expect(
    page.getByRole("button", { name: "暂停", exact: true }),
  ).toBeVisible();
});

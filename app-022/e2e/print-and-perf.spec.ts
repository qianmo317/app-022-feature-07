import { expect, test, type Page } from '@playwright/test';

const HUNDRED = [
  ...new Set(
    '一二三四五六七八九十人口手足耳目日月水火山石田土禾木马虫鱼肉鸟竹米谷风云电天上下大小多少长短高矮进出开关来去坐立走飞东西南北前中外交里半分变成白黑红黄蓝绿紫灰粉金银行学习工作休息游玩吃喝看听读写说球场',
  ),
].slice(0, 100);

async function createWorksheet(page: Page, chars: string): Promise<string> {
  await page.goto('/');
  await page.fill('[data-testid="input-chars"]', chars);
  await page.click('[data-testid="create"]');
  await expect(page).toHaveURL(/\/worksheet\/[^/]+$/);
  return page.url().split('/').pop()!;
}

test.describe('打印 / 校验尺 / PDF / healthz', () => {
  test('healthz 返回 200 ok，静态资源可访问', async ({ request }) => {
    const res = await request.get('/healthz');
    expect(res.status()).toBe(200);
    expect(await res.text()).toBe('ok');
    const index = await request.get('/');
    expect(index.status()).toBe(200);
  });

  test('100mm 校验尺在屏幕上宽度 ≈ 377.95px（1mm=3.7795px）', async ({ page }) => {
    const id = await createWorksheet(page, '春');
    await page.goto(`/worksheet/${id}/print`);
    const box = await page.locator('[data-testid="ruler"]').boundingBox();
    expect(box).toBeTruthy();
    expect(box!.width).toBeGreaterThan(375.9);
    expect(box!.width).toBeLessThan(379.9);
  });

  test('打印视图：无选中态、无交互，页脚页码正确', async ({ page }) => {
    const id = await createWorksheet(page, '春');
    await page.goto(`/worksheet/${id}/print`);
    await expect(page.locator('.sheet')).toHaveCount(1);
    await expect(page.locator('[data-page-num="1"]')).toContainText('第 1 页 / 共 1 页');
    await expect(page.locator('[data-selected]')).toHaveCount(0);
  });

  test('多页打印：页数与预览一致', async ({ page }) => {
    const id = await createWorksheet(page, '春');
    await page.goto(`/worksheet/${id}`);
    await page.fill('[data-testid="editor-chars"]', HUNDRED.join(''));
    await expect(page.locator('[data-testid="char-count"]')).toHaveText('100 字 · 10 页');
    await page.waitForTimeout(600); // 等待防抖自动保存
    await page.goto(`/worksheet/${id}/print`);
    await expect(page.locator('.sheet')).toHaveCount(10);
    await expect(page.locator('[data-page-num="10"]')).toContainText('第 10 页 / 共 10 页');
  });

  test('page.pdf 导出页数与字帖页数一致', async ({ page }) => {
    const id = await createWorksheet(page, '春');
    await page.goto(`/worksheet/${id}`);
    await page.fill('[data-testid="editor-chars"]', HUNDRED.join(''));
    await expect(page.locator('[data-testid="char-count"]')).toHaveText('100 字 · 10 页');
    await page.waitForTimeout(600); // 等待防抖自动保存
    await page.goto(`/worksheet/${id}/print`);
    await expect(page.locator('.sheet')).toHaveCount(10);
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    const s = pdf.toString('latin1');
    // 统计 /Type /Page（排除 /Pages）
    const count = (s.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(count).toBe(10);
  });

  test('访问不存在的字帖 id 自动跳回首页', async ({ page }) => {
    await page.goto('/worksheet/no-such-id');
    await expect(page).toHaveURL(/\/$/);
    await expect(page.locator('[data-testid="create"]')).toBeVisible();
  });

  test('无笔顺数据的汉字显示「无笔顺数据」且不提供描红', async ({ page }) => {
    await createWorksheet(page, '㐀');
    await expect(page.locator('[data-no-stroke]')).toHaveCount(1);
    // 㐀 块 = 例字 + 4 空格 = 5 格：块内只有 1 个 grid 组合外框由每格绘制，
    // 通过块内描红路径数为 0 验证（有描红时会有 font 回退 text 以外的 trace 路径）
    const tracePaths = await page.evaluate(() => {
      const block = document.querySelector('[data-block="㐀"]');
      if (!block) return -1;
      // 描红格使用浅灰色路径，无描红则不存在 stroke=#cccccc 的 path
      return block.querySelectorAll('path[stroke="#cccccc"]').length;
    });
    expect(tracePaths).toBe(0);
  });
});

test.describe('打印页码范围与拼版', () => {
  /** 建一份 100 字（10 页）的字帖并打开打印视图 */
  async function openPrintWithHundred(page: Page): Promise<void> {
    const id = await createWorksheet(page, '春');
    await page.goto(`/worksheet/${id}`);
    await page.fill('[data-testid="editor-chars"]', HUNDRED.join(''));
    await expect(page.locator('[data-testid="char-count"]')).toHaveText('100 字 · 10 页');
    await page.waitForTimeout(600); // 等待防抖自动保存
    await page.goto(`/worksheet/${id}/print`);
  }

  test('页码范围：只印选中页，页脚按「第几张/共几张」编号', async ({ page }) => {
    await openPrintWithHundred(page);
    await expect(page.locator('.sheet')).toHaveCount(10);
    await page.fill('[data-testid="print-from"]', '3');
    await page.fill('[data-testid="print-to"]', '5');
    // 只印 3 张纸，内容分别是原第 3、4、5 页
    await expect(page.locator('.sheet')).toHaveCount(3);
    await expect(page.locator('.sheet').nth(0)).toHaveAttribute('data-page', '2');
    await expect(page.locator('.sheet').nth(1)).toHaveAttribute('data-page', '3');
    await expect(page.locator('.sheet').nth(2)).toHaveAttribute('data-page', '4');
    // 页脚按纸张重新编号
    await expect(page.locator('[data-page-num="1"]')).toContainText('第 1 页 / 共 3 页');
    await expect(page.locator('[data-page-num="3"]')).toContainText('第 3 页 / 共 3 页');
    // 页面上先显示会印几张纸、每张纸上是哪几页
    await expect(page.locator('[data-testid="print-plan"]')).toContainText('共 3 张纸');
    await expect(page.locator('[data-testid="print-plan-item"]')).toHaveCount(3);
    await expect(page.locator('[data-testid="print-plan-item"]').nth(0)).toHaveText('第 1 张＝第 3 页');
    // 校验尺只在第一张纸上（即使原第 1 页不在范围内）
    await expect(page.locator('[data-testid="ruler"]')).toHaveCount(1);
    await expect(page.locator('.sheet').nth(0).locator('[data-testid="ruler"]')).toHaveCount(1);
  });

  test('起始页大于结束页时自动交换', async ({ page }) => {
    await openPrintWithHundred(page);
    await page.fill('[data-testid="print-from"]', '4');
    await page.fill('[data-testid="print-to"]', '2');
    await expect(page.locator('.sheet')).toHaveCount(3);
    await expect(page.locator('.sheet').nth(0)).toHaveAttribute('data-page', '1');
  });

  test('每张纸 2 页：上下排、缩一半、页脚按张编号', async ({ page }) => {
    await openPrintWithHundred(page);
    await page.fill('[data-testid="print-from"]', '1');
    await page.fill('[data-testid="print-to"]', '5');
    await page.locator('[data-testid="per-sheet-2"]').check();
    // 5 页 → 3 张纸（2+2+1）
    await expect(page.locator('.sheet')).toHaveCount(3);
    await expect(page.locator('[data-testid="print-plan"]')).toContainText('共 3 张纸');
    await expect(page.locator('[data-testid="print-plan-item"]').nth(0)).toHaveText('第 1 张＝第 1–2 页');
    await expect(page.locator('[data-testid="print-plan-item"]').nth(2)).toHaveText('第 3 张＝第 5 页');
    // 第一张纸上下两半分别是原第 1、2 页；最后一张只有一半
    const first = page.locator('.sheet').nth(0);
    await expect(first.locator('.sheet-half')).toHaveCount(2);
    await expect(first.locator('.sheet-half').nth(0)).toHaveAttribute('data-page', '0');
    await expect(first.locator('.sheet-half').nth(1)).toHaveAttribute('data-page', '1');
    await expect(page.locator('.sheet').nth(2).locator('.sheet-half')).toHaveCount(1);
    // 每张纸一个页脚，按张编号
    await expect(first.locator('.sheet-footer')).toHaveCount(1);
    await expect(page.locator('[data-page-num="1"]')).toContainText('第 1 页 / 共 3 页');
    await expect(page.locator('[data-page-num="3"]')).toContainText('第 3 页 / 共 3 页');
    // 校验尺只在第一张纸上
    await expect(page.locator('[data-testid="ruler"]')).toHaveCount(1);
    await expect(first.locator('[data-testid="ruler"]')).toHaveCount(1);
    // 半页尺寸 = 105mm × 148.5mm（1mm ≈ 3.7795px）
    const half = await first.locator('.sheet-half').nth(0).boundingBox();
    expect(half).toBeTruthy();
    expect(half!.width).toBeGreaterThan(395.8);
    expect(half!.width).toBeLessThan(397.9);
    expect(half!.height).toBeGreaterThan(560.2);
    expect(half!.height).toBeLessThan(562.3);
    // 格子随页面等比缩一半：行宽 200mm → 100mm ≈ 377.95px
    const row = await first.locator('.sheet-half .row-svg').first().boundingBox();
    expect(row).toBeTruthy();
    expect(row!.width).toBeGreaterThan(375.9);
    expect(row!.width).toBeLessThan(379.9);
  });

  test('范围 + 每张 2 页时 PDF 页数 = 纸张数', async ({ page }) => {
    await openPrintWithHundred(page);
    await page.fill('[data-testid="print-from"]', '2');
    await page.fill('[data-testid="print-to"]', '5');
    await page.locator('[data-testid="per-sheet-2"]').check();
    await expect(page.locator('.sheet')).toHaveCount(2);
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    const s = pdf.toString('latin1');
    const count = (s.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(count).toBe(2);
  });
});

test.describe('性能', () => {
  test('100 字全量重排 < 200ms', async ({ page }) => {
    await createWorksheet(page, '春');
    // 先填充到接近规模，避免首次渲染计入
    await page.fill('[data-testid="editor-chars"]', HUNDRED.slice(0, 50).join(''));
    await expect(page.locator('[data-testid="char-count"]')).toContainText('50 字');
    const ms = await page.evaluate(
      (next) =>
        new Promise<number>((resolve) => {
          const ta = document.querySelector('[data-testid="editor-chars"]') as HTMLTextAreaElement;
          const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, 'value')!.set!;
          const t0 = performance.now();
          setter.call(ta, next);
          ta.dispatchEvent(new Event('input', { bubbles: true }));
          requestAnimationFrame(() => requestAnimationFrame(() => resolve(performance.now() - t0)));
        }),
      HUNDRED.join(''),
    );
    console.log(`100 字重排耗时: ${ms.toFixed(1)}ms`);
    expect(ms).toBeLessThan(200);
  });
});

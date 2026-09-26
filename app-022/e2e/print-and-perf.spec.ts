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

  test('打印视图：页码范围只印选中页，页脚按纸编号', async ({ page }) => {
    const id = await createWorksheet(page, '春');
    await page.goto(`/worksheet/${id}`);
    await page.fill('[data-testid="editor-chars"]', HUNDRED.join(''));
    await expect(page.locator('[data-testid="char-count"]')).toHaveText('100 字 · 10 页');
    await page.waitForTimeout(600); // 等待防抖自动保存
    await page.goto(`/worksheet/${id}/print`);
    await expect(page.locator('.sheet')).toHaveCount(10);
    // 选择第 3–5 页
    await page.fill('[data-testid="print-from"]', '3');
    await page.fill('[data-testid="print-to"]', '5');
    await expect(page.locator('.sheet')).toHaveCount(3);
    await expect(page.locator('[data-testid="print-summary"]')).toContainText('将打印 3 张纸');
    await expect(page.locator('[data-testid="print-summary"]')).toContainText('第 1 张=第 3 页');
    await expect(page.locator('[data-page-num="1"]')).toContainText('第 1 页 / 共 3 页');
    await expect(page.locator('[data-page-num="3"]')).toContainText('第 3 页 / 共 3 页');
    // 范围外的字不渲染：第 1 页含「一」，第 3 页含「山」
    await expect(page.locator('[data-block="一"]')).toHaveCount(0);
    await expect(page.locator('[data-block="山"]')).toHaveCount(1);
    // 校验尺只在第一张纸出现
    await expect(page.locator('[data-testid="ruler"]')).toHaveCount(1);
    await expect(page.locator('.sheet').first().locator('[data-testid="ruler"]')).toHaveCount(1);
  });

  test('打印视图：每张纸 2 页上下拼版，内容缩放一半', async ({ page }) => {
    const id = await createWorksheet(page, '春');
    await page.goto(`/worksheet/${id}`);
    await page.fill('[data-testid="editor-chars"]', HUNDRED.join(''));
    await expect(page.locator('[data-testid="char-count"]')).toHaveText('100 字 · 10 页');
    await page.waitForTimeout(600); // 等待防抖自动保存
    await page.goto(`/worksheet/${id}/print`);
    await page.selectOption('[data-testid="print-per-sheet"]', '2');
    await expect(page.locator('.sheet')).toHaveCount(5);
    await expect(page.locator('[data-testid="print-summary"]')).toContainText('将打印 5 张纸');
    await expect(page.locator('[data-testid="print-summary"]')).toContainText('第 1 张=第 1–2 页');
    // 每张纸上下两个槽位
    await expect(page.locator('.sheet').first().locator('.sheet-slot')).toHaveCount(2);
    // 校验尺全文档只出现一次，且在第一张纸
    await expect(page.locator('[data-testid="ruler"]')).toHaveCount(1);
    await expect(page.locator('.sheet').first().locator('[data-testid="ruler"]')).toHaveCount(1);
    // 页脚按纸编号
    await expect(page.locator('[data-page-num="5"]')).toContainText('第 5 页 / 共 5 页');
    // 行宽 200mm 缩放一半 → 屏幕 ≈ 377.95px（1mm=3.7795px）
    const rowBox = await page.locator('.sheet').first().locator('.row-svg').first().boundingBox();
    expect(rowBox).toBeTruthy();
    expect(rowBox!.width).toBeGreaterThan(375.9);
    expect(rowBox!.width).toBeLessThan(379.9);
    // 奇数范围：最后一张纸只有上半页
    await page.fill('[data-testid="print-to"]', '9');
    await expect(page.locator('.sheet')).toHaveCount(5);
    await expect(page.locator('.sheet').last().locator('.sheet-slot')).toHaveCount(1);
    await expect(page.locator('[data-page-num="5"]')).toContainText('第 5 页 / 共 5 页');
  });

  test('拼版 PDF：范围 1–4 页、每张纸 2 页 → 2 页 PDF', async ({ page }) => {
    const id = await createWorksheet(page, '春');
    await page.goto(`/worksheet/${id}`);
    await page.fill('[data-testid="editor-chars"]', HUNDRED.join(''));
    await expect(page.locator('[data-testid="char-count"]')).toHaveText('100 字 · 10 页');
    await page.waitForTimeout(600); // 等待防抖自动保存
    await page.goto(`/worksheet/${id}/print`);
    await page.fill('[data-testid="print-to"]', '4');
    await page.selectOption('[data-testid="print-per-sheet"]', '2');
    await expect(page.locator('.sheet')).toHaveCount(2);
    const pdf = await page.pdf({ format: 'A4', printBackground: true });
    const s = pdf.toString('latin1');
    // 统计 /Type /Page（排除 /Pages）
    const count = (s.match(/\/Type\s*\/Page[^s]/g) ?? []).length;
    expect(count).toBe(2);
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

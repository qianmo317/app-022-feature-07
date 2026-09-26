/**
 * 打印拼版规划：把「页码范围 + 每张纸页数」换算成每张纸上放哪些页。
 * 页码对外一律 1 起、含端点；范围之外的页不参与打印。
 */

/** 把用户输入的页码夹到 [1, pageCount]，并保证 from ≤ to（起止填反时自动交换） */
export function normalizeRange(from: number, to: number, pageCount: number): { from: number; to: number } {
  const total = Math.max(1, Math.round(pageCount));
  const clamp = (n: number): number => {
    const v = Math.round(n);
    if (!Number.isFinite(v)) return 1;
    return Math.min(total, Math.max(1, v));
  };
  const a = clamp(from);
  const b = clamp(to);
  return a <= b ? { from: a, to: b } : { from: b, to: a };
}

/**
 * 每张纸上放哪些页（返回 1 起的页码列表，一项 = 一张纸）。
 * perSheet = 2 时两页拼一张（上下排、各缩一半），页数为奇数时最后一张只放一页。
 */
export function planSheets(pageCount: number, from: number, to: number, perSheet: 1 | 2): number[][] {
  const range = normalizeRange(from, to, pageCount);
  const sheets: number[][] = [];
  for (let p = range.from; p <= range.to; p += perSheet) {
    const sheet = [p];
    if (perSheet === 2 && p + 1 <= range.to) sheet.push(p + 1);
    sheets.push(sheet);
  }
  return sheets;
}

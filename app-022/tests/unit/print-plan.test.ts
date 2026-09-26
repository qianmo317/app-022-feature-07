import { describe, expect, it } from 'vitest';
import { normalizeRange, planSheets } from '../../src/lib/printPlan';

describe('normalizeRange 页码范围约束', () => {
  it('夹到 [1, pageCount]', () => {
    expect(normalizeRange(0, 99, 10)).toEqual({ from: 1, to: 10 });
    expect(normalizeRange(-3, 4, 10)).toEqual({ from: 1, to: 4 });
  });

  it('起始页大于结束页时自动交换', () => {
    expect(normalizeRange(5, 3, 10)).toEqual({ from: 3, to: 5 });
  });

  it('非法输入回退到第 1 页', () => {
    expect(normalizeRange(NaN, NaN, 10)).toEqual({ from: 1, to: 1 });
  });
});

describe('planSheets 拼版规划', () => {
  it('每张 1 页：一页一张纸', () => {
    expect(planSheets(10, 1, 10, 1)).toEqual([[1], [2], [3], [4], [5], [6], [7], [8], [9], [10]]);
  });

  it('页码范围：只含选中页', () => {
    expect(planSheets(10, 3, 5, 1)).toEqual([[3], [4], [5]]);
  });

  it('每张 2 页：两页拼一张，落单独占一张', () => {
    expect(planSheets(10, 1, 5, 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('每张 2 页 + 页码范围：从起始页开始两两配对', () => {
    expect(planSheets(10, 3, 6, 2)).toEqual([[3, 4], [5, 6]]);
  });

  it('范围越界时先夹紧再拼版', () => {
    expect(planSheets(3, 0, 99, 2)).toEqual([[1, 2], [3]]);
  });
});

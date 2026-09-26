import { describe, expect, it } from 'vitest';
import { groupSheets } from '../../src/components/PrintSheets';

describe('groupSheets 打印拼版分组', () => {
  it('每张纸 1 页：范围内的页各占一张纸', () => {
    expect(groupSheets(10, 1, 10, 1)).toEqual([[1], [2], [3], [4], [5], [6], [7], [8], [9], [10]]);
    expect(groupSheets(10, 3, 5, 1)).toEqual([[3], [4], [5]]);
  });

  it('每张纸 2 页：上下拼版，奇数范围最后一张纸只有一页', () => {
    expect(groupSheets(10, 1, 10, 2)).toEqual([[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]]);
    expect(groupSheets(10, 3, 5, 2)).toEqual([[3, 4], [5]]);
    expect(groupSheets(5, 1, 5, 2)).toEqual([[1, 2], [3, 4], [5]]);
  });

  it('起止颠倒与越界自动收敛', () => {
    expect(groupSheets(10, 5, 3, 1)).toEqual([[3], [4], [5]]);
    expect(groupSheets(10, 0, 99, 2)).toEqual([[1, 2], [3, 4], [5, 6], [7, 8], [9, 10]]);
    expect(groupSheets(3, 2, 99, 2)).toEqual([[2, 3]]);
  });

  it('单页范围与空范围', () => {
    expect(groupSheets(10, 4, 4, 2)).toEqual([[4]]);
    expect(groupSheets(3, 5, 7, 1)).toEqual([]);
  });
});

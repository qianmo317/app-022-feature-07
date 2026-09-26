/**
 * 打印拼版：把选中的页码范围按「每张纸 1/2 页」分组到 A4 纸上。
 * 2 页/纸时上下排布、整页缩放 50%（格子尺寸同步减半），校验尺只在第一张纸出现；
 * 范围之外的页不渲染、不参与打印，页脚按纸编号「第 s 页 / 共 S 页」。
 */
import type { JSX } from 'react';
import type { Worksheet } from '../types';
import { PAGE, clampLayout, paginate } from '../lib/layout';
import { strokeCountOf } from '../lib/data';
import { SheetPage } from './PageView';

/** 每张纸放置的字帖页数 */
export type PerSheet = 1 | 2;

/**
 * 页码范围（1-based，起止顺序不限）→ 每张纸承载的页码组。
 * 越界自动收敛到 [1, totalPages]；范围为空时返回空数组。
 */
export function groupSheets(totalPages: number, from: number, to: number, perSheet: PerSheet): number[][] {
  const lo = Math.max(1, Math.min(from, to));
  const hi = Math.min(totalPages, Math.max(from, to));
  const sheets: number[][] = [];
  for (let p = lo; p <= hi; p += perSheet) {
    sheets.push(Array.from({ length: Math.min(perSheet, hi - p + 1) }, (_, i) => p + i));
  }
  return sheets;
}

type PrintSheetsProps = {
  worksheet: Worksheet;
  /** groupSheets 的结果：每张纸承载的 1-based 页码 */
  sheets: number[][];
  perSheet: PerSheet;
};

/** 打印输出：每张 A4 纸一个 .sheet（强制分页），页脚按纸编号 */
export function PrintSheets({ worksheet, sheets, perSheet }: PrintSheetsProps): JSX.Element {
  const layout = clampLayout(worksheet.layout);
  const pages = paginate(worksheet.chars, layout, strokeCountOf);
  const imposed = perSheet === 2;
  const pagePadding = {
    paddingTop: `${PAGE.marginTMm}mm`,
    paddingRight: `${PAGE.marginRMm}mm`,
    paddingBottom: `${PAGE.marginBMm}mm`,
    paddingLeft: `${PAGE.marginLMm}mm`,
  };

  return (
    <div data-pages data-page-count={sheets.length} data-per-sheet={perSheet}>
      {sheets.map((pageNums, si) => (
        <div
          key={si}
          className={imposed ? 'sheet sheet-imposed' : 'sheet'}
          data-sheet={si}
          style={
            imposed
              ? { width: `${PAGE.wMm}mm`, height: `${PAGE.hMm}mm` }
              : { width: `${PAGE.wMm}mm`, height: `${PAGE.hMm}mm`, ...pagePadding }
          }
        >
          {imposed ? (
            <div className="sheet-slots">
              {pageNums.map((pn, slot) => (
                <div className="sheet-slot" data-slot={slot} key={pn} style={{ height: `${PAGE.hMm / 2}mm` }}>
                  {/* 缩放后的可视区 105×148.5mm，内部整页 scale(0.5)，宽高各半 */}
                  <div className="slot-zoom" style={{ width: `${PAGE.wMm / 2}mm`, height: `${PAGE.hMm / 2}mm` }}>
                    <div
                      className="slot-page"
                      style={{
                        width: `${PAGE.wMm}mm`,
                        height: `${PAGE.hMm}mm`,
                        transform: 'scale(0.5)',
                        transformOrigin: 'top left',
                        ...pagePadding,
                      }}
                    >
                      <SheetPage
                        worksheet={worksheet}
                        layout={layout}
                        rows={pages[pn - 1]}
                        showRuler={si === 0 && slot === 0}
                        plain
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <SheetPage worksheet={worksheet} layout={layout} rows={pages[pageNums[0] - 1]} showRuler={si === 0} plain />
          )}
          <div className={imposed ? 'sheet-footer sheet-footer-float' : 'sheet-footer'} data-page-num={si + 1}>
            第 {si + 1} 页 / 共 {sheets.length} 页
          </div>
        </div>
      ))}
    </div>
  );
}

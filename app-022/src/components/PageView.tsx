import { memo } from 'react';
import type { JSX, MouseEvent } from 'react';
import type { Row, Worksheet } from '../types';
import { PAGE, clampLayout, paginate } from '../lib/layout';
import { planSheets } from '../lib/printPlan';
import { RowContent, ROW_FACTOR } from './paint';
import { getStrokes } from '../lib/data';
import { readingsOf } from '../lib/pinyin';

/** 100mm 校验尺（1:1 打印校验） */
export function Ruler(): JSX.Element {
  return (
    <svg
      data-testid="ruler"
      width="100mm"
      height="7mm"
      viewBox="0 0 100 7"
      style={{ display: 'block' }}
      aria-label="100mm 校验尺"
    >
      <rect x={0} y={0} width={100} height={7} fill="none" stroke="#999" strokeWidth={0.3} />
      <line x1={0.5} y1={6} x2={99.5} y2={6} stroke="#333" strokeWidth={0.4} />
      {Array.from({ length: 11 }, (_, i) => {
        const x = i * 10;
        const long = i % 5 === 0;
        return (
          <g key={i}>
            <line x1={x} y1={6} x2={x} y2={long ? 1.5 : 3.5} stroke="#333" strokeWidth={0.4} />
            {long && i > 0 && (
              <text x={x} y={4.8} textAnchor="middle" fontSize={3.4} fontFamily="'Noto Sans SC','PingFang SC',sans-serif" fill="#333">
                {i * 10}
              </text>
            )}
          </g>
        );
      })}
      <text x={0} y={4.8} fontSize={3.4} fontFamily="'Noto Sans SC','PingFang SC',sans-serif" fill="#333">
        0
      </text>
      <text x={0} y={0.9} fontSize={3} fontFamily="'Noto Sans SC','PingFang SC',sans-serif" fill="#c0392b">
        校验尺：打印后应为 100mm，请关闭「缩放/适应页面」
      </text>
    </svg>
  );
}

export function pinyinResolver(worksheet: Worksheet): (ch: string) => string | undefined {
  return (ch: string) => {
    const readings = readingsOf(ch);
    if (readings.length === 0) return undefined;
    const idx = worksheet.pinyinChoice?.[ch] ?? 0;
    return readings[Math.min(idx, readings.length - 1)];
  };
}

function strokeCountOf(ch: string): number | undefined {
  const s = getStrokes(ch);
  return s ? s.length : undefined;
}

/** 计算行内各字块的 unit 区间，用于点击命中 */
function blockRanges(row: Row): { char: string; start: number; end: number }[] {
  let x = 0;
  return row.map((b) => {
    const r = { char: b.char, start: x, end: x + b.cells.length * 100 };
    x = r.end;
    return r;
  });
}

type PageViewProps = {
  worksheet: Worksheet;
  selectedChar?: string;
  onSelectChar?: (ch: string) => void;
  /** 打印/导出模式下不显示选中态与点击行为 */
  plain?: boolean;
  className?: string;
  /** 打印：页码范围（1 起、含端点），默认整份字帖；范围之外的页不渲染 */
  pageFrom?: number;
  pageTo?: number;
  /** 打印：每张纸拼几页（2 时上下排、两页各缩到一半宽高） */
  perSheet?: 1 | 2;
};

/** 全部页面（预览与打印共用同一渲染，所见即打印所得） */
export const PageView = memo(function PageView({
  worksheet,
  selectedChar,
  onSelectChar,
  plain,
  className,
  pageFrom,
  pageTo,
  perSheet = 1,
}: PageViewProps) {
  const layout = clampLayout(worksheet.layout);
  const pages = paginate(worksheet.chars, layout, strokeCountOf);
  const pinyinFor = pinyinResolver(worksheet);
  const rowWidthMm = layout.perLine * layout.cellMm;
  const rowHeightMm = layout.cellMm * ROW_FACTOR;
  // 选中范围之外的页不参与打印；每张纸的页脚按「第几张 / 共几张」重新编号
  const sheets = planSheets(pages.length, pageFrom ?? 1, pageTo ?? pages.length, perSheet);

  function handleRowClick(row: Row, e: MouseEvent<SVGSVGElement>) {
    if (plain || !onSelectChar) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const unit = ((e.clientX - rect.left) / rect.width) * layout.perLine * 100;
    const hit = blockRanges(row).find((r) => unit >= r.start && unit < r.end);
    if (hit) onSelectChar(hit.char);
  }

  /** 一页的正文（页眉 + 各行），整页与两页拼版（缩放 0.5）共用 */
  function renderPageBody(pageIdx: number, showRuler: boolean): JSX.Element {
    const rows = pages[pageIdx];
    return (
      <>
        <div className="sheet-header" style={{ height: `${PAGE.headerMm}mm` }}>
          <div className="sheet-title" data-testid="sheet-title">
            {worksheet.title}
          </div>
          {showRuler && <Ruler />}
        </div>
        <div
          className="sheet-rows"
          style={{ display: 'flex', flexDirection: 'column', gap: `${layout.lineGapMm}mm` }}
        >
          {rows.map((row, ri) => (
            <svg
              key={ri}
              className="row-svg"
              data-row={ri}
              width={`${rowWidthMm}mm`}
              height={`${rowHeightMm}mm`}
              viewBox={`0 0 ${layout.perLine * 100} 120`}
              onClick={(e) => handleRowClick(row, e)}
            >
              <RowContent row={row} layout={layout} selectedChar={plain ? undefined : selectedChar} pinyinFor={pinyinFor} />
            </svg>
          ))}
        </div>
      </>
    );
  }

  const sheetBox = { width: `${PAGE.wMm}mm`, height: `${PAGE.hMm}mm` } as const;
  const sheetPadding = {
    paddingTop: `${PAGE.marginTMm}mm`,
    paddingRight: `${PAGE.marginRMm}mm`,
    paddingBottom: `${PAGE.marginBMm}mm`,
    paddingLeft: `${PAGE.marginLMm}mm`,
  } as const;

  return (
    <div className={className} data-pages data-page-count={pages.length} data-sheet-count={sheets.length}>
      {sheets.map((sheetPages, si) => {
        // 页脚按纸张编号：第几张 / 共几张
        const footer = (
          <div className="sheet-footer" data-page-num={si + 1}>
            第 {si + 1} 页 / 共 {sheets.length} 页
          </div>
        );
        if (perSheet === 2) {
          // 两页拼一张：上下排，两页都缩到一半宽高（格子、校验尺随页面等比缩放）
          return (
            <div key={si} className="sheet sheet-2up" data-sheet={si} style={sheetBox}>
              {sheetPages.map((p, k) => (
                <div className="sheet-half" data-page={p - 1} key={p}>
                  <div className="sheet-half-scale" style={{ ...sheetBox, ...sheetPadding }}>
                    {renderPageBody(p - 1, si === 0 && k === 0)}
                  </div>
                </div>
              ))}
              {footer}
            </div>
          );
        }
        const p = sheetPages[0];
        return (
          <div key={si} className="sheet" data-page={p - 1} data-sheet={si} style={{ ...sheetBox, ...sheetPadding }}>
            {renderPageBody(p - 1, si === 0)}
            {footer}
          </div>
        );
      })}
    </div>
  );
});

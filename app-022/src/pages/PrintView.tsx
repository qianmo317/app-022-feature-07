import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import { useWorksheetDoc } from '../hooks';
import { PageView } from '../components/PageView';
import { clampLayout, paginate } from '../lib/layout';
import { normalizeRange, planSheets } from '../lib/printPlan';
import { strokeCountOf } from '../lib/data';

/** 打印视图：只有纸面内容，?autoprint=1 时字体就绪后自动弹出打印 */
export default function PrintView(): JSX.Element {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { ws, notFound } = useWorksheetDoc(id);
  // 打印范围（1 起、含端点）；pageTo 为 null 表示「到最后一页」
  const [pageFrom, setPageFrom] = useState(1);
  const [pageTo, setPageTo] = useState<number | null>(null);
  const [perSheet, setPerSheet] = useState<1 | 2>(1);

  useEffect(() => {
    if (!ws || params.get('autoprint') !== '1') return;
    let cancelled = false;
    document.fonts.ready.then(() => {
      if (!cancelled) setTimeout(() => window.print(), 300);
    });
    return () => {
      cancelled = true;
    };
  }, [ws, params]);

  if (notFound) return <Navigate to="/" replace />;
  if (!ws) return <div className="app-state">加载中…</div>;

  const pageCount = paginate(ws.chars, clampLayout(ws.layout), strokeCountOf).length;
  const range = normalizeRange(pageFrom, pageTo ?? pageCount, pageCount);
  const sheets = planSheets(pageCount, range.from, range.to, perSheet);

  const onRangeInput =
    (setter: (n: number) => void) =>
    (e: { target: { value: string } }): void => {
      const n = Number(e.target.value);
      if (!Number.isNaN(n)) setter(n);
    };

  return (
    <div className="print-root">
      <div className="print-toolbar no-print">
        <Link className="btn ghost" to={`/worksheet/${id}`}>← 返回编辑</Link>
        <button className="btn primary" data-testid="print-now" onClick={() => window.print()}>打印</button>
        <label className="print-opt">
          起始页
          <input
            type="number"
            data-testid="print-from"
            min={1}
            max={pageCount}
            value={range.from}
            onChange={onRangeInput(setPageFrom)}
          />
        </label>
        <label className="print-opt">
          结束页
          <input
            type="number"
            data-testid="print-to"
            min={1}
            max={pageCount}
            value={range.to}
            onChange={onRangeInput(setPageTo)}
          />
        </label>
        <span className="print-opt">
          每张纸
          <label>
            <input
              type="radio"
              name="per-sheet"
              data-testid="per-sheet-1"
              checked={perSheet === 1}
              onChange={() => setPerSheet(1)}
            />
            1 页
          </label>
          <label>
            <input
              type="radio"
              name="per-sheet"
              data-testid="per-sheet-2"
              checked={perSheet === 2}
              onChange={() => setPerSheet(2)}
            />
            2 页
          </label>
        </span>
        <span className="hint">打印时请选择 A4、实际大小（关闭「缩放/适应页面」）；第 1 张纸含 100mm 校验尺。</span>
        <span className="print-plan" data-testid="print-plan">
          <strong>共 {sheets.length} 张纸</strong>
          {sheets.map((s, i) => (
            <span key={i} data-testid="print-plan-item">
              第 {i + 1} 张＝第 {s[0]}{s.length > 1 ? `–${s[s.length - 1]}` : ''} 页
            </span>
          ))}
        </span>
      </div>
      <PageView worksheet={ws} plain pageFrom={range.from} pageTo={range.to} perSheet={perSheet} />
    </div>
  );
}

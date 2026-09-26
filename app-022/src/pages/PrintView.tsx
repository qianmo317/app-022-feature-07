import { useEffect, useState } from 'react';
import type { JSX } from 'react';
import { Link, Navigate, useParams, useSearchParams } from 'react-router-dom';
import type { Worksheet } from '../types';
import { useWorksheetDoc } from '../hooks';
import { paginate } from '../lib/layout';
import { strokeCountOf } from '../lib/data';
import { PrintSheets, groupSheets, type PerSheet } from '../components/PrintSheets';

/** 打印视图：可选页码范围与每张纸 1/2 页拼版，?autoprint=1 时字体就绪后自动弹出打印 */
export default function PrintView(): JSX.Element {
  const { id } = useParams();
  const [params] = useSearchParams();
  const { ws, notFound } = useWorksheetDoc(id);

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
  return <PrintReady id={id} ws={ws} />;
}

/** 字帖加载完成后的打印设置与纸面预览（state 以总页数初始化，故拆成独立组件） */
function PrintReady({ id, ws }: { id: string | undefined; ws: Worksheet }): JSX.Element {
  const total = paginate(ws.chars, ws.layout, strokeCountOf).length;
  const [from, setFrom] = useState(1);
  const [to, setTo] = useState(total);
  const [perSheet, setPerSheet] = useState<PerSheet>(1);
  const sheets = groupSheets(total, from, to, perSheet);

  const clampPage = (n: number) => Math.min(total, Math.max(1, Math.round(n) || 1));
  // 起始/结束页保持 from <= to：越过另一端时把另一端一起带走
  const changeFrom = (n: number) => {
    const v = clampPage(n);
    setFrom(v);
    if (v > to) setTo(v);
  };
  const changeTo = (n: number) => {
    const v = clampPage(n);
    setTo(v);
    if (v < from) setFrom(v);
  };

  const plan = sheets
    .map((s, i) => (s.length === 1 ? `第 ${i + 1} 张=第 ${s[0]} 页` : `第 ${i + 1} 张=第 ${s[0]}–${s[s.length - 1]} 页`))
    .join('，');

  return (
    <div className="print-root">
      <div className="print-toolbar no-print">
        <Link className="btn ghost" to={`/worksheet/${id}`}>← 返回编辑</Link>
        <label className="print-field">
          起始页
          <input
            type="number"
            data-testid="print-from"
            min={1}
            max={total}
            value={from}
            onChange={(e) => changeFrom(Number(e.target.value))}
          />
        </label>
        <label className="print-field">
          结束页
          <input
            type="number"
            data-testid="print-to"
            min={1}
            max={total}
            value={to}
            onChange={(e) => changeTo(Number(e.target.value))}
          />
        </label>
        <label className="print-field">
          每张纸
          <select
            data-testid="print-per-sheet"
            value={perSheet}
            onChange={(e) => setPerSheet(Number(e.target.value) as PerSheet)}
          >
            <option value={1}>1 页</option>
            <option value={2}>2 页（上下拼版）</option>
          </select>
        </label>
        <span className="hint" data-testid="print-summary">将打印 {sheets.length} 张纸：{plan}</span>
        <button className="btn primary" data-testid="print-now" onClick={() => window.print()}>打印</button>
        <span className="hint">
          打印时请选择 A4、实际大小（关闭「缩放/适应页面」）；
          {perSheet === 2 ? '拼版内容缩放 50%，校验尺应为 50mm。' : '第 1 张纸含 100mm 校验尺。'}
        </span>
      </div>
      <PrintSheets worksheet={ws} sheets={sheets} perSheet={perSheet} />
    </div>
  );
}

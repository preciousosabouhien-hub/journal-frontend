import React, { useState, useMemo, useEffect } from "react";
import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine } from "recharts";
import { Plus, TrendingUp, TrendingDown, Target, X, Tag as TagIcon, Upload, Check, AlertCircle, Loader2 } from "lucide-react";
import { api } from "./api.js";

const STRATEGY_TAGS = ["Breakout", "Pullback", "Reversal", "News", "Range", "Trend Follow"];

function calcPips(symbol, openPrice, closePrice, direction) {
  const multiplier = symbol === "USDJPY" ? 100 : symbol === "XAUUSD" ? 1 : 10000;
  const diff = direction === "buy" ? closePrice - openPrice : openPrice - closePrice;
  return diff * multiplier;
}

function calcRR(direction, openPrice, sl, tp) {
  const risk = Math.abs(openPrice - sl);
  const reward = Math.abs(tp - openPrice);
  return risk === 0 ? 0 : reward / risk;
}

function fmtMoney(n) {
  const sign = n >= 0 ? "+" : "−";
  return `${sign}$${Math.abs(n).toFixed(2)}`;
}

function RRBar({ direction, openPrice, sl, tp }) {
  const risk = Math.abs(openPrice - sl);
  const reward = Math.abs(tp - openPrice);
  const total = risk + reward;
  const riskPct = total === 0 ? 50 : (risk / total) * 100;
  const rewardPct = 100 - riskPct;
  const ratio = risk === 0 ? 0 : reward / risk;
  return (
    <div className="flex items-center gap-2 w-full">
      <div className="flex h-1.5 flex-1 rounded-full overflow-hidden bg-[#2A2E38]">
        <div style={{ width: `${riskPct}%` }} className="bg-[#E5484D]" />
        <div style={{ width: `${rewardPct}%` }} className="bg-[#3DD68C]" />
      </div>
      <span className="text-[11px] font-mono text-[#A8B0BD] w-10 text-right tabular-nums">1:{ratio.toFixed(1)}</span>
    </div>
  );
}

function StatCard({ label, value, sub, accent }) {
  return (
    <div className="flex-1 min-w-[120px] px-4 py-3 border-r border-[#2A2E38] last:border-r-0">
      <div className="text-[11px] uppercase tracking-wider text-[#6B7280] font-sans mb-1">{label}</div>
      <div className={`text-xl font-mono font-medium tabular-nums ${accent || "text-[#F2F4F7]"}`}>{value}</div>
      {sub && <div className="text-[11px] text-[#6B7280] font-sans mt-0.5">{sub}</div>}
    </div>
  );
}

function TagPill({ tag, onRemove }) {
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[11px] font-sans bg-[#2A2E38] text-[#A8B0BD] border border-[#363B47]">
      {tag}
      {onRemove && (
        <button onClick={onRemove} className="hover:text-[#F2F4F7]">
          <X size={10} />
        </button>
      )}
    </span>
  );
}

function TagEditor({ trade, onSave, onTagClick }) {
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [pendingTags, setPendingTags] = useState(trade.tags);
  const ref = React.useRef(null);

  // Keep local editing state in sync if the trade's tags change from elsewhere
  // (e.g. another save completing), but only while the popover is closed —
  // avoids overwriting an in-progress edit out from under the user.
  useEffect(() => {
    if (!open) setPendingTags(trade.tags);
  }, [trade.tags, open]);

  // Close the popover when clicking outside it.
  useEffect(() => {
    if (!open) return;
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [open]);

  const toggleTag = async (tag) => {
    const next = pendingTags.includes(tag)
      ? pendingTags.filter((t) => t !== tag)
      : [...pendingTags, tag];
    setPendingTags(next);
    setSaving(true);
    try {
      await onSave(trade.id, { tags: next });
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="relative inline-block" ref={ref}>
      <div className="flex flex-wrap items-center gap-1">
        {trade.tags.map((tag) => (
          <button key={tag} onClick={() => onTagClick(tag)}>
            <TagPill tag={tag} />
          </button>
        ))}
        <button
          onClick={() => setOpen((o) => !o)}
          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded-md text-[11px] font-sans text-[#6B7280] border border-dashed border-[#363B47] hover:text-[#3DD68C] hover:border-[#3DD68C]/40"
        >
          {saving ? <Loader2 size={10} className="animate-spin" /> : <Plus size={10} />}
          {trade.tags.length === 0 ? "Tag" : ""}
        </button>
      </div>

      {open && (
        <div className="absolute z-20 top-full left-0 mt-1 bg-[#1C1F26] border border-[#2A2E38] rounded-lg shadow-lg p-2 w-44">
          <div className="flex flex-col gap-1">
            {STRATEGY_TAGS.map((tag) => (
              <button
                key={tag}
                onClick={() => toggleTag(tag)}
                className={`flex items-center justify-between text-left px-2 py-1.5 rounded-md text-[12px] font-sans ${
                  pendingTags.includes(tag) ? "bg-[#3DD68C]/15 text-[#3DD68C]" : "text-[#A8B0BD] hover:bg-[#2A2E38]"
                }`}
              >
                {tag}
                {pendingTags.includes(tag) && <Check size={12} />}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AddTradeForm({ onAdd, onClose }) {
  const [form, setForm] = useState({
    symbol: "EURUSD", direction: "buy", openTime: new Date().toISOString().slice(0, 10),
    openPrice: "", closePrice: "", sl: "", tp: "", lot: "0.1", tags: [], notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const toggleTag = (tag) => {
    setForm((f) => ({
      ...f,
      tags: f.tags.includes(tag) ? f.tags.filter((t) => t !== tag) : [...f.tags, tag],
    }));
  };

  const handleSubmit = async () => {
    const op = parseFloat(form.openPrice), cp = parseFloat(form.closePrice);
    if (!op || !cp || !form.sl || !form.tp) {
      setError("Open price, close price, stop loss, and take profit are all required.");
      return;
    }
    const pips = calcPips(form.symbol, op, cp, form.direction);
    const pl = pips * parseFloat(form.lot) * (form.symbol === "XAUUSD" ? 1 : 10);

    setSubmitting(true);
    setError(null);
    try {
      await onAdd({
        symbol: form.symbol, direction: form.direction, openTime: form.openTime,
        openPrice: op, closePrice: cp, sl: parseFloat(form.sl), tp: parseFloat(form.tp),
        lot: parseFloat(form.lot), pl: Math.round(pl), tags: form.tags, notes: form.notes,
      });
      onClose();
    } catch (err) {
      setError(err.message || "Couldn't save the trade. Is the backend running?");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass = "w-full bg-[#13151A] border border-[#2A2E38] rounded-md px-3 py-2 text-sm font-mono text-[#F2F4F7] focus:outline-none focus:ring-1 focus:ring-[#3DD68C] focus:border-[#3DD68C]";
  const labelClass = "text-[11px] uppercase tracking-wider text-[#6B7280] font-sans mb-1.5 block";

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-[#1C1F26] border border-[#2A2E38] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2E38]">
          <h2 className="font-sans font-semibold text-[#F2F4F7]">Log a trade</h2>
          <button onClick={onClose} className="text-[#6B7280] hover:text-[#F2F4F7]">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Symbol</label>
              <select className={inputClass} value={form.symbol} onChange={(e) => setForm({ ...form, symbol: e.target.value })}>
                {["EURUSD", "GBPUSD", "USDJPY", "XAUUSD"].map((s) => <option key={s}>{s}</option>)}
              </select>
            </div>
            <div>
              <label className={labelClass}>Direction</label>
              <div className="flex rounded-md border border-[#2A2E38] overflow-hidden">
                {["buy", "sell"].map((d) => (
                  <button key={d} onClick={() => setForm({ ...form, direction: d })}
                    className={`flex-1 py-2 text-sm font-sans capitalize ${form.direction === d ? (d === "buy" ? "bg-[#3DD68C]/15 text-[#3DD68C]" : "bg-[#E5484D]/15 text-[#E5484D]") : "text-[#6B7280]"}`}>
                    {d}
                  </button>
                ))}
              </div>
            </div>
          </div>
          <div>
            <label className={labelClass}>Date</label>
            <input type="date" className={inputClass} value={form.openTime} onChange={(e) => setForm({ ...form, openTime: e.target.value })} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Open price</label>
              <input type="number" step="0.0001" className={inputClass} value={form.openPrice} onChange={(e) => setForm({ ...form, openPrice: e.target.value })} placeholder="1.0850" />
            </div>
            <div>
              <label className={labelClass}>Close price</label>
              <input type="number" step="0.0001" className={inputClass} value={form.closePrice} onChange={(e) => setForm({ ...form, closePrice: e.target.value })} placeholder="1.0900" />
            </div>
          </div>
          <div className="grid grid-cols-3 gap-3">
            <div>
              <label className={labelClass}>Stop loss</label>
              <input type="number" step="0.0001" className={inputClass} value={form.sl} onChange={(e) => setForm({ ...form, sl: e.target.value })} placeholder="1.0820" />
            </div>
            <div>
              <label className={labelClass}>Take profit</label>
              <input type="number" step="0.0001" className={inputClass} value={form.tp} onChange={(e) => setForm({ ...form, tp: e.target.value })} placeholder="1.0930" />
            </div>
            <div>
              <label className={labelClass}>Lot size</label>
              <input type="number" step="0.01" className={inputClass} value={form.lot} onChange={(e) => setForm({ ...form, lot: e.target.value })} />
            </div>
          </div>
          <div>
            <label className={labelClass}>Strategy tags</label>
            <div className="flex flex-wrap gap-1.5">
              {STRATEGY_TAGS.map((tag) => (
                <button key={tag} onClick={() => toggleTag(tag)}
                  className={`px-2.5 py-1 rounded-md text-[12px] font-sans border ${form.tags.includes(tag) ? "bg-[#3DD68C]/15 text-[#3DD68C] border-[#3DD68C]/40" : "bg-transparent text-[#6B7280] border-[#2A2E38]"}`}>
                  {tag}
                </button>
              ))}
            </div>
          </div>
          <div>
            <label className={labelClass}>Notes</label>
            <textarea className={inputClass + " font-sans"} rows={2} value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} placeholder="What was your read on this trade?" />
          </div>
          {error && (
            <div className="flex items-start gap-2 text-[12px] font-sans rounded-md px-3 py-2 bg-[#E5484D]/10 text-[#E5484D]">
              <AlertCircle size={14} className="mt-0.5 shrink-0" />
              <span>{error}</span>
            </div>
          )}
        </div>
        <div className="flex gap-2 px-5 py-4 border-t border-[#2A2E38]">
          <button onClick={onClose} disabled={submitting} className="flex-1 py-2 rounded-md text-sm font-sans text-[#A8B0BD] border border-[#2A2E38] hover:border-[#3A3F4A] disabled:opacity-40">Cancel</button>
          <button onClick={handleSubmit} disabled={submitting} className="flex-1 py-2 rounded-md text-sm font-sans font-medium bg-[#3DD68C] text-[#0A0E0C] hover:bg-[#34C17D] disabled:opacity-60 flex items-center justify-center gap-1.5">
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? "Saving…" : "Save trade"}
          </button>
        </div>
      </div>
    </div>
  );
}

function normalizeImportedTrade(raw) {
  // Accepts trades shaped either like convert_to_journal.py's output
  // (openTime/openPrice/closePrice/sl/tp/lot/pl/tags) or close variants
  // of the same fields, and fills in safe defaults for anything missing.
  // The original id/ticket is preserved as-is — the backend uses it as
  // external_id to skip duplicates on re-import, so it must not be altered.
  return {
    id: raw.id ?? raw.ticket ?? null,
    symbol: raw.symbol || "UNKNOWN",
    direction: raw.direction === "sell" ? "sell" : "buy",
    openTime: raw.openTime || raw.time || new Date().toISOString().slice(0, 10),
    openPrice: Number(raw.openPrice ?? raw.open_price ?? 0),
    closePrice: Number(raw.closePrice ?? raw.close_price ?? raw.price ?? 0),
    sl: raw.sl != null ? Number(raw.sl) : 0,
    tp: raw.tp != null ? Number(raw.tp) : 0,
    lot: Number(raw.lot ?? raw.volume ?? 0.01),
    pl: Number(raw.pl ?? raw.profit ?? 0),
    tags: Array.isArray(raw.tags) ? raw.tags : [],
    notes: raw.notes || raw.comment || "",
  };
}

function ImportModal({ onImport, onClose }) {
  const [status, setStatus] = useState(null); // { type: 'success'|'error', message }
  const [pasteValue, setPasteValue] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const processJson = async (text) => {
    let normalized;
    try {
      const parsed = JSON.parse(text);
      const list = Array.isArray(parsed) ? parsed : parsed.closed_trades || parsed.trades || [];
      if (!Array.isArray(list) || list.length === 0) {
        setStatus({ type: "error", message: "No trades found in that JSON. Expecting an array, or {trades: [...]}." });
        return;
      }
      normalized = list.map(normalizeImportedTrade);
    } catch (e) {
      setStatus({ type: "error", message: "Couldn't parse that as JSON. Check the file is valid journal_trades.json output." });
      return;
    }

    setSubmitting(true);
    try {
      const result = await onImport(normalized);
      const noTagCount = normalized.filter((t) => t.tags.length === 0).length;
      setStatus({
        type: "success",
        message: `Imported ${result.inserted} new trade${result.inserted === 1 ? "" : "s"}.${result.skipped ? ` Skipped ${result.skipped} already in your journal.` : ""}${noTagCount ? ` Tag your new trades in the trade log when you get a chance.` : ""}`,
      });
    } catch (err) {
      setStatus({ type: "error", message: err.message || "Import failed. Is the backend running?" });
    } finally {
      setSubmitting(false);
    }
  };

  const handleFile = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => processJson(ev.target.result);
    reader.readAsText(file);
  };

  return (
    <div className="fixed inset-0 bg-black/60 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} className="bg-[#1C1F26] border border-[#2A2E38] rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#2A2E38]">
          <h2 className="font-sans font-semibold text-[#F2F4F7]">Import trades</h2>
          <button onClick={onClose} className="text-[#6B7280] hover:text-[#F2F4F7]">
            <X size={18} />
          </button>
        </div>
        <div className="p-5 space-y-4">
          <p className="text-[13px] font-sans text-[#A8B0BD]">
            Upload <span className="font-mono text-[#F2F4F7]">journal_trades.json</span> from the MT5 sync scripts, or paste its contents below. Imported trades are added on top of what's already here.
          </p>

          <label className="flex flex-col items-center justify-center gap-2 border border-dashed border-[#2A2E38] rounded-lg py-6 cursor-pointer hover:border-[#3DD68C]/40 transition-colors">
            <Upload size={18} className="text-[#6B7280]" />
            <span className="text-[12px] font-sans text-[#6B7280]">Click to choose a .json file</span>
            <input type="file" accept=".json,application/json" className="hidden" onChange={handleFile} disabled={submitting} />
          </label>

          <div className="flex items-center gap-2">
            <div className="h-px flex-1 bg-[#2A2E38]" />
            <span className="text-[11px] font-sans text-[#6B7280]">or paste JSON</span>
            <div className="h-px flex-1 bg-[#2A2E38]" />
          </div>

          <textarea
            value={pasteValue}
            onChange={(e) => setPasteValue(e.target.value)}
            placeholder='[{"symbol": "EURUSD", "direction": "buy", ...}]'
            rows={4}
            className="w-full bg-[#13151A] border border-[#2A2E38] rounded-md px-3 py-2 text-[12px] font-mono text-[#F2F4F7] focus:outline-none focus:ring-1 focus:ring-[#3DD68C] focus:border-[#3DD68C]"
          />
          <button
            onClick={() => pasteValue.trim() && processJson(pasteValue)}
            disabled={!pasteValue.trim() || submitting}
            className="w-full py-2 rounded-md text-sm font-sans font-medium bg-[#2A2E38] text-[#F2F4F7] hover:bg-[#363B47] disabled:opacity-40 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
          >
            {submitting && <Loader2 size={14} className="animate-spin" />}
            {submitting ? "Importing…" : "Import pasted JSON"}
          </button>

          {status && (
            <div className={`flex items-start gap-2 text-[12px] font-sans rounded-md px-3 py-2 ${status.type === "success" ? "bg-[#3DD68C]/10 text-[#3DD68C]" : "bg-[#E5484D]/10 text-[#E5484D]"}`}>
              {status.type === "success" ? <Check size={14} className="mt-0.5 shrink-0" /> : <AlertCircle size={14} className="mt-0.5 shrink-0" />}
              <span>{status.message}</span>
            </div>
          )}
        </div>
        <div className="px-5 py-4 border-t border-[#2A2E38]">
          <button onClick={onClose} className="w-full py-2 rounded-md text-sm font-sans text-[#A8B0BD] border border-[#2A2E38] hover:border-[#3A3F4A]">
            {status?.type === "success" ? "Done" : "Cancel"}
          </button>
        </div>
      </div>
    </div>
  );
}

export default function TradingJournal() {
  const [trades, setTrades] = useState([]);
  const [isLoaded, setIsLoaded] = useState(false);
  const [loadError, setLoadError] = useState(null);
  const [actionError, setActionError] = useState(null);
  const [showForm, setShowForm] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [view, setView] = useState("dashboard");
  const [activeTagFilter, setActiveTagFilter] = useState(null);

  // Load trades from the backend API on first mount.
  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const data = await api.getTrades();
        if (cancelled) return;
        setTrades(data);
      } catch (err) {
        if (!cancelled) setLoadError(err.message);
      } finally {
        if (!cancelled) setIsLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  // Add a single trade via the API, then reflect it in local state.
  const addTrade = async (trade) => {
    setActionError(null);
    try {
      const created = await api.createTrade(trade);
      setTrades((prev) => [...prev, created]);
    } catch (err) {
      setActionError(err.message);
    }
  };

  // Bulk import via the API, then refetch so we have real ids and skip-counts reflected.
  const importTrades = async (importedTrades) => {
    setActionError(null);
    try {
      const result = await api.importTrades(importedTrades);
      const fresh = await api.getTrades();
      setTrades(fresh);
      return result;
    } catch (err) {
      setActionError(err.message);
      throw err;
    }
  };

  // Update a trade (most commonly: adding strategy tags) via the API.
  const updateTrade = async (id, updates) => {
    setActionError(null);
    try {
      const updated = await api.updateTrade(id, updates);
      setTrades((prev) => prev.map((t) => (t.id === id ? updated : t)));
    } catch (err) {
      setActionError(err.message);
    }
  };

  const deleteTrade = async (id) => {
    setActionError(null);
    try {
      await api.deleteTrade(id);
      setTrades((prev) => prev.filter((t) => t.id !== id));
    } catch (err) {
      setActionError(err.message);
    }
  };

  const enriched = useMemo(() => {
    let running = 0;
    return [...trades]
      .sort((a, b) => new Date(a.openTime) - new Date(b.openTime))
      .map((t) => {
        running += t.pl;
        return { ...t, cumulative: running, rr: calcRR(t.direction, t.openPrice, t.sl, t.tp), win: t.pl > 0 };
      });
  }, [trades]);

  const stats = useMemo(() => {
    const wins = enriched.filter((t) => t.win);
    const losses = enriched.filter((t) => !t.win);
    const totalPL = enriched.reduce((s, t) => s + t.pl, 0);
    const winRate = enriched.length ? (wins.length / enriched.length) * 100 : 0;
    const avgWin = wins.length ? wins.reduce((s, t) => s + t.pl, 0) / wins.length : 0;
    const avgLoss = losses.length ? losses.reduce((s, t) => s + t.pl, 0) / losses.length : 0;
    const grossWin = wins.reduce((s, t) => s + t.pl, 0);
    const grossLoss = Math.abs(losses.reduce((s, t) => s + t.pl, 0));
    const profitFactor = grossLoss === 0 ? grossWin : grossWin / grossLoss;
    const avgRR = enriched.length ? enriched.reduce((s, t) => s + t.rr, 0) / enriched.length : 0;
    return { totalPL, winRate, avgWin, avgLoss, profitFactor, avgRR, count: enriched.length };
  }, [enriched]);

  const tagStats = useMemo(() => {
    const map = {};
    enriched.forEach((t) => {
      t.tags.forEach((tag) => {
        if (!map[tag]) map[tag] = { trades: [], };
        map[tag].trades.push(t);
      });
    });
    return Object.entries(map).map(([tag, { trades }]) => {
      const wins = trades.filter((t) => t.win).length;
      const pl = trades.reduce((s, t) => s + t.pl, 0);
      const avgRR = trades.reduce((s, t) => s + t.rr, 0) / trades.length;
      return { tag, count: trades.length, winRate: (wins / trades.length) * 100, pl, avgRR };
    }).sort((a, b) => b.pl - a.pl);
  }, [enriched]);

  const filteredTrades = activeTagFilter
    ? enriched.filter((t) => t.tags.includes(activeTagFilter))
    : enriched;

  if (!isLoaded) {
    return (
      <div className="min-h-screen bg-[#13151A] text-[#6B7280] flex items-center justify-center font-sans text-sm">
        Loading your journal…
      </div>
    );
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-[#13151A] text-[#F2F4F7] flex items-center justify-center font-sans p-6">
        <div className="max-w-sm text-center space-y-3">
          <AlertCircle size={28} className="text-[#E5484D] mx-auto" />
          <h2 className="font-semibold text-[15px]">Couldn't reach the journal API</h2>
          <p className="text-[13px] text-[#A8B0BD]">{loadError}</p>
          <p className="text-[12px] text-[#6B7280]">
            Make sure the backend is running (<span className="font-mono">npm start</span> in the
            <span className="font-mono"> journal-backend</span> folder) and reachable at{" "}
            <span className="font-mono">{import.meta.env.VITE_API_URL || "http://localhost:4000"}</span>.
          </p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 rounded-md text-sm font-sans font-medium bg-[#3DD68C] text-[#0A0E0C] hover:bg-[#34C17D]"
          >
            Retry
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#13151A] text-[#F2F4F7]" style={{ fontFamily: "Inter, system-ui, sans-serif" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&family=JetBrains+Mono:wght@400;500;600&display=swap');
        .font-mono { font-family: 'JetBrains Mono', monospace; }
        .font-sans { font-family: 'Inter', system-ui, sans-serif; }
      `}</style>

      {/* Header */}
      <header className="border-b border-[#2A2E38] px-5 py-4 flex items-center justify-between sticky top-0 bg-[#13151A]/95 backdrop-blur z-10">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 rounded-full bg-[#3DD68C]" />
          <h1 className="font-sans font-semibold text-[15px]">Ledger</h1>
          <span className="font-sans text-[11px] text-[#6B7280] hidden sm:inline">— personal trading journal</span>
          {actionError && (
            <span className="font-sans text-[11px] text-[#E5484D] hidden md:inline">· {actionError}</span>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button onClick={() => setShowImport(true)} className="flex items-center gap-1.5 bg-transparent border border-[#2A2E38] text-[#A8B0BD] px-3 py-1.5 rounded-md text-[13px] font-sans font-medium hover:border-[#3A3F4A] hover:text-[#F2F4F7]">
            <Upload size={14} /> Import
          </button>
          <button onClick={() => setShowForm(true)} className="flex items-center gap-1.5 bg-[#3DD68C] text-[#0A0E0C] px-3 py-1.5 rounded-md text-[13px] font-sans font-medium hover:bg-[#34C17D]">
            <Plus size={14} /> Log trade
          </button>
        </div>
      </header>

      {/* Nav */}
      <nav className="flex gap-1 px-5 pt-3 border-b border-[#2A2E38]">
        {[{ id: "dashboard", label: "Dashboard" }, { id: "trades", label: "Trade log" }, { id: "tags", label: "Strategy tags" }].map((v) => (
          <button key={v.id} onClick={() => setView(v.id)}
            className={`px-3 py-2 text-[13px] font-sans border-b-2 -mb-px ${view === v.id ? "border-[#3DD68C] text-[#F2F4F7]" : "border-transparent text-[#6B7280] hover:text-[#A8B0BD]"}`}>
            {v.label}
          </button>
        ))}
      </nav>

      <main className="p-5 max-w-5xl mx-auto">
        {view === "dashboard" && (
          <div className="space-y-5">
            {/* Equity curve - hero */}
            <div className="bg-[#1C1F26] border border-[#2A2E38] rounded-xl p-4">
              <div className="flex items-center justify-between mb-3">
                <h2 className="font-sans text-[13px] text-[#A8B0BD] uppercase tracking-wider">Equity curve</h2>
                <span className={`font-mono text-sm font-medium ${stats.totalPL >= 0 ? "text-[#3DD68C]" : "text-[#E5484D]"}`}>
                  {fmtMoney(stats.totalPL)}
                </span>
              </div>
              <ResponsiveContainer width="100%" height={220}>
                <LineChart data={enriched.map((t, i) => ({ idx: i + 1, cumulative: t.cumulative, date: t.openTime }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2A2E38" vertical={false} />
                  <XAxis dataKey="idx" tick={{ fontSize: 11, fill: "#6B7280" }} tickLine={false} axisLine={{ stroke: "#2A2E38" }} />
                  <YAxis tick={{ fontSize: 11, fill: "#6B7280" }} tickLine={false} axisLine={false} width={50} tickFormatter={(v) => `$${v}`} />
                  <ReferenceLine y={0} stroke="#2A2E38" />
                  <Tooltip
                    contentStyle={{ background: "#1C1F26", border: "1px solid #2A2E38", borderRadius: 8, fontSize: 12, fontFamily: "JetBrains Mono" }}
                    labelStyle={{ color: "#6B7280" }}
                    formatter={(v) => [fmtMoney(v), "Cumulative P/L"]}
                    labelFormatter={(_, p) => p?.[0]?.payload?.date}
                  />
                  <Line type="monotone" dataKey="cumulative" stroke="#3DD68C" strokeWidth={2} dot={{ r: 3, fill: "#3DD68C" }} activeDot={{ r: 5 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Stats strip */}
            <div className="bg-[#1C1F26] border border-[#2A2E38] rounded-xl flex flex-wrap">
              <StatCard label="Win rate" value={`${stats.winRate.toFixed(0)}%`} sub={`${stats.count} trades`} />
              <StatCard label="Profit factor" value={stats.profitFactor.toFixed(2)} accent={stats.profitFactor >= 1 ? "text-[#3DD68C]" : "text-[#E5484D]"} />
              <StatCard label="Avg win" value={fmtMoney(stats.avgWin)} accent="text-[#3DD68C]" />
              <StatCard label="Avg loss" value={fmtMoney(stats.avgLoss)} accent="text-[#E5484D]" />
              <StatCard label="Avg R:R" value={`1:${stats.avgRR.toFixed(1)}`} />
            </div>

            {/* Top tags preview */}
            <div className="bg-[#1C1F26] border border-[#2A2E38] rounded-xl p-4">
              <h2 className="font-sans text-[13px] text-[#A8B0BD] uppercase tracking-wider mb-3">Strategy performance</h2>
              <div className="space-y-2">
                {tagStats.slice(0, 4).map((t) => (
                  <div key={t.tag} className="flex items-center justify-between text-sm">
                    <div className="flex items-center gap-2">
                      <TagPill tag={t.tag} />
                      <span className="text-[#6B7280] text-[12px] font-sans">{t.count} trades · {t.winRate.toFixed(0)}% win</span>
                    </div>
                    <span className={`font-mono text-[13px] ${t.pl >= 0 ? "text-[#3DD68C]" : "text-[#E5484D]"}`}>{fmtMoney(t.pl)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        )}

        {view === "trades" && (
          <div className="space-y-3">
            {activeTagFilter && (
              <div className="flex items-center gap-2 text-[13px] font-sans text-[#A8B0BD]">
                Filtering by <TagPill tag={activeTagFilter} onRemove={() => setActiveTagFilter(null)} />
              </div>
            )}
            <div className="bg-[#1C1F26] border border-[#2A2E38] rounded-xl">
              <table className="w-full text-sm border-separate" style={{ borderSpacing: 0 }}>
                <thead>
                  <tr className="border-b border-[#2A2E38] text-[11px] uppercase tracking-wider text-[#6B7280] font-sans">
                    <th className="text-left px-4 py-2.5 font-medium rounded-tl-xl">Date</th>
                    <th className="text-left px-4 py-2.5 font-medium">Symbol</th>
                    <th className="text-left px-4 py-2.5 font-medium">Dir</th>
                    <th className="text-left px-4 py-2.5 font-medium w-32">Risk : Reward</th>
                    <th className="text-left px-4 py-2.5 font-medium">Tags</th>
                    <th className="text-right px-4 py-2.5 font-medium rounded-tr-xl">P/L</th>
                  </tr>
                </thead>
                <tbody>
                  {[...filteredTrades].reverse().map((t) => (
                    <tr key={t.id} className="border-b border-[#2A2E38] last:border-b-0 hover:bg-[#22252D]">
                      <td className="px-4 py-3 font-mono text-[12px] text-[#A8B0BD]">{t.openTime}</td>
                      <td className="px-4 py-3 font-mono text-[13px]">{t.symbol}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center gap-1 text-[12px] font-sans ${t.direction === "buy" ? "text-[#3DD68C]" : "text-[#E5484D]"}`}>
                          {t.direction === "buy" ? <TrendingUp size={12} /> : <TrendingDown size={12} />}
                          {t.direction}
                        </span>
                      </td>
                      <td className="px-4 py-3"><RRBar direction={t.direction} openPrice={t.openPrice} sl={t.sl} tp={t.tp} /></td>
                      <td className="px-4 py-3">
                        <TagEditor trade={t} onSave={updateTrade} onTagClick={setActiveTagFilter} />
                      </td>
                      <td className={`px-4 py-3 text-right font-mono font-medium ${t.pl >= 0 ? "text-[#3DD68C]" : "text-[#E5484D]"}`}>{fmtMoney(t.pl)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {view === "tags" && (
          <div className="grid sm:grid-cols-2 gap-3">
            {tagStats.map((t) => (
              <div key={t.tag} className="bg-[#1C1F26] border border-[#2A2E38] rounded-xl p-4">
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-1.5">
                    <TagIcon size={13} className="text-[#6B7280]" />
                    <span className="font-sans font-medium text-[14px]">{t.tag}</span>
                  </div>
                  <span className={`font-mono text-sm font-medium ${t.pl >= 0 ? "text-[#3DD68C]" : "text-[#E5484D]"}`}>{fmtMoney(t.pl)}</span>
                </div>
                <div className="grid grid-cols-3 gap-2 text-center">
                  <div>
                    <div className="font-mono text-[15px] tabular-nums">{t.count}</div>
                    <div className="text-[10px] uppercase text-[#6B7280] font-sans tracking-wide">Trades</div>
                  </div>
                  <div>
                    <div className="font-mono text-[15px] tabular-nums">{t.winRate.toFixed(0)}%</div>
                    <div className="text-[10px] uppercase text-[#6B7280] font-sans tracking-wide">Win rate</div>
                  </div>
                  <div>
                    <div className="font-mono text-[15px] tabular-nums">1:{t.avgRR.toFixed(1)}</div>
                    <div className="text-[10px] uppercase text-[#6B7280] font-sans tracking-wide">Avg R:R</div>
                  </div>
                </div>
                <button onClick={() => { setActiveTagFilter(t.tag); setView("trades"); }} className="mt-3 text-[12px] font-sans text-[#6B7280] hover:text-[#3DD68C] flex items-center gap-1">
                  <Target size={11} /> View trades →
                </button>
              </div>
            ))}
          </div>
        )}
      </main>

      {showForm && (
        <AddTradeForm
          onAdd={addTrade}
          onClose={() => setShowForm(false)}
        />
      )}

      {showImport && (
        <ImportModal
          onImport={importTrades}
          onClose={() => setShowImport(false)}
        />
      )}
    </div>
  );
}

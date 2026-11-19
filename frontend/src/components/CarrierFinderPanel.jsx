import { useCallback, useEffect, useState } from "react";
import {
  ArrowRight, Check, CheckCircle2, ClipboardCopy, Download,
  Globe2, LoaderCircle, Mail, Phone, RefreshCw, Search,
  ShieldCheck, Truck, X
} from "lucide-react";
import { api } from "../api.js";

const STATE_NAMES = {
  TX: "Texas", GA: "Georgia", FL: "Florida",
  NC: "North Carolina", OH: "Ohio", PA: "Pennsylvania"
};

function formatCount(value) {
  return Number(value || 0).toLocaleString();
}

function safeCell(value) {
  const text = String(value ?? "");
  return /^[=+\-@\t\r]/.test(text) ? `'${text}` : text;
}

function downloadCSV(rows, filename) {
  const headers = ["USDOT", "Company", "State", "Power Units", "Phone", "Email", "Authority", "Outreach"];
  const fields = rows.map((row) => [
    row.usdot, row.company, row.state, row.power_units,
    row.phone, row.email, row.authority_verification, row.outreach_stage
  ]);
  const csv = [headers, ...fields]
    .map((fields) => fields.map((item) => `"${safeCell(item).replace(/"/g, '""')}"`).join(","))
    .join("\r\n");
  const blob = new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" });
  const link = document.createElement("a");
  const objectURL = URL.createObjectURL(blob);
  link.href = objectURL;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.setTimeout(() => URL.revokeObjectURL(objectURL), 1000);
}

export default function CarrierFinderPanel({ onOpen, onChanged, notify, compact = false }) {
  const [state, setState] = useState("TX");
  const [target, setTarget] = useState(20);
  const [page, setPage] = useState(1);
  const [query, setQuery] = useState("");
  const [items, setItems] = useState([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [discovering, setDiscovering] = useState(false);
  const [enriching, setEnriching] = useState(false);
  const [selected, setSelected] = useState([]);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");
  const [lookupCarrier, setLookupCarrier] = useState(null);
  const [candidates, setCandidates] = useState([]);
  const [lookingUp, setLookingUp] = useState(false);
  const [savingEmail, setSavingEmail] = useState("");
  const pageSize = compact ? 8 : 20;

  const loadRecords = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const result = await api.carriers({
        state, page, page_size: pageSize, search: query.trim()
      });
      setItems(result.items || []);
      setTotal(result.total || 0);
    } catch (err) {
      setError(err.message || "Unable to load carriers");
    } finally {
      setLoading(false);
    }
  }, [state, page, pageSize, query]);

  useEffect(() => { loadRecords(); }, [loadRecords]);
  useEffect(() => { setPage(1); setSelected([]); }, [state, query]);

  const announce = (text, kind = "success") => {
    setMessage(text);
    if (notify) notify(text, kind);
  };

  async function discover(event) {
    event.preventDefault();
    setDiscovering(true);
    setMessage("");
    try {
      const result = await api.discover({ state, target });
      announce(`Scanned ${formatCount(result.scanned)} FMCSA records. Saved ${formatCount(result.added)} new carriers.`);
      setPage(1);
      await loadRecords();
      onChanged?.();
    } catch (err) {
      setError(err.message || "The FMCSA search failed");
    } finally {
      setDiscovering(false);
    }
  }

  async function refreshEmails() {
    setEnriching(true);
    setMessage("");
    try {
      const result = await api.refreshCarrierEmails();
      announce(`Checked ${formatCount(result.checked)} saved carriers; filled ${formatCount(result.updated)} missing FMCSA emails.`);
      await loadRecords();
      onChanged?.();
    } catch (err) {
      setError(err.message || "Email refresh failed");
    } finally {
      setEnriching(false);
    }
  }

  async function findOnline(carrier) {
    setLookupCarrier(carrier);
    setCandidates([]);
    setLookingUp(true);
    setError("");
    try {
      const data = await api.findPublicEmails(carrier.usdot);
      setCandidates(data.items || []);
    } catch (err) {
      setError(err.message || "Online email lookup unavailable");
    } finally {
      setLookingUp(false);
    }
  }

  async function saveSuggestedEmail(email) {
    if (!lookupCarrier) return;
    if (!window.confirm(`Only save ${email} if you have verified the source belongs to ${lookupCarrier.company}. Continue?`)) return;
    setSavingEmail(email);
    try {
      await api.saveCarrierEmail(lookupCarrier.usdot, email);
      announce("Business email saved to the carrier record.");
      setLookupCarrier(null);
      setCandidates([]);
      await loadRecords();
      onChanged?.();
    } catch (err) {
      setError(err.message || "Could not save email");
    } finally {
      setSavingEmail("");
    }
  }

  function toggleSelection(dot) {
    setSelected((current) => current.includes(dot)
      ? current.filter((item) => item !== dot)
      : [...current, dot]);
  }

  function exportVisible() {
    const chosen = selected.length
      ? items.filter((item) => selected.includes(item.usdot))
      : items;
    if (!chosen.length) return;
    downloadCSV(chosen, `lanecove-carriers-${state.toLowerCase()}.csv`);
  }

  async function copySource(url) {
    try {
      await navigator.clipboard.writeText(url);
      setMessage("Source URL copied. Open it in your browser to verify the business email.");
    } catch {
      setMessage(`Copy this source URL manually: ${url}`);
    }
  }

  return (
    <section className={`lc-finder ${compact ? "lc-finder-compact" : ""}`}>
      <div className="lc-finder-heading">
        <div className="lc-finder-heading-title">
          <div className="lc-finder-heading-icon"><Search size={24} /></div>
          <div>
            <h2>Find Carriers <span>(FMCSA + Online)</span></h2>
            <p>Discover U.S. trucking carriers and find available business contact details.</p>
          </div>
        </div>
        <span className="lc-source-tag"><CheckCircle2 size={14} /> FMCSA dataset</span>
      </div>

      <form className="lc-finder-controls" onSubmit={discover}>
        <label>State
          <select value={state} onChange={(event) => setState(event.target.value)}>
            {Object.entries(STATE_NAMES).map(([code, name]) =>
              <option key={code} value={code}>{code} · {name}</option>
            )}
          </select>
        </label>
        <label>Power Units
          <div className="lc-fixed-value">1 – 5</div>
        </label>
        <label>Carrier Type
          <div className="lc-fixed-value">Authorized for Hire</div>
        </label>
        <label>DOT Status
          <div className="lc-fixed-value">Active</div>
        </label>
        <label>New leads
          <select value={target} onChange={(event) => setTarget(Number(event.target.value))}>
            <option value={10}>10</option>
            <option value={20}>20</option>
            <option value={50}>50</option>
          </select>
        </label>
        <button className="lc-search-button" type="submit" disabled={discovering}>
          {discovering ? <LoaderCircle size={18} className="spin" /> : <Search size={18} />}
          {discovering ? "Searching..." : "Find New Carriers"}
        </button>
      </form>

      <div className="lc-finder-help">
        <div><span className="lc-check"><Check size={13} /></span><Mail size={18} /> <div><strong>FMCSA email import</strong><small>Officially listed emails are saved when available.</small></div></div>
        <div><Globe2 size={19} /> <div><strong>Online email lookup</strong><small>Review public suggestions individually before saving.</small></div></div>
        <div className="lc-finder-help-note">Online lookup needs an optional Brave Search API key.</div>
      </div>

      <div className="lc-results-bar">
        <div><Truck size={20} /><h3>Carrier Results <span>({formatCount(total)} saved in {state})</span></h3></div>
        <div className="lc-results-actions">
          <button type="button" onClick={refreshEmails} disabled={enriching}>
            {enriching ? <LoaderCircle size={15} className="spin" /> : <RefreshCw size={15} />}
            <span>{enriching ? "Checking emails..." : "Fill Missing Emails"}</span>
          </button>
          <button type="button" onClick={exportVisible} disabled={loading || !items.length}>
            <Download size={15} /><span>Export CSV</span>
          </button>
        </div>
      </div>

      <label className="lc-list-search"><Search size={16} />
        <input aria-label="Filter saved carriers" value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Filter saved companies or USDOT numbers..." />
      </label>

      {message && <p className="lc-feedback lc-feedback-good" role="status">{message}</p>}
      {error && <p className="lc-feedback lc-feedback-error" role="alert">{error}</p>}

      <div className="lc-carrier-table-wrap">
        <table className="lc-carrier-table">
          <thead><tr>
            <th className="lc-select-col"><input type="checkbox" aria-label="Select all visible carriers"
              checked={items.length > 0 && items.every((c) => selected.includes(c.usdot))}
              onChange={(event) => setSelected(event.target.checked ? items.map((c) => c.usdot) : [])} /></th>
            <th>USDOT</th><th>Company Name</th><th>State</th><th>Power Units</th>
            <th>Phone</th><th>Email</th><th>Email Status</th><th>Actions</th>
          </tr></thead>
          <tbody>
            {items.map((carrier) => (
              <tr key={carrier.usdot}>
                <td><input type="checkbox" aria-label={`Select ${carrier.company}`}
                  checked={selected.includes(carrier.usdot)} onChange={() => toggleSelection(carrier.usdot)} /></td>
                <td className="lc-dot">{carrier.usdot}</td>
                <td><strong className="lc-company-name">{carrier.company}</strong></td>
                <td><span className="lc-state-chip">{carrier.state || "–"}</span></td>
                <td>{carrier.power_units ?? "–"}</td>
                <td>{carrier.phone ? <span className="lc-inline-contact"><Phone size={14} />{carrier.phone}</span> : <span className="lc-empty-value">Not listed</span>}</td>
                <td>{carrier.email ? <span className="lc-inline-contact lc-email"><Mail size={14} />{carrier.email}</span> : <span className="lc-empty-value">Not listed</span>}</td>
                <td><span className={`lc-email-status ${carrier.email ? "lc-has-email" : ""}`}>
                  {carrier.email ? "Recorded" : "Missing"}
                </span></td>
                <td><div className="lc-row-actions">
                  <button type="button" title="Find public email" aria-label={`Search email for ${carrier.company}`}
                    onClick={() => findOnline(carrier)}><Globe2 size={16} /></button>
                  <button type="button" title="Manage carrier" aria-label={`Manage ${carrier.company}`}
                    onClick={() => onOpen?.(carrier)}><ArrowRight size={16} /></button>
                </div></td>
              </tr>
            ))}
            {!items.length && <tr><td className="lc-no-results" colSpan={9}>
              {loading ? "Loading saved carriers..." : "No matching carriers yet. Run Find New Carriers to import records."}
            </td></tr>}
          </tbody>
        </table>
      </div>

      <div className="lc-table-footer">
        <span>Showing {items.length ? (page - 1) * pageSize + 1 : 0}–{Math.min(page * pageSize, total)} of {formatCount(total)} saved carriers
          {selected.length ? ` · ${selected.length} selected` : ""}</span>
        <div className="lc-pages">
          <button disabled={page === 1 || loading} onClick={() => setPage((n) => n - 1)} type="button">‹ Prev</button>
          <span>{page}</span>
          <button disabled={page * pageSize >= total || loading} onClick={() => setPage((n) => n + 1)} type="button">Next ›</button>
        </div>
      </div>

      {lookupCarrier && <div className="lc-modal-backdrop" role="presentation" onMouseDown={(event) => { if (event.target === event.currentTarget) setLookupCarrier(null); }}>
        <div className="lc-modal" role="dialog" aria-modal="true" aria-label="Public email suggestions">
          <div className="lc-modal-head">
            <div><h3>Business email lookup</h3><p>{lookupCarrier.company} · USDOT {lookupCarrier.usdot}</p></div>
            <button type="button" onClick={() => setLookupCarrier(null)} aria-label="Close"><X size={18} /></button>
          </div>
          {lookingUp ? <p>Searching indexed public business pages...</p> : !candidates.length ?
            <p>No public email suggestions are available. An API key may be required, or the business may not publish one.</p> :
            <div className="lc-suggestions">
              {candidates.map((candidate) => <div key={`${candidate.email}-${candidate.source_url}`} className="lc-suggestion">
                <strong><Mail size={16} /> {candidate.email}</strong>
                <p>{candidate.source_title || "Public website result"}</p>
                <small>{candidate.source_url}</small>
                <div>
                  <button type="button" onClick={() => copySource(candidate.source_url)}><ClipboardCopy size={15} /> Copy source URL</button>
                  <button type="button" className="lc-confirm-email" disabled={Boolean(savingEmail)} onClick={() => saveSuggestedEmail(candidate.email)}>
                    <ShieldCheck size={15} /> {savingEmail === candidate.email ? "Saving..." : "Save verified email"}
                  </button>
                </div>
              </div>)}
            </div>
          }
          <p className="lc-modal-note">Public search results are unverified. Check that the source belongs to the company before saving.</p>
        </div>
      </div>}
    </section>
  );
}

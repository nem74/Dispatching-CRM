import { useState } from "react";
import { BookOpen, CheckCircle2, ClipboardCopy, ExternalLink, LifeBuoy, RefreshCw, ShieldCheck } from "lucide-react";
import { api } from "../api.js";

const QUESTIONS = [
  {
    title: "How do I find new carriers?",
    answer: "Open Find Carriers, choose a state and lead count, and select Find New Carriers. The app checks the public FMCSA dataset and saves qualifying records in your configured PostgreSQL database."
  },
  {
    title: "Where do business email addresses come from?",
    answer: "LaneCove can import an email listed in an FMCSA record. If the email is missing, optional online search can suggest publicly indexed addresses. Verify the company and source before saving a suggestion."
  },
  {
    title: "Why are some emails missing?",
    answer: "Not every trucking company publishes a business email. A blank field means no address has been recorded; it does not mean the company has no email. You can still contact the company by phone."
  },
  {
    title: "How do I record a call or follow-up?",
    answer: "Open Carrier Leads or Outreach History, select a company, enter the outreach stage and notes, then save. Use Follow-ups to review carriers requiring attention."
  },
  {
    title: "How do I add an active client?",
    answer: "Verify the carrier first. Open Active Clients and record the agreed dispatch details, contact information and terms. Only confirmed customers belong in Active Clients."
  },
  {
    title: "What should I do if LaneCove cannot connect?",
    answer: "Make sure PostgreSQL is running and the local database settings are correct. If the FMCSA lookup fails, check your internet connection. Use the diagnostic check below to confirm whether the local API and database are reachable."
  }
];

export default function HelpSupportPage() {
  const [check, setCheck] = useState({ status: "idle", text: "" });
  const [copied, setCopied] = useState(false);

  async function checkConnection() {
    setCheck({ status: "working", text: "Checking LaneCove..." });
    try {
      const result = await api.health();
      const connected = result.status === "ok" && result.database === "connected";
      setCheck({ status: connected ? "success" : "error", text: connected ? "Local API and PostgreSQL are connected." : "API answered, but the database has not confirmed its connection." });
    } catch (error) {
      setCheck({ status: "error", text: `Connection check failed: ${error.message}` });
    }
  }

  async function copyDiagnostics() {
    const details = [
      "LaneCove diagnostic summary",
      `Checked: ${new Date().toLocaleString()}`,
      `Theme: ${document.documentElement.dataset.theme || "light"}`,
      `Table spacing: ${document.documentElement.dataset.density || "comfortable"}`,
      `API/database: ${check.text || "Not checked"}`,
      `Browser platform: ${navigator.platform || "unknown"}`
    ].join("\n");
    try {
      await navigator.clipboard.writeText(details);
      setCopied(true);
    } catch {
      setCopied(false);
      setCheck({ status: "error", text: "Clipboard unavailable. You can copy the visible information manually." });
    }
  }

  return (
    <div className="lc-support-page">
      <div className="page-heading">
        <div>
          <div className="eyebrow">HELP CENTER</div>
          <h1>Help &amp; Support</h1>
          <p>Guides and quick checks for working with LaneCove.</p>
        </div>
      </div>
      <section className="lc-settings-section">
        <div className="lc-settings-title"><BookOpen size={20} /><div><h2>Frequently asked questions</h2><p>Answers to the most common workflow questions.</p></div></div>
        <div className="lc-faq-list">
          {QUESTIONS.map(({ title, answer }) => (
            <details key={title} className="lc-faq-item">
              <summary>{title}</summary>
              <p>{answer}</p>
            </details>
          ))}
        </div>
      </section>
      <section className="lc-settings-section">
        <div className="lc-settings-title"><LifeBuoy size={20} /><div><h2>Connection diagnostics</h2><p>Check your local LaneCove backend and database.</p></div></div>
        <p className="lc-settings-hint">Diagnostics are generated on this device. No passwords or carrier records are copied.</p>
        <div className="lc-support-actions">
          <button type="button" className="btn btn-primary" onClick={checkConnection} disabled={check.status === "working"}>
            <RefreshCw size={16} /> {check.status === "working" ? "Checking..." : "Check connection"}
          </button>
          <button type="button" className="btn btn-outline" onClick={copyDiagnostics}>
            <ClipboardCopy size={16} /> {copied ? "Copied" : "Copy diagnostics"}
          </button>
        </div>
        {check.text && <p className={`lc-health-status ${check.status}`} role="status">{check.status === "success" && <CheckCircle2 size={17} />} {check.text}</p>}
      </section>
      <section className="lc-settings-section lc-settings-info">
        <div className="lc-settings-title"><ShieldCheck size={20} /><div><h2>Official carrier information</h2><p>Verify a carrier before negotiating or signing an agreement.</p></div></div>
        <p>Always confirm operating authority through the official FMCSA records. Being listed in the CRM is not proof that a carrier currently holds valid authority.</p>
        <a href="https://safer.fmcsa.dot.gov/" target="_blank" rel="noopener noreferrer" className="lc-support-official">FMCSA SAFER website <ExternalLink size={15} /></a>
        <p className="lc-settings-hint">Direct support email and live chat have not been configured yet. Use these guides and diagnostics in the meantime.</p>
      </section>
    </div>
  );
}

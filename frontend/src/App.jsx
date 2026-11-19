
import { useEffect, useState } from "react";

import {
  Activity,
  ArrowDownToLine,
  ArrowRight,
  Bell,
  Building2,
  CalendarClock,
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  ClipboardList,
  ExternalLink,
  FileCheck2,
  Filter,
  LayoutDashboard,
  Loader2,
  Menu,
  Phone,
  Plus,
  RefreshCw,
  Save,
  Search,
  ShieldCheck,
  SlidersHorizontal,
  CircleHelp,
  Truck,
  Users,
  X
} from "lucide-react";

import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis
} from "recharts";

import { api } from "./api.js";

import OutreachHistory from "./components/OutreachHistory";
import ActiveClients from "./components/ActiveClients";
import CarrierFinderPanel from "./components/CarrierFinderPanel";
import SettingsPage from "./components/SettingsPage";
import HelpSupportPage from "./components/HelpSupportPage";


// ===========================================
// NAVIGATION
// ===========================================

const NAV = [
  { key: "dashboard", label: "Dashboard", icon: LayoutDashboard },
  { key: "carriers", label: "Carrier Leads", icon: Truck },
  { key: "active-clients", label: "Active Clients", icon: Users },
  { key: "discover", label: "Find Carriers", icon: Search },
  { key: "outreach", label: "Outreach History", icon: ClipboardList },
  { key: "followups", label: "Follow-ups", icon: CalendarClock },
  { key: "verification", label: "Verify Carriers", icon: ShieldCheck }
];

const STAGES = [
  "Not contacted",
  "Contacted",
  "Replied",
  "Interested",
  "Follow-up",
  "Client"
];

const VERIFICATION_STATUSES = [
  "Not verified",
  "Needs investigation",
  "Property authority confirmed",
  "Not authorized",
  "Out of service"
];

const STATES = ["TX", "GA", "FL", "NC", "OH", "PA"];

const PIPELINE = [
  { stage: "Not contacted", short: "Not contacted" },
  { stage: "Contacted", short: "Contacted" },
  { stage: "Replied", short: "Replied" },
  { stage: "Interested", short: "Interested" },
  { stage: "Follow-up", short: "Follow-up" },
  { stage: "Client", short: "Client" }
];


// ===========================================
// SHARED UI COMPONENTS
// ===========================================

function Badge({ value, kind = "stage" }) {
  const label =
    value ||
    (kind === "authority"
      ? "Not verified"
      : "Not contacted");

  const status = String(label).toLowerCase();

  let tone = "neutral";

  if (
    status.includes("confirmed") ||
    status === "client" ||
    status === "interested"
  ) {
    tone = "green";
  } else if (
    status.includes("investigation") ||
    status === "follow-up" ||
    status === "replied"
  ) {
    tone = "amber";
  } else if (
    status.includes("not authorized") ||
    status.includes("out of service")
  ) {
    tone = "red";
  } else if (status === "contacted") {
    tone = "blue";
  }

  return (
    <span className={`badge badge-${tone}`}>
      <span className="badge-dot" />
      {label}
    </span>
  );
}

function Spinner({ label = "Loading..." }) {
  return (
    <div className="loader">
      <Loader2 size={20} className="spin" />
      <span>{label}</span>
    </div>
  );
}

function Empty({
  title,
  detail,
  icon: Icon = ClipboardList
}) {
  return (
    <div className="empty">
      <div className="empty-icon">
        <Icon size={23} />
      </div>

      <strong>{title}</strong>
      <p>{detail}</p>
    </div>
  );
}

function Toast({
  kind = "success",
  children,
  onClose
}) {
  return (
    <div
      className={`toast toast-${kind}`}
      role="status"
    >
      {kind === "success" ? (
        <CheckCircle2 size={18} />
      ) : (
        <CircleAlert size={18} />
      )}

      <span>{children}</span>

      <button
        className="plain-icon"
        onClick={onClose}
        aria-label="Dismiss message"
      >
        <X size={16} />
      </button>
    </div>
  );
}

function StatCard({
  label,
  value,
  caption,
  icon: Icon,
  accent = false
}) {
  return (
    <div
      className={`stat-card ${
        accent ? "stat-accent" : ""
      }`}
    >
      <div className="stat-icon">
        <Icon size={19} strokeWidth={1.9} />
      </div>

      <div className="stat-value">
        {Number(value ?? 0).toLocaleString()}
      </div>

      <div className="stat-label">
        {label}
      </div>

      <div className="stat-caption">
        {caption}
      </div>
    </div>
  );
}

function Card({
  title,
  subtitle,
  action,
  children,
  className = ""
}) {
  return (
    <section className={`panel ${className}`}>
      {(title || action) && (
        <div className="panel-heading">
          <div>
            <h2>{title}</h2>

            {subtitle && <p>{subtitle}</p>}
          </div>

          {action}
        </div>
      )}

      {children}
    </section>
  );
}


// ===========================================
// CARRIER TABLE
// ===========================================

function LeadTable({
  items = [],
  onOpen,
  compact = false,
  showFollowup = false
}) {
  if (!items.length) {
    return (
      <Empty
        title="No matching carriers"
        detail="Try another filter or search for more leads."
        icon={Truck}
      />
    );
  }

  return (
    <div className="table-scroll">
      <table className="data-table">
        <thead>
          <tr>
            <th>Company</th>
            <th>USDOT</th>
            <th>State</th>

            {!compact && <th>Units</th>}

            <th>Authority</th>
            <th>Outreach</th>

            {showFollowup && <th>Follow-up</th>}

            <th className="right">Action</th>
          </tr>
        </thead>

        <tbody>
          {items.map((carrier) => (
            <tr key={carrier.usdot}>
              <td>
                <div className="company-cell">
                  <span className="company-glyph">
                    <Building2 size={17} />
                  </span>

                  <div>
                    <strong>{carrier.company}</strong>
                    <small>
                      {carrier.phone || "Phone not available"}
                    </small>
                    <small>
                      {carrier.email || "Email not available"}
                    </small>
                  </div>
                </div>
              </td>

              <td className="mono-cell">
                {carrier.usdot}
              </td>

              <td>{carrier.state || "—"}</td>

              {!compact && (
                <td>{carrier.power_units ?? "—"}</td>
              )}

              <td>
                <Badge
                  value={carrier.authority_verification}
                  kind="authority"
                />
              </td>

              <td>
                <Badge value={carrier.outreach_stage} />
              </td>

              {showFollowup && (
                <td className="mono-cell">
                  {carrier.next_follow_up || "—"}
                </td>
              )}

              <td className="right">
                <button
                  className="table-action"
                  onClick={() => onOpen(carrier)}
                  aria-label={`Manage ${carrier.company}`}
                >
                  <ArrowRight size={16} />
                </button>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}


// ===========================================
// DASHBOARD
// ===========================================

function Dashboard({
  stats,
  recent,
  pending,
  loading,
  navigate,
  onOpen,
  onReview,
  refresh,
  notify
}) {
  const totals = stats?.totals || {};

  const pipeline = PIPELINE.map(({ stage, short }) => ({
    name: short,
    value:
      stats?.pipeline?.find(
        (item) => item.stage === stage
      )?.total ?? 0
  }));

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">OVERVIEW</div>

          <h1>Dashboard</h1>

          <p>
            Manage carrier prospecting, outreach,
            and dispatching clients.
          </p>
        </div>

        <button
          className="btn btn-primary"
          onClick={() => navigate("discover")}
        >
          <Plus size={17} />
          Find carriers
        </button>
      </div>

      <div className="stats-grid">
        <StatCard
          label="Total Carriers"
          value={totals.total}
          caption="Saved company records"
          icon={Truck}
          accent
        />
        <StatCard
          label="Potential Leads"
          value={Math.max(0, Number(totals.total || 0) - Number(totals.clients || 0))}
          caption="Not yet active clients"
          icon={Users}
        />
        <StatCard
          label="Active Clients"
          value={totals.clients}
          caption="Carrier agreements"
          icon={CheckCircle2}
        />
        <StatCard
          label="Outreach This Month"
          value={totals.outreach_this_month}
          caption="Logged outreach records"
          icon={Activity}
        />
      </div>

      <CarrierFinderPanel
        compact
        onOpen={onOpen}
        onChanged={refresh}
        notify={notify}
      />

      <div className="dashboard-grid">
        <Card
          title="Outreach activity"
          subtitle="Number of carriers at each stage"
          action={
            <span className="soft-chip">
              <Activity size={14} />
              Live records
            </span>
          }
        >
          {loading ? (
            <Spinner />
          ) : (
            <div className="chart-wrap">
              <ResponsiveContainer
                width="100%"
                height="100%"
              >
                <BarChart
                  data={pipeline}
                  margin={{
                    top: 12,
                    right: 8,
                    left: -15,
                    bottom: 10
                  }}
                >
                  <CartesianGrid
                    stroke="#eef0f3"
                    vertical={false}
                  />

                  <XAxis
                    dataKey="name"
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#8b92a0",
                      fontSize: 11
                    }}
                    interval={0}
                  />

                  <YAxis
                    axisLine={false}
                    tickLine={false}
                    tick={{
                      fill: "#8b92a0",
                      fontSize: 11
                    }}
                    allowDecimals={false}
                  />

                  <Tooltip
                    cursor={{ fill: "#f3f4f7" }}
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e8eaf0",
                      fontSize: 12
                    }}
                  />

                  <Bar
                    dataKey="value"
                    fill="#1d2638"
                    radius={[5, 5, 0, 0]}
                    maxBarSize={35}
                  />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Card>

        <Card
          title="Pending verification"
          subtitle="Carrier records that still need review"
          action={
            <button
              className="text-action"
              onClick={() => navigate("verification")}
            >
              View all
              <ArrowRight size={15} />
            </button>
          }
        >
          {loading ? (
            <Spinner />
          ) : pending.length ? (
            <div className="pending-list">
              {pending.slice(0, 5).map((item) => (
                <button
                  key={item.usdot}
                  className="pending-row"
                  onClick={() => onReview(item)}
                >
                  <span className="pending-symbol">
                    <FileCheck2 size={17} />
                  </span>

                  <span className="pending-main">
                    <strong>{item.company}</strong>
                    <small>USDOT {item.usdot}</small>
                  </span>

                  <span className="pending-tag">
                    Review
                  </span>
                </button>
              ))}
            </div>
          ) : (
            <Empty
              title="Nothing pending"
              detail="New carrier candidates will appear here."
              icon={ShieldCheck}
            />
          )}
        </Card>
      </div>

      <Card
        title="Recent carrier leads"
        subtitle="A snapshot of your prospect database"
        className="table-panel"
        action={
          <button
            className="text-action"
            onClick={() => navigate("carriers")}
          >
            View all carriers
            <ArrowRight size={15} />
          </button>
        }
      >
        {loading ? (
          <Spinner />
        ) : (
          <LeadTable
            items={recent}
            compact
            onOpen={onOpen}
          />
        )}
      </Card>
    </>
  );
}


// ===========================================
// CARRIER LEADS PAGE
// ===========================================

function Carriers({ onOpen, refreshKey }) {
  const [filters, setFilters] = useState({
    search: "",
    state: "",
    stage: "",
    authority: ""
  });

  const [page, setPage] = useState(1);

  const [data, setData] = useState({
    items: [],
    total: 0
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    const timer = setTimeout(() => {
      setLoading(true);

      api.carriers({
        ...filters,
        page,
        page_size: 10
      })
        .then((result) => {
          if (active) {
            setData(result);
            setError("");
          }
        })
        .catch((err) => {
          if (active) setError(err.message);
        })
        .finally(() => {
          if (active) setLoading(false);
        });
    }, 250);

    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [filters, page, refreshKey]);

  function change(name, value) {
    setFilters((previous) => ({
      ...previous,
      [name]: value
    }));

    setPage(1);
  }

  function exportCsv() {
    if (!data.items.length) return;

    const columns = [
      "company",
      "usdot",
      "state",
      "power_units",
      "phone",
      "authority_verification",
      "outreach_stage",
      "next_follow_up"
    ];

    const csv = [
      columns.join(","),
      ...data.items.map((record) =>
        columns
          .map((key) =>
            `"${String(record[key] ?? "").replaceAll(
              '"',
              '""'
            )}"`
          )
          .join(",")
      )
    ].join("\n");

    const url = URL.createObjectURL(
      new Blob([csv], {
        type: "text/csv;charset=utf-8"
      })
    );

    const link = document.createElement("a");
    link.href = url;
    link.download = "silvanne-carriers-page.csv";
    link.click();

    URL.revokeObjectURL(url);
  }

  const pages = Math.max(
    1,
    Math.ceil(data.total / 10)
  );

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            PROSPECT MANAGEMENT
          </div>

          <h1>Carrier Leads</h1>

          <p>
            Search and organize trucking companies
            in Silvanne's database.
          </p>
        </div>

        <button
          className="btn btn-outline"
          onClick={exportCsv}
        >
          <ArrowDownToLine size={17} />
          Export page
        </button>
      </div>

      <Card
        className="table-panel"
        title="Carrier directory"
        subtitle="Filter by location, outreach stage, or authority status"
      >
        <div className="search-row">
          <label className="searchbox">
            <Search size={18} />

            <input
              value={filters.search}
              onChange={(e) =>
                change("search", e.target.value)
              }
              placeholder="Search company, USDOT or phone..."
            />
          </label>

          <div className="filter-label">
            <SlidersHorizontal size={16} />
            Filters
          </div>
        </div>

        <div className="filter-grid">
          <label>
            State

            <select
              value={filters.state}
              onChange={(e) =>
                change("state", e.target.value)
              }
            >
              <option value="">All states</option>

              {STATES.map((state) => (
                <option key={state} value={state}>
                  {state}
                </option>
              ))}
            </select>
          </label>

          <label>
            Outreach

            <select
              value={filters.stage}
              onChange={(e) =>
                change("stage", e.target.value)
              }
            >
              <option value="">All stages</option>

              {STAGES.map((stage) => (
                <option key={stage} value={stage}>
                  {stage}
                </option>
              ))}
            </select>
          </label>

          <label>
            Verification

            <select
              value={filters.authority}
              onChange={(e) =>
                change("authority", e.target.value)
              }
            >
              <option value="">All statuses</option>

              {VERIFICATION_STATUSES.map((status) => (
                <option key={status} value={status}>
                  {status}
                </option>
              ))}
            </select>
          </label>

          <button
            className="btn btn-soft reset-button"
            onClick={() => {
              setFilters({
                search: "",
                state: "",
                stage: "",
                authority: ""
              });

              setPage(1);
            }}
          >
            <RefreshCw size={15} />
            Clear filters
          </button>
        </div>

        {error && (
          <Toast
            kind="error"
            onClose={() => setError("")}
          >
            {error}
          </Toast>
        )}

        {loading ? (
          <Spinner />
        ) : (
          <LeadTable
            items={data.items}
            onOpen={onOpen}
            showFollowup
          />
        )}

        <div className="table-footer">
          <span>
            Showing{" "}
            {data.items.length
              ? (page - 1) * 10 + 1
              : 0}
            –
            {Math.min(page * 10, data.total)}
            {" "}of {data.total} carriers
          </span>

          <div className="pager">
            <button
              disabled={page <= 1}
              onClick={() =>
                setPage((previous) => previous - 1)
              }
            >
              <ChevronLeft size={16} />
            </button>

            <span>
              Page {page} of {pages}
            </span>

            <button
              disabled={page >= pages}
              onClick={() =>
                setPage((previous) => previous + 1)
              }
            >
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </Card>
    </>
  );
}


// ===========================================
// CARRIER LOOKUP
// ===========================================

function CarrierLookup({
  onPick,
  initial = ""
}) {
  const [search, setSearch] = useState(initial);
  const [results, setResults] = useState([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    let live = true;

    setLoading(true);

    const timer = setTimeout(() => {
      api.carriers({
        search,
        page_size: 8
      })
        .then((response) => {
          if (live) {
            setResults(response.items || []);
          }
        })
        .catch(() => {
          if (live) setResults([]);
        })
        .finally(() => {
          if (live) setLoading(false);
        });
    }, 250);

    return () => {
      live = false;
      clearTimeout(timer);
    };
  }, [search]);

  return (
    <div className="lookup">
      <label className="field-label">
        Select a carrier
      </label>

      <label className="searchbox">
        <Search size={17} />

        <input
          value={search}
          onChange={(e) =>
            setSearch(e.target.value)
          }
          placeholder="Search company name or USDOT"
        />
      </label>

      <div className="lookup-results">
        {loading ? (
          <Spinner />
        ) : (
          <>
            {results.map((carrier) => (
              <button
                key={carrier.usdot}
                className="lookup-item"
                onClick={() => onPick(carrier)}
              >
                <span>
                  <strong>
                    {carrier.company}
                  </strong>

                  <small>
                    USDOT {carrier.usdot}
                    {" · "}
                    {carrier.state}
                  </small>
                </span>

                <ArrowRight size={16} />
              </button>
            ))}

            {!results.length && (
              <p className="muted-pad">
                No carriers found.
              </p>
            )}
          </>
        )}
      </div>
    </div>
  );
}


// ===========================================
// OUTREACH MANAGEMENT
// ===========================================

function Outreach({
  selected,
  setSelected,
  refresh,
  notify
}) {
  const [stage, setStage] = useState("Not contacted");
  const [contacted, setContacted] = useState(false);
  const [followup, setFollowup] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);
  const [searchingEmail, setSearchingEmail] = useState(false);
  const [emailCandidates, setEmailCandidates] = useState([]);
  const [emailNotice, setEmailNotice] = useState("");
  const [savingEmail, setSavingEmail] = useState(false);

  useEffect(() => {
    setEmailCandidates([]);
    setEmailNotice("");
    if (selected) {
      setStage(
        selected.outreach_stage || "Not contacted"
      );

      setFollowup(
        selected.next_follow_up || ""
      );

      setNotes(selected.notes || "");
      setContacted(false);
    }
  }, [selected]);

  async function findBusinessEmail() {
    if (!selected) return;
    setSearchingEmail(true);
    setEmailCandidates([]);
    setEmailNotice("");
    try {
      const data = await api.findPublicEmails(selected.usdot);
      setEmailCandidates(data.items || []);
      if (!data.items?.length) {
        setEmailNotice("No indexed public email found. Try contacting the carrier by phone.");
      }
    } catch (error) {
      setEmailNotice(error.message);
    } finally {
      setSearchingEmail(false);
    }
  }

  async function saveBusinessEmail(email) {
    if (!selected) return;
    setSavingEmail(true);
    try {
      await api.saveCarrierEmail(selected.usdot, email);
      const updated = await api.carrier(selected.usdot);
      setSelected(updated);
      refresh();
      setEmailCandidates([]);
      notify("Carrier business email saved.");
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setSavingEmail(false);
    }
  }

  async function submit(event) {
    event.preventDefault();

    if (!selected) return;

    setSaving(true);

    try {
      await api.outreach(selected.usdot, {
        stage,
        contacted_today: contacted,
        next_follow_up: followup || null,
        notes
      });

      const updated = await api.carrier(
        selected.usdot
      );

      setSelected(updated);
      refresh();

      notify("Outreach information saved.");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  async function handleActivitySaved() {
    if (selected) {
      try {
        const updated = await api.carrier(
          selected.usdot
        );

        setSelected(updated);
      } catch (err) {
        notify(err.message, "error");
      }
    }

    refresh();
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            CARRIER RELATIONSHIPS
          </div>

          <h1>Outreach Management</h1>

          <p>
            Track conversations, notes,
            and next follow-up dates.
          </p>
        </div>
      </div>

      <div className="form-layout">
        <Card
          title="Choose carrier"
          subtitle="Find a company to work on"
        >
          <CarrierLookup onPick={setSelected} />
        </Card>

        <Card
          title="Carrier details"
          subtitle={
            selected
              ? `USDOT ${selected.usdot}`
              : "Select a carrier to begin"
          }
        >
          {!selected ? (
            <Empty
              title="No carrier selected"
              detail="Choose a lead from the list to update its outreach status."
              icon={Truck}
            />
          ) : (
            <>
              <div className="selected-carrier">
                <span className="selected-icon">
                  <Building2 size={22} />
                </span>

                <div>
                  <strong>
                    {selected.company}
                  </strong>

                  <p>
                    {selected.state || "Unknown state"}
                    {" · "}
                    {selected.power_units ?? "—"}
                    {" "}power units
                  </p>
                </div>
              </div>

              <div className="detail-lines">
                <span>
                  <Phone size={15} />
                  {selected.phone || "No phone listed"}
                </span>
                <span>
                  <span aria-hidden="true">✉</span>
                  {selected.email || "No business email listed"}
                </span>

                <Badge
                  value={selected.authority_verification}
                  kind="authority"
                />
              </div>

              <div style={{ marginBottom: 20 }}>
                <button
                  type="button"
                  className="btn btn-secondary"
                  disabled={searchingEmail || savingEmail}
                  onClick={findBusinessEmail}
                >
                  {searchingEmail ? "Searching public websites..." : "Find business email online"}
                </button>
                {emailNotice && <p style={{ marginTop: 8 }}>{emailNotice}</p>}
                {emailCandidates.length > 0 && (
                  <div style={{ marginTop: 12 }}>
                    <p>These are unverified public search results. Check the source before saving.</p>
                    {emailCandidates.map((item) => (
                      <div key={item.email} style={{ padding: 8, borderBottom: "1px solid #ddd" }}>
                        <strong>{item.email}</strong>
                        <p style={{ overflowWrap: "anywhere" }}>
                          Source: {item.source_title || item.source_url}
                        </p>
                        <p style={{ overflowWrap: "anywhere" }}>
                          {item.source_url}
                        </p>
                        <button
                          type="button"
                          className="btn btn-secondary"
                          disabled={savingEmail}
                          onClick={() => saveBusinessEmail(item.email)}
                        >
                          Save this email
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>

              <form
                className="edit-form"
                onSubmit={submit}
              >
                <label>
                  Outreach stage

                  <select
                    value={stage}
                    onChange={(e) =>
                      setStage(e.target.value)
                    }
                  >
                    {STAGES.map((item) => (
                      <option key={item} value={item}>
                        {item}
                      </option>
                    ))}
                  </select>
                </label>

                <label>
                  Next follow-up

                  <input
                    type="date"
                    value={followup}
                    onChange={(e) =>
                      setFollowup(e.target.value)
                    }
                  />
                </label>

                <label className="check-line">
                  <input
                    type="checkbox"
                    checked={contacted}
                    onChange={(e) =>
                      setContacted(e.target.checked)
                    }
                  />

                  I contacted this carrier today
                </label>

                <label>
                  Conversation notes

                  <textarea
                    value={notes}
                    onChange={(e) =>
                      setNotes(e.target.value)
                    }
                    rows={5}
                    placeholder="Record who you spoke to, what they said, and your next action..."
                  />
                </label>

                <div className="form-footer">
                  <button
                    disabled={saving}
                    className="btn btn-primary"
                    type="submit"
                  >
                    {saving ? (
                      <Loader2
                        size={16}
                        className="spin"
                      />
                    ) : (
                      <Save size={16} />
                    )}

                    Save changes
                  </button>
                </div>
              </form>
            </>
          )}
        </Card>
      </div>

      {/* OUTREACH HISTORY */}

      <div style={{ marginTop: 24 }}>
        <Card
          title="Outreach History"
          subtitle="Record calls, emails, replies, and follow-ups"
        >
          <OutreachHistory
            carrier={selected}
            onSaved={handleActivitySaved}
          />
        </Card>
      </div>
    </>
  );
}


// ===========================================
// CARRIER VERIFICATION
// ===========================================

function Verification({
  selected,
  setSelected,
  refresh,
  notify
}) {
  const [status, setStatus] = useState("Not verified");
  const [source, setSource] = useState("");
  const [notes, setNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (selected) {
      setStatus(
        VERIFICATION_STATUSES.includes(
          selected.authority_verification
        )
          ? selected.authority_verification
          : "Not verified"
      );

      setSource(
        selected.verification_source || ""
      );

      setNotes(
        selected.verification_notes || ""
      );
    }
  }, [selected]);

  async function submit(event) {
    event.preventDefault();

    if (!selected) return;

    setSaving(true);

    try {
      await api.verify(selected.usdot, {
        status,
        source,
        notes
      });

      const updated = await api.carrier(
        selected.usdot
      );

      setSelected(updated);
      refresh();

      notify("Authority review saved.");
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            COMPLIANCE WORKFLOW
          </div>

          <h1>Carrier Verification</h1>

          <p>
            Review operating authority before
            approaching potential clients.
          </p>
        </div>

        <a
          className="btn btn-outline"
          href="https://motus.dot.gov/public/search"
          target="_blank"
          rel="noreferrer"
        >
          <ExternalLink size={16} />
          FMCSA Motus
        </a>
      </div>

      <div className="notice">
        <CircleAlert size={18} />

        <span>
          FMCSA Census information is not proof of
          current authority. Only mark a carrier
          confirmed after reviewing official records.
        </span>
      </div>

      <div className="form-layout">
        <Card
          title="Verification queue"
          subtitle="Search for a carrier needing review"
        >
          <CarrierLookup onPick={setSelected} />
        </Card>

        <Card
          title="Record authority review"
          subtitle="Store the source and what you verified"
        >
          {!selected ? (
            <Empty
              title="No carrier selected"
              detail="Search for a company or select one from the dashboard's pending review list."
              icon={ShieldCheck}
            />
          ) : (
            <>
              <div className="selected-carrier">
                <span className="selected-icon">
                  <ShieldCheck size={22} />
                </span>

                <div>
                  <strong>
                    {selected.company}
                  </strong>

                  <p>
                    USDOT {selected.usdot}
                  </p>
                </div>
              </div>

              <div className="detail-lines">
                <Badge
                  kind="authority"
                  value={selected.authority_verification}
                />

                <span className="minor">
                  {selected.verification_reviewed_on
                    ? `Last reviewed ${selected.verification_reviewed_on}`
                    : "Never reviewed"}
                </span>
              </div>

              <form
                className="edit-form"
                onSubmit={submit}
              >
                <label>
                  Verification result

                  <select
                    value={status}
                    onChange={(e) =>
                      setStatus(e.target.value)
                    }
                  >
                    {VERIFICATION_STATUSES.map(
                      (item) => (
                        <option
                          key={item}
                          value={item}
                        >
                          {item}
                        </option>
                      )
                    )}
                  </select>
                </label>

                <label>
                  Official record URL

                  <input
                    type="url"
                    value={source}
                    onChange={(e) =>
                      setSource(e.target.value)
                    }
                    placeholder="https://motus.dot.gov/..."
                  />
                </label>

                <label>
                  Verification notes

                  <textarea
                    value={notes}
                    onChange={(e) =>
                      setNotes(e.target.value)
                    }
                    rows={5}
                    placeholder="Record the official status observed, date, and relevant details..."
                  />
                </label>

                <div className="form-footer">
                  <button
                    disabled={saving}
                    className="btn btn-primary"
                    type="submit"
                  >
                    {saving ? (
                      <Loader2
                        size={16}
                        className="spin"
                      />
                    ) : (
                      <Save size={16} />
                    )}

                    Save review
                  </button>
                </div>
              </form>
            </>
          )}
        </Card>
      </div>
    </>
  );
}


// ===========================================
// FOLLOW-UPS
// ===========================================

function Followups({
  onOpen,
  refreshKey
}) {
  const [tab, setTab] = useState("due");
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let live = true;

    setLoading(true);

    api.followups(tab)
      .then((response) => {
        if (live) {
          setData(response.items || []);
          setError("");
        }
      })
      .catch((err) => {
        if (live) setError(err.message);
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [tab, refreshKey]);

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            YOUR SCHEDULE
          </div>

          <h1>Follow-ups</h1>

          <p>
            Keep promises to call or email
            prospective carriers.
          </p>
        </div>
      </div>

      <Card
        title="Scheduled follow-ups"
        subtitle="Due today, overdue, and upcoming conversations"
      >
        <div className="tabs">
          <button
            className={
              tab === "due" ? "active" : ""
            }
            onClick={() => setTab("due")}
          >
            <Bell size={16} />
            Due & overdue
          </button>

          <button
            className={
              tab === "upcoming" ? "active" : ""
            }
            onClick={() => setTab("upcoming")}
          >
            <CalendarClock size={16} />
            Upcoming
          </button>
        </div>

        {error && (
          <Toast
            kind="error"
            onClose={() => setError("")}
          >
            {error}
          </Toast>
        )}

        {loading ? (
          <Spinner />
        ) : data.length ? (
          <LeadTable
            items={data}
            onOpen={onOpen}
            showFollowup
          />
        ) : (
          <Empty
            title="No follow-ups in this group"
            detail="Schedule a follow-up when editing a carrier's outreach record."
            icon={CalendarClock}
          />
        )}
      </Card>
    </>
  );
}


// ===========================================
// FIND NEW CARRIERS
// ===========================================

function Discover({
  refresh,
  notify,
  navigate
}) {
  const [state, setState] = useState("TX");
  const [target, setTarget] = useState(20);

  const [working, setWorking] = useState(false);
  const [refreshingEmails, setRefreshingEmails] = useState(false);
  const [result, setResult] = useState(null);

  async function refreshEmails() {
    setRefreshingEmails(true);
    try {
      const data = await api.refreshCarrierEmails();
      refresh();
      notify(`Checked ${data.checked} existing carriers; added ${data.updated} FMCSA emails.`);
    } catch (error) {
      notify(error.message, "error");
    } finally {
      setRefreshingEmails(false);
    }
  }

  async function submit(event) {
    event.preventDefault();

    setWorking(true);
    setResult(null);

    try {
      const response = await api.discover({
        state,
        target
      });

      setResult(response);
      refresh();

      notify(
        `Added ${response.added} new carrier candidates.`
      );
    } catch (err) {
      notify(err.message, "error");
    } finally {
      setWorking(false);
    }
  }

  const stateNames = {
    TX: "Texas",
    GA: "Georgia",
    FL: "Florida",
    NC: "North Carolina",
    OH: "Ohio",
    PA: "Pennsylvania"
  };

  return (
    <>
      <div className="page-heading">
        <div>
          <div className="eyebrow">
            LEAD DISCOVERY
          </div>

          <h1>Find New Carriers</h1>

          <button
            type="button"
            className="btn btn-secondary"
            onClick={refreshEmails}
            disabled={refreshingEmails || working}
            style={{ marginTop: 10, marginBottom: 12 }}
          >
            {refreshingEmails ? "Checking FMCSA emails..." : "Fill missing FMCSA emails for existing leads"}
          </button>

          <p>
            Discover small for-hire carrier candidates
            from public FMCSA records.
          </p>
        </div>
      </div>

      <div className="discover-layout">
        <Card
          title="Start a search"
          subtitle="Choose your target state and number of leads"
        >
          <form
            className="edit-form"
            onSubmit={submit}
          >
            <label>
              State

              <select
                value={state}
                onChange={(e) =>
                  setState(e.target.value)
                }
              >
                {STATES.map((item) => (
                  <option
                    key={item}
                    value={item}
                  >
                    {stateNames[item]} ({item})
                  </option>
                ))}
              </select>
            </label>

            <label>
              Number of carrier candidates

              <select
                value={target}
                onChange={(e) =>
                  setTarget(Number(e.target.value))
                }
              >
                <option value={10}>
                  10 carriers
                </option>

                <option value={20}>
                  20 carriers
                </option>

                <option value={50}>
                  50 carriers
                </option>
              </select>
            </label>

            <div className="notice subtle">
              <Filter size={18} />

              <span>
                The search screens for active USDOT
                registration, interstate operations,
                1–5 power units, and reported
                authorized-for-hire classification.
                Every result still needs independent
                verification.
              </span>
            </div>

            <button
              disabled={working}
              className="btn btn-primary"
              type="submit"
            >
              {working ? (
                <Loader2
                  size={17}
                  className="spin"
                />
              ) : (
                <Search size={17} />
              )}

              {working
                ? "Searching FMCSA..."
                : "Find carriers"}
            </button>
          </form>
        </Card>

        <Card
          title="Latest search"
          subtitle="Results are saved directly into PostgreSQL"
        >
          {result ? (
            <div className="search-results">
              <div className="result-mark">
                <CheckCircle2 size={28} />
              </div>

              <h3>Search complete</h3>

              <p>
                Processed{" "}
                {Number(
                  result.scanned
                ).toLocaleString()}{" "}
                records in {result.state}.
              </p>

              <div className="result-number">
                {result.added}
                <span> new prospects added</span>
              </div>

              <button
                className="btn btn-outline"
                onClick={() =>
                  navigate("carriers")
                }
              >
                View carrier leads
                <ArrowRight size={16} />
              </button>
            </div>
          ) : (
            <Empty
              title="Ready to find prospects"
              detail="Start a search to bring new, unverified candidates into Silvanne's database."
              icon={Search}
            />
          )}
        </Card>
      </div>
    </>
  );
}


// ===========================================
// MAIN APP
// ===========================================

export default function App() {
  const [page, setPage] = useState("dashboard");
  const [mobileNav, setMobileNav] = useState(false);

  const [refreshKey, setRefreshKey] = useState(0);

  const [stats, setStats] = useState(null);
  const [recent, setRecent] = useState([]);
  const [pending, setPending] = useState([]);

  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState(null);

  const [toast, setToast] = useState(null);

  function navigate(key) {
    setPage(key);
    setMobileNav(false);

    window.scrollTo({
      top: 0,
      behavior: "smooth"
    });
  }

  function refresh() {
    setRefreshKey((previous) => previous + 1);
  }

  function notify(
    message,
    kind = "success"
  ) {
    setToast({ message, kind });
  }

  function openCarrier(carrier) {
    setSelected(carrier);
    navigate("outreach");
  }

  function openReview(carrier) {
    setSelected(carrier);
    navigate("verification");
  }

  useEffect(() => {
    let live = true;

    setLoading(true);

    Promise.all([
      api.stats(),
      api.carriers({ page_size: 8 }),
      api.carriers({
        page_size: 5,
        verification_pending: true
      })
    ])
      .then(
        ([
          statsData,
          recentData,
          pendingData
        ]) => {
          if (live) {
            setStats(statsData);
            setRecent(recentData.items || []);
            setPending(pendingData.items || []);
          }
        }
      )
      .catch((err) => {
        if (live) {
          notify(
            `API connection: ${err.message}`,
            "error"
          );
        }
      })
      .finally(() => {
        if (live) setLoading(false);
      });

    return () => {
      live = false;
    };
  }, [refreshKey]);

  const title =
    NAV.find((item) => item.key === page)?.label ||
    (page === "settings" ? "Settings" : page === "support" ? "Help & Support" : "Dashboard");

  return (
    <div className="app-shell">

      {/* MOBILE OVERLAY */}

      {mobileNav && (
        <div
          className="mobile-overlay"
          onClick={() => setMobileNav(false)}
        />
      )}

      {/* SIDEBAR */}

      <aside
        className={`sidebar ${
          mobileNav ? "open" : ""
        }`}
      >
        <div className="brand">
          <div className="brand-mark">
            <Truck
              size={21}
              strokeWidth={2.1}
            />
          </div>

          <div>
            <strong>Lane<span className="lc-brand-accent">Cove</span></strong>
            <span>Dispatching CRM</span>
          </div>
        </div>

        <div className="nav-caption">
          WORKSPACE
        </div>

        <nav
          className="nav-list"
          aria-label="Main navigation"
        >
          {NAV.map(
            ({
              key,
              label,
              icon: Icon
            }) => (
              <button
                key={key}
                className={`nav-item ${
                  page === key
                    ? "selected"
                    : ""
                }`}
                onClick={() => navigate(key)}
              >
                <Icon
                  size={18}
                  strokeWidth={1.9}
                />

                <span>{label}</span>

                {page === key && (
                  <span className="active-marker" />
                )}
              </button>
            )
          )}
        </nav>

        <div className="sidebar-spacer" />

        <div className="lc-sidebar-links" aria-label="Help and settings">
          <button type="button" className={`nav-item ${page === "settings" ? "selected" : ""}`} onClick={() => navigate("settings")}> <SlidersHorizontal size={18} /> <span>Settings</span> </button>
          <button type="button" className={`nav-item ${page === "support" ? "selected" : ""}`} onClick={() => navigate("support")}> <CircleHelp size={18} /> <span>Help &amp; Support</span> </button>
        </div>

        <div className="sidebar-bottom">
          <div className="sidebar-rule" />

          <div className="avatar">
            S
          </div>

          <div>
            <strong>Silvanne</strong>
            <span>Dispatch workspace</span>
          </div>

          <span
            className="status-dot"
            title="Local development"
          />
        </div>
      </aside>

      {/* MAIN CONTENT */}

      <div className="main-wrap">

        {/* TOP BAR */}

        <header className="topbar">
          <div className="topbar-left">
            <button
              className="mobile-menu"
              onClick={() => setMobileNav(true)}
              aria-label="Open navigation"
            >
              <Menu size={22} />
            </button>

            {page === "dashboard" ? (
              <div className="lc-greeting">
                <h2>Good {new Date().getHours() < 12 ? "Morning" : new Date().getHours() < 17 ? "Afternoon" : "Evening"}, Silvanne 👋</h2>
                <p>Find, verify, and manage U.S. trucking carriers.</p>
              </div>
            ) : (
              <>
                <span>Workspace</span>
                <ChevronRight size={14} />
                <strong>{title}</strong>
              </>
            )}
          </div>

          <div className="topbar-right">
            <span className="local-pill">
              <span />
              Local workspace
            </span>

            <span className="header-avatar">
              S
            </span>
          </div>
        </header>

        {/* PAGE CONTENT */}

        <main className="content-area">

          {toast && (
            <Toast
              kind={toast.kind}
              onClose={() => setToast(null)}
            >
              {toast.message}
            </Toast>
          )}

          {/* DASHBOARD */}

          {page === "dashboard" && (
            <Dashboard
              stats={stats}
              recent={recent}
              pending={pending}
              loading={loading}
              navigate={navigate}
              onOpen={openCarrier}
              onReview={openReview}
              refresh={refresh}
              notify={notify}
            />
          )}

          {/* CARRIER LEADS */}

          {page === "carriers" && (
            <Carriers
              onOpen={openCarrier}
              refreshKey={refreshKey}
            />
          )}

          {/* FIND NEW CARRIERS */}

          {page === "discover" && (
            <CarrierFinderPanel
              onOpen={openCarrier}
              onChanged={refresh}
              notify={notify}
            />
          )}

          {/* FOLLOW-UPS */}

          {page === "followups" && (
            <Followups
              onOpen={openCarrier}
              refreshKey={refreshKey}
            />
          )}

          {/* OUTREACH + HISTORY */}

          {page === "outreach" && (
            <Outreach
              selected={selected}
              setSelected={setSelected}
              refresh={refresh}
              notify={notify}
            />
          )}

          {/* ACTIVE CLIENTS - SEPARATE PAGE */}

          {page === "active-clients" && (
            <ActiveClients
              onChanged={refresh}
            />
          )}

          {/* VERIFICATION */}

          {page === "verification" && (
            <Verification
              selected={selected}
              setSelected={setSelected}
              refresh={refresh}
              notify={notify}
            />
          )}
          {page === "settings" && <SettingsPage />}
          {page === "support" && <HelpSupportPage />}

        </main>

        {/* FOOTER */}

        <footer className="app-footer">
          Silvanne Carrier Finder
          <span>·</span>
          Local workspace
          <span>·</span>
          FMCSA records require verification
        </footer>

      </div>
    </div>
  );
}

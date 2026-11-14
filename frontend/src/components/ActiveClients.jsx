
import { useEffect, useState } from "react";

import {
  UsersRound,
  Search,
  Save,
  Archive,
  Truck
} from "lucide-react";

import { api } from "../api";

const EMPTY = {
  usdot: "",
  contact_name: "",
  contact_phone: "",
  contact_email: "",
  equipment: "",
  truck_count: 1,
  start_date: "",
  dispatch_fee_percent: "",
  preferred_lanes: "",
  notes: "",
  agreement_signed: false
};

async function clientRequest(path, options = {}) {
  const response = await fetch(`/api${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers
    }
  });

  const result = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(
      typeof result.detail === "string"
        ? result.detail
        : `Request failed (${response.status})`
    );
  }

  return result;
}

export default function ActiveClients({ onChanged }) {
  const [clients, setClients] = useState([]);
  const [form, setForm] = useState({ ...EMPTY });

  const [search, setSearch] = useState("");
  const [company, setCompany] = useState("");
  const [authority, setAuthority] = useState("");

  const [loading, setLoading] = useState(true);
  const [working, setWorking] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  async function reload() {
    const result = await clientRequest("/active-clients");
    setClients(result.items || []);
  }

  useEffect(() => {
    let active = true;

    clientRequest("/active-clients")
      .then((result) => {
        if (active) setClients(result.items || []);
      })
      .catch((err) => {
        if (active) setError(err.message);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  function update(field, value) {
    setForm((previous) => ({
      ...previous,
      [field]: value
    }));

    setMessage("");
  }

  function selectClient(client) {
    setForm({
      ...EMPTY,
      ...client,
      dispatch_fee_percent:
        client.dispatch_fee_percent ?? ""
    });

    setCompany(client.company);
    setAuthority(client.authority_verification);
    setError("");
    setMessage("");
  }

  async function findCarrier(event) {
    event.preventDefault();

    if (!search.trim()) return;

    setWorking(true);
    setError("");
    setMessage("");

    try {
      const carrier = await api.carrier(search.trim());

      const existing = clients.find(
        (item) => item.usdot === carrier.usdot
      );

      if (existing) {
        selectClient(existing);
        setMessage("This carrier is already an active client.");
        return;
      }

      setForm({
        ...EMPTY,
        usdot: carrier.usdot,
        contact_phone: carrier.phone || "",
        contact_email: carrier.email || "",
        equipment: carrier.equipment || ""
      });

      setCompany(carrier.company);
      setAuthority(carrier.authority_verification);

    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  async function save(event) {
    event.preventDefault();

    if (!form.usdot || working) return;

    setWorking(true);
    setError("");
    setMessage("");

    try {
      const payload = {
        ...form,
        truck_count: Number(form.truck_count),
        dispatch_fee_percent:
          form.dispatch_fee_percent === ""
            ? null
            : Number(form.dispatch_fee_percent)
      };

      await clientRequest("/active-clients", {
        method: "POST",
        body: JSON.stringify(payload)
      });

      await reload();

      onChanged?.();

      setMessage("Active client saved successfully.");

    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  async function archiveClient() {
    if (!form.usdot || working) return;

    const confirmed = window.confirm(
      `Archive ${company} from Active Clients? ` +
      "Its record will be retained."
    );

    if (!confirmed) return;

    setWorking(true);
    setError("");
    setMessage("");

    try {
      await clientRequest(
        `/active-clients/${encodeURIComponent(
          form.usdot
        )}/archive`,
        { method: "POST" }
      );

      await reload();

      setForm({ ...EMPTY });
      setCompany("");
      setAuthority("");

      onChanged?.();

      setMessage("Client archived successfully.");

    } catch (err) {
      setError(err.message);
    } finally {
      setWorking(false);
    }
  }

  const totalTrucks = clients.reduce(
    (sum, client) => sum + Number(client.truck_count || 0),
    0
  );

  const isExisting = clients.some(
    (client) => client.usdot === form.usdot
  );

  return (
    <div className="active-clients-page">

      <div className="page-heading">
        <div>
          <div className="eyebrow">DISPATCH OPERATIONS</div>
          <h1>Active Clients</h1>
          <p>
            Manage trucking companies that have officially
            hired Silvanne for dispatching services.
          </p>
        </div>
      </div>

      <div className="ac-summary">
        <div className="ac-stat">
          <UsersRound size={20} />
          <strong>{clients.length}</strong>
          <span>Active carriers</span>
        </div>

        <div className="ac-stat">
          <Truck size={20} />
          <strong>{totalTrucks}</strong>
          <span>Trucks managed</span>
        </div>
      </div>

      {error && (
        <p className="ac-alert ac-error" role="alert">
          {error}
        </p>
      )}

      {message && (
        <p className="ac-alert ac-success" role="status">
          {message}
        </p>
      )}

      <div className="ac-layout">

        <section className="ac-panel">
          <h2>Client Directory</h2>
          <p className="ac-muted">
            Only confirmed active clients appear here.
          </p>

          {loading && (
            <p className="ac-muted">Loading clients...</p>
          )}

          {!loading && clients.length === 0 && (
            <div className="ac-empty">
              <UsersRound size={28} />
              <strong>No active clients yet</strong>
              <p>
                Once Silvanne secures her first signed
                carrier, add it using the form.
              </p>
            </div>
          )}

          <div className="ac-client-list">
            {clients.map((client) => (
              <button
                key={client.usdot}
                type="button"
                className={
                  "ac-client " +
                  (form.usdot === client.usdot
                    ? "ac-client-selected"
                    : "")
                }
                onClick={() => selectClient(client)}
              >
                <span className="ac-client-icon">
                  <Truck size={18} />
                </span>

                <span className="ac-client-details">
                  <strong>{client.company}</strong>
                  <small>
                    USDOT {client.usdot}
                  </small>
                  <small>
                    {client.truck_count} truck(s)
                    {" · "}
                    {client.equipment || "Equipment not set"}
                  </small>
                </span>

                <span className="ac-active-tag">
                  Active
                </span>
              </button>
            ))}
          </div>
        </section>

        <section className="ac-panel">
          <h2>
            {isExisting
              ? "Manage Client"
              : "Add Active Client"}
          </h2>

          <p className="ac-muted">
            Find a carrier by its USDOT number,
            then manage its dispatching details.
          </p>

          <form
            className="ac-search"
            onSubmit={findCarrier}
          >
            <input
              type="text"
              inputMode="numeric"
              placeholder="Enter carrier USDOT number"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />

            <button
              type="submit"
              className="btn btn-outline"
              disabled={working}
            >
              <Search size={16} />
              Find
            </button>
          </form>

          {!form.usdot ? (
            <div className="ac-empty">
              <Truck size={28} />
              <strong>Select a carrier</strong>
              <p>
                Search by USDOT or choose an existing
                client from the directory.
              </p>
            </div>
          ) : (
            <>
              <div className="ac-selected">
                <strong>{company}</strong>
                <small>USDOT {form.usdot}</small>
                <small>
                  Authority: {authority || "Not verified"}
                </small>
              </div>

              {![
                "Property authority confirmed",
                "Confirmed manually"
              ].includes(authority) && (
                <p className="ac-alert ac-warning">
                  Current operating authority has not been
                  confirmed in this record. Verify it
                  through FMCSA before dispatching loads.
                </p>
              )}

              <form
                className="ac-form"
                onSubmit={save}
              >
                <div className="ac-fields">
                  <label>
                    Contact Person
                    <input
                      type="text"
                      maxLength={150}
                      value={form.contact_name}
                      onChange={(e) =>
                        update("contact_name", e.target.value)
                      }
                    />
                  </label>

                  <label>
                    Contact Phone
                    <input
                      type="tel"
                      maxLength={50}
                      value={form.contact_phone}
                      onChange={(e) =>
                        update("contact_phone", e.target.value)
                      }
                    />
                  </label>

                  <label>
                    Business Email
                    <input
                      type="email"
                      maxLength={254}
                      value={form.contact_email}
                      onChange={(e) =>
                        update("contact_email", e.target.value)
                      }
                    />
                  </label>

                  <label>
                    Equipment
                    <input
                      type="text"
                      maxLength={150}
                      placeholder="Dry Van, Reefer, Flatbed..."
                      value={form.equipment}
                      onChange={(e) =>
                        update("equipment", e.target.value)
                      }
                    />
                  </label>

                  <label>
                    Number of Trucks
                    <input
                      type="number"
                      min="1"
                      required
                      value={form.truck_count}
                      onChange={(e) =>
                        update("truck_count", e.target.value)
                      }
                    />
                  </label>

                  <label>
                    Service Start Date
                    <input
                      type="date"
                      required
                      value={form.start_date}
                      onChange={(e) =>
                        update("start_date", e.target.value)
                      }
                    />
                  </label>

                  <label>
                    Dispatch Fee (%)
                    <input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      placeholder="Example: 5"
                      value={form.dispatch_fee_percent}
                      onChange={(e) =>
                        update(
                          "dispatch_fee_percent",
                          e.target.value
                        )
                      }
                    />
                  </label>
                </div>

                <label>
                  Preferred Routes
                  <textarea
                    rows={3}
                    maxLength={2000}
                    value={form.preferred_lanes}
                    placeholder="Preferred states or lanes..."
                    onChange={(e) =>
                      update("preferred_lanes", e.target.value)
                    }
                  />
                </label>

                <label>
                  Operational Notes
                  <textarea
                    rows={4}
                    maxLength={5000}
                    value={form.notes}
                    placeholder="Client preferences, instructions..."
                    onChange={(e) =>
                      update("notes", e.target.value)
                    }
                  />
                </label>

                <label className="ac-checkbox">
                  <input
                    type="checkbox"
                    required
                    checked={form.agreement_signed}
                    onChange={(e) =>
                      update(
                        "agreement_signed",
                        e.target.checked
                      )
                    }
                  />
                  <span>
                    I confirm that a signed dispatch
                    agreement is in place for this client.
                  </span>
                </label>

                <div className="ac-actions">
                  <button
                    type="submit"
                    className="btn btn-primary"
                    disabled={working}
                  >
                    <Save size={16} />
                    {working
                      ? "Saving..."
                      : "Save Active Client"}
                  </button>

                  {isExisting && (
                    <button
                      type="button"
                      className="btn btn-outline"
                      disabled={working}
                      onClick={archiveClient}
                    >
                      <Archive size={16} />
                      Archive
                    </button>
                  )}
                </div>
              </form>
            </>
          )}
        </section>
      </div>
    </div>
  );
}

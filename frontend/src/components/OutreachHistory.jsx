
import { useEffect, useState } from "react";

import {
  Phone,
  Mail,
  BriefcaseBusiness,
  UsersRound,
  MessageCircle,
  Save
} from "lucide-react";

import { api } from "../api";


// ========================================
// 1. COMMUNICATION CHANNELS
// ========================================

const CHANNELS = [
  "Phone",
  "Email",
  "LinkedIn",
  "Facebook",
  "Other"
];


// ========================================
// 2. POSSIBLE OUTCOMES
// ========================================

const OUTCOMES = [
  "No answer",
  "Message sent",
  "Reply received",
  "Interested",
  "Follow-up requested",
  "Not interested",
  "Other"
];


// ========================================
// 3. OUTREACH STAGES
// ========================================

const STAGES = [
  "Not contacted",
  "Contacted",
  "Replied",
  "Interested",
  "Follow-up",
  "Client"
];


// ========================================
// 4. ICON MAPPING
// ========================================

const ICONS = {
  Phone: Phone,
  Email: Mail,
  LinkedIn: BriefcaseBusiness,
  Facebook: UsersRound,
  Other: MessageCircle
};


// ========================================
// 5. OUTREACH HISTORY COMPONENT
// ========================================

export default function OutreachHistory({
  carrier,
  onSaved
}) {

  const [activities, setActivities] = useState([]);

  const [channel, setChannel] = useState("Phone");
  const [outcome, setOutcome] = useState("No answer");

  const [notes, setNotes] = useState("");
  const [followUp, setFollowUp] = useState("");
  const [stage, setStage] = useState("");

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [version, setVersion] = useState(0);


  // ========================================
  // 6. LOAD COMMUNICATION HISTORY
  // ========================================

  useEffect(() => {

    if (!carrier?.usdot) {
      setActivities([]);
      return;
    }

    let active = true;

    setActivities([]);
    setError("");
    setNotice("");

    api.activities(carrier.usdot)
      .then((response) => {

        if (active) {
          setActivities(response.items || []);
        }

      })
      .catch((err) => {

        if (active) {
          setError(err.message);
        }

      });

    return () => {
      active = false;
    };

  }, [carrier?.usdot, version]);


  // ========================================
  // 7. SAVE NEW INTERACTION
  // ========================================

  async function save(e) {

    e.preventDefault();

    if (!carrier?.usdot || loading) {
      return;
    }

    setLoading(true);
    setError("");
    setNotice("");

    try {

      await api.addActivity(carrier.usdot, {
        channel: channel,
        outcome: outcome,
        notes: notes,
        next_follow_up: followUp || null,
        stage_after: stage || null
      });

      // Clear form after saving
      setNotes("");
      setFollowUp("");
      setStage("");

      // Reload history
      setVersion((previous) => previous + 1);

      // Refresh parent dashboard
      if (onSaved) {
        await onSaved();
      }

      setNotice("Interaction saved successfully!");

    } catch (err) {

      setError(err.message);

    } finally {

      setLoading(false);

    }
  }


  // ========================================
  // 8. NO CARRIER SELECTED
  // ========================================

  if (!carrier) {

    return (
      <p className="empty">
        Select a carrier to view and record
        communication history.
      </p>
    );

  }


  // ========================================
  // 9. MAIN INTERFACE
  // ========================================

  return (

    <div className="outreach-history">

      <h3>Record Interaction</h3>

      <p className="activity-help">
        Track calls, emails, replies, and follow-ups
        with this trucking company.
      </p>


      {/* INTERACTION FORM */}

      <form
        className="form"
        onSubmit={save}
      >

        <div className="activity-fields">

          {/* Communication channel */}

          <label>
            Communication Channel

            <select
              value={channel}
              onChange={(e) =>
                setChannel(e.target.value)
              }
            >

              {CHANNELS.map((item) => (

                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>

              ))}

            </select>
          </label>


          {/* Interaction outcome */}

          <label>
            Outcome

            <select
              value={outcome}
              onChange={(e) =>
                setOutcome(e.target.value)
              }
            >

              {OUTCOMES.map((item) => (

                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>

              ))}

            </select>
          </label>


          {/* Follow-up date */}

          <label>
            Next Follow-up

            <input
              type="date"
              value={followUp}
              onChange={(e) =>
                setFollowUp(e.target.value)
              }
            />

          </label>


          {/* Outreach stage */}

          <label>
            Update Outreach Stage

            <select
              value={stage}
              onChange={(e) =>
                setStage(e.target.value)
              }
            >

              <option value="">
                Keep existing stage
              </option>

              {STAGES.map((item) => (

                <option
                  key={item}
                  value={item}
                >
                  {item}
                </option>

              ))}

            </select>
          </label>

        </div>


        {/* Notes */}

        <label>
          Interaction Notes

          <textarea
            rows={4}
            maxLength={5000}
            value={notes}
            placeholder="What happened during this interaction?"
            onChange={(e) =>
              setNotes(e.target.value)
            }
          />

        </label>


        {/* Error message */}

        {error && (

          <p className="activity-error">
            {error}
          </p>

        )}


        {/* Success message */}

        {notice && (

          <p className="activity-success">
            {notice}
          </p>

        )}


        {/* Save button */}

        <button
          type="submit"
          className="button primary"
          disabled={loading}
        >

          <Save size={16} />

          {loading
            ? "Saving..."
            : "Log Interaction"
          }

        </button>

      </form>


      {/* ====================================
          COMMUNICATION HISTORY
      ==================================== */}

      <div className="history-heading">

        <h3>Communication History</h3>

        <span>
          {activities.length} recent records
        </span>

      </div>


      {/* Empty history */}

      {activities.length === 0 && (

        <p className="empty">
          No recorded interactions for this carrier yet.
        </p>

      )}


      {/* History list */}

      <div className="activity-list">

        {activities.map((item) => {

          const Icon =
            ICONS[item.channel] || MessageCircle;

          return (

            <div
              className="activity-item"
              key={item.id}
            >

              <div className="activity-icon">
                <Icon size={17} />
              </div>


              <div className="activity-content">

                <div className="activity-title">

                  <strong>
                    {item.channel} · {item.outcome}
                  </strong>

                  <time>
                    {item.created_at
                      ? new Date(
                          item.created_at
                        ).toLocaleString()
                      : "Date unavailable"}
                  </time>

                </div>


                {item.notes && (

                  <p>
                    {item.notes}
                  </p>

                )}


                {item.stage_after && (

                  <small>
                    Stage updated to: {item.stage_after}
                  </small>

                )}


                {item.next_follow_up && (

                  <small>
                    Next follow-up: {item.next_follow_up}
                  </small>

                )}

              </div>

            </div>

          );

        })}

      </div>

    </div>

  );

}

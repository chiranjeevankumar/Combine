// Marketing campaigns page.
import React, { useEffect, useState } from "react";
import { campaignService, tagService, savedSearchService } from "@/services";
import {
  UptoPage, UptoHero, UptoButton, UptoInput, UptoBadge,
  UptoSpinner, UptoError, UptoEmptyState, UptoCard,
} from "@/components/UI/UptoHooks";
import { Megaphone, Plus } from "lucide-react";
import { toast } from "sonner";

const LEAD_STATUS_OPTIONS = [
  { value: "new", label: "New" },
  { value: "contacted", label: "Contacted" },
  { value: "qualified", label: "Qualified" },
  { value: "in_progress", label: "In Progress" },
  { value: "converted", label: "Converted" },
  { value: "closed", label: "Closed" },
  { value: "lost", label: "Lost" },
];

const Campaigns = () => {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [tags, setTags] = useState([]);
  const [segments, setSegments] = useState([]);

  const toLocalDateTimeInput = (value) => {
    if (!value) return "";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return "";
    const pad = (n) => String(n).padStart(2, "0");
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
  };

  const [draft, setDraft] = useState({
    name: "",
    audience: { type: "all" },
    schedule: "",
    steps: [
      {
        day: 0,
        subject: "",
        body: "",
      },
    ],
  });

  const loadMetaData = async () => {
    try {
      const [tagsData, segmentsData] = await Promise.all([
        tagService.list(),
        savedSearchService.list({ resource: "leads" }),
      ]);
      setTags(tagsData || []);
      setSegments(segmentsData || []);
    } catch (err) {
      console.error("Failed to load audience metadata:", err);
    }
  };

  const load = async () => {
    setLoading(true);
    try {
      const res = await campaignService.list({ limit: 100 });
      setItems(res?.items || res || []);
      setError(null);
    } catch (e) { setError(e?.message || "Failed to load"); }
    finally { setLoading(false); }
  };

  useEffect(() => {
    load();
    loadMetaData();
  }, []);

  const handleAudienceTypeChange = (type) => {
    if (type === "all") {
      setDraft({ ...draft, audience: { type: "all" } });
    } else if (type === "tag") {
      const firstTagId = tags[0]?.id || "";
      setDraft({ ...draft, audience: { type: "tag", tagId: firstTagId } });
    } else if (type === "status") {
      setDraft({ ...draft, audience: { type: "status", status: "new" } });
    } else if (type === "segment") {
      const firstSegId = segments[0]?.id || "";
      setDraft({ ...draft, audience: { type: "segment", savedSearchId: firstSegId } });
    }
  };

  const renderAudienceLabel = (aud) => {
    if (!aud || aud === "all") return "All Leads";
    let audienceObj = aud;
    if (typeof aud === "string") {
      try {
        audienceObj = JSON.parse(aud);
      } catch (_) {
        return aud;
      }
    }

    if (audienceObj?.type === "all") return "All Leads";
    if (audienceObj?.type === "tag") {
      const tag = tags.find((t) => t.id === Number(audienceObj.tagId));
      return tag ? `Tag: ${tag.name}` : `Tag #${audienceObj.tagId}`;
    }
    if (audienceObj?.type === "status") {
      const matchedStatus = LEAD_STATUS_OPTIONS.find((s) => s.value === audienceObj.status);
      return `Status: ${matchedStatus ? matchedStatus.label : audienceObj.status}`;
    }
    if (audienceObj?.type === "segment") {
      const seg = segments.find((s) => s.id === Number(audienceObj.savedSearchId));
      return seg ? `Segment: ${seg.name}` : `Segment #${audienceObj.savedSearchId}`;
    }
    return "All Leads";
  };

  const handleCreate = async (e) => {
    e.preventDefault();

    try {
      if (!draft.schedule) {
        toast.error("Please select a campaign start date.");
        return;
      }

      const startDate = draft.schedule.slice(0, 10);
      const startTime = draft.steps?.[0]?.time || "10:00";
      const scheduleDateTime = `${startDate}T${startTime}`;

      const payload = {
        ...draft,
        schedule: new Date(scheduleDateTime).toISOString(),
      };

      if (editingId) {
        await campaignService.update(editingId, payload);
        toast.success("Campaign updated");
      } else {
        await campaignService.create(payload);
        toast.success("Campaign created");
      }

      setShowCreate(false);
      setEditingId(null);

      setDraft({
        name: "",
        audience: { type: "all" },
        schedule: "",
        steps: [
          {
            day: 0,
            subject: "",
            body: "",
          },
        ],
      });

      load();
    } catch (err) {
      toast.error(err?.message || "Operation failed");
    }
  };

  const handleLaunch = async (id) => {
    try {
      await campaignService.launch(id);
      toast.success("Campaign launched");
      load();
    } catch (err) {
      toast.error(err?.message || "Launch failed");
    }
  };

  const handlePause = async (id) => {
    try {
      await campaignService.pause(id);
      toast.success("Campaign paused");
      load();
    } catch (err) {
      toast.error(err?.message || "Pause failed");
    }
  };

  const handleStop = async (id) => {
    try {
      await campaignService.stop(id);
      toast.success("Campaign stopped");
      load();
    } catch (err) {
      toast.error(err?.message || "Stop failed");
    }
  };

  const handleResume = async (id) => {
    try {
      await campaignService.resume(id);
      toast.success("Campaign resumed");
      load();
    } catch (err) {
      toast.error(err?.message || "Resume failed");
    }
  };

  const handleDelete = async (id) => {
    const ok = window.confirm("Delete this campaign?");
    if (!ok) return;

    try {
      await campaignService.remove(id);
      toast.success("Campaign deleted");
      load();
    } catch (err) {
      toast.error(err?.message || "Delete failed");
    }
  };

  const handleEdit = (campaign) => {
    setEditingId(campaign.id);
    const rawAudience = campaign.conditions?.audience || "all";
    let audience = rawAudience;
    if (typeof rawAudience === "string" && rawAudience !== "all") {
      try {
        audience = JSON.parse(rawAudience);
      } catch (_) {
        audience = rawAudience;
      }
    }

    setDraft({
      name: campaign.name || "",
      audience,
      schedule: toLocalDateTimeInput(campaign.conditions?.schedule),
      steps: campaign.conditions?.steps || [
        {
          day: 0,
          subject: campaign.conditions?.subject || "",
          body: campaign.conditions?.body || "",
        },
      ],
    });

    setShowCreate(true);
  };

  return (
    <UptoPage>
      <UptoHero
        title="Campaigns"
        subtitle="Email and marketing automation"
        actions={<UptoButton onClick={() => setShowCreate(true)}><Plus className="mr-1 h-4 w-4 inline" /> New campaign</UptoButton>}
      />
      <UptoCard>
        {loading && <UptoSpinner />}
        {error && <UptoError message={error} onRetry={load} />}
        {!loading && !error && items.length === 0 && (
          <UptoEmptyState icon={Megaphone} title="No campaigns" body="Create a campaign to reach your audience." />
        )}
        {!loading && !error && items.length > 0 && (
          <div className="space-y-2">
            {items.map((c) => (
              <div key={c.id} className="p-3 rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-between">
                <div>
                  <div className="font-medium">{c.name}</div>
                  <div className="text-xs text-slate-500">
                    {renderAudienceLabel(c.conditions?.audience)} ·{" "}
                    {c.conditions?.schedule ? `${new Date(c.conditions.schedule).toLocaleString()}` : "No schedule"} ·{" "}
                    {c.conditions?.steps?.length
                      ? `${c.conditions.steps.length} step${c.conditions.steps.length > 1 ? "s" : ""}`
                      : c.conditions?.subject || "—"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <UptoBadge>
                    {c.conditions?.status === "paused"
                      ? "Paused"
                      : c.conditions?.status === "scheduled"
                        ? "Scheduled"
                        : c.conditions?.status === "completed"
                          ? "Completed"
                          : c.active
                            ? "Running"
                            : "Draft"}
                  </UptoBadge>

                  {c.conditions?.status === "paused" ? (
                    <>
                      <UptoButton variant="ghost" onClick={() => handleResume(c.id)}>
                        Resume
                      </UptoButton>
                      <UptoButton variant="secondary" onClick={() => handleStop(c.id)}>
                        Stop
                      </UptoButton>
                    </>
                  ) : c.conditions?.status === "cancelled" ? (
                    <span className="text-sm text-slate-500">Stopped</span>
                  ) : c.conditions?.status === "completed" ? (
                    <span className="text-sm text-slate-500">Completed</span>
                  ) : !c.active ? (
                    <UptoButton variant="ghost" onClick={() => handleLaunch(c.id)}>
                      Launch
                    </UptoButton>
                  ) : (
                    <>
                      <UptoButton variant="secondary" onClick={() => handlePause(c.id)}>
                        Pause
                      </UptoButton>
                      <UptoButton variant="secondary" onClick={() => handleStop(c.id)}>
                        Stop
                      </UptoButton>
                    </>
                  )}

                  <UptoButton
                    variant="ghost"
                    onClick={() => handleEdit(c)}
                  >
                    Edit
                  </UptoButton>

                  <UptoButton
                    variant="danger"
                    onClick={() => handleDelete(c.id)}
                  >
                    Delete
                  </UptoButton>
                </div>
              </div>
            ))}
          </div>
        )}
      </UptoCard>

      {showCreate && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4">
          <form
            onSubmit={handleCreate}
            className="bg-white dark:bg-slate-900 rounded-2xl p-6 max-w-md w-full max-h-[90vh] overflow-y-auto"
          >
            <h3 className="text-lg font-semibold mb-4">
              {editingId ? "Edit campaign" : "New campaign"}
            </h3>
            <div className="space-y-3">
              <UptoInput label="Name" value={draft.name} onChange={(e) => setDraft({ ...draft, name: e.target.value })} required />

              <div className="space-y-2">
                <label className="text-sm font-medium text-slate-700 dark:text-slate-300">Target Audience</label>
                <select
                  className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={
                    typeof draft.audience === "string"
                      ? draft.audience === "all" ? "all" : "all"
                      : draft.audience?.type || "all"
                  }
                  onChange={(e) => handleAudienceTypeChange(e.target.value)}
                >
                  <option value="all">All Leads</option>
                  <option value="tag">By Tag</option>
                  <option value="status">By Status</option>
                  <option value="segment">By Saved Segment</option>
                </select>

                {(typeof draft.audience === "object" && draft.audience?.type === "tag") && (
                  <div className="mt-2">
                    <label className="text-xs text-slate-500 mb-1 block">Select Tag</label>
                    {tags.length === 0 ? (
                      <div className="text-xs text-amber-600 dark:text-amber-400">No tags available. Please create tags first in Leads.</div>
                    ) : (
                      <select
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-sm"
                        value={draft.audience?.tagId || ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            audience: { type: "tag", tagId: Number(e.target.value) },
                          })
                        }
                      >
                        {tags.map((t) => (
                          <option key={t.id} value={t.id}>
                            {t.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}

                {(typeof draft.audience === "object" && draft.audience?.type === "status") && (
                  <div className="mt-2">
                    <label className="text-xs text-slate-500 mb-1 block">Select Lead Status</label>
                    <select
                      className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-sm"
                      value={draft.audience?.status || "new"}
                      onChange={(e) =>
                        setDraft({
                          ...draft,
                          audience: { type: "status", status: e.target.value },
                        })
                      }
                    >
                      {LEAD_STATUS_OPTIONS.map((st) => (
                        <option key={st.value} value={st.value}>
                          {st.label}
                        </option>
                      ))}
                    </select>
                  </div>
                )}

                {(typeof draft.audience === "object" && draft.audience?.type === "segment") && (
                  <div className="mt-2">
                    <label className="text-xs text-slate-500 mb-1 block">Select Saved Segment</label>
                    {segments.length === 0 ? (
                      <div className="text-xs text-amber-600 dark:text-amber-400">No lead segments saved yet.</div>
                    ) : (
                      <select
                        className="w-full rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-800 p-2 text-sm"
                        value={draft.audience?.savedSearchId || ""}
                        onChange={(e) =>
                          setDraft({
                            ...draft,
                            audience: { type: "segment", savedSearchId: Number(e.target.value) },
                          })
                        }
                      >
                        {segments.map((s) => (
                          <option key={s.id} value={s.id}>
                            {s.name}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                )}
              </div>

              <UptoInput
                label="Campaign Start Date"
                type="date"
                min={new Date().toISOString().slice(0, 10)}
                value={(draft.schedule || "").slice(0, 10)}
                onChange={(e) => setDraft({ ...draft, schedule: e.target.value })}
                required
              />

              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="font-medium">Campaign Steps</h4>
                  <UptoButton
                    type="button"
                    variant="ghost"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        steps: [
                          ...draft.steps,
                          {
                            day: draft.steps.length === 0
                              ? 0
                              : draft.steps[draft.steps.length - 1].day + 1,
                            subject: "",
                            body: "",
                          },
                        ],
                      })
                    }
                  >
                    + Add Step
                  </UptoButton>
                </div>

                {draft.steps.map((step, index) => (
                  <div
                    key={index}
                    className="border border-slate-200 dark:border-slate-700 rounded-xl p-4 space-y-3"
                  >
                    <div className="flex items-center justify-between">
                      <h5 className="font-medium">Step {index + 1}</h5>
                      {draft.steps.length > 1 && (
                        <UptoButton
                          type="button"
                          variant="danger"
                          onClick={() =>
                            setDraft({
                              ...draft,
                              steps: draft.steps.filter((_, i) => i !== index),
                            })
                          }
                        >
                          Remove
                        </UptoButton>
                      )}
                    </div>

                    <UptoInput
                      label="Day"
                      type="number"
                      min="0"
                      value={step.day}
                      onChange={(e) => {
                        const steps = [...draft.steps];
                        steps[index] = {
                          ...steps[index],
                          day: Number(e.target.value),
                        };
                        setDraft({ ...draft, steps });
                      }}
                      required
                    />

                    <UptoInput
                      label="Time"
                      type="time"
                      value={step.time || "10:00"}
                      onChange={(e) => {
                        const steps = [...draft.steps];
                        steps[index] = {
                          ...steps[index],
                          time: e.target.value,
                        };
                        setDraft({ ...draft, steps });
                      }}
                      required
                    />

                    <UptoInput
                      label="Subject"
                      value={step.subject}
                      onChange={(e) => {
                        const steps = [...draft.steps];
                        steps[index] = {
                          ...steps[index],
                          subject: e.target.value,
                        };
                        setDraft({ ...draft, steps });
                      }}
                      required
                    />

                    <UptoInput
                      label="Email Body"
                      value={step.body}
                      onChange={(e) => {
                        const steps = [...draft.steps];
                        steps[index] = {
                          ...steps[index],
                          body: e.target.value,
                        };
                        setDraft({ ...draft, steps });
                      }}
                      required
                    />
                  </div>
                ))}
              </div>
            </div>
            <div className="mt-4 flex justify-end gap-2">
              <UptoButton type="button" variant="ghost" onClick={() => { setShowCreate(false); setEditingId(null); }}>Cancel</UptoButton>
              <UptoButton type="submit">
                {editingId ? "Save Changes" : "Create"}
              </UptoButton>
            </div>
          </form>
        </div>
      )}
    </UptoPage>
  );
};

export default Campaigns;




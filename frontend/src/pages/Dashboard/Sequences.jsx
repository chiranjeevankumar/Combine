import React, { useEffect, useState } from "react";
import { sequenceService } from "@/services";
import { useUptoStyles, UptoPage, UptoHero, UptoSectionHeading, UptoButton, UptoInput, UptoTextarea, UptoBadge, UptoSpinner, UptoError, UptoEmptyState, UptoCard } from "@/components/UI/UptoHooks";
import { Workflow, Plus, Play, Pause, Trash2, Mail, Clock } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const Sequences = () => {
  const { isMember } = useAuth();
  const s = useUptoStyles();
  const { darkMode } = s;
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({
    name: "", description: "",
    steps: [
      { day: 0, subject: "Initial outreach", body: "Hi {{first_name}}, ..." },
      { day: 3, subject: "Follow up", body: "Just bumping this..." },
      { day: 7, subject: "Last touch", body: "Closing the loop..." },
    ],
  });

  const load = async () => {
    setLoading(true);
    try { setItems(await sequenceService.list() || []); }
    catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try { await sequenceService.create(draft); toast.success("Sequence created"); setShowCreate(false); load(); }
    catch (err) { toast.error(err.message); }
  };
  const toggleStatus = async (sq) => {
    const next = sq.status === "ACTIVE" ? "PAUSED" : "ACTIVE";
    try { await sequenceService.update(sq.id, { status: next }); load(); }
    catch (e) { toast.error(e.message); }
  };
  const remove = async (id) => {
    if (!confirm("Delete this sequence?")) return;
    try { await sequenceService.remove(id); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <UptoPage>
      <UptoHero title="Sequences" subtitle="Automated multi-step email drip campaigns." darkMode={darkMode}
        actions={isMember && <UptoButton onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New Sequence</UptoButton>}
      />

      {loading ? <UptoSpinner /> : items.length === 0 ? (
        <section><UptoCard><UptoEmptyState icon={Workflow} title="No sequences yet" body="Automate your outreach with multi-step drip campaigns." /></UptoCard></section>
      ) : (
        <section>
          <UptoSectionHeading label="Your Sequences" darkMode={darkMode} />
          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            {items.map((sq) => (
              <UptoCard key={sq.id}>
                <div className="mb-2 flex items-start justify-between">
                  <div>
                    <h3 className={`font-semibold ${s.heading}`}>{sq.name}</h3>
                    {sq.description && <p className={`text-xs ${s.muted}`}>{sq.description}</p>}
                  </div>
                  <UptoBadge tone={sq.status === "ACTIVE" ? "success" : sq.status === "PAUSED" ? "warning" : "default"}>{sq.status}</UptoBadge>
                </div>
                <div className="mb-3 flex items-center gap-3 text-xs text-slate-500">
                  <span><Mail className="mr-1 inline h-3 w-3" />{Array.isArray(sq.steps) ? sq.steps.length : 0} steps</span>
                  <span><Clock className="mr-1 inline h-3 w-3" />{Array.isArray(sq.steps) ? Math.max(...sq.steps.map((st) => st.day || 0)) : 0}d total</span>
                </div>
                {Array.isArray(sq.steps) && (
                  <div className="mb-3 space-y-1">
                    {sq.steps.slice(0, 3).map((step, i) => (
                      <div key={i} className={`flex items-center gap-2 rounded-lg border p-2 text-xs ${darkMode ? "border-slate-800" : "border-slate-100"}`}>
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[#00b5ad] text-[10px] font-semibold text-white">{i + 1}</span>
                        <span className={`font-medium ${s.heading}`}>Day {step.day}</span>
                        <span className={`truncate ${s.body}`}>{step.subject}</span>
                      </div>
                    ))}
                    {sq.steps.length > 3 && <p className={`text-xs ${s.muted}`}>+{sq.steps.length - 3} more steps</p>}
                  </div>
                )}
                <div className="flex items-center gap-1">
                  {isMember && <UptoButton variant="secondary" onClick={() => toggleStatus(sq)}>{sq.status === "ACTIVE" ? <><Pause className="h-4 w-4" /> Pause</> : <><Play className="h-4 w-4" /> Activate</>}</UptoButton>}
                  {isMember && <UptoButton variant="ghost" onClick={() => remove(sq.id)} className="text-red-500"><Trash2 className="h-4 w-4" /></UptoButton>}
                </div>
              </UptoCard>
            ))}
          </div>
        </section>
      )}

      {showCreate && (
        <section>
          <UptoCard>
            <h3 className={`text-base font-semibold mb-4 ${s.heading}`}>New Sequence</h3>
            <form onSubmit={create} className="space-y-3">
              <UptoInput label="Name" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} required placeholder="3-step cold outreach" />
              <UptoTextarea label="Description" rows={2} value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} />
              <p className={`text-xs ${s.muted}`}>This starter sequence has 3 steps. Edit the JSON below to customize.</p>
              <UptoTextarea label="Steps (JSON)" rows={6} value={JSON.stringify(draft.steps, null, 2)} onChange={(e) => {
                try { setDraft((p) => ({ ...p, steps: JSON.parse(e.target.value) })); } catch {}
              }} />
              <div className="flex gap-2">
                <UptoButton type="submit">Create</UptoButton>
                <UptoButton type="button" variant="secondary" onClick={() => setShowCreate(false)}>Cancel</UptoButton>
              </div>
            </form>
          </UptoCard>
        </section>
      )}
    </UptoPage>
  );
};

export default Sequences;

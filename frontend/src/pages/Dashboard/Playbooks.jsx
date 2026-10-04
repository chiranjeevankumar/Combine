import React, { useEffect, useState } from "react";
import { playbookService } from "@/services";
import { useUptoStyles, UptoPage, UptoHero, UptoSectionHeading, UptoButton, UptoInput, UptoTextarea, UptoSelect, UptoBadge, UptoSpinner, UptoError, UptoEmptyState, UptoCard } from "@/components/UI/UptoHooks";
import { BookOpen, Plus, Trash2, CheckCircle, AlertTriangle, HelpCircle, Lightbulb, Download } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/context/AuthContext";

const CATEGORY_LABELS = { general: "General", competitor: "Competitor", objection: "Objection", discovery: "Discovery", closing: "Closing", follow_up: "Follow-up" };
const STEP_ICONS = { question: HelpCircle, tip: Lightbulb, warning: AlertTriangle, checklist: CheckCircle, text: BookOpen };

const Playbooks = () => {
  const { isMember } = useAuth();
  const s = useUptoStyles();
  const { darkMode } = s;
  const [tab, setTab] = useState("library");
  const [items, setItems] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const [draft, setDraft] = useState({ name: "", description: "", category: "general", tags: "" });
  const [steps, setSteps] = useState([{ title: "", content: "", type: "text" }]);

  const load = async () => {
    setLoading(true);
    try {
      const [p, t] = await Promise.all([playbookService.list(), playbookService.templates()]);
      setItems(p || []);
      setTemplates(t || []);
    } catch (e) { setError(e.message); }
    finally { setLoading(false); }
  };
  useEffect(() => { load(); }, []);

  const create = async (e) => {
    e.preventDefault();
    try {
      await playbookService.create({
        ...draft,
        steps: steps.filter((s) => s.title).map((s, i) => ({ ...s, position: i })),
      });
      toast.success("Playbook created");
      setShowCreate(false);
      setDraft({ name: "", description: "", category: "general", tags: "" });
      setSteps([{ title: "", content: "", type: "text" }]);
      load();
    } catch (err) { toast.error(err.message); }
  };
  const installTemplate = async (name) => {
    try { await playbookService.installTemplate(name); toast.success("Template installed"); load(); }
    catch (e) { toast.error(e.message); }
  };
  const remove = async (id) => {
    if (!confirm("Delete this playbook?")) return;
    try { await playbookService.remove(id); load(); }
    catch (e) { toast.error(e.message); }
  };

  return (
    <UptoPage>
      <UptoHero title="Sales Playbooks" subtitle="Battle cards, discovery frameworks, and objection handlers." darkMode={darkMode}
        actions={isMember && <UptoButton onClick={() => setShowCreate(true)}><Plus className="h-4 w-4" /> New Playbook</UptoButton>}
      />

      <section>
        <div className="mb-4 flex items-center gap-2">
          {["library", "templates"].map((t) => (
            <button key={t} onClick={() => setTab(t)} className={`rounded-lg px-3 py-1.5 text-sm font-medium capitalize ${tab === t ? "bg-[#00b5ad] text-white" : s.body + " " + (darkMode ? "hover:bg-slate-800" : "hover:bg-slate-100")}`}>
              {t === "library" ? `Library (${items.length})` : `Templates (${templates.length})`}
            </button>
          ))}
        </div>

        {loading ? <UptoSpinner /> : error ? <UptoError error={error} onRetry={load} /> : tab === "library" ? (
          items.length === 0 ? (
            <UptoCard><UptoEmptyState icon={BookOpen} title="No playbooks yet" body="Install a template or create your own playbook." /></UptoCard>
          ) : (
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              {items.map((pb) => (
                <UptoCard key={pb.id}>
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold ${s.heading}`}>{pb.name}</h3>
                        <UptoBadge tone="info">{CATEGORY_LABELS[pb.category] || pb.category}</UptoBadge>
                      </div>
                      {pb.description && <p className={`mt-1 text-sm ${s.body} line-clamp-2`}>{pb.description}</p>}
                    </div>
                    {isMember && <UptoButton variant="ghost" onClick={() => remove(pb.id)} className="text-red-500"><Trash2 className="h-4 w-4" /></UptoButton>}
                  </div>
                  <p className={`text-xs ${s.muted}`}>{pb._count?.steps || 0} steps · by {pb.createdBy?.name || "—"}</p>
                </UptoCard>
              ))}
            </div>
          )
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
            {templates.map((t) => {
              const accent = { competitor: "amber", objection: "red", discovery: "blue", closing: "emerald", follow_up: "brand" }[t.category] || "info";
              return (
                <UptoCard key={t.name}>
                  <div className="mb-2 flex items-start justify-between">
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className={`font-semibold ${s.heading}`}>{t.name}</h3>
                        <UptoBadge tone={accent}>{CATEGORY_LABELS[t.category] || t.category}</UptoBadge>
                      </div>
                      {t.description && <p className={`mt-1 text-sm ${s.body}`}>{t.description}</p>}
                    </div>
                  </div>
                  <div className="mb-3 space-y-1">
                    {t.steps.slice(0, 3).map((step, i) => {
                      const Icon = STEP_ICONS[step.type] || BookOpen;
                      return (
                        <div key={i} className={`flex items-center gap-2 rounded-lg p-2 text-xs ${darkMode ? "bg-slate-800/50" : "bg-slate-50"}`}>
                          <Icon className="h-3 w-3 text-[#00b5ad]" />
                          <span className={`font-medium ${s.heading}`}>{step.title}</span>
                          <span className={`truncate ${s.muted}`}>{step.content?.slice(0, 50)}</span>
                        </div>
                      );
                    })}
                    {t.steps.length > 3 && <p className={`text-xs ${s.muted}`}>+{t.steps.length - 3} more steps</p>}
                  </div>
                  {isMember && <UptoButton onClick={() => installTemplate(t.name)} className="w-full"><Download className="h-4 w-4" /> Install Template</UptoButton>}
                </UptoCard>
              );
            })}
          </div>
        )}
      </section>

      {showCreate && (
        <section>
          <UptoCard>
            <h3 className={`text-base font-semibold mb-4 ${s.heading}`}>New Playbook</h3>
            <form onSubmit={create} className="space-y-3">
              <UptoInput label="Name *" value={draft.name} onChange={(e) => setDraft((p) => ({ ...p, name: e.target.value }))} required />
              <UptoTextarea label="Description" value={draft.description} onChange={(e) => setDraft((p) => ({ ...p, description: e.target.value }))} />
              <div className="grid grid-cols-1 gap-3 md:grid-cols-2">
                <UptoSelect label="Category" value={draft.category} onChange={(e) => setDraft((p) => ({ ...p, category: e.target.value }))}>
                  {Object.entries(CATEGORY_LABELS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                </UptoSelect>
                <UptoInput label="Tags (comma-separated)" value={draft.tags} onChange={(e) => setDraft((p) => ({ ...p, tags: e.target.value }))} />
              </div>
              <div>
                <p className={`mb-2 text-sm font-medium ${s.body}`}>Steps</p>
                {steps.map((step, idx) => (
                  <div key={idx} className="space-y-2 mb-3 rounded-xl border p-3" style={{ borderColor: darkMode ? "#334155" : "#e2e8f0" }}>
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-7"><UptoInput placeholder="Step title" value={step.title} onChange={(e) => { const s = [...steps]; s[idx].title = e.target.value; setSteps(s); }} /></div>
                      <div className="col-span-3">
                        <UptoSelect value={step.type} onChange={(e) => { const s = [...steps]; s[idx].type = e.target.value; setSteps(s); }}>
                          <option value="text">Text</option>
                          <option value="tip">Tip</option>
                          <option value="question">Question</option>
                          <option value="checklist">Checklist</option>
                          <option value="warning">Warning</option>
                        </UptoSelect>
                      </div>
                      <div className="col-span-2 flex items-center">
                        {steps.length > 1 && <UptoButton variant="ghost" onClick={() => setSteps(steps.filter((_, i) => i !== idx))} className="text-red-500"><Trash2 className="h-4 w-4" /></UptoButton>}
                      </div>
                    </div>
                    <UptoTextarea placeholder="Step content" rows={2} value={step.content} onChange={(e) => { const s = [...steps]; s[idx].content = e.target.value; setSteps(s); }} />
                  </div>
                ))}
                <UptoButton variant="secondary" onClick={() => setSteps([...steps, { title: "", content: "", type: "text" }])} className="mt-2"><Plus className="h-4 w-4" /> Add Step</UptoButton>
              </div>
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

export default Playbooks;

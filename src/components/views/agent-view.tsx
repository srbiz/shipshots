"use client";

import { Ban, Bot, ExternalLink, KeyRound, Pencil, Plus, Terminal, Trash2 } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { api, errMsg } from "@/lib/client/api";
import { timeAgo } from "@/lib/export-paths";
import type { ApiKeyDTO } from "@/lib/types";
import { Badge, Button, Card, CodeBlock, ConfirmDialog, CopyButton, EmptyState, Field, Input, Menu, Modal, PageHeader, Segmented, Select } from "../ui";

type ProjectLite = { id: string; name: string };

const ENDPOINTS: [string, string, string][] = [
  ["POST", "/assets", "Upload a simulator/emulator capture (multipart, base64 JSON or raw)"],
  ["POST", "/projects", "Create an app project"],
  ["POST", "/projects/:id/screenshots", "Create a screenshot (headline, subheadline, layout, assetId | mock, templateId)"],
  ["PATCH", "/screenshots/:id", "Update copy, screen, layout, background, device…"],
  ["PUT", "/projects/:id/screenshots/order", "Reorder the set"],
  ["POST", "/projects/:id/apply-template", "Restyle every screenshot with a template"],
  ["GET", "/screenshots/:id/render", "Render one PNG/JPEG (?size=iphone-69&save=1)"],
  ["POST", "/projects/:id/render", "Render all sizes → ZIP (fastlane layout)"],
  ["PATCH", "/videos/:id", "Configure preview video scenes & end card"],
  ["GET", "/exports", "List rendered files; GET /exports/:id/download"],
  ["GET", "/catalog", "Sizes, devices, layouts, mocks, fonts"],
];

export function AgentView({ initialKeys, projects }: { initialKeys: ApiKeyDTO[]; projects: ProjectLite[] }) {
  const [keys, setKeys] = useState(initialKeys);
  const [origin, setOrigin] = useState("http://localhost:3000");
  const [creating, setCreating] = useState(false);
  const [newToken, setNewToken] = useState<string | null>(null);
  const [renaming, setRenaming] = useState<ApiKeyDTO | null>(null);
  const [toDelete, setToDelete] = useState<ApiKeyDTO | null>(null);
  const [lang, setLang] = useState<"curl" | "node" | "agent">("curl");
  const [projectId, setProjectId] = useState(projects[0]?.id ?? "<project-id>");

  useEffect(() => {
    setOrigin(window.location.origin);
  }, []);

  const revoke = async (k: ApiKeyDTO) => {
    const snapshot = keys;
    setKeys((x) => x.map((y) => (y.id === k.id ? { ...y, revokedAt: new Date().toISOString() } : y)));
    try {
      await api(`keys/${k.id}`, { method: "PATCH", body: { revoked: true } });
      toast.success(`Revoked “${k.name}”`);
    } catch (e) {
      setKeys(snapshot);
      toast.error(errMsg(e));
    }
  };
  const remove = async (k: ApiKeyDTO) => {
    const snapshot = keys;
    setKeys((x) => x.filter((y) => y.id !== k.id));
    try {
      await api(`keys/${k.id}`, { method: "DELETE" });
      toast.success("Key deleted");
    } catch (e) {
      setKeys(snapshot);
      toast.error(errMsg(e));
    }
  };

  const base = `${origin}/api/v1`;
  const snippets = {
    curl: `export SHIPSHOTS_URL=${origin}
export SHIPSHOTS_KEY=ss_live_…   # create one above
export PROJECT=${projectId}

# 1. Capture the current simulator screen and upload it
xcrun simctl io booted screenshot /tmp/home.png
ASSET=$(curl -s -X POST $SHIPSHOTS_URL/api/v1/assets \\
  -H "Authorization: Bearer $SHIPSHOTS_KEY" \\
  -F file=@/tmp/home.png -F projectId=$PROJECT | jq -r .id)

# 2. Create a framed screenshot with marketing copy
SHOT=$(curl -s -X POST $SHIPSHOTS_URL/api/v1/projects/$PROJECT/screenshots \\
  -H "Authorization: Bearer $SHIPSHOTS_KEY" -H "content-type: application/json" \\
  -d "{\\"headline\\":\\"Ship *faster*\\",\\"subheadline\\":\\"One-tap releases\\",\\"assetId\\":\\"$ASSET\\"}" | jq -r .id)

# 3. Render a single PNG, or every store size as a fastlane-ready ZIP
curl -o shot.png "$SHIPSHOTS_URL/api/v1/screenshots/$SHOT/render?size=iphone-69" -H "Authorization: Bearer $SHIPSHOTS_KEY"
curl -X POST $SHIPSHOTS_URL/api/v1/projects/$PROJECT/render -H "Authorization: Bearer $SHIPSHOTS_KEY" \\
  -H "content-type: application/json" -d '{"layout":"fastlane"}' -o store.zip && unzip -o store.zip`,
    node: `// scripts/store-screenshots.mjs — run after UI changes
import { readFile, writeFile } from "node:fs/promises";

const BASE = process.env.SHIPSHOTS_URL ?? "${origin}";
const headers = { Authorization: \`Bearer \${process.env.SHIPSHOTS_KEY}\` };
const project = "${projectId}";

const { screenshots } = await fetch(\`\${BASE}/api/v1/projects/\${project}\`, { headers }).then((r) => r.json());

// swap screen #1 for a fresh capture
const form = new FormData();
form.append("file", new Blob([await readFile("captures/home.png")]), "home.png");
form.append("projectId", project);
const asset = await fetch(\`\${BASE}/api/v1/assets\`, { method: "POST", headers, body: form }).then((r) => r.json());
await fetch(\`\${BASE}/api/v1/screenshots/\${screenshots[0].id}\`, {
  method: "PATCH",
  headers: { ...headers, "content-type": "application/json" },
  body: JSON.stringify({ assetId: asset.id }),
});

const zip = await fetch(\`\${BASE}/api/v1/projects/\${project}/render\`, {
  method: "POST",
  headers: { ...headers, "content-type": "application/json" },
  body: JSON.stringify({ layout: "fastlane", sizes: ["iphone-69", "ipad-13", "android-phone", "play-feature"] }),
});
await writeFile("store.zip", Buffer.from(await zip.arrayBuffer()));`,
    agent: `## Store screenshots (add to CLAUDE.md / AGENTS.md)
ShipShots runs as a separate local server at ${origin} (key in $SHIPSHOTS_KEY,
project id ${projectId}). Docs for you: ${origin}/llms.txt

When a user-facing screen changes:
1. Boot the simulator, open the screen and run
   \`xcrun simctl io booted screenshot /tmp/<screen>.png\` (Android: \`adb exec-out screencap -p\`).
2. Upload: POST ${base}/assets (multipart: file, projectId).
3. PATCH ${base}/screenshots/<id> with {"assetId": "<asset id>"} — keep the headline
   under 6 words and wrap one key word in *asterisks* to highlight it.
4. Render: POST ${base}/projects/${projectId}/render {"layout":"fastlane"} -o store.zip,
   unzip at the repo root, then run \`fastlane deliver\` / \`fastlane supply\`.
Never commit the API key.`,
  };

  return (
    <div className="mx-auto max-w-6xl px-4 py-8 sm:px-8">
      <PageHeader
        eyebrow="Integrations"
        title="Agent API"
        description="ShipShots runs as its own local server next to your mobile project. Coding agents and CI jobs drive it over REST."
        actions={
          <>
            <a href="/llms.txt" target="_blank" className="inline-flex h-9 items-center gap-2 rounded-lg bg-white/[0.06] px-3.5 text-sm font-medium text-zinc-100 ring-1 ring-inset ring-white/[0.08] hover:bg-white/[0.1]">
              llms.txt <ExternalLink className="size-3.5" />
            </a>
            <Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>
              Create API key
            </Button>
          </>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <Card className="overflow-hidden">
          <div className="flex items-center justify-between border-b border-white/[0.06] px-5 py-4">
            <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
              <KeyRound className="size-4 text-indigo-300" /> API keys
            </h2>
            <span className="text-xs text-zinc-500">{keys.filter((k) => !k.revokedAt).length} active</span>
          </div>
          {keys.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={<KeyRound />} title="No API keys" description="Create a key for each agent or CI job so you can revoke them independently." action={<Button variant="primary" icon={<Plus />} onClick={() => setCreating(true)}>Create API key</Button>} />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm">
                <thead className="text-[11px] uppercase tracking-wider text-zinc-500">
                  <tr className="border-b border-white/[0.06]">
                    <th className="px-5 py-2.5 font-medium">Name</th>
                    <th className="px-3 py-2.5 font-medium">Key</th>
                    <th className="px-3 py-2.5 font-medium">Last used</th>
                    <th className="px-3 py-2.5 font-medium">Status</th>
                    <th className="w-10 px-3" />
                  </tr>
                </thead>
                <tbody>
                  {keys.map((k) => (
                    <tr key={k.id} className="border-b border-white/[0.04] last:border-0">
                      <td className="px-5 py-3">
                        <div className="font-medium text-zinc-200">{k.name}</div>
                        <div className="text-[11px] text-zinc-500">Created {timeAgo(k.createdAt)}</div>
                      </td>
                      <td className="px-3 py-3 font-mono text-xs text-zinc-400">{k.prefix}…</td>
                      <td className="px-3 py-3 text-xs text-zinc-400">{timeAgo(k.lastUsedAt)}</td>
                      <td className="px-3 py-3">{k.revokedAt ? <Badge tone="red">Revoked</Badge> : <Badge tone="green">Active</Badge>}</td>
                      <td className="px-3 py-3">
                        <Menu
                          items={[
                            { label: "Rename", icon: <Pencil />, onClick: () => setRenaming(k) },
                            ...(!k.revokedAt ? [{ label: "Revoke", icon: <Ban />, danger: true, onClick: () => revoke(k) }] : [{ label: "Delete", icon: <Trash2 />, danger: true, onClick: () => setToDelete(k) }]),
                          ]}
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </Card>

        <Card className="p-5">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Terminal className="size-4 text-emerald-300" /> Run beside your app
          </h2>
          <p className="mt-2 text-xs leading-relaxed text-zinc-400">Keep ShipShots in your repo (e.g. <code className="text-zinc-300">tools/shipshots</code>) and start it on its own port so it never collides with Metro or Vite.</p>
          <CodeBlock className="mt-3" code={`cd tools/shipshots\nnpm install && npm run build\nPORT=4545 npm start`} />
          <div className="mt-4 flex items-center justify-between rounded-lg bg-white/[0.03] px-3 py-2 ring-1 ring-inset ring-white/[0.06]">
            <div className="min-w-0">
              <div className="text-[11px] text-zinc-500">Base URL</div>
              <div className="truncate font-mono text-xs text-zinc-200">{base}</div>
            </div>
            <CopyButton text={base} />
          </div>
        </Card>
      </div>

      <Card className="mt-6 p-5">
        <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-white">
            <Bot className="size-4 text-violet-300" /> Quickstart
          </h2>
          <div className="flex flex-wrap items-center gap-2">
            {projects.length > 0 && (
              <Select value={projectId} onChange={(e) => setProjectId(e.target.value)} className="h-8 w-44 text-xs">
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </Select>
            )}
            <Segmented
              value={lang}
              onChange={setLang}
              options={[
                { value: "curl", label: "Shell" },
                { value: "node", label: "Node" },
                { value: "agent", label: "Agent prompt" },
              ]}
            />
          </div>
        </div>
        <CodeBlock code={snippets[lang]} />
      </Card>

      <Card className="mt-6 overflow-hidden">
        <div className="border-b border-white/[0.06] px-5 py-4">
          <h2 className="text-sm font-semibold text-white">Endpoint reference</h2>
          <p className="mt-0.5 text-xs text-zinc-500">
            All endpoints accept <code className="text-zinc-300">Authorization: Bearer &lt;key&gt;</code>. Full machine-readable index at <code className="text-zinc-300">GET /api/v1</code>.
          </p>
        </div>
        <ul className="divide-y divide-white/[0.04]">
          {ENDPOINTS.map(([m, p, d]) => (
            <li key={m + p} className="flex flex-col gap-1 px-5 py-3 sm:flex-row sm:items-center sm:gap-4">
              <span className={`w-14 font-mono text-[11px] font-semibold ${m === "GET" ? "text-emerald-300" : m === "POST" ? "text-indigo-300" : m === "PATCH" ? "text-amber-300" : "text-cyan-300"}`}>{m}</span>
              <code className="font-mono text-xs text-zinc-200 sm:w-80">/api/v1{p}</code>
              <span className="text-xs text-zinc-500">{d}</span>
            </li>
          ))}
        </ul>
      </Card>

      {creating && (
        <CreateKeyModal
          onClose={() => setCreating(false)}
          onCreated={(k, token) => {
            setKeys((x) => [k, ...x]);
            setNewToken(token);
          }}
        />
      )}
      <Modal open={!!newToken} onClose={() => setNewToken(null)} size="md" title="Copy your API key" description="This is the only time the full key is shown. Store it in your shell profile or secrets manager.">
        {newToken && (
          <div className="space-y-4">
            <div className="flex items-center gap-2 rounded-lg bg-black/40 p-3 ring-1 ring-inset ring-emerald-400/30">
              <code className="flex-1 break-all font-mono text-xs text-emerald-300">{newToken}</code>
              <CopyButton text={newToken} label="Copy" />
            </div>
            <CodeBlock code={`export SHIPSHOTS_URL=${origin}\nexport SHIPSHOTS_KEY=${newToken}`} />
          </div>
        )}
      </Modal>
      {renaming && <RenameKeyModal k={renaming} onClose={() => setRenaming(null)} onSaved={(k) => setKeys((x) => x.map((y) => (y.id === k.id ? k : y)))} />}
      <ConfirmDialog open={!!toDelete} onClose={() => setToDelete(null)} title="Delete revoked key?" description="It will be removed from the list permanently." onConfirm={() => (toDelete ? remove(toDelete) : undefined)} />
    </div>
  );
}

function CreateKeyModal({ onClose, onCreated }: { onClose: () => void; onCreated: (k: ApiKeyDTO, token: string) => void }) {
  const [name, setName] = useState("Claude Code");
  const [busy, setBusy] = useState(false);
  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      const res = await api<{ key: ApiKeyDTO; token: string }>("keys", { body: { name } });
      onCreated(res.key, res.token);
      onClose();
    } catch (err) {
      toast.error(errMsg(err));
    } finally {
      setBusy(false);
    }
  };
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Create API key"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button variant="primary" type="submit" form="key-form" loading={busy}>
            Create key
          </Button>
        </>
      }
    >
      <form id="key-form" onSubmit={submit}>
        <Field label="Name" hint="Which agent, machine or CI job will use it?">
          <Input required autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
        </Field>
      </form>
    </Modal>
  );
}

function RenameKeyModal({ k, onClose, onSaved }: { k: ApiKeyDTO; onClose: () => void; onSaved: (k: ApiKeyDTO) => void }) {
  const [name, setName] = useState(k.name);
  const [busy, setBusy] = useState(false);
  return (
    <Modal
      open
      onClose={onClose}
      size="sm"
      title="Rename key"
      footer={
        <>
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            loading={busy}
            onClick={async () => {
              setBusy(true);
              onSaved({ ...k, name });
              try {
                onSaved(await api<ApiKeyDTO>(`keys/${k.id}`, { method: "PATCH", body: { name } }));
                onClose();
              } catch (e) {
                onSaved(k);
                toast.error(errMsg(e));
              } finally {
                setBusy(false);
              }
            }}
          >
            Save
          </Button>
        </>
      }
    >
      <Input autoFocus value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
    </Modal>
  );
}

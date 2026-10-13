"use client";

import { useMemo, useState } from "react";
import { DEFAULT_SPEC, normalizeSpec, type ScreenshotSpec, type TemplateDTO } from "@/lib/types";
import { ShotCanvas } from "./shot-canvas";
import { Badge, Button, cn, Modal, Segmented } from "./ui";

export function TemplatePickerModal({
  open,
  onClose,
  templates,
  sample,
  sizeId,
  title = "Choose a template",
  description,
  confirmLabel = "Apply template",
  onPick,
  appName,
  brandColor,
}: {
  open: boolean;
  onClose: () => void;
  templates: TemplateDTO[];
  sample?: ScreenshotSpec;
  sizeId: string;
  title?: string;
  description?: string;
  confirmLabel?: string;
  onPick: (t: TemplateDTO) => Promise<void> | void;
  appName?: string;
  brandColor?: string;
}) {
  const [selected, setSelected] = useState<string | null>(null);
  const [filter, setFilter] = useState<"all" | "builtin" | "mine">("all");
  const [busy, setBusy] = useState(false);
  const list = useMemo(() => templates.filter((t) => filter === "all" || (filter === "builtin" ? t.isBuiltin : !t.isBuiltin)), [templates, filter]);
  const base = sample ?? DEFAULT_SPEC;
  return (
    <Modal
      open={open}
      onClose={onClose}
      size="xl"
      title={title}
      description={description}
      footer={
        <>
          <Segmented
            className="mr-auto"
            value={filter}
            onChange={setFilter}
            options={[
              { value: "all", label: "All" },
              { value: "builtin", label: "Built-in" },
              { value: "mine", label: "Mine" },
            ]}
          />
          <Button variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            disabled={!selected}
            loading={busy}
            onClick={async () => {
              const t = templates.find((x) => x.id === selected);
              if (!t) return;
              setBusy(true);
              try {
                await onPick(t);
                onClose();
              } finally {
                setBusy(false);
              }
            }}
          >
            {confirmLabel}
          </Button>
        </>
      }
    >
      <div className="grid grid-cols-2 gap-4 sm:grid-cols-4 lg:grid-cols-6">
        {list.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setSelected(t.id)}
            onDoubleClick={() => setSelected(t.id)}
            className={cn("group rounded-xl p-1.5 text-left ring-2 transition", selected === t.id ? "bg-indigo-500/10 ring-indigo-400" : "ring-transparent hover:bg-white/[0.03]")}
          >
            <ShotCanvas spec={normalizeSpec({ ...base, ...t.spec })} sizeId={sizeId} appName={appName} brandColor={brandColor} />
            <div className="mt-2 flex items-center justify-between gap-1 px-0.5">
              <span className="truncate text-xs font-medium text-zinc-200">{t.name}</span>
              {!t.isBuiltin && <Badge tone="violet">Mine</Badge>}
            </div>
          </button>
        ))}
        {list.length === 0 && <p className="col-span-full py-10 text-center text-sm text-zinc-500">No templates in this filter yet.</p>}
      </div>
    </Modal>
  );
}

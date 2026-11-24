"use client";

import { useRef, useState } from "react";
import * as XLSX from "xlsx";
import CardEditor, { CardEditorHandle, TextElement } from "@/components/CardEditor";

type Row = Record<string, unknown>;

interface CardSlot {
  id: number;
  image: string | null;
  element: TextElement | null;
  fileName: string;
  ref: React.RefObject<CardEditorHandle | null>;
}

let slotCounter = 0;
const makeSlot = (): CardSlot => ({
  id: ++slotCounter,
  image: null,
  element: null,
  fileName: "card",
  ref: { current: null },
});

export default function BatchProcessor() {
  const [slots, setSlots] = useState<CardSlot[]>([makeSlot()]);
  // keep latest element per slot in a ref so the loop reads current values
  const elementRefs = useRef<Map<number, TextElement | null>>(new Map());

  const [rows, setRows] = useState<Row[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [nameKey, setNameKey] = useState("");
  const [fileNameKey, setFileNameKey] = useState("");
  const [excelName, setExcelName] = useState("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState("");
  const [format, setFormat] = useState<"png" | "pdf">("pdf");

  const updateSlot = (id: number, patch: Partial<Omit<CardSlot, "id" | "ref">>) => {
    setSlots((prev) =>
      prev.map((s) => {
        if ("element" in patch && patch.element !== null) {
          // placing a text box — clear it from all other slots
          if (s.id !== id) {
            elementRefs.current.set(s.id, null);
            return { ...s, element: null };
          }
        }
        if (s.id !== id) return s;
        if ("element" in patch) elementRefs.current.set(id, patch.element ?? null);
        return { ...s, ...patch };
      })
    );
  };

  const addSlot = () => setSlots((prev) => [...prev, makeSlot()]);

  const removeSlot = (id: number) => {
    elementRefs.current.delete(id);
    setSlots((prev) => prev.filter((s) => s.id !== id));
  };

  const handleExcel = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheet = workbook.Sheets[workbook.SheetNames[0]];
      const json = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
      if (!json.length) { setMessage("No rows found in the sheet."); return; }
      const keys = Object.keys(json[0]);
      const candidate = keys.find((k) => k.toLowerCase().includes("name")) ?? keys[0] ?? "";
      setRows(json);
      setColumns(keys);
      setNameKey(candidate);
      setFileNameKey("");
      setExcelName(file.name);
      setMessage(`Loaded ${json.length} rows from "${file.name}".`);
      setProgress(0);
      setTotal(0);
    } catch {
      setMessage("Could not read that file. Please use a valid .xlsx or .xls file.");
    }
  };

  const sanitize = (v: string) => v.replace(/[\\/:*?"<>|]/g, "").trim() || "card";

  // Render a slot to dataUrl — if no text element, just render the plain image
  const renderSlot = (slot: CardSlot, name: string): string | null => {
    if (!slot.ref.current) return null;
    const el = elementRefs.current.get(slot.id) ?? slot.element;
    // slot has a text element → render with name; otherwise render image as-is
    const override = el ? { ...el, text: name } : undefined;
    return slot.ref.current.exportCard(override);
  };

  const handleProcess = async () => {
    if (!rows) { setMessage("Upload an Excel file first."); return; }
    const activeSlots = slots.filter((s) => s.image);
    if (!activeSlots.length) { setMessage("Upload at least one card image."); return; }
    const hasTextSlot = activeSlots.some((s) => s.element || elementRefs.current.get(s.id));
    if (!hasTextSlot) { setMessage("Click on at least one card image to place the text box."); return; }

    setProcessing(true);
    setMessage("");
    setProgress(0);
    setTotal(rows.length);

    let count = 0;

    if (format === "pdf") {
      const { jsPDF } = await import("jspdf");

      for (const row of rows) {
        const name = String(row[nameKey] ?? "").trim();
        if (!name) continue;

        const rawFileName = fileNameKey ? String(row[fileNameKey] ?? "").trim() : "";
        const saveAs = sanitize(rawFileName || name);

        let pdf: InstanceType<typeof jsPDF> | null = null;

        for (const slot of activeSlots) {
          const dataUrl = renderSlot(slot, name);
          if (!dataUrl) continue;

          const img = new Image();
          await new Promise<void>((res) => { img.onload = () => res(); img.src = dataUrl; });
          const w = img.naturalWidth, h = img.naturalHeight;

          if (!pdf) {
            pdf = new jsPDF({ orientation: w >= h ? "landscape" : "portrait", unit: "px", format: [w, h] });
          } else {
            pdf.addPage([w, h], w >= h ? "landscape" : "portrait");
          }
          pdf.addImage(dataUrl, "PNG", 0, 0, w, h);
        }

        if (pdf) { pdf.save(`${saveAs}.pdf`); count++; }
        setProgress(count);
      }
    } else {
      for (const row of rows) {
        const name = String(row[nameKey] ?? "").trim();
        if (!name) continue;

        const rawFileName = fileNameKey ? String(row[fileNameKey] ?? "").trim() : "";
        const saveAs = sanitize(rawFileName || name);

        for (let i = 0; i < activeSlots.length; i++) {
          const slot = activeSlots[i];
          const suffix = activeSlots.length > 1 ? `_${i + 1}` : "";
          const el = elementRefs.current.get(slot.id) ?? slot.element;
          const override = el ? { ...el, text: name } : undefined;
          await slot.ref.current?.saveCard(`${saveAs}${suffix}.png`, override);
        }
        count++;
        setProgress(count);
      }
    }

    setProcessing(false);
    setMessage(`Done. Exported ${count} ${format === "pdf" ? "PDF" : "image"}${count === 1 ? "" : "s"}.`);
  };

  return (
    <div className="space-y-6">
      {/* Card slots */}
      {slots.map((slot, idx) => (
        <div key={slot.id} className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
          <div className="mb-3 flex items-center justify-between">
            <h3 className="text-sm font-semibold">
              {slots.length > 1 ? `Page ${idx + 1}` : "1. Card image"}
            </h3>
            {slots.length > 1 && (
              <button onClick={() => removeSlot(slot.id)} className="text-xs text-red-500 hover:text-red-700">
                Remove
              </button>
            )}
          </div>
          <p className="mb-3 text-xs text-zinc-500">
            Upload the image.{" "}
            {slots.length > 1
              ? "Click on it to place the name — or leave it as-is if this page has no name."
              : "Then click on the spot where the name should go."}
          </p>
          <CardEditor
            ref={slot.ref}
            image={slot.image}
            element={slot.element}
            onImageChange={(v) => updateSlot(slot.id, { image: v })}
            onElementChange={(v) => updateSlot(slot.id, { element: v })}
            fileName={slot.fileName}
            onFileNameChange={(v) => updateSlot(slot.id, { fileName: v })}
          />
        </div>
      ))}

      <button
        onClick={addSlot}
        className="w-full rounded-2xl border-2 border-dashed border-zinc-300 py-3 text-sm text-zinc-500 hover:border-zinc-400 hover:text-zinc-700 dark:border-zinc-700 dark:hover:border-zinc-500"
      >
        + Add another page / image
      </button>

      {/* Excel */}
      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="mb-1 text-sm font-semibold">2. Excel file with names</h3>
        <p className="mb-3 text-xs text-zinc-500">
          One row = one person. Each person gets a PDF with all pages, name placed only on pages where you set a text box.
        </p>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleExcel(f); e.target.value = ""; }}
          className="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700 dark:file:bg-white dark:file:text-zinc-900"
        />
        {excelName && <p className="mt-2 text-xs text-zinc-500">Selected: {excelName}</p>}
        {columns.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <label className="text-zinc-600 dark:text-zinc-400">Name column (on card):</label>
            <select value={nameKey} onChange={(e) => setNameKey(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800">
              {columns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="ml-2 text-zinc-600 dark:text-zinc-400">File name column:</label>
            <select value={fileNameKey} onChange={(e) => setFileNameKey(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800">
              <option value="">(same as name)</option>
              {columns.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {rows && <span className="text-xs text-zinc-500">{rows.length} rows</span>}
          </div>
        )}
      </div>

      {/* Generate */}
      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="mb-1 text-sm font-semibold">3. Generate</h3>
        <p className="mb-3 text-xs text-zinc-500">
          PDF: one PDF per person with all pages. PNG: one image per page per person.
        </p>
        <div className="mb-3 flex items-center gap-3">
          <span className="text-sm text-zinc-600 dark:text-zinc-400">Format:</span>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="radio" checked={format === "pdf"} onChange={() => setFormat("pdf")} /> PDF
          </label>
          <label className="flex items-center gap-1.5 text-sm">
            <input type="radio" checked={format === "png"} onChange={() => setFormat("png")} /> PNG
          </label>
        </div>
        <button
          onClick={handleProcess}
          disabled={processing || !rows}
          className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {processing ? `Generating… (${progress}/${total})` : format === "pdf" ? "Generate & Download PDFs" : "Generate & Download all"}
        </button>
        {total > 0 && progress > 0 && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div className="h-full rounded-full bg-emerald-500 transition-all" style={{ width: `${(progress / total) * 100}%` }} />
          </div>
        )}
        {message && <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">{message}</p>}
      </div>
    </div>
  );
}

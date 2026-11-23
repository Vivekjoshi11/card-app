"use client";

import { useEffect, useRef, useState } from "react";
import * as XLSX from "xlsx";
import CardEditor, { CardEditorHandle, TextElement } from "@/components/CardEditor";

type Row = Record<string, unknown>;

export default function BatchProcessor() {
  const editorRef = useRef<CardEditorHandle>(null);
  const elementRef = useRef<TextElement | null>(null);
  const [image, setImage] = useState<string | null>(null);
  const [element, setElement] = useState<TextElement | null>(null);
  const [fileName, setFileName] = useState("card");
  const [rows, setRows] = useState<Row[] | null>(null);
  const [columns, setColumns] = useState<string[]>([]);
  const [nameKey, setNameKey] = useState<string>("");
  const [fileNameKey, setFileNameKey] = useState<string>("");
  const [excelName, setExcelName] = useState<string>("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [total, setTotal] = useState(0);
  const [message, setMessage] = useState("");

  useEffect(() => {
    elementRef.current = element;
  }, [element]);

  const handleExcel = async (file: File) => {
    try {
      const buffer = await file.arrayBuffer();
      const workbook = XLSX.read(buffer, { type: "array" });
      const sheetName = workbook.SheetNames[0];
      const sheet = workbook.Sheets[sheetName];
      const json = XLSX.utils.sheet_to_json<Row>(sheet, { defval: "" });
      if (!json.length) {
        setMessage("No rows found in the sheet.");
        return;
      }
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
    } catch (err) {
      console.error(err);
      setMessage("Could not read that file. Please use a valid .xlsx or .xls file.");
    }
  };

  const sanitize = (value: string) => value.replace(/[\\/:*?"<>|]/g, "").trim() || "card";

  const handleProcess = async () => {
    if (!rows || !editorRef.current) {
      setMessage("Upload a card image and place the text box first.");
      return;
    }
    if (!image || !element) {
      setMessage("Upload a card image and click on it to place the text box first.");
      return;
    }
    setProcessing(true);
    setMessage("");
    setProgress(0);
    setTotal(rows.length);

    let count = 0;
    for (const row of rows) {
      const raw = row[nameKey];
      const name = String(raw ?? "").trim();
      if (!name) continue;

      const rawFileName = fileNameKey ? String(row[fileNameKey] ?? "").trim() : "";
      const saveAs = sanitize(rawFileName || name);

      const next: TextElement = { ...elementRef.current!, text: name };
      const ok = await editorRef.current.saveCard(`${saveAs}.png`, next);
      if (!ok) continue;

      elementRef.current = next;
      setElement(next);
      count++;
      setProgress(count);
    }

    setProcessing(false);
    setMessage(`Done. Exported ${count} image${count === 1 ? "" : "s"}.`);
  };

  const handleExcelInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void handleExcel(file);
    e.target.value = "";
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="mb-1 text-sm font-semibold">1. Card image</h3>
        <p className="mb-3 text-xs text-zinc-500">
          Upload the image, then click on the spot where the name should go.
        </p>
        <CardEditor
          ref={editorRef}
          image={image}
          element={element}
          onImageChange={setImage}
          onElementChange={setElement}
          fileName={fileName}
          onFileNameChange={setFileName}
        />
      </div>

      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="mb-1 text-sm font-semibold">2. Excel file with names</h3>
        <p className="mb-3 text-xs text-zinc-500">
          Upload an .xlsx / .xls file where one column holds the names. One image is
          generated per row.
        </p>
        <input
          type="file"
          accept=".xlsx,.xls,.csv"
          onChange={handleExcelInput}
          className="block w-full text-sm file:mr-3 file:cursor-pointer file:rounded-lg file:border-0 file:bg-zinc-900 file:px-4 file:py-1.5 file:text-sm file:font-medium file:text-white hover:file:bg-zinc-700 dark:file:bg-white dark:file:text-zinc-900"
        />
        {excelName && <p className="mt-2 text-xs text-zinc-500">Selected: {excelName}</p>}
        {columns.length > 0 && (
          <div className="mt-3 flex flex-wrap items-center gap-2 text-sm">
            <label className="text-zinc-600 dark:text-zinc-400">Name column (on card):</label>
            <select
              value={nameKey}
              onChange={(e) => setNameKey(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            >
              {columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <label className="text-zinc-600 dark:text-zinc-400 ml-2">Image file name column:</label>
            <select
              value={fileNameKey}
              onChange={(e) => setFileNameKey(e.target.value)}
              className="rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
            >
              <option value="">(same as name)</option>
              {columns.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            {rows && <span className="text-xs text-zinc-500">{rows.length} rows</span>}
          </div>
        )}
      </div>

      <div className="rounded-2xl border border-zinc-200 p-4 dark:border-zinc-700">
        <h3 className="mb-1 text-sm font-semibold">3. Generate</h3>
        <p className="mb-3 text-xs text-zinc-500">
          Each image will open a Save As dialog (or download to your default folder),
          one file per name.
        </p>
        <button
          onClick={handleProcess}
          disabled={processing || !rows}
          className="rounded-lg bg-zinc-900 px-5 py-2 text-sm font-medium text-white hover:bg-zinc-700 disabled:cursor-not-allowed disabled:opacity-50 dark:bg-white dark:text-zinc-900"
        >
          {processing ? `Generating… (${progress}/${total})` : "Generate & Download all"}
        </button>
        {total > 0 && progress > 0 && (
          <div className="mt-3 h-2 w-full overflow-hidden rounded-full bg-zinc-200 dark:bg-zinc-700">
            <div
              className="h-full rounded-full bg-emerald-500 transition-all"
              style={{ width: `${(progress / total) * 100}%` }}
            />
          </div>
        )}
        {message && <p className="mt-3 text-xs text-zinc-600 dark:text-zinc-400">{message}</p>}
      </div>
    </div>
  );
}

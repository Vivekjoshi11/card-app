"use client";

import { forwardRef, useCallback, useEffect, useImperativeHandle, useRef } from "react";

export interface TextElement {
  id: string;
  x: number;
  y: number;
  text: string;
  prefix: string;
  suffix: string;
  fontSize: number;
  color: string;
  bold: boolean;
  italic: boolean;
  fontFamily: string;
}

export interface CardEditorHandle {
  exportCard: () => string | null;
  saveCard: (filename: string) => Promise<string | null>;
}

interface CardEditorProps {
  image: string | null;
  element: TextElement | null;
  onImageChange: (value: string | null) => void;
  onElementChange: (value: TextElement | null) => void;
  fileName: string;
  onFileNameChange: (value: string) => void;
}

const FONT_OPTIONS = [
  { label: "Arial", value: "Arial, sans-serif" },
  { label: "Helvetica", value: "Helvetica, Arial, sans-serif" },
  { label: "Georgia", value: "Georgia, serif" },
  { label: "Times New Roman", value: "'Times New Roman', Times, serif" },
  { label: "Courier New", value: "'Courier New', Courier, monospace" },
  { label: "Verdana", value: "Verdana, Geneva, sans-serif" },
  { label: "Trebuchet MS", value: "'Trebuchet MS', sans-serif" },
  { label: "Impact", value: "Impact, sans-serif" },
];

let idCounter = 0;
const createId = () => `el-${Date.now()}-${idCounter++}`;

const saveDataUrl = async (dataUrl: string, filename: string): Promise<void> => {
  const blob = await (await fetch(dataUrl)).blob();
  const file = new File([blob], filename, { type: "image/png" });
  const w = window as unknown as {
    showSaveFilePicker?: (options: unknown) => Promise<{
      createWritable: () => Promise<{
        write: (d: Blob) => Promise<void>;
        close: () => Promise<void>;
      }>;
    }>;
  };
  if (typeof w.showSaveFilePicker === "function") {
    try {
      const handle = await w.showSaveFilePicker({
        suggestedName: filename,
        types: [{ description: "PNG Image", accept: { "image/png": [".png"] } }],
      });
      const writable = await handle.createWritable();
      await writable.write(file);
      await writable.close();
      return;
    } catch {
      // fall through to default download
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  setTimeout(() => URL.revokeObjectURL(url), 5000);
};

const CardEditor = forwardRef<CardEditorHandle, CardEditorProps>(
  function CardEditor(
    { image, element, onImageChange, onElementChange, fileName, onFileNameChange },
    ref
  ) {
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const imageRef = useRef<HTMLImageElement | null>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const elementRef = useRef<TextElement | null>(null);

    const render = useCallback(() => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      if (!canvas || !ctx) return;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      const img = imageRef.current;
      if (img && img.complete && img.naturalWidth > 0) {
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      }
      const el = elementRef.current;
      if (el) {
        const fullText = `${el.prefix ?? ""}${el.text ?? ""}${el.suffix ?? ""}`;
        if (fullText.trim().length > 0) {
          const fontPx = (canvas.width * el.fontSize) / 100;
          ctx.font = `${el.italic ? "italic " : ""}${el.bold ? 700 : 400} ${fontPx}px ${el.fontFamily}, Arial, sans-serif`;
          ctx.fillStyle = el.color;
          ctx.textBaseline = "top";
          ctx.fillText(fullText, (canvas.width * el.x) / 100, (canvas.height * el.y) / 100);
        }
      }
    }, []);

    useEffect(() => {
      if (!image) {
        imageRef.current = null;
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = 0;
          canvas.height = 0;
        }
        return;
      }
      const img = new Image();
      img.onload = () => {
        imageRef.current = img;
        const canvas = canvasRef.current;
        if (canvas) {
          canvas.width = img.naturalWidth;
          canvas.height = img.naturalHeight;
        }
        render();
      };
      img.src = image;
    }, [image, render]);

    useEffect(() => {
      elementRef.current = element;
      render();
    }, [element, render]);

    const exportCard = useCallback((): string | null => {
      const canvas = canvasRef.current;
      const ctx = canvas?.getContext("2d");
      const img = imageRef.current;
      const el = elementRef.current;
      if (!canvas || !ctx || !img) return null;
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      if (el) {
        const fullText = `${el.prefix ?? ""}${el.text ?? ""}${el.suffix ?? ""}`;
        if (fullText.trim().length > 0) {
          const fontPx = (canvas.width * el.fontSize) / 100;
          ctx.font = `${el.italic ? "italic " : ""}${el.bold ? 700 : 400} ${fontPx}px ${el.fontFamily}, Arial, sans-serif`;
          ctx.fillStyle = el.color;
          ctx.textBaseline = "top";
          ctx.fillText(fullText, (canvas.width * el.x) / 100, (canvas.height * el.y) / 100);
        }
      }
      return canvas.toDataURL("image/png");
    }, []);

    const saveCard = useCallback(
      async (filename: string): Promise<string | null> => {
        const dataUrl = exportCard();
        if (!dataUrl) return null;
        await saveDataUrl(dataUrl, filename);
        return dataUrl;
      },
      [exportCard]
    );

    useImperativeHandle(ref, () => ({ exportCard, saveCard }), [exportCard, saveCard]);

    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => onImageChange(typeof reader.result === "string" ? reader.result : null);
      reader.readAsDataURL(file);
      e.target.value = "";
    };

    const handleCanvasClick = (e: React.MouseEvent<HTMLCanvasElement>) => {
      const canvas = canvasRef.current;
      if (!canvas) return;
      const rect = canvas.getBoundingClientRect();
      const x = ((e.clientX - rect.left) / rect.width) * canvas.width;
      const y = ((e.clientY - rect.top) / rect.height) * canvas.height;
      const newEl: TextElement = {
        id: createId(),
        x: (x / canvas.width) * 100,
        y: (y / canvas.height) * 100,
        text: elementRef.current?.text ?? "",
        prefix: elementRef.current?.prefix ?? "",
        suffix: elementRef.current?.suffix ?? "",
        fontSize: elementRef.current?.fontSize ?? 6,
        color: elementRef.current?.color ?? "#ffffff",
        bold: elementRef.current?.bold ?? true,
        italic: elementRef.current?.italic ?? false,
        fontFamily: elementRef.current?.fontFamily ?? "Arial, sans-serif",
      };
      onElementChange(newEl);
    };

    const handleExport = async () => {
      await saveCard(`${fileName.trim() || "card"}.png`);
    };

    return (
      <div className="w-full">
        {!image ? (
          <div
            onClick={() => fileInputRef.current?.click()}
            className="flex h-64 w-full flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed border-zinc-300 bg-zinc-50 text-center dark:border-zinc-700 dark:bg-zinc-900"
          >
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />
            <p className="text-sm font-medium">Upload card image</p>
            <p className="text-xs text-zinc-500">PNG, JPG, SVG, WebP</p>
          </div>
        ) : (
          <>
            <div className="relative w-full overflow-hidden rounded-2xl border border-zinc-200 bg-zinc-100 dark:border-zinc-800">
              <canvas
                ref={canvasRef}
                onClick={handleCanvasClick}
                className="block h-auto w-full cursor-crosshair"
              />
              {element && (
                <div
                  className="absolute pointer-events-none"
                  style={{
                    left: `${element.x}%`,
                    top: `${element.y}%`,
                    transform: "translate(-50%, -50%)",
                  }}
                >
                  <div
                    className="w-3 h-3 rounded-full border-2 border-white/80 bg-zinc-500/50 shadow-lg"
                    style={{ boxShadow: "0 0 0 2px #0008" }}
                  />
                </div>
              )}
            </div>
            <div className="mt-4 flex flex-wrap items-center gap-3">
              <input
                value={fileName}
                onChange={(e) => onFileNameChange(e.target.value)}
                placeholder="File name (without extension)"
                className="flex-1 min-w-[180px] rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
              />
              <button
                onClick={handleExport}
                className="rounded-lg bg-zinc-900 px-4 py-1.5 text-sm font-medium text-white hover:bg-zinc-700 dark:bg-white dark:text-zinc-900"
              >
                Export PNG
              </button>
              {element && (
                <button
                  onClick={() => onElementChange(null)}
                  className="rounded-lg border border-zinc-300 px-4 py-1.5 text-sm hover:bg-zinc-100 dark:border-zinc-600 dark:hover:bg-zinc-800"
                >
                  Remove text
                </button>
              )}
            </div>
            {element && (
              <div className="mt-4 grid gap-3 rounded-2xl border border-zinc-200 bg-zinc-50 p-4 dark:border-zinc-700 dark:bg-zinc-800 sm:grid-cols-2">
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Text
                  </label>
                  <input
                    type="text"
                    value={element.text}
                    onChange={(e) =>
                      onElementChange({ ...element, text: e.target.value })
                    }
                    placeholder="Enter name or text"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Color
                  </label>
                  <input
                    type="color"
                    value={element.color}
                    onChange={(e) =>
                      onElementChange({ ...element, color: e.target.value })
                    }
                    className="w-full h-10 rounded-lg border border-zinc-300 cursor-pointer dark:border-zinc-600"
                  />
                </div>
                <div className="mb-2">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Prefix (e.g. OK, Mr.)
                  </label>
                  <input
                    type="text"
                    value={element.prefix}
                    onChange={(e) =>
                      onElementChange({ ...element, prefix: e.target.value })
                    }
                    placeholder="Optional prefix"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                  />
                </div>
                <div className="mb-2">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Suffix (e.g. )
                  </label>
                  <input
                    type="text"
                    value={element.suffix}
                    onChange={(e) =>
                      onElementChange({ ...element, suffix: e.target.value })
                    }
                    placeholder="Optional suffix"
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                  />
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Font size: <span className="font-mono">{element.fontSize.toFixed(1)}%</span>
                  </label>
                  <input
                    type="range"
                    min="0.5"
                    max="20"
                    step="0.1"
                    value={element.fontSize}
                    onChange={(e) =>
                      onElementChange({ ...element, fontSize: Number(e.target.value) })
                    }
                    className="w-full"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={element.bold}
                      onChange={(e) =>
                        onElementChange({ ...element, bold: e.target.checked })
                      }
                      className="rounded border-zinc-300"
                    />
                    <span className="text-sm">Bold</span>
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={element.italic}
                      onChange={(e) =>
                        onElementChange({ ...element, italic: e.target.checked })
                      }
                      className="rounded border-zinc-300"
                    />
                    <span className="text-sm">Italic</span>
                  </label>
                </div>
                <div className="sm:col-span-2">
                  <label className="block text-xs font-medium text-zinc-600 dark:text-zinc-400 mb-1">
                    Font family
                  </label>
                  <select
                    value={element.fontFamily}
                    onChange={(e) =>
                      onElementChange({ ...element, fontFamily: e.target.value })
                    }
                    className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-1.5 text-sm dark:border-zinc-600 dark:bg-zinc-800"
                  >
                    {FONT_OPTIONS.map((f) => (
                      <option key={f.value} value={f.value}>
                        {f.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
            )}
          </>
        )}
      </div>
    );
  }
);

CardEditor.displayName = "CardEditor";
export default CardEditor;
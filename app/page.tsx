"use client";

import { useState } from "react";
import SingleCardEditor from "@/components/SingleCardEditor";
import BatchProcessor from "@/components/BatchProcessor";

export default function Home() {
  const [mode, setMode] = useState<"single" | "batch">("single");

  return (
    <div className="flex min-h-screen flex-col bg-zinc-50 font-sans dark:bg-black">
      <header className="sticky top-0 z-10 border-b border-zinc-200 bg-white/80 backdrop-blur dark:border-zinc-800 dark:bg-black/80">
        <div className="mx-auto flex max-w-4xl items-center justify-between px-4 py-3">
          <h1 className="text-lg font-semibold tracking-tight text-zinc-900 dark:text-zinc-50">
            Card Text Adder
          </h1>
          <div className="flex rounded-full bg-zinc-100 p-1 dark:bg-zinc-900">
            <button
              onClick={() => setMode("single")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                mode === "single"
                  ? "bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              }`}
            >
              Single
            </button>
            <button
              onClick={() => setMode("batch")}
              className={`rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
                mode === "batch"
                  ? "bg-white text-zinc-900 shadow dark:bg-zinc-700 dark:text-zinc-50"
                  : "text-zinc-600 hover:text-zinc-900 dark:text-zinc-400 dark:hover:text-zinc-50"
              }`}
            >
              Batch (Excel)
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-4xl flex-1 px-4 py-8">
        {mode === "single" ? (
          <SingleCardEditor />
        ) : (
          <BatchProcessor />
        )}
      </main>

      <footer className="border-t border-zinc-200 py-4 text-center text-xs text-zinc-500 dark:border-zinc-800">
        Click on the image to place text. Export as PNG.
      </footer>
    </div>
  );
}

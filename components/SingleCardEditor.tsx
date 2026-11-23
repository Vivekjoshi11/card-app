"use client";

import { useState } from "react";
import CardEditor, { TextElement } from "@/components/CardEditor";

export default function SingleCardEditor() {
  const [image, setImage] = useState<string | null>(null);
  const [element, setElement] = useState<TextElement | null>(null);
  const [fileName, setFileName] = useState("card");

  return (
    <div className="space-y-6">
      <CardEditor
        image={image}
        element={element}
        onImageChange={setImage}
        onElementChange={setElement}
        fileName={fileName}
        onFileNameChange={setFileName}
      />
    </div>
  );
}

export type { TextElement };
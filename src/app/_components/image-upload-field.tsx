"use client";

import Image from "next/image";
import { type ChangeEvent, useState, useTransition } from "react";

const MAX_SIDE = 1200;

/** Reduz para no máx. 1200 px e WebP antes de enviar; se o navegador não conseguir, envia o original. */
async function resizeForUpload(file: File): Promise<Blob> {
  try {
    const bitmap = await createImageBitmap(file);
    const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(bitmap.width * scale));
    canvas.height = Math.max(1, Math.round(bitmap.height * scale));
    canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/webp", 0.85));
    return blob ?? file;
  } catch {
    return file;
  }
}

export function ImageUploadField({ name, label, defaultUrl }: { name: string; label: string; defaultUrl: string | null }) {
  const [url, setUrl] = useState(defaultUrl ?? "");
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function onChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    setError(null);
    startTransition(async () => {
      const form = new FormData();
      form.set("file", await resizeForUpload(file), "imagem");
      try {
        const response = await fetch("/api/painel/upload", { method: "POST", body: form });
        const result = (await response.json()) as { url?: string; error?: string };
        if (result.url) setUrl(result.url);
        else setError(result.error ?? "Não foi possível enviar a imagem.");
      } catch {
        setError("Não foi possível enviar a imagem.");
      }
    });
  }

  return (
    <div className="flex flex-col gap-2 text-sm">
      <label className="flex flex-col gap-1">
        {label}
        <input type="file" accept="image/jpeg,image/png,image/webp" onChange={onChange} disabled={pending} />
      </label>
      <input type="hidden" name={name} value={url} />
      {pending && <p>Enviando imagem...</p>}
      {error && <p className="text-red-700 dark:text-red-400">{error}</p>}
      {url && (
        <div className="flex items-center gap-3">
          <Image src={url} alt={`Prévia: ${label}`} width={80} height={80} unoptimized className="size-20 rounded object-cover" />
          <button type="button" onClick={() => setUrl("")} className="underline">
            Remover imagem
          </button>
        </div>
      )}
    </div>
  );
}

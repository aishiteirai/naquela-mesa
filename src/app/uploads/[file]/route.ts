import { readImage } from "@/modules/media";

export async function GET(_request: Request, { params }: RouteContext<"/uploads/[file]">) {
  const { file } = await params;
  const image = await readImage(file);
  if (!image) return new Response("Não encontrado", { status: 404 });

  return new Response(image.bytes as Uint8Array<ArrayBuffer>, {
    headers: {
      "Content-Type": image.contentType,
      "Cache-Control": "public, max-age=31536000, immutable",
      "X-Content-Type-Options": "nosniff",
    },
  });
}

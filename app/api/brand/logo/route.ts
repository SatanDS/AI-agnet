import { NextResponse } from "next/server";
import { getBrandLogoFile } from "@/lib/brand";

export async function GET() {
  const logo = await getBrandLogoFile();

  if (!logo) {
    return new NextResponse(null, { status: 404 });
  }

  return new NextResponse(logo.file, {
    headers: {
      "Content-Type": logo.mimeType,
      "Cache-Control": "no-store, max-age=0",
    },
  });
}

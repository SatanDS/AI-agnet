import { NextResponse } from "next/server";
import { getBrandSettings } from "@/lib/brand";

export async function GET() {
  return NextResponse.json({ brand: await getBrandSettings() });
}

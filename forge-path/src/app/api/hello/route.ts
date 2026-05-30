import { NextResponse } from "next/server";

/** Reference handler for the Forge Path capstone — edit and extend as you learn. */
export async function GET() {
  return NextResponse.json({ message: "forge" });
}

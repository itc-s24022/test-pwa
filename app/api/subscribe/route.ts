import { NextResponse } from "next/server";
import { supabase } from "@/lib/supabase";


export async function POST(request: Request) {
  try {
    const body = await request.json();
    const endpoint = body?.endpoint;
    const keys = body?.keys;

    if (
      typeof endpoint !== "string" ||
      !endpoint.startsWith("https://") ||
      typeof keys?.p256dh !== "string" ||
      typeof keys?.auth !== "string"
    ) {
      return NextResponse.json(
        { error: "Invalid subscription" },
        { status: 400 }
      );
    }

    const { error } = await supabase
      .from("push_subscriptions")
      .upsert(
        {
          endpoint,
          subscription: body,
          updated_at: new Date().toISOString(),
        },
        { onConflict: "endpoint" }
      );

    if (error) {
      console.error("Subscription save failed:", error.message);
      return NextResponse.json(
        { error: "Could not save subscription" },
        { status: 500 }
      );
    }

    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json(
      { error: "Invalid request" },
      { status: 400 }
    );
  }
}

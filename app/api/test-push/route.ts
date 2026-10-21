import { NextResponse } from "next/server";
import webpush from "web-push";
import { supabase } from "@/lib/supabase";


webpush.setVapidDetails(
  process.env.VAPID_SUBJECT!,
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
);

export async function POST(request: Request) {
  const token = process.env.PUSH_TEST_TOKEN;
  const authorization = request.headers.get("authorization");

  if (!token || authorization !== `Bearer ${token}`) {
    return NextResponse.json(
      { error: "Unauthorized" },
      { status: 401 }
    );
  }

  const { data: rows, error } = await supabase
    .from("push_subscriptions")
    .select("id, subscription");

  if (error) {
    console.error("Subscription lookup failed:", error.message);
    return NextResponse.json(
      { error: "Database error" },
      { status: 500 }
    );
  }

  if (!rows?.length) {
    return NextResponse.json(
      { error: "No registered devices" },
      { status: 404 }
    );
  }

  let sent = 0;
  let failed = 0;
  let removed = 0;

  for (const row of rows) {
    try {
      await webpush.sendNotification(
        row.subscription,
        JSON.stringify({
          title: "PWA テスト通知",
          body: "サーバーからのプッシュ通知に成功しました。",
          url: "/",
        }),
        { TTL: 60 }
      );

      sent++;
    } catch (error: unknown) {
      failed++;

      const status =
        typeof error === "object" && error !== null && "statusCode" in error
          ? (error as { statusCode?: number }).statusCode
          : undefined;

      console.error("Push failed:", status ?? "unknown");

      if (status === 404 || status === 410) {
        const { error: deleteError } = await supabase
          .from("push_subscriptions")
          .delete()
          .eq("id", row.id);

        if (!deleteError) removed++;
      }
    }
  }

  return NextResponse.json({
    total: rows.length,
    sent,
    failed,
    removed,
  });
}

"use client";

import { useEffect, useState } from "react";

function decodeVapidKey(value: string) {
  const padding = "=".repeat((4 - (value.length % 4)) % 4);
  const base64 = (value + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);

  return Uint8Array.from(raw, (char) => char.charCodeAt(0));
}

export default function Home() {
  const [supported, setSupported] = useState(false);
  const [subscribed, setSubscribed] = useState(false);
  const [token, setToken] = useState("");
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("読み込み中...");

  useEffect(() => {
    async function initialize() {
      const available =
        "serviceWorker" in navigator &&
        "PushManager" in window &&
        "Notification" in window;

      setSupported(available);

      if (!available) {
        setMessage("このブラウザはプッシュ通知に対応していません。");
        return;
      }

      try {
        const registration =
          await navigator.serviceWorker.register("/sw.js");

        await navigator.serviceWorker.ready;

        const subscription =
          await registration.pushManager.getSubscription();

        setSubscribed(Boolean(subscription));
        setMessage(
          subscription
            ? "通知は登録済みです。"
            : "通知を有効にしてください。"
        );
      } catch (error) {
        console.error(error);
        setMessage("Service Worker の登録に失敗しました。");
      }
    }

    void initialize();
  }, []);

  async function subscribe() {
    setBusy(true);

    try {
      if (!supported) throw new Error("通知に対応していません");

      if (Notification.permission === "denied") {
        throw new Error(
          "通知がブロックされています。ブラウザや端末の設定を確認してください。"
        );
      }

      const permission = await Notification.requestPermission();

      if (permission !== "granted") {
        throw new Error("通知の許可が得られませんでした。");
      }

      const registration =
        await navigator.serviceWorker.ready;

      let subscription =
        await registration.pushManager.getSubscription();

      if (!subscription) {
        const publicKey =
          process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;

        if (!publicKey) throw new Error("VAPID 公開鍵がありません");

        subscription = await registration.pushManager.subscribe({
          userVisibleOnly: true,
          applicationServerKey: decodeVapidKey(publicKey),
        });
      }

      const response = await fetch("/api/subscribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(subscription),
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "購読情報の保存に失敗しました");
      }

      setSubscribed(true);
      setMessage("通知の登録とデータベースへの保存に成功しました。");
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "登録に失敗しました"
      );
    } finally {
      setBusy(false);
    }
  }

  async function sendTest() {
    if (!token.trim()) {
      setMessage("テスト用秘密トークンを入力してください。");
      return;
    }

    setBusy(true);

    try {
      const response = await fetch("/api/test-push", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${token.trim()}`,
        },
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || "通知の送信に失敗しました");
      }

      setMessage(
        `送信処理完了：成功 ${result.sent} 件 / 失敗 ${result.failed} 件 / 登録 ${result.total} 件`
      );
    } catch (error) {
      setMessage(
        error instanceof Error ? error.message : "送信に失敗しました"
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto min-h-screen max-w-xl px-5 py-12">
      <div className="mb-8 flex items-center gap-3">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-blue-600 text-2xl text-white">
          ♧
        </div>
        <div>
          <p className="text-sm text-blue-600">PWA / Web Push</p>
          <h1 className="text-2xl font-bold">通知受信テスト</h1>
        </div>
      </div>

      <section className="space-y-5 rounded-2xl border border-gray-200 p-5 shadow-sm">
        <div>
          <h2 className="font-semibold">1. 通知を登録</h2>
          <p className="mt-1 text-sm text-gray-600">
            この端末で通知を許可し、購読情報をサーバーに保存します。
          </p>
        </div>

        <button
          disabled={busy || !supported}
          onClick={subscribe}
          className="w-full rounded-xl bg-blue-600 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          {busy ? "処理中..." : "通知を有効にする"}
        </button>

        <p className="text-sm">
          対応状況：{supported ? "対応 API あり" : "未対応または確認中"}
          <br />
          登録状態：{subscribed ? "登録済み" : "未登録"}
        </p>

        <hr />

        <div>
          <h2 className="font-semibold">2. テスト通知を送信</h2>
          <p className="mt-1 text-sm text-gray-600">
            Vercel の環境変数 PUSH_TEST_TOKEN と同じ値を入力してください。
          </p>
        </div>

        <input
          type="password"
          autoComplete="off"
          value={token}
          onChange={(event) => setToken(event.target.value)}
          placeholder="テスト用秘密トークン"
          className="w-full rounded-xl border border-gray-300 px-4 py-3"
        />

        <button
          disabled={busy}
          onClick={sendTest}
          className="w-full rounded-xl bg-gray-900 px-4 py-3 font-semibold text-white disabled:opacity-50"
        >
          テスト通知を送る
        </button>

        <div
          role="status"
          aria-live="polite"
          className="break-words rounded-xl bg-gray-100 p-4 text-sm text-gray-800"
        >
          {message}
        </div>
      </section>

      <p className="mt-6 text-xs leading-6 text-gray-500">
        テスト用途のアプリです。通知の登録は端末ごとに必要です。
        iPhone ではホーム画面に追加したアプリからテストしてください。
      </p>
    </main>
  );
}

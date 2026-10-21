self.addEventListener("push", (event) => {
  let data = {};

  try {
    data = event.data ? event.data.json() : {};
  } catch {
    data = {
      title: "PWA 通知",
      body: event.data?.text() ?? "通知を受信しました",
    };
  }

  const title = data.title || "PWA 通知";
  const options = {
    body: data.body || "新しい通知があります",
    icon: "/icon.svg",
    data: { url: data.url || "/" },
  };

  event.waitUntil(
    self.registration.showNotification(title, options)
  );
});

self.addEventListener("notificationclick", (event) => {
  event.notification.close();

  const path = event.notification.data?.url || "/";
  const target = new URL(path, self.location.origin);

  if (target.origin !== self.location.origin) return;

  event.waitUntil(
    clients.openWindow(target.href)
  );
});

import * as controller from "../controllers/notifications.controller";

// The caller's unread notification counts per module, e.g. [{ module: "leave", unread: 2, scope: "team", requestNo: "123" }].
export async function getNotificationCounts() {
  return (await controller.getCounts()) ?? [];
}

// Marks a module's notifications read.
export async function markNotificationsRead(module) {
  await controller.markRead(module);
}
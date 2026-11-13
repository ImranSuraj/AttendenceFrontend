// Real-time (SignalR) notification channel for the header bell -- entirely separate from any e-mail notification this app sends.
// One connection per browser tab, authenticated with the same session token as every REST call; the WebSocket handshake cannot carry custom
// headers (a browser limitation), so the SignalR JS client sends its accessTokenFactory's value as ?access_token=....
// The website (and the app opened inside Teams) only keeps the counts up to date: the visitor-request beep and message are the phone app's job.
import * as signalR from "@microsoft/signalr";
import { HUB_URL } from "@/shared/api/config";
import { getToken } from "@/shared/auth/auth.store";
import { useNotificationStore } from "../hooks/useNotificationStore";
import { useAccessStore, hasAccessKey } from "@/shared/access/access.store";
import { queryClient } from "@/shared/api/queryClient";
import { useHostStore } from "@/shared/utils/teams";

// The hub is mounted at the app root ("/hubs/notifications"), not under "/api"; the address comes from config.js (the one place the URLs are set).
const hubUrl = () => HUB_URL;

let connection = null;
let connectedToken = null;

// HRAdmin group membership is decided ONCE, at connect time, from the token's own role (see the backend's NotificationHub) --
// reconnecting is how a role change is picked up without a full page reload.
export function connectNotificationHub() {
  // Only once the menu is known and the user has the app chrome (the "settings" module); an outsider (Visitor) has no notification bell.
  const { loaded, items } = useAccessStore.getState();
  if (!loaded || !hasAccessKey(items, "settings")) return;
  // The same session token every REST call uses; the server reads the employee number from it and the roles from dbo.UserRoles.
  const token = getToken();
  if (!token) return;
  if (connection && connectedToken === token) return;

  disconnectNotificationHub();
  connectedToken = token;

  connection = new signalR.HubConnectionBuilder()
    // withCredentials defaults to true in the SignalR JS client (for cookie-based auth) -- this app authenticates via accessTokenFactory
    // instead, never cookies, so it is turned off here rather than adding AllowCredentials() to the shared CORS policy.
    // ?client= tells the server where this connection runs (the app inside Teams, or the plain website).
    .withUrl(`${hubUrl()}?client=${useHostStore.getState().inTeams ? "teams" : "web"}`, { accessTokenFactory: () => token, withCredentials: false })
    .withAutomaticReconnect()
    .build();

  // Something arrived for this person: the sidebar counts are refreshed (and the open page's notifications read).
  connection.on("Notify", (notification) => {
    useNotificationStore.getState()._addNotification(notification);
  });

  // A meeting made / changed / cancelled in Teams was just stored (or cancelled) by the server: the open conference page reloads its lists at once.
  connection.on("ConferenceChanged", () => {
    queryClient.invalidateQueries({ queryKey: ["conference"] });
  });

  connection.start().catch(err => {
    // eslint-disable-next-line no-console
    console.error("[SignalR] Notification hub connection failed:", err);
  });
}

export function disconnectNotificationHub() {
  if (connection) {
    connection.stop();
  }
  connection = null;
  connectedToken = null;
}

// Connect as soon as the menu has loaded (and again if it ever changes).
useAccessStore.subscribe(() => connectNotificationHub());

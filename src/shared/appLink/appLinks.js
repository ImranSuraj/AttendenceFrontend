// Where the Employee Connect phone app lives. PLACEHOLDERS until the real store listings and app identifiers exist -- change only this file.
export const APP_LINKS = {
  appName: "Employee Connect",
  scheme: "employeeconnect://open",                                                   // opens the installed app (a verified https link replaces this later)
  android: "https://play.google.com/store/apps/details?id=com.ttkprestige.employeeconnect",
  ios: "https://apps.apple.com/app/employee-connect/id0000000000",
};

export const phoneKind = () => {
  const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
  if (/Android/i.test(ua)) return "android";
  if (/iPhone|iPod|iPad/i.test(ua) || (/Macintosh/i.test(ua) && navigator.maxTouchPoints > 1)) return "ios";
  return null;
};
export const storeUrl = (kind) => (kind === "ios" ? APP_LINKS.ios : APP_LINKS.android);
// The same page the person was on (e.g. ?module=leave&requestNo=5) is handed to the app.
export const openAppUrl = () => `${APP_LINKS.scheme}${typeof window !== "undefined" ? window.location.search : ""}`;
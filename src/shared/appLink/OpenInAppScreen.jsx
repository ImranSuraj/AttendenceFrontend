import { APP_LINKS, phoneKind, storeUrl } from "./appLinks";
import { openExternalLink } from "../utils/teams";

// Shown instead of the website when the Teams tab is opened in the Teams phone app: {appName} is used from its own app there. One simple message; tapping it
// (or one of the two store names) goes to the store the app can be downloaded from.
export default function OpenInAppScreen() {
  const kind = phoneKind();
  const go = (url) => (e) => { e.preventDefault(); openExternalLink(url); };
  const link = "text-primary font-semibold underline cursor-pointer";
  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-6">
      <div className="w-full max-w-sm bg-card border border-border rounded-xl p-6 text-center flex flex-col gap-4">
        <p className="text-base text-foreground m-0 leading-relaxed">
          Get the {APP_LINKS.appName} from the{" "}
          <a href={APP_LINKS.android} onClick={go(APP_LINKS.android)} className={link}>Google Play Store</a>
          {" "}or{" "}
          <a href={APP_LINKS.ios} onClick={go(APP_LINKS.ios)} className={link}>App Store</a>.
        </p>
        {kind ? (
          <button type="button" onClick={() => openExternalLink(storeUrl(kind))} className="w-full h-11 rounded-lg border-none text-sm font-semibold cursor-pointer bg-primary text-primary-foreground">
            Get the app{kind === "ios" ? " on the App Store" : " on Google Play"}
          </button>
        ) : null}
      </div>
    </div>
  );
}
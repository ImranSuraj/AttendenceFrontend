import { useHostStore, isTeamsMobile } from "../shared/utils/teams";
import OpenInAppScreen from "../shared/appLink/OpenInAppScreen";
import InstallAppBanner from "../shared/appLink/InstallAppBanner";
import App from "./App.jsx";

// Teams phone app -> hand over to the Employee Connect app. Phone browser -> the website plus an install bar. Everything else (Teams desktop/web, PC browsers) -> the website as is.
export default function Root() {
  const inTeams = useHostStore((s) => s.inTeams);
  useHostStore((s) => s.clientType); // re-check once the Teams SDK reports the client
  if (inTeams && isTeamsMobile()) return <OpenInAppScreen />;
  return (<>{!inTeams && <InstallAppBanner />}<App /></>);
}
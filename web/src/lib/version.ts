export const APP_VERSION = __APP_VERSION__;
export const BUILD_DATE = __BUILD_DATE__;
export const COMMIT = __COMMIT__;

/** e.g. "Wednesday 7 October 2026 at 14:32:10 UTC" */
export const fullBuildDate = () =>
  new Date(BUILD_DATE).toLocaleString("en-GB", { weekday: "long", day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit", second: "2-digit", timeZone: "UTC", timeZoneName: "short" })
    .replace(/, (\d{2}:)/, " at $1").replace(/,/g, "");

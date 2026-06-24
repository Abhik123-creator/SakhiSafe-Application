import packageJson from "../../package.json";

const currentYear = new Date().getFullYear();

export const APP_CONFIG = {
  name: "SakhiSafe",
  version: packageJson.version,
  copyright: `© ${currentYear}, SakhiSafe.`,
  branding: {
    logoPath: "/LOGO.jpeg",
    faviconPath: "/Favicon.jpeg",
    logoAlt: "SakhiSafe logo",
  },
  meta: {
    title: "SakhiSafe - Secure Care Response Dashboard",
    description:
      "SakhiSafe provides a secure workspace for care coordination, case response, incident review, and survivor support operations.",
  },
};

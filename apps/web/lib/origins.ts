export const parseOrigins = (text: string) =>
  text
    .split(/[\s,]+/)
    .map((origin) => origin.trim())
    .filter(Boolean);

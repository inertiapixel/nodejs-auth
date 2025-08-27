import { Request } from "express";

export const getCookie = (req: Request, name: string): string | undefined => {
  const raw = req.headers.cookie;
  if (!raw) return undefined;

  const cookies = raw.split(";").reduce((acc, part) => {
    const [key, value] = part.trim().split("=");
    if (key && value !== undefined) {
      acc[key] = decodeURIComponent(value);
    }
    return acc;
  }, {} as Record<string, string>);

  return cookies[name];
};

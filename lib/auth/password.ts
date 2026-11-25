import { timingSafeEqual } from "crypto";

export const DEMO_PASSWORD = "workroom-demo";

export function checkDemoPassword(input: string) {
  const given = Buffer.from(input);
  const expected = Buffer.from(DEMO_PASSWORD);
  if (given.length !== expected.length) return false;
  return timingSafeEqual(given, expected);
}

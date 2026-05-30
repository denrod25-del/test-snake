import type { County } from "@/generated/prisma";

export type NormalizedBooking = {
  county: County;
  sourceSystem: string;
  externalId: string;
  personName: string;
  bookingDate: Date | null;
  chargesText: string | null;
  mugshotUrl: string | null;
  officialSourceUrl: string | null;
  rawMetadata?: Record<string, unknown>;
};

export type CountyAdapter = {
  county: County;
  sourceSystem: string;
  label: string;
  run: () => Promise<NormalizedBooking[]>;
};

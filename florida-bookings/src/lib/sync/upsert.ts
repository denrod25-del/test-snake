import type { Prisma } from "@/generated/prisma";
import { prisma } from "@/lib/db";
import type { NormalizedBooking } from "@/lib/adapters/types";

export async function upsertBooking(record: NormalizedBooking, syncedAt: Date) {
  const data: Prisma.BookingRecordCreateInput = {
    county: record.county,
    sourceSystem: record.sourceSystem,
    externalId: record.externalId,
    personName: record.personName,
    bookingDate: record.bookingDate,
    chargesText: record.chargesText,
    mugshotUrl: record.mugshotUrl,
    officialSourceUrl: record.officialSourceUrl,
    rawMetadata: (record.rawMetadata ?? undefined) as Prisma.InputJsonValue,
    lastSyncedAt: syncedAt,
  };

  await prisma.bookingRecord.upsert({
    where: {
      county_sourceSystem_externalId: {
        county: record.county,
        sourceSystem: record.sourceSystem,
        externalId: record.externalId,
      },
    },
    create: data,
    update: {
      personName: data.personName,
      bookingDate: data.bookingDate,
      chargesText: data.chargesText,
      mugshotUrl: data.mugshotUrl,
      officialSourceUrl: data.officialSourceUrl,
      rawMetadata: data.rawMetadata,
      lastSyncedAt: syncedAt,
    },
  });
}

import "server-only";
import { db } from "@/lib/db";
import { logger } from "@/lib/logger";
import type { FeatureId } from "./features";

type TrackArgs = {
  userId: string;
  feature: FeatureId;
  action: string;
  metadata?: Record<string, unknown>;
};

/**
 * Records one usage event for the admin analytics. Never throws: a failure to
 * log must not break the feature the user is actually using.
 */
export async function trackEvent({ userId, feature, action, metadata }: TrackArgs): Promise<void> {
  try {
    await db.featureEvent.create({
      data: {
        userId,
        feature,
        action,
        metadataJson: metadata ? JSON.stringify(metadata) : null,
      },
    });
  } catch (error) {
    logger.warn("analytics", "Couldn't record feature event", { feature, action, error: String(error) });
  }
}

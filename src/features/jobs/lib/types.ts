import { z } from "zod";

export const EMPLOYMENT_TYPES = ["INTERNSHIP", "PART_TIME", "FULL_TIME"] as const;
export type EmploymentType = (typeof EMPLOYMENT_TYPES)[number];

export const LOCATION_TYPES = ["REMOTE", "ON_SITE", "HYBRID"] as const;
export type LocationType = (typeof LOCATION_TYPES)[number];

export const JOB_STATUSES = ["OPEN", "CLOSED"] as const;
export type JobStatus = (typeof JOB_STATUSES)[number];

export const APPLICATION_STATUSES = ["SUBMITTED", "REVIEWED", "SHORTLISTED", "REJECTED"] as const;
export type ApplicationStatus = (typeof APPLICATION_STATUSES)[number];

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  INTERNSHIP: "Internship",
  PART_TIME: "Part-time",
  FULL_TIME: "Full-time",
};

export const LOCATION_TYPE_LABELS: Record<LocationType, string> = {
  REMOTE: "Remote",
  ON_SITE: "On-site",
  HYBRID: "Hybrid",
};

export const APPLICATION_STATUS_LABELS: Record<ApplicationStatus, string> = {
  SUBMITTED: "Submitted",
  REVIEWED: "Reviewed",
  SHORTLISTED: "Shortlisted",
  REJECTED: "Rejected",
};

export const createJobSchema = z.object({
  title: z.string().trim().min(1, "Title is required").max(150),
  description: z.string().trim().min(1, "Description is required").max(10000),
  requirements: z.string().trim().max(10000).optional(),
  employmentType: z.enum(EMPLOYMENT_TYPES),
  hoursPerWeek: z.coerce.number().int().min(1).max(168).optional(),
  weeksPerYear: z.coerce.number().int().min(1).max(52).optional(),
  pay: z.string().trim().max(100).optional(),
  location: z.string().trim().max(150).optional(),
  locationType: z.enum(LOCATION_TYPES),
});
export type CreateJobInput = z.infer<typeof createJobSchema>;

export const updateJobSchema = createJobSchema.partial().extend({
  status: z.enum(JOB_STATUSES).optional(),
});
export type UpdateJobInput = z.infer<typeof updateJobSchema>;

export const applySchema = z.object({
  resumeId: z.string().min(1, "Choose a resume"),
  note: z.string().trim().max(2000).optional(),
});
export type ApplyInput = z.infer<typeof applySchema>;

export const updateApplicationStatusSchema = z.object({
  status: z.enum(APPLICATION_STATUSES),
});

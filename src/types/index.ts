import { type User, type UserLink } from "~/server/db/schema";

export type UserWithLink = User & { userLink?: UserLink };

export type SafeActionError = {
  serverError?: string;
  fetchError?: string;
  validationErrors?: Partial<Record<string | number | symbol, string[]>>;
};

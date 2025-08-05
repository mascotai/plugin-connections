import {
  pgTable,
  uuid,
  text,
  timestamp,
  jsonb,
  boolean,
  index,
  unique,
  pgEnum,
  pgSchema,
} from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";

// Create plugin_connections schema
export const pluginConnectionsSchema = pgSchema("plugin_connections");

// Enum for supported service types
export const serviceTypeEnum = pluginConnectionsSchema.enum("service_type", [
  "twitter",
  "discord",
  "telegram",
  "github",
  "google",
  "facebook",
  "linkedin",
  "instagram",
  "tiktok",
  "youtube",
  "other",
]);

export const serviceCredentialsTable = pluginConnectionsSchema.table(
  "service_credentials",
  {
    id: uuid("id")
      .primaryKey()
      .default(sql`gen_random_uuid()`),
    agentId: uuid("agent_id").notNull(),
    serviceName: serviceTypeEnum("service_name").notNull(),
    credentials: jsonb("credentials").notNull().default("{}"),
    isActive: boolean("is_active").default(true).notNull(),
    expiresAt: timestamp("expires_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .default(sql`now()`)
      .notNull(),
  },
  (table) => [
    // Indexes for performance
    index("service_credentials_agent_id_idx").on(table.agentId),
    index("service_credentials_service_name_idx").on(table.serviceName),
    index("service_credentials_is_active_idx").on(table.isActive),
    index("service_credentials_created_at_idx").on(table.createdAt),
    // Unique constraint for one active credential per agent/service
    unique("service_credentials_agent_service_unique").on(
      table.agentId,
      table.serviceName,
    ),
  ],
);

// Export individual tables and enums for direct imports and automatic migration
import {
  serviceCredentialsTable,
  serviceTypeEnum,
} from "./service-credentials";

// Export schema object for ElizaOS migration system

export const schema = {
  serviceCredentialsTable,
};

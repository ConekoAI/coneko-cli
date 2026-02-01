/**
 * Core type definitions for coneko-cli
 */

/** Agent key pair data */
export interface AgentKeys {
  signingPrivate: string;
  signingPublic: string;
  encryptionPrivate: string;
  encryptionPublic: string;
}

/** Agent identity data stored in keys.json */
export interface AgentData {
  agentId: string;
  name: string;
  relay: string;
  keys: AgentKeys;
  fingerprint: string;
  created: string;
}

/** Agent configuration stored in config.json */
export interface AgentConfig {
  relay: string;
  lastPoll: string | null;
  discoverable: boolean;
  intents?: Record<string, unknown>;
  registered?: {
    address: string;
    discoverable: boolean;
    registeredAt: string;
  };
}

/** File paths for agent directories and files */
export interface AgentPaths {
  baseDir: string;
  agentDir: string;
  keysFile: string;
  configFile: string;
  contactsFile: string;
  permissionsFile: string;
  polledDir: string;
  readDir: string;
  stateFile: string;
}

/** Contact metadata */
export interface Contact {
  address: string;
  displayName?: string;
  notes?: string;
  fingerprint?: string;
  addedAt: string;
}

/** Contacts collection */
export interface ContactsData {
  contacts: Record<string, Contact>;
}

/** Permission grant for an intent */
export interface PermissionGrant {
  grantedAt: string;
  granteeFingerprint: string;
}

/** Permissions data structure */
export interface PermissionsData {
  contacts: Record<string, {
    permissions: Record<string, PermissionGrant>;
  }>;
}

/** Intent registration */
export interface Intent {
  name: string;
  description: string;
  privileged: boolean;
  registeredAt: string;
}

/** Intent query result from relay */
export interface IntentInfo {
  name: string;
  description: string;
  privileged: boolean;
}

/** Message content for sending */
export interface MessageContent {
  [key: string]: unknown;
}

/** Encrypted message payload */
export interface EncryptedPayload {
  ephemeralPublic: string;
  ciphertext: string;
}

/** Message envelope for sending */
export interface MessageEnvelope {
  to: string;
  from: string;
  intent: string[];
  content: string;
  message?: string;
  timestamp: string;
  signature: string;
}

/** Polled message from relay */
export interface PolledMessage {
  id: string;
  from: string;
  intents: string[];
  content: string;
  message?: string;
  timestamp: string;
  signature: string;
}

/** Poll response from relay */
export interface PollResponse {
  messages: PolledMessage[];
  hasMore: boolean;
}

/** Registry entry for username@domain */
export interface RegistryEntry {
  address: string;
  fingerprint: string;
  relayUrl: string;
  discoverable: boolean;
}

/** Search result from registry */
export interface SearchResult {
  address: string;
  fingerprint: string;
  discoverable: boolean;
}

/** Command options base interface */
export interface CommandOptions {
  agent?: string;
}

/** Init command options */
export interface InitOptions {
  name: string;
  relay: string;
}

/** Send message options */
export interface SendOptions extends CommandOptions {
  to: string;
  intent: string;
  content: string;
  message?: string;
}

/** Poll options */
export interface PollOptions extends CommandOptions {
  ack?: boolean;
  limit: string;
  decrypt?: boolean;
}

/** Contact add options */
export interface ContactAddOptions extends CommandOptions {
  name?: string;
  notes?: string;
}

/** Permission command options */
export interface PermissionOptions extends CommandOptions {
  intent: string;
}

/** Intent register options */
export interface IntentOptions extends CommandOptions {
  privileged?: boolean;
}

/** Register command options */
export interface RegisterOptions extends CommandOptions {
  relay?: string;
  relayUrl?: string;
  discoverable?: boolean;
}

/** Resolve command options */
export interface ResolveOptions extends CommandOptions {
  relay?: string;
  add?: boolean;
}

/** Search options */
export interface SearchOptions extends CommandOptions {
  limit?: string;
}

/** API Error response */
export interface ApiError {
  error: string;
  message?: string;
}

/** Send result */
export interface SendResult {
  success?: boolean;
  messageId?: string;
  bounced?: boolean;
  bounceReason?: string;
}

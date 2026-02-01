/**
 * Intent management commands
 */
import { CommandOptions, IntentOptions } from '../types';
export declare const DEFAULT_INTENT: {
    name: string;
    description: string;
};
/**
 * Register a new intent for this agent
 */
export declare function registerIntent(name: string, description: string, options: IntentOptions): Promise<void>;
/**
 * List registered intents for this agent
 */
export declare function listIntents(options: CommandOptions): Promise<void>;
/**
 * Remove an intent from this agent
 */
export declare function removeIntent(name: string, options: CommandOptions): Promise<void>;
/**
 * Query allowed intents of a contact
 */
export declare function queryIntents(address: string, options: CommandOptions): Promise<void>;
//# sourceMappingURL=intents.d.ts.map
/**
 * Settings and discoverability commands
 */
import { CommandOptions, SearchOptions } from '../types';
/**
 * Set account discoverability
 */
export declare function setDiscoverable(discoverable: boolean, options: CommandOptions): Promise<void>;
/**
 * Get current discoverability status
 */
export declare function getDiscoverable(options: CommandOptions): Promise<void>;
/**
 * Search discoverable accounts
 */
export declare function searchAccounts(query: string, options: SearchOptions): Promise<void>;
/**
 * Get service metrics
 */
export declare function getMetrics(options: CommandOptions & {
    relay?: string;
}): Promise<void>;
//# sourceMappingURL=settings.d.ts.map
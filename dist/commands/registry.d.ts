/**
 * Registry commands for DNS-style addressing
 */
import { CommandOptions, RegisterOptions, ResolveOptions } from '../types';
export declare const DEFAULT_INTENT: {
    name: string;
    description: string;
};
/**
 * Register username@domain on relay
 */
export declare function register(address: string, options: RegisterOptions): Promise<void>;
/**
 * Resolve username@domain to fingerprint
 */
export declare function resolve(address: string, options: ResolveOptions): Promise<void>;
/**
 * Reverse lookup: find addresses by fingerprint
 */
export declare function whois(fingerprint: string, options: CommandOptions & {
    relay?: string;
}): Promise<void>;
//# sourceMappingURL=registry.d.ts.map
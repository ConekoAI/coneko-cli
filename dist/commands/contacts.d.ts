/**
 * Contact management commands
 */
import { CommandOptions, ContactAddOptions } from '../types';
/**
 * Search for an account
 */
export declare function search(query: string, options: CommandOptions): Promise<void>;
/**
 * List contacts (metadata only)
 */
export declare function list(options: CommandOptions): Promise<void>;
/**
 * Add a contact (metadata only)
 */
export declare function add(address: string, options: ContactAddOptions): Promise<void>;
/**
 * Remove a contact
 */
export declare function remove(address: string, options: CommandOptions): Promise<void>;
//# sourceMappingURL=contacts.d.ts.map
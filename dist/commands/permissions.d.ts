/**
 * Permission management commands
 */
import { CommandOptions, PermissionOptions } from '../types';
/**
 * Grant permission to a sender for a privileged intent
 */
export declare function grantPermission(grantee: string, options: PermissionOptions): Promise<void>;
/**
 * Revoke permission from a sender
 */
export declare function revokePermission(grantee: string, options: PermissionOptions): Promise<void>;
/**
 * List permissions I've granted
 */
export declare function listGrantedPermissions(options: CommandOptions): Promise<void>;
/**
 * List permissions I've received (what I can send)
 */
export declare function listReceivedPermissions(options: CommandOptions): Promise<void>;
//# sourceMappingURL=permissions.d.ts.map
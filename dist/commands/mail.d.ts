/**
 * Mail polling commands
 */
import { PollOptions } from '../types';
/**
 * Poll for messages from relay and save to agent's polled folder
 */
export declare function check(options: PollOptions): Promise<{
    count: number;
    agentName?: string;
    agentDir?: string;
}>;
//# sourceMappingURL=mail.d.ts.map
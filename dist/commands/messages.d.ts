/**
 * Message sending commands
 */
import { SendOptions, SendResult } from '../types';
declare const DEFAULT_INTENT: {
    name: string;
    description: string;
};
/**
 * Send a message with one or more intents
 */
export declare function send(options: SendOptions): Promise<SendResult>;
export { DEFAULT_INTENT };
//# sourceMappingURL=messages.d.ts.map
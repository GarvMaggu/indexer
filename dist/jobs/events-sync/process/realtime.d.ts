import { Queue } from "bullmq";
import { EventsInfo } from "@/events-sync/handlers";
export declare const queue: Queue<any, any, string>;
export declare const addToQueue: (infos: EventsInfo[]) => Promise<void>;
//# sourceMappingURL=realtime.d.ts.map
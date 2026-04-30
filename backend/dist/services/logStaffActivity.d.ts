import { STAFF_ACTIONS } from "../constants/staffActions";
type StaffAction = typeof STAFF_ACTIONS[keyof typeof STAFF_ACTIONS];
interface LogStaffActivityInput {
    restaurantId: number;
    staffId?: number;
    action: StaffAction;
    meta?: Record<string, any>;
}
export declare function logStaffActivity({ restaurantId, staffId, action, meta, }: LogStaffActivityInput): Promise<void>;
export {};
//# sourceMappingURL=logStaffActivity.d.ts.map
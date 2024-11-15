import type { Trigger } from "../TriggerService";
import type { TriggerConditionGroup } from "./TriggerConditionGroup";

export interface TriggerCondition {
	trigger: Trigger;
	order: number;
	parent: TriggerConditionGroup | null;

	evaluate(): boolean;
}

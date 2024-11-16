import type { Trigger } from "../TriggerService";
import type { TriggerConditionGroup } from "./TriggerConditionGroup";

export interface TriggerCondition {
	trigger: Trigger;
	order: number;
	parent: TriggerConditionGroup | null;

	evaluate(result: object): boolean;
	getReturnData(): Promise<object>
	delete(): Promise<this>
}

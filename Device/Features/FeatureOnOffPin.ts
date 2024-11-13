import { FeatureBase } from "./FeatureBase";

export class FeatureOnOffPin extends FeatureBase {
	protected processValue(value: boolean): boolean {
		return !!value;
	}
}

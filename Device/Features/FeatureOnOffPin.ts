import { FeatureBase } from "./FeatureBase";

export class FeatureOnOffPin extends FeatureBase {
	protected processValue(value: any): boolean {
		return !!parseInt(value);
	}
}

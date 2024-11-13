import { FeatureBase } from "./FeatureBase";

export class FeatureOnOffPin extends FeatureBase {
	protected processValue(value: any): boolean {
		if (typeof value === "boolean")
			return value;

		return !!parseInt(value);
	}
}

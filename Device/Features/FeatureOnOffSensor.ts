import { FeatureBase } from "./FeatureBase";

export class FeatureOnOffSensor extends FeatureBase {
	public processValue(value: any): boolean {
		if (typeof value === "boolean")
			return value;

		return !!parseInt(value);
	}
}
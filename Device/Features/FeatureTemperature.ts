import { FeatureBase } from "./FeatureBase";

export class FeatureTemperature extends FeatureBase {
	protected processValue(value: number): number {
		if (typeof value !== "number")
			return parseFloat(value);

		return value;
	}
}

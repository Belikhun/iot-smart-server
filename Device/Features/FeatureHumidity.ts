import { FeatureBase } from "./FeatureBase";

export class FeatureHumidity extends FeatureBase {
	protected processValue(value: number): number {
		if (typeof value !== "number")
			return parseInt(value);

		return value;
	}
}

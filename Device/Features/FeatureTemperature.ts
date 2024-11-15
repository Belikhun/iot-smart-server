import { FeatureBase } from "./FeatureBase";

export class FeatureTemperature extends FeatureBase {
	public defaultValue(): any {
		return 0;
	}

	public processValue(value: number): number {
		if (typeof value !== "number")
			return parseFloat(value);

		return value;
	}
}

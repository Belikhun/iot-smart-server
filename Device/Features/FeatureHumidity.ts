import { FeatureBase } from "./FeatureBase";

export class FeatureHumidity extends FeatureBase {
	public defaultValue(): any {
		return 0;
	}

	protected processValue(value: number): number {
		if (typeof value !== "number")
			return parseInt(value);

		return value;
	}
}

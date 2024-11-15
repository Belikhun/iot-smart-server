import { FeatureBase } from "./FeatureBase";

export class FeatureKnob extends FeatureBase {
	public defaultValue(): number {
		return 0;
	}

	public processValue(value: number): number {
		if (value === null)
			return this.defaultValue();

		if (typeof value !== "number")
			return parseInt(value);

		return value;
	}
}

import { FeatureBase } from "./FeatureBase";

export class FeatureFanMotor extends FeatureBase {
	public defaultValue(): number {
		return 0;
	}

	public processValue(value: number): number {
		if (value === null)
			return this.defaultValue();

		if (typeof value !== "number")
			value = parseInt(value);

		return Math.min(100, Math.max(-100, value));
	}
}

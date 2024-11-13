import { FeatureBase } from "./FeatureBase";

export class FeatureRGBLed extends FeatureBase {
	public defaultValue(): number[] {
		return [0, 0, 0];
	}

	protected serializeValue(value: object): string {
		return JSON.stringify(value);
	}

	protected unserializeValue(value: string): object {
		if (!value)
			return this.defaultValue();

		return JSON.parse(value);
	}
}

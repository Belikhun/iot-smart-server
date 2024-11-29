import { FeatureBase } from "./FeatureBase";

export class FeatureSystemAlert extends FeatureBase {
	public processValue(value: any): boolean {
		if (typeof value === "boolean")
			return value;

		return !!parseInt(value);
	}
}

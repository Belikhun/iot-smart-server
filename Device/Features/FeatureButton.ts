import { FeatureBase } from "./FeatureBase";

export class FeatureButton extends FeatureBase {
	protected processValue(value: any): boolean {
		if (typeof value === "boolean")
			return value;

		return !!parseInt(value);
	}
}

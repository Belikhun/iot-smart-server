import { FeatureBase } from "./FeatureBase";

export class FeatureButton extends FeatureBase {
	protected processValue(value: any): boolean {
		return !!parseInt(value);
	}
}

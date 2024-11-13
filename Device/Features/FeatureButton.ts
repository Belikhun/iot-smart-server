import { FeatureBase } from "./FeatureBase";

export class FeatureButton extends FeatureBase {
	protected processValue(value: boolean): boolean {
		return !!value;
	}
}

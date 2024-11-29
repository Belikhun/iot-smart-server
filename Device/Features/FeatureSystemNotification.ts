import { FeatureBase } from "./FeatureBase";

export class FeatureSystemNotification extends FeatureBase {
	public defaultValue(): object | null {
		return null;
	}

	protected serializeValue(value: object | null): string | null {
		if (!value)
			return null;

		return JSON.stringify(value);
	}

	protected unserializeValue(value: string | null): object | null {
		if (!value)
			return this.defaultValue();

		return JSON.parse(value);
	}
}

import { FeatureBase } from "./FeatureBase";

type AlarmCommand = {
	action: "off" | "beep" | "alert" | "tune" | "alarm",
	data: any
};

export class FeatureAlarm extends FeatureBase {
	public defaultValue(): AlarmCommand | string {
		return "off";
	}

	protected serializeValue(value: AlarmCommand | string): string {
		if (value === "off")
			return "off";

		return JSON.stringify(value);
	}

	protected unserializeValue(value: string): AlarmCommand | string {
		if (!value)
			return this.defaultValue();

		if (value === "off")
			return "off";

		return JSON.parse(value);
	}
}

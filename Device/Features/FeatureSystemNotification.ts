import { sendDashboardCommand, type WebSocket } from "../../Routes/WebSocket";
import { FeatureBase, FeatureUpdateSource } from "./FeatureBase";

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

	public setValue(newValue: any, source?: FeatureUpdateSource, sourceWS?: WebSocket | null): FeatureBase {
		super.setValue(newValue, source, sourceWS);

		if (source !== FeatureUpdateSource.DEVICE) {
			sendDashboardCommand("notification", this.getValue());
			this.setValue(null, FeatureUpdateSource.DEVICE);
		}

		return this;
	}
}

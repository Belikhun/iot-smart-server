import { sendNotification } from "../../Firebase/Client";
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

	public setValue(newValue: any, source?: FeatureUpdateSource, sourceWS?: WebSocket | null): FeatureSystemNotification {
		super.setValue(newValue, source, sourceWS);

		if (source !== FeatureUpdateSource.DEVICE) {
			const { level, message }: { level: string, message: string } = this.getValue();
			const levelDisplay = {
				info: "Thông Tin",
				warning: "Cảnh Báo",
				critical: "Nghiêm Trọng"
			}[level];

			sendDashboardCommand("notification", { level, message });
			sendNotification({
				title: levelDisplay as string,
				body: message
			});

			this.setValue(null, FeatureUpdateSource.DEVICE);
		}

		return this;
	}
}

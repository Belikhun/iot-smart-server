import { sendNotification } from "../../Firebase/Client";
import type { WebSocket } from "../../Routes/WebSocket";
import { FeatureBase, FeatureUpdateSource } from "./FeatureBase";

export class FeatureSystemAlert extends FeatureBase {

	protected isSent = false;

	public processValue(value: any): boolean {
		if (typeof value === "boolean")
			return value;

		return !!parseInt(value);
	}

	public setValue(newValue: any, source?: FeatureUpdateSource, sourceWS?: WebSocket | null): FeatureSystemAlert {
		super.setValue(newValue, source, sourceWS);

		if (source !== FeatureUpdateSource.DEVICE) {
			if (this.getValue() && !this.isSent) {
				sendNotification({
					title: "Cảnh Báo",
					body: `Cảnh báo của hệ thống vừa được kích hoạt!`,
					sound: "alarm"
				});

				this.isSent = true;
			} else if (this.isSent) {
				sendNotification({
					title: "Cảnh Báo",
					body: `Cảnh báo đã kết thúc!`
				});

				this.isSent = false;
			}
		}

		return this;
	}
}

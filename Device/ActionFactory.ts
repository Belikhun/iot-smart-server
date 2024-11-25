import { scope } from "../Utils/Logger";
import { getDeviceFeature } from "./Device";
import type { FeatureBase } from "./Features/FeatureBase";

const log = scope("feature/action");

export enum ActionType {
	SET_VALUE = "setValue",
	SET_FROM_FEATURE = "setFromFeature",
	TOGGLE_VALUE = "toggleValue",
	ALARM_VALUE = "alarmValue"
}

export const setFeatureValueByAction = (feature: FeatureBase, action: ActionType, newValue: any) => {
	switch (action) {
		case ActionType.SET_VALUE: {
			feature.setValue(newValue);
			break;
		}

		case ActionType.SET_FROM_FEATURE: {
			const source = getDeviceFeature(newValue);

			if (!source) {
				log.warn(`Không tìm thấy tính năng với mã #${newValue}`);
				return;
			}

			feature.setValue(source.getValue());
			break;
		}

		case ActionType.TOGGLE_VALUE: {
			feature.setValue(!feature.getValue());
			break;
		}

		case ActionType.ALARM_VALUE: {
			const payload: { action: string, data: any } = {
				action: newValue,
				data: null
			};

			if (newValue === "beep")
				payload.data = [0.2, 1000];

			feature.setValue(payload);
			break;
		}
	}
}

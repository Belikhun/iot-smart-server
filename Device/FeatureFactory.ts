import type DeviceFeatureModel from "../Models/DeviceFeatureModel";
import type Device from "./Device";
import { FeatureAlarm } from "./Features/FeatureAlarm";
import type { FeatureBase } from "./Features/FeatureBase";
import { FeatureButton } from "./Features/FeatureButton";
import { FeatureHumidity } from "./Features/FeatureHumidity";
import { FeatureKnob } from "./Features/FeatureKnob";
import { FeatureOnOffSensor } from "./Features/FeatureOnOffSensor";
import { FeatureOnOffToggle } from "./Features/FeatureOnOffToggle";
import { FeatureRGBLed } from "./Features/FeatureRGBLed";
import { FeatureSensorValue } from "./Features/FeatureSensorValue";
import { FeatureTemperature } from "./Features/FeatureTemperature";

const RegisteredFeatures = {
	"FeatureButton": FeatureButton,
	"FeatureOnOffToggle": FeatureOnOffToggle,
	"FeatureOnOffSensor": FeatureOnOffSensor,
	"FeatureRGBLed": FeatureRGBLed,
	"FeatureKnob": FeatureKnob,
	"FeatureTemperature": FeatureTemperature,
	"FeatureHumidity": FeatureHumidity,
	"FeatureSensorValue": FeatureSensorValue,
	"FeatureAlarm": FeatureAlarm
}

export function resolveFeature(model: DeviceFeatureModel, device: Device): FeatureBase {
	if (!isFeatureAvailable(model.kind))
		throw new Error(`Tính năng không hợp lệ hoặc chưa được hỗ trợ: ${model.kind}`);

	// @ts-ignore
	return new RegisteredFeatures[model.kind](model, device);
}

export function isFeatureAvailable(kind: string): boolean {
	// @ts-ignore
	if (RegisteredFeatures[kind])
		return true;

	return false;
}

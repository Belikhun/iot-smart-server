import type DeviceFeatureModel from "../Models/DeviceFeatureModel";
import type Device from "./Device";
import type { FeatureBase } from "./Features/FeatureBase";
import { FeatureButton } from "./Features/FeatureButton";
import { FeatureHumidity } from "./Features/FeatureHumidity";
import { FeatureKnob } from "./Features/FeatureKnob";
import { FeatureOnOffPin } from "./Features/FeatureOnOffPin";
import { FeatureRGBLed } from "./Features/FeatureRGBLed";
import { FeatureTemperature } from "./Features/FeatureTemperature";

const RegisteredFeatures = {
	"FeatureButton": FeatureButton,
	"FeatureOnOffPin": FeatureOnOffPin,
	"FeatureRGBLed": FeatureRGBLed,
	"FeatureKnob": FeatureKnob,
	"FeatureTemperature": FeatureTemperature,
	"FeatureHumidity": FeatureHumidity
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

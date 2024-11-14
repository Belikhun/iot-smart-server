import type DeviceFeatureModel from "../Models/DeviceFeatureModel";
import type Device from "./Device";
import type { FeatureBase } from "./Features/FeatureBase";
import { FeatureButton } from "./Features/FeatureButton";
import { FeatureKnob } from "./Features/FeatureKnob";
import { FeatureOnOffPin } from "./Features/FeatureOnOffPin";
import { FeatureRGBLed } from "./Features/FeatureRGBLed";

export function resolveFeature(model: DeviceFeatureModel, device: Device): FeatureBase {
	switch (model.kind) {
		case "FeatureButton":
			return new FeatureButton(model, device);

		case "FeatureOnOffPin":
			return new FeatureOnOffPin(model, device);

		case "FeatureRGBLed":
			return new FeatureRGBLed(model, device);

		case "FeatureKnob":
			return new FeatureKnob(model, device);
	}

	throw new Error(`Tính năng không hợp lệ hoặc chưa được hỗ trợ: ${model.kind}`);
}

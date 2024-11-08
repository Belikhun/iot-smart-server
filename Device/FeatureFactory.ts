import type DeviceFeatureModel from "../Models/DeviceFeatureModel";
import { DeviceFeatureKind } from "../Models/DeviceFeatureModel";
import type { FeatureBase } from "./Features/FeatureBase";
import { Light } from "./Features/Light";

export function resolveFeature(model: DeviceFeatureModel): FeatureBase {
	switch (model.kind) {
		case DeviceFeatureKind.LIGHT:
			return new Light(model);
	}
}

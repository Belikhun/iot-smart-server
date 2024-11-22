import Device, { createDevice, getDevice } from "../Device/Device";
import { FeatureBase, FeatureFlag, FeatureUpdateSource } from "../Device/Features/FeatureBase";
import { scope } from "../Utils/Logger";
import TuyaAPI from "./TuyaAPI";

const log = scope("tuya");

const {
	TUYA_BASE_URL,
	TUYA_APP_ID,
	TUYA_APP_KEY,
	TUYA_SPACE_ID
} = process.env;

let client: TuyaAPI;
const tuyaDevices: Device[] = [];
const tuyaFeatures: FeatureBase[] = [];
const tuyaValueTimes: { [uuid: string]: number } = {};

const tuyaToFeatureValue = ({ code, value }: { code: string, value: any }): any => {
	switch (code) {
		case "colour_data":
			return tuyaColorStringToRgb(value);

		case "cur_voltage":
		case "cur_power":
		case "bright_value":
		case "temp_value":
			return value / 10;
	}

	return value;
}

const featureToTuyaValue = (feature: FeatureBase): any => {
	const value = feature.getValue();

	switch (feature.model.featureId) {
		case "colour_data":
			return rgbToTuyaColorString(value);

		case "bright_value":
		case "temp_value":
			return Math.round(value * 10);
	}

	return value;
}

export const initializeTuya = async () => {
	client = new TuyaAPI(
		TUYA_BASE_URL as string,
		TUYA_APP_ID as string,
		TUYA_APP_KEY as string
	);

	if (!await client.connect()) {
		log.error("Dừng khởi động máy khách Tuya IoT");
		return;
	}

	await updateDevices();
}

const updateDevices = async () => {
	if (!client)
		return;

	const spaceId = TUYA_SPACE_ID as string;
	const devices = await client.getDevicesInSpace(spaceId);

	for (const { id, name, uuid, localKey } of devices) {
		let device = getDevice(uuid);

		if (!device) {
			log.info(`Đang đăng ký thiết bị Tuya \"${name}\" vào hệ thống...`);

			device = await createDevice({
				hardwareId: uuid,
				name,
				token: localKey,
				externalId: id,
				type: "tuya",
				color: "tuya"
			});
		}

		await registerFeatures(device);
		tuyaDevices.push(device);
		device.connected = true;
	}

	doCheckFeatureUpdate();
	doValuePolling();
}

const registerFeatures = async (device: Device) => {
	if (!client)
		return;

	const properties = await client.getDeviceProperties(device.model.externalId as string);

	for (let { code, name, type, value, time } of properties.properties) {
		const uuid = `${device.model.hardwareId}/${code}`;
		let feature = device.getFeature(code);

		if (!feature) {
			let flags = FeatureFlag.READ | FeatureFlag.WRITE;
			let kind: string | null = null;
			const extras: {[key: string]: any} = { type };

			if (code.startsWith("switch_") && code !== "switch_inching") {
				kind = "FeatureOnOffToggle";
			} else {
				switch (code) {
					case "switch_led":
						name = "Switch"
						kind = "FeatureOnOffToggle";
						break;

					case "do_not_disturb":
						name = "Do Not Disturb Mode";
						kind = "FeatureOnOffToggle";
						break;

					case "colour_data":
						name = "Color";
						kind = "FeatureRGBLed";
						break;

					case "bright_value":
						name = "Brightness";
						kind = "FeatureKnob";
						break;

					case "temp_value":
						name = "Color Temperature";
						kind = "FeatureKnob";
						break;

					case "cur_current": {
						name = "Current";
						kind = "FeatureSensorValue";
						extras.max = 15000;
						extras.min = 0;
						extras.unit = "mA";
						extras.dangerous = 10000;
						break;
					}

					case "cur_voltage": {
						name = "Voltage";
						kind = "FeatureSensorValue";
						extras.max = 320;
						extras.min = 0;
						extras.unit = "V";
						extras.dangerous = 250;
						break;
					}

					case "cur_power": {
						name = "Power";
						kind = "FeatureSensorValue";
						extras.max = 2000;
						extras.min = 0;
						extras.unit = "W";
						extras.dangerous = 1800;
						break;
					}
				}
			}

			if (!kind) {
				log.info(`Chưa xử lý thuộc tính ${code} của thiết bị!`);
				continue;
			}

			feature = await device.createFeature({
				featureId: code,
				uuid,
				flags,
				kind,
				name: (name) ? name : code,
				...extras
			});

			if (feature) {
				feature.setValue(
					tuyaToFeatureValue({ code, value }),
					FeatureUpdateSource.DEVICE
				);

				tuyaValueTimes[feature.model.uuid] = time;
			}
		}

		if (!feature)
			continue;

		tuyaFeatures.push(feature);
	}
}

const pushDeviceValues = async (device: Device) => {
	log.info(`Đang đẩy các giá trị của ${device.model.hardwareId} lên Tuya IoT`);
	const properties: {[code: string]: any} = {};

	for (const feature of Object.values(device.features)) {
		if (!feature.shouldPushValue)
			continue;

		const value = featureToTuyaValue(feature);
		feature.shouldPushValue = false;
		properties[feature.model.featureId] = value;

		if (feature.model.featureId === "temp_value")
			properties.work_mode = "white";

		if (feature.model.featureId === "colour_data")
			properties.work_mode = "colour";

		tuyaValueTimes[feature.model.uuid] = Date.now() - client.deltaT;
	}

	log.outgoing(`[${device.model.hardwareId}] Giá trị mới: `, properties);
	await client.sendProperties(device.model.externalId as string, properties);
}

const doCheckFeatureUpdate = async () => {
	try {
		const promises: { [devId: string]: Promise<void> } = {};

		for (const feature of tuyaFeatures) {
			if (!feature.shouldPushValue)
				continue;

			const devId = feature.device.model.externalId as string;

			// @ts-ignore
			if (promises[devId])
				continue;

			promises[devId] = pushDeviceValues(feature.device);
		}

		await Promise.all(Object.values(promises));
	} catch (e) {
		log.warn(`Đẩy giá trị mới lên máy chủ thất bại!`, e);
	}

	setTimeout(() => doCheckFeatureUpdate(), 50);
}

const pullDeviceValues = async (device: Device) => {
	const codes = [];

	for (const feature of Object.values(device.features))
		codes.push(feature.model.featureId);

	if (codes.length === 0)
		return;

	const properties = await client.getDeviceProperties(device.model.externalId as string, codes);

	for (const { code, value, time } of properties.properties) {
		const feature = device.getFeature(code);

		if (!feature)
			continue;

		if (tuyaValueTimes[feature.model.uuid] && tuyaValueTimes[feature.model.uuid] >= time)
			continue;

		feature.setValue(tuyaToFeatureValue({ code, value }), FeatureUpdateSource.DEVICE);
		tuyaValueTimes[feature.model.uuid] = time;
	}
}

const doValuePolling = async () => {
	const start = performance.now();

	try {
		const promises: Promise<void>[] = [];

		for (const device of tuyaDevices)
			promises.push(pullDeviceValues(device));

		await Promise.all(promises);
	} catch (e) {
		log.warn(`Cập nhật giá trị từ Tuya IoT thất bại!`, e);
	}

	setTimeout(() => doValuePolling(), 1000 - (performance.now() - start));
}

/**
 * Converts an RGB array [r, g, b] to the Tuya color string format.
 *
 * @param rgb - Array of [r, g, b] values (0-255).
 * @returns Tuya color string in HSV format (e.g., "014303520081").
 */
function rgbToTuyaColorString(rgb: [number, number, number]): string {
	const [r, g, b] = rgb.map((x) => x / 255); // Normalize RGB values to 0-1
	const max = Math.max(r, g, b);
	const min = Math.min(r, g, b);
	const delta = max - min;

	// Calculate Hue
	let hue = 0;
	if (delta !== 0) {
		if (max === r) hue = ((g - b) / delta + (g < b ? 6 : 0)) * 60;
		else if (max === g) hue = ((b - r) / delta + 2) * 60;
		else if (max === b) hue = ((r - g) / delta + 4) * 60;
	}

	// Saturation and Value
	const saturation = max === 0 ? 0 : delta / max;
	const value = max;

	// Scale to Tuya ranges and convert to hex
	const hueHex = Math.round(hue * (0x0168 / 360)).toString(16).padStart(4, "0");
	const saturationHex = Math.round(saturation * 0x03E8).toString(16).padStart(4, "0");
	const valueHex = Math.round(value * 0x03E8).toString(16).padStart(4, "0");

	return `${hueHex}${saturationHex}${valueHex}`.toUpperCase();
}

/**
 * Converts a Tuya color string in HSV format to an RGB array [r, g, b].
 *
 * @param tuyaColorString - Tuya color string (e.g., "014303520081").
 * @returns Array of [r, g, b] values (0-255).
 */
function tuyaColorStringToRgb(tuyaColorString: string): [number, number, number] {
	const hue = parseInt(tuyaColorString.slice(0, 4), 16) * (360 / 0x0168);
	const saturation = parseInt(tuyaColorString.slice(4, 8), 16) / 0x03E8;
	const value = parseInt(tuyaColorString.slice(8, 12), 16) / 0x03E8;

	// Convert HSV to RGB
	const c = value * saturation;
	const x = c * (1 - Math.abs((hue / 60) % 2 - 1));
	const m = value - c;

	let r = 0, g = 0, b = 0;
	if (hue >= 0 && hue < 60) [r, g, b] = [c, x, 0];
	else if (hue >= 60 && hue < 120) [r, g, b] = [x, c, 0];
	else if (hue >= 120 && hue < 180) [r, g, b] = [0, c, x];
	else if (hue >= 180 && hue < 240) [r, g, b] = [0, x, c];
	else if (hue >= 240 && hue < 300) [r, g, b] = [x, 0, c];
	else if (hue >= 300 && hue < 360) [r, g, b] = [c, 0, x];

	// Scale back to 0-255 and round
	return [
		Math.round((r + m) * 255),
		Math.round((g + m) * 255),
		Math.round((b + m) * 255),
	];
}

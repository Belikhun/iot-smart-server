import { getDevices } from "./Device/Device";
import { pleft, time } from "./Utils/belibrary";
import { scope } from "./Utils/Logger";

const log = scope("watchdog");
let watchdogTask: any = null;

const run = () => {
	const devices = getDevices();
	const now = time();

	for (const device of Object.values(devices)) {
		if (device.connected) {
			const heartbeat = now - device.lastHeartbeat;
			log.debug(`<${pleft(device.model.hardwareId, 14)}> d_heartbeat=${heartbeat}`);

			if (heartbeat > 10) {
				log.warn(`Thiết bị không phản hồi sau 10 giây, sẽ đặt trạng thái của thiết bị thành ngoại tuyến.`)
				device.setWS(null);
			}
		}
	}
}

export const startWatchdog = () => {
	log.info(`Đang khởi động Watchdog`);

	if (watchdogTask)
		clearInterval(watchdogTask);

	watchdogTask = setInterval(() => run(), 10000);
}

export const stopWatchdog = () => {
	if (watchdogTask) {
		log.warn(`Đang tắt Watchdog...`);
		clearInterval(watchdogTask);
		watchdogTask = null;
	}
}

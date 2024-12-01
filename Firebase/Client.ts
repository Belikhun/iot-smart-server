import admin from "firebase-admin";
import config from "../firebase-admin.json";
import { scope } from "../Utils/Logger";
import type { Message } from "firebase-admin/messaging";

const log = scope("firebase");
const fcmLog = scope("firebase:fcm");

export const initializeFirebase = () => {
	if (admin.apps.length)
		return;

	log.info("Đang khởi tạo Firebase Admin SDK");

	// Khởi tạo Firebase Admin SDK
	const app = admin.initializeApp({
		credential: admin.credential.cert(config as admin.ServiceAccount),
	});

	log.success(`Đăng nhập thành công vào ${app.name}!`);
}

export async function sendNotification({
	title,
	body,
	topic = "mobile",
	sound,
	data
}: { title: string, body: string, topic?: string, sound?: string, data?: Record<string, string> }) {
	try {
		const message: Message = {
			notification: {
				title,
				body
			},

			data: data || {},

			android: {
				notification: {
					priority: "high",
					channelId: "system-alert",
					visibility: "public",
					sound: (sound) ? sound : undefined,
					icon: "house_chimney_window"
				}
			},

			topic
		};

		const response = await admin.messaging().send(message);
		fcmLog.info("Gửi thông báo thành công: ", response);
	} catch (error) {
		fcmLog.error("Lỗi khi gửi thông báo: ", error);
	}
}

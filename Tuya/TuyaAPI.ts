import axios from "axios";
import crypto from "crypto";
import { scope } from "../Utils/Logger";

const log = scope("tuya:log");

class TuyaAPI {
	private baseUrl: string;
	private clientId: string;
	private secretKey: string;
	private token: string | null = null;
	private tokenExpireTime: number = 0;

	constructor(baseUrl: string, clientId: string, secretKey: string) {
		this.baseUrl = baseUrl;
		this.clientId = clientId;
		this.secretKey = secretKey;
	}

	/**
	 * Generate a hash for the request
	 */
	private createHash(payload: string): string {
		return crypto.createHash("sha256").update(payload).digest("hex");
	}

	/**
	 * Generate the HMAC-SHA256 signature
	 */
	private generateSign(
		path: string,
		method: string,
		timestamp: string,
		query: Record<string, any>,
		body: Record<string, any>,
		accessToken: string | null = null
	): string {
		// Sort query parameters alphabetically by their keys
		const sortedQuery = Object.keys(query)
			.sort()
			.reduce((sortedObj, key) => {
				sortedObj[key] = query[key];
				return sortedObj;
			}, {} as Record<string, any>);

		const queryString = new URLSearchParams(sortedQuery).toString();
		const url = queryString ? `${path}?${queryString}` : path;

		// Content Hash for body (empty for GET)
		const bodyString = body && Object.keys(body).length > 0 ? JSON.stringify(body) : "";
		const contentHash = this.createHash(bodyString);

		// String to sign
		const stringToSign = [
			method.toUpperCase(),
			contentHash,
			"",
			decodeURIComponent(url),
		].join("\n");

		const str = this.clientId + (accessToken ? accessToken : "") + timestamp + stringToSign;
		return crypto.createHmac("sha256", this.secretKey).update(str).digest("hex").toUpperCase();
	}

	/**
	 * Fetch a new access token
	 */
	public async getToken(): Promise<string> {
		if (this.token && Date.now() < this.tokenExpireTime)
			return this.token;

		const timestamp = Date.now().toString();
		const path = "/v1.0/token?grant_type=1";
		const sign = this.generateSign(path, "GET", timestamp, {}, {});

		const response = await axios.get(`${this.baseUrl}${path}`, {
			headers: {
				"client_id": this.clientId,
				"t": timestamp,
				"sign": sign,
				"sign_method": "HMAC-SHA256",
			},
		});

		if (response.data.success) {
			const { access_token, expire_time } = response.data.result;
			this.token = access_token;
			this.tokenExpireTime = Date.now() + expire_time * 1000;
			return this.token as string;
		} else {
			throw new Error(`Lỗi khi tạo token mới: ${response.data.msg}`);
		}
	}

	/**
	 * Test connectivity by fetching and validating the token
	 */
	public async connect(): Promise<boolean> {
		try {
			const token = await this.getToken();
			log.success(`Đã kết nối tới Tuya IoT Core. Token: ...${token.slice(-7)}`);
			return true;
		} catch (error) {
			log.error("Lỗi khi cố kết nối tới Tuya IoT Core:", error);
			return false;
		}
	}

	/**
	 * General API request
	 */
	public async request(
		path: string,
		method: "GET" | "POST",
		query: Record<string, any> = {},
		body: Record<string, any> = {}
	): Promise<any> {
		const token = await this.getToken();
		const timestamp = Date.now().toString();
		const sign = this.generateSign(path, method, timestamp, query, body, token);

		const headers = {
			"client_id": this.clientId,
			"access_token": token,
			"t": timestamp,
			"sign": sign,
			"sign_method": "HMAC-SHA256"
		};

		const url = `${this.baseUrl}${path}`;

		try {
			const response = await axios({
				method,
				url,
				params: query,
				data: body,
				headers,
			});

			const { code, msg, success } = response.data;

			if (!success)
				throw new Error(`Lỗi khi gửi yêu cầu tới Tuya IoT Core: [${code}] ${msg}`);

			return response.data.result;
		} catch (error) {
			log.error(`Lỗi khi gửi yêu cầu lên Tuya IoT (${path}):`, error);
			throw error;
		}
	}

	/**
	 * Send a command to a device
	 */
	public async sendCommand(deviceId: string, commands: any[]): Promise<any> {
		return this.request(`/v2.0/devices/${deviceId}/commands`, "POST", {}, { commands });
	}

	/**
	 * Get the status of a device
	 */
	public async getDeviceStatus(deviceId: string): Promise<any> {
		return this.request(`/v2.0/devices/${deviceId}/status`, "GET");
	}

	/**
	 * Get the list of devices in a space
	 *
	 * @param spaceIds The space IDs (comma-separated if multiple)
	 * @param pageNo The page number (default: 1)
	 * @param pageSize The number of devices per page (default: 20)
	 * @param isRecursion Whether to recursively fetch devices (default: false)
	 * @returns List of devices in the specified space
	 */
	public async getDevicesInSpace(
		spaceIds: string,
		pageNo: number = 1,
		pageSize: number = 20,
		isRecursion: boolean = false
	): Promise<any> {
		const path = `/v2.0/cloud/thing/space/device`;
		const query = {
			space_ids: spaceIds,
			page_size: pageSize,
			is_recursion: isRecursion,
			page_no: pageNo,
		};

		const response = await this.request(path, "GET", query);
		return response;
	}

	public async getDeviceProperties(
		deviceId: string,
		codes: string[] = []
	): Promise<any> {
		const path = `/v2.0/cloud/thing/${deviceId}/shadow/properties`;
		const query: {[name: string]: any} = { device_id: deviceId };

		if (codes.length > 0)
			query.codes = codes.join(",");

		const response = await this.request(path, "GET", query);
		return response;
	}

	public async sendProperties(
		deviceId: string,
		properties: { [code: string]: any }
	): Promise<any> {
		const path = `/v2.0/cloud/thing/${deviceId}/shadow/properties/issue`;
		const query = {};
		const body = { properties };

		const response = await this.request(path, "POST", query, body);
		return response;
	}
}

export default TuyaAPI;

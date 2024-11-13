
export default class APIResponse {

	public readonly code: number;
	public readonly description: string;
	public readonly status: number;
	public data: object | null = null;
	public timestamp: number;
	public runtime: number;

	protected headers: { [name: string]: string };

	constructor(code: number, description: string, status: number = 200, data: object | null = null) {
		this.code = code;
		this.description = description;
		this.status = status;
		this.data = data;
		this.timestamp = 0;
		this.runtime = 0;

		this.headers = {};
	}

	header(name: string, value: string | null = null) {
		if (!value) {
			delete this.headers[name];
			return this;
		}

		this.headers[name] = value;
		return this;
	}

	getHeaders() {
		return this.headers;
	}
}

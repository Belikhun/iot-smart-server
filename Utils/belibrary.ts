import moment from "moment";

const start = performance.now()

export function randomString(length: number = 16, charSet: string = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789") {
	let randomString = "";

	for (let i = 0; i < length; i++) {
		let p = Math.floor(Math.random() * charSet.length);
		randomString += charSet.substring(p, p + 1);
	}

	return randomString;
}

export function time(): number {
	return moment().valueOf() / 1000;
}

export function runtime(): number {
	return Math.floor(performance.now() - start);
}

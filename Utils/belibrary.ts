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

/**
 * Add padding to the left of input
 *
 * Example:
 *
 * + 21 with length 3: 021
 * + "sample" with length 8: "  sample"
 *
 * @param	{string|number}		input	Input String
 * @param	{number}			length	Length
 * @param	{boolean}			right	Align right???
 */
export function pleft(input: string | number, length: number = 0, right: boolean = false): string {
	const type = typeof input;
	let padd = "";

	if (typeof input === "number")
		input = input.toString();

	switch (type) {
		case "number":
			padd = "0";
			break;

		case "string":
			padd = " ";
			break;

		default:
			console.error(`error: pleft() first arg is ${type}`);
			return input;
	}

	padd = padd.repeat(Math.max(0, length - input.length));
	return (right) ? input + padd : padd + input;
}

export function encodeInt16ArrayToBase64(int16Array: Int16Array): string {
	const uint8Array = new Uint8Array(int16Array.buffer);

	let binaryString = "";
	for (let i = 0; i < uint8Array.length; i++)
		binaryString += String.fromCharCode(uint8Array[i]);

	return btoa(binaryString);
}

export function decodeBase64ToInt16Array(base64String: string): Int16Array {
	const binaryString = atob(base64String);
	const uint8Array = new Uint8Array(binaryString.length);

	for (let i = 0; i < binaryString.length; i++)
		uint8Array[i] = binaryString.charCodeAt(i);

	return new Int16Array(uint8Array.buffer);
}

export function satisfySearch(content: string[], search: string) {
	const tokens = search.toLocaleLowerCase().split(" ");
	const target = content
		.map((i) => i.toLocaleLowerCase())
		.join(" ");

	for (const token of tokens) {
		if (!target.includes(token))
			return false;
	}

	return true;
}

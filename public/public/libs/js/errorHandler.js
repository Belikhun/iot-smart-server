/**
 * /assets/js/errorHandler.js
 *
 * Handle the damn error for me. Im lazy
 *
 * This file is licensed under the MIT License.
 * See LICENSE in the project root for license information.
 *
 * @author		Belikhun
 * @version		1.0
 * @license		MIT
 * @copyright	2018-2023 Belikhun
 */

/**
 * Parse error stack
 *
 * @param	{Error|Object}	error
 */
function parseException(error, inStack = false) {

	/** @type {Number|String} */
	let code = "ERROR";

	if (error instanceof Error) {
		code = error.constructor.name;
	} else if (typeof error === "object") {
		if (typeof error.code === "number") {
			code = (typeof error.status === "number")
				? `E${error.code} HTTP${error.status}`
				: `E${error.code}`;
		} else if (typeof error.code === "string") {
			code = error.code;
		} else if (typeof error.name === "string") {
			code = error.name;
		}
	}

	/** @type {String} */
	let description = "An undefined error occured. Check console for more information.";

	if (error instanceof Error) {
		description = error.message;
	} else if (typeof error === "object") {
		if (typeof error.description === "string") {
			description = error.description;
		} else if (typeof error.message === "string") {
			description = error.message;
		}
	}

	// File location parser specifically for
	// Error object and my custom api error
	// format (see BaseException)
	let file;

	if (error instanceof Error) {
		let stack = error.stack;
		file = stack.split("\n")[1];

		if (file)
			file = file.slice(file.indexOf("at ") + 3, file.length);
	} else if (
		error.data
		&& typeof error.data === "object"
		&& typeof error.data.file === "string"
		&& typeof error.data.line === "number"
	) {
		file = `${error.data.file}:${error.data.line}`;
	}

	if (file)
		description += ` tại ${file}`;

	// Create a copy of error object without
	// referencing to it
	let _e = { ...error };

	/** @type {Array} */
	let stack = []

	if (!inStack) {
		while (_e.data && typeof _e.data === "object") {
			let err = parseException(_e.data, true);

			// If no error detail found in the end of the
			// stack, we can stop executing now
			if (!err || err.description === "Unknown")
				break;

			stack.push(`\t[${err.code}] >>> ${err.description}`);
			_e = _e.data;
		}
	}

	return {
		code,
		description,
		stack
	}
}

const errorHandler = async (error, returnable = true) => {
	if (!popup || !popup.initialized)
		return;

	const { code, description, stack } = parseException(error);
	const buttons = {}

	if (returnable)
		buttons.back = { text: "Quay lại", color: "green" }

	let errorLines = [`${code}: ${description}`]

	if (stack.length > 0)
		errorLines = [...errorLines, "", "Stack Trace:", ...stack]

	const errorBox = document.createElement("ul");
	errorBox.classList.add("textView", "breakWord");
	errorBox.innerHTML = errorLines.map(i => `<li>${i}</li>`).join("");

	if (error.data.report) {
		buttons.viewReport = {
			text: app.string("response.errorReport"),
			color: "red",
			onClick: () => window.open(error.data.report, "_blank"),
			resolve: false
		}
	}

	await popup.show({
		windowTitle: "Error Handler",
		title: app.string("popup_error_title"),
		message: app.string("popup_error_description"),
		level: "error",
		customNode: errorBox,
		buttons
    });

	if (typeof gtag === "function") {
		gtag("event", "errored", {
			"event_category": "error",
			"event_label": "exception",
			value: `${code} >>> ${description}`
		});
	}
}

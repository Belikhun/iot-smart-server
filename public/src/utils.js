
function calcColorBrightness(rgb) {
	const [r, g, b] = rgb;
	const brightness = 0.299 * r + 0.587 * g + 0.114 * b;
	return (brightness / 255) * 100;
}

function updateBrightness(rgb, targetBrightness) {
	const [r, g, b] = rgb;
	const currentBrightness = calcColorBrightness(rgb);

	if (currentBrightness === 0) {
		const brightnessValue = (targetBrightness / 100) * 255;

        return [
            Math.round(brightnessValue),
            Math.round(brightnessValue),
            Math.round(brightnessValue),
		];
	}

	const scaleFactor = targetBrightness / ((currentBrightness / 255) * 100);

	const newR = Math.min(255, Math.max(0, Math.round(r * scaleFactor)));
	const newG = Math.min(255, Math.max(0, Math.round(g * scaleFactor)));
	const newB = Math.min(255, Math.max(0, Math.round(b * scaleFactor)));

	return [newR, newG, newB];
}

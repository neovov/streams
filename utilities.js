export function toASCII(number) {
	return String.fromCharCode(number);
}

export function toBin(number, padded = true) {
	return `0b${number.toString(2).padStart(padded ? 8 : 0, '0')}`;
}

export function toHex(number, padded = true) {
	return `0x${number.toString(16).padStart(padded ? 2 : 0, '0')}`;
}

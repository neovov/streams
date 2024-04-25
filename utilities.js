const KB = 1024;
const MB = KB * 1024;
const GB = MB * 1024;

export function formatBytesToHumanReadable(bytes) {
	if (bytes < KB) {
		return `${bytes} bytes`;
	} else if (bytes < MB) {
		return `${Math.floor(bytes / KB)} kB`;
	} else if (bytes < GB) {
		return `${Math.floor(bytes / MB)} MB`;
	} else {
		return bytes;
	}
}

export function stringToHTML(string) {
	const {body} = new DOMParser().parseFromString(string, 'text/html');
	return body.children.length > 1 ? body.children : body.children[0];
}

export function toASCII(number) {
	return String.fromCharCode(number);
}

export function toBin(number, padded = true) {
	return `0b${number.toString(2).padStart(padded ? 8 : 0, '0')}`;
}

export function toHex(number, padded = true) {
	return `0x${number.toString(16).padStart(padded ? 2 : 0, '0')}`;
}

export function debounce(fn, time) {
	let cleared = true;
	return (...args) => {
		if (cleared) {
			fn(...args);
			cleared = false;
			setTimeout(() => (cleared = true), time);
		}
	};
}

export default class WindowSizeObserver {
	#callback;
	#height;
	#pixelRatio;
	#width;

	constructor({callback} = {}) {
		const {devicePixelRatio, innerHeight: height, innerWidth: width} = window;
		this.#callback = callback;
		this.#height = height;
		this.#pixelRatio = Math.min(devicePixelRatio, 2);
		this.#width = width;

		window.addEventListener('resize', this.#onResize);
	}

	destruct() {
		window.removeEventListener('resize', this.#onResize);
	}

	get aspectRatio() {
		return this.#width / this.#height;
	}

	get height() {
		return this.#height;
	}

	#onResize = () => {
		const {devicePixelRatio, innerHeight: height, innerWidth: width} = window;
		this.#height = height;
		this.#pixelRatio = Math.min(devicePixelRatio, 2);
		this.#width = width;

		this.#callback?.({
			aspectRatio: this.aspectRatio,
			height,
			pixelRatio: this.#pixelRatio,
			width,
		});
	};

	get pixelRatio() {
		return this.#pixelRatio;
	}

	get width() {
		return this.#width;
	}
}

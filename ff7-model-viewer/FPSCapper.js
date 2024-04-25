/**
 * @see https://woodenraft.games/blog/how-to-implement-consistent-frame-rate-threejs
 */
export default class FPSCapper {
	#callback;
	#interval = 1000 / 60;
	#lastOverTime = 0;
	#lastTime = 0;
	#target = 60;

	constructor(fps, callback) {
		this.callback = callback;
		this.fps = fps;
	}

	get callback() {
		return this.#callback;
	}

	set callback(callback) {
		this.#callback = callback;
	}

	get fps() {
		return this.#target;
	}

	set fps(fps) {
		this.#target = Math.max(1, fps);
		this.#interval = 1000 / this.#target;
	}

	loop(time = 0) {
		let delta = time - this.#lastTime;
		if (delta < this.#interval) return;

		const prevOverTime = this.#lastOverTime;
		this.#lastOverTime = delta % this.#interval;
		this.#lastTime = time - this.#lastOverTime;
		delta -= prevOverTime;

		return this.#callback(delta);
	}
}

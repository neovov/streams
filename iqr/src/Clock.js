import {DEFAULT_FPS} from './constants.js';

/**
 * @see https://woodenraft.games/blog/how-to-implement-consistent-frame-rate-threejs
 */
export default class Clock {
	#callback;
	#id;
	#interval;
	#lastOverTime = 0;
	#lastTime = 0;
	#maxFPS = 0;
	#target;

	constructor({autoStart = true, callback, fps = DEFAULT_FPS}) {
		this.#callback = callback;
		this.fps = fps;

		if (autoStart) this.start();
	}

	destruct() {
		this.stop();
	}

	get fps() {
		return this.#target;
	}

	set fps(fps) {
		this.#target = Math.max(0, fps);
		this.#interval = 1000 / this.#target;
	}

	get maxFPS() {
		return this.#maxFPS;
	}

	start() {
		this.#id = window.requestAnimationFrame(this.#tick);
	}

	stop() {
		window.cancelAnimationFrame(this.#id);
	}

	#tick = (time = 0) => {
		this.#id = window.requestAnimationFrame(this.#tick);
		this.#maxFPS = Math.max(this.#maxFPS, 1000 / (time - this.#lastTime - this.#lastOverTime));

		const delta = time - this.#lastTime;
		if (delta < this.#interval) return;

		const prevOverTime = this.#lastOverTime;
		this.#lastOverTime = delta % this.#interval;
		this.#lastTime = time - this.#lastOverTime;

		return this.#callback(time, delta - prevOverTime);
	};
}

import Bomb from './Bomb.js';

export default class Grid {
	#grid;
	#width;
	#scene;

	constructor(width, depth, scene) {
		width = Math.max(4, width);
		this.#grid = Array.from({length: width * depth}).map(() => ({bomb: null, cube: null}));
		this.#width = width;
		this.#scene = scene;

		this.bombIndex = null;
	}

	#getIndex(index) {
		return typeof index === 'number' ? index : this.getIndexFromVector2(index);
	}

	addCube(cube, index) {
		this.#grid[this.#getIndex(index)].cube = cube;
		this.#scene.add(cube);
	}

	addBomb(bomb, index) {
		this.#grid[index].bomb = bomb;
		this.bombIndex = index;
	}

	placeBomb({x, z}) {
		if (this.hasBomb({x, z})) return;
		x = Math.trunc(x);
		z = Math.trunc(z);
		const index = this.getIndexFromVector2({x, y: z});
		console.log('placing at', index, x, z);
		const bomb = new Bomb(x, z);
		this.#grid[index].bomb = bomb;
		this.#scene.add(bomb);
		this.bombIndex = index;
	}

	hasBomb({x, z}) {
		const index = this.getIndexFromVector2({x, y: z});
		console.log('hasBomb', index, this.#grid[index]);
		return Boolean(this.#grid[index].bomb);
	}

	get(index) {
		return this.#grid[index];
	}

	remove(index) {
		this.#grid[index] = undefined;
		if (index === this.bombIndex) this.bombIndex = null;
	}

	getIndexFromVector2({x, y}) {
		return Math.trunc(x) + Math.trunc(y) * this.#width;
	}
}

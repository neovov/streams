import {Group} from 'three';
import World from './World.js';
import Cube from './Cube.js';

const STAGES = {
	1: {
		depth: 15,
		phases: [
			[2, 2, 2],
			[2, 2, 2],
			[3, 3, 3],
			[4, 4, 4],
		],
		width: 4,
	},
};

export default class Stage extends Group {
	#cubes = [];
	#currentCubes = [];
	#phase = 0;
	#set = 0;
	#world;

	constructor(nb) {
		super();

		const {depth, phases, width} = STAGES[Math.min(Math.max(1, nb), 8)];
		const phase = phases[this.#phase];
		const cubes = phase.map((set) => set * width).reduce((total, current) => (total += current), 0);

		for (let i = 0; i < cubes; i++) {
			const x = Math.trunc(i % width);
			const z = Math.trunc(i / width);
			const cube = new Cube(x, z);
			this.#cubes.push(cube);
		}

		this.#currentCubes = this.#cubes.slice(this.#set * width, phase[this.#set] * width);
		this.#world = new World(width, depth);

		this.add(...this.#cubes);
		this.add(this.#world);
	}

	destruct() {
		this.#world.destruct();
	}

	get collisionables() {
		return [...this.#currentCubes, this.#world.collisionMesh];
	}

	get spawn() {
		return this.#world.spawn;
	}

	#addRow() {
		// TODO: Animate
		const {width, depth} = this.#world.geometry.parameters;
		this.#world.destruct();
		this.remove(this.#world);

		this.#world = new World(width, depth + 1);
		this.add(this.#world);
	}

	#removeRow() {
		// TODO: Animate
		const {width, depth} = this.#world.geometry.parameters;
		this.#world.destruct();
		this.remove(this.#world);

		this.#world = new World(width, depth - 1);
		this.add(this.#world);
	}
}

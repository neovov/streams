import Cube from './cubes/Cube.js';

// Stage 1:
// 4 phases:
// 3 sets de 2 rows (2 phases)
// 3 sets de 3 rows (1 phase)
// 3 sets de 4 rows (1 phase)

// Stage 2:
// 4 phases:
// 4 rows, 5 rows, 5 rows
// 5 rows,

export default class Grid {
	#grid = [];
	constructor(sets, width, depth) {
		this.#grid = sets.map(({rows}) => {
			const cubes = Array.from({length: rows}).map(() => {
				const foo = Array.from({length: width}).map((v, i) => new Cube(i, depth));
				depth += 1;
				return foo;
			});
			return cubes;
		});
	}

	get cubes() {
		return this.#grid.flat(2);
	}

	getSetIterator() {
		return this.#grid.reverse().values();
	}
}

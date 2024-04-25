import {CUBE_SIZE} from './constants.js';
import {Mesh, MeshBasicMaterial, PlaneGeometry} from 'three';

export const geometry = new PlaneGeometry(CUBE_SIZE, CUBE_SIZE);

export const materialExploding = new MeshBasicMaterial({
	color: 'red',
	opacity: 0.4,
	transparent: true,
});

export const materialGreen = new MeshBasicMaterial({
	color: 'green',
	opacity: 0.4,
	transparent: true,
});

export const materialNormal = new MeshBasicMaterial({
	color: 'blue',
	opacity: 0.4,
	transparent: true,
});

export const BOMB_EXPLODING_TIME = 500;
export const BOMB_TYPES = {
	GREEN: 'green',
	NORMAL: 'normal',
};

function getMaterialFromType(type) {
	switch (type) {
		case 'green':
			return materialGreen;
		case 'normal':
			return materialNormal;
	}
}

export default class Bomb extends Mesh {
	#bombType;

	constructor(x, z, type = BOMB_TYPES.NORMAL) {
		super(geometry, getMaterialFromType(type));
		this.#bombType = type;
		this.position.x = x + CUBE_SIZE / 2;
		this.position.y = 0.01;
		this.position.z = z + CUBE_SIZE / 2;
		this.rotation.x = -Math.PI / 2;
	}

	get bombType() {
		return this.#bombType;
	}

	explode() {
		this.material = materialExploding;
		return new Promise((resolve) => setTimeout(() => resolve(this), BOMB_EXPLODING_TIME));
	}
}

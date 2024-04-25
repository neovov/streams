import {CUBE_SIZE} from './constants.js';
import {MeshPhongMaterial, RepeatWrapping, TextureLoader} from 'three';
import Cube from './Cube.js';

const texture = new TextureLoader().load('./assets/black.png');
texture.repeat.set(CUBE_SIZE, CUBE_SIZE);
texture.wrapS = RepeatWrapping;
texture.wrapT = RepeatWrapping;

const material = new MeshPhongMaterial({map: texture});

export default class BlackCube extends Cube {
	constructor(x, z) {
		super(x, z);
		const [mesh] = this.children;
		mesh.material = material;
	}
}

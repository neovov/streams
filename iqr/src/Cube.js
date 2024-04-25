import {BoxGeometry, Group, Mesh, MeshPhongMaterial, RepeatWrapping, TextureLoader} from 'three';
import {CUBE_SIZE} from './constants.js';

const texture = new TextureLoader().load('./assets/stage-1.png');
texture.repeat.set(CUBE_SIZE, CUBE_SIZE);
texture.wrapS = RepeatWrapping;
texture.wrapT = RepeatWrapping;

const geometry = new BoxGeometry(CUBE_SIZE, CUBE_SIZE, CUBE_SIZE);
const material = new MeshPhongMaterial({map: texture});

export default class Cube extends Group {
	constructor(x, z) {
		super();
		this.position.x = x;
		this.position.z = z + CUBE_SIZE;

		const mesh = new Mesh(geometry, material);
		mesh.position.x = CUBE_SIZE / 2;
		mesh.position.y = CUBE_SIZE / 2;
		mesh.position.z = -(CUBE_SIZE / 2);
		this.add(mesh);
	}
}

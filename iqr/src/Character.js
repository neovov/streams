import {Box3, BoxGeometry, Group, Mesh, MeshBasicMaterial, Vector3} from 'three';

export const material = new MeshBasicMaterial({color: 'yellow', wireframe: true});

export default class Character extends Group {
	#height;
	#width;

	constructor() {
		super();
		const mesh = new Mesh(new BoxGeometry(0.5, 0.5, 0.5), material);
		mesh.position.y = 0.5 / 2;

		const {x: width, y: height} = new Box3().setFromObject(mesh).getSize(new Vector3());
		this.#height = height;
		this.#width = width;

		this.add(mesh);
	}

	destruct() {
		this.children[0].geometry.dispose();
		this.children[0].material.dispose();
	}

	get collisionMesh() {
		return this;
	}

	get height() {
		return this.#height;
	}

	get width() {
		return this.#width;
	}
}

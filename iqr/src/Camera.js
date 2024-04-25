import {DEFAULT_FOV} from './constants.js';
import {Group, PerspectiveCamera, Vector3} from 'three';

export default class Camera extends PerspectiveCamera {
	#group = new Group();
	#positionOffset = new Vector3(0, 2.5, 3);

	constructor({fov = DEFAULT_FOV} = {}) {
		super(fov);
		this.#group.add(this);
		this.position.copy(this.#positionOffset);
	}

	get group() {
		return this.#group;
	}

	get positionOffset() {
		return this.#positionOffset;
	}

	update({yawRight, yawLeft}) {
		const {y} = this.group.rotation;
		if (yawLeft) this.group.rotation.y = Math.max(-0.45, y - 0.01);
		if (yawRight) this.group.rotation.y = Math.min(0.45, y + 0.01);
	}
}

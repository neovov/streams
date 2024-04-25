import {Raycaster, Vector3} from 'three';

export default class CharacterController {
	#character;
	#speed = 0.05;

	constructor(character) {
		this.#character = character;
	}

	update(
		{directionBackward, directionForward, directionLeft, directionRight},
		collisionables = []
	) {
		const vector = new Vector3();
		if (directionBackward) vector.z = this.#speed;
		if (directionForward) vector.z = -this.#speed;
		if (directionLeft) vector.x = -this.#speed;
		if (directionRight) vector.x = this.#speed;
		if (!vector.x && !vector.z) return;

		// FIXME
		if (directionForward) {
			if (directionLeft) {
				this.#character.rotation.y = Math.PI / 4;
			} else if (directionRight) {
				this.#character.rotation.y = -Math.PI / 4;
			} else {
				this.#character.rotation.y = 0;
			}
		} else if (directionBackward) {
			if (directionLeft) {
				this.#character.rotation.y = (Math.PI / 4) * 3;
			} else if (directionRight) {
				this.#character.rotation.y = (-Math.PI / 4) * 3;
			} else {
				this.#character.rotation.y = Math.PI;
			}
		} else {
			if (directionLeft) {
				this.#character.rotation.y = Math.PI / 2;
			} else if (directionRight) {
				this.#character.rotation.y = -Math.PI / 2;
			}
		}

		// FIXME: Use two rays on bounds instead of one in center
		const direction = vector.clone().normalize();
		const caster = new Raycaster(this.#character.position, direction);
		const collisions = caster.intersectObjects(collisionables);

		const maxDistance =
			0.01 + // Add a 0.01 leeway to avoid merging the character with the mesh
			vector
				.clone()
				.multiplyScalar(this.#character.width / this.#speed)
				.length() /
				2;

		for (const collision of collisions) {
			if (collision.distance <= maxDistance) return;
		}

		this.#character.position.add(vector);
	}
}

import {
	BackSide,
	BoxGeometry,
	Mesh,
	MeshBasicMaterial,
	MeshPhongMaterial,
	RepeatWrapping,
	TextureLoader,
	Vector3,
} from 'three';
import {WORLD_HEIGHT, WORLD_MIN_WIDTH} from './constants.js';

// const texture = new TextureLoader().load(
// 	'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAACAAAAAgCAMAAABEpIrGAAAAAXNSR0IArs4c6QAAAKtQTFRFxtbnvdbvvc7vvc7ntcbntcbetcbWtb3erb3erb3WrbXOpbXWpbXOpa3OnK3OnK3GlK3GnKXGlKXGlKW9lJy9jJy9jJy1jJS1jJSthJS1hJSthIythIyle4yte4yle4Sle4Scc4Slc4Scc4SUc3ucc3uUa3uUa3uMa3OMa3OEY3OEY2uEY2t7Y2tzWmtzY2NzWmN7WmNzWmNrWlprUlprUlpjUlJjUlJaSlJapMSrPgAAAa5JREFUeNo1kAGOJDEIA8uGvtX9/7Wn6cAFNBup1ZByHJN8qEPMoqvL8fykqcI4bCUQ0HDUTVj9aY0A0hnOqUyuSNg2h2lK74WdJYk/kfCCIiDFrGJuPSlJGWlz2dInfOGR3S+kZWdKa21fhp0TzNTTc8JP6J0C2XJVmQ0GCmUZ+d+pYYmSPrTSMUNZSmsCFn02W2++6J5CiMx4ovx456bLgSNvgdHwtIUuw3pkKYjw2guezVadGDId50Jhd0tKQFkqIEhCEUGYFtLvg+WRrGaXPOIJwhh7BW/Wa51oKUMeDsN1zgq+r56ZEbpUGjq6Y43gcaQ83GKy86swU+Rf5NDlg5EHbuoj5Tj8THu5114iT19u1lCdyYszYrOtKD9wMCChzDdPpntYXxx8umQjrO8UU21sLPcHpt3rRlAw+S7hiKkAz9Y0TWLLZbsIG8w4HCOqxyEYBjXKpd0dgaxVZI7jxB6s6V4TVkjtcfhGQtgBUu+WZ6uRsoxbZuhwqSZdRQ/3TOFS88BXcEFb0NJ459f/sw57dmT7jYpMa5pfTu1vJVN1hocMF7OGrKB7Ff8B/e+oEL1/qcEAAAAASUVORK5CYII='
// );
const texture = new TextureLoader().load('./assets/stage-1.png');
texture.wrapS = RepeatWrapping;
texture.wrapT = RepeatWrapping;

// FIXME: Clone textures while not loaded causes a warning
export const materialX = new MeshPhongMaterial({map: texture.clone()});
export const materialY = new MeshPhongMaterial({map: texture.clone()});
export const materialZ = new MeshPhongMaterial({map: texture.clone()});

export default class World extends Mesh {
	#collisionMesh;
	#spawn;

	constructor(width, depth) {
		const height = WORLD_HEIGHT;
		width = Math.max(WORLD_MIN_WIDTH, width);

		materialX.map.repeat.set(depth, height);
		materialY.map.repeat.set(width, depth);
		materialZ.map.repeat.set(width, height);

		super(new BoxGeometry(width, height, depth), [
			materialX, // +x
			materialX, // -x
			materialY, // +y
			materialY, // -y
			materialZ, // +z
			materialZ, // -z
		]);

		this.position.set(width / 2, -height / 2, depth / 2);

		this.#collisionMesh = new Mesh(
			new BoxGeometry(width, 1, depth),
			new MeshBasicMaterial({side: BackSide, wireframe: true})
		);
		this.#collisionMesh.position.set(width / 2, 0.5, depth / 2);
		this.#collisionMesh.updateWorldMatrix();

		this.#spawn = new Vector3(width / 2, 0, depth - 1);
	}

	destruct() {
		this.#collisionMesh.geometry.dispose();
		this.#collisionMesh.material.dispose();
		this.geometry.dispose();
		this.material.forEach((material) => material.dispose());
	}

	get collisionMesh() {
		return this.#collisionMesh;
	}

	get spawn() {
		return this.#spawn;
	}
}

import {AmbientLight, Scene, WebGLRenderer} from 'three';
import {debounce} from './debounce.js';
import {PLAYER_ACTIONS} from './constants.js';
import Bomb from './Bomb.js';
import Camera from './Camera.js';
import Character from './Character.js';
import CharacterController from './CharacterController.js';
import Clock from './Clock.js';
import PlayerControls from './PlayerControls.js';
import WindowSizeObserver from './WindowSizeObserver.js';
import Stage from './Stage.js';
import World from './World.js';

import Cube from './Cube.js';
import GreenCube from './GreenCube.js';
import BlackCube from './BlackCube.js';

import {OrbitControls} from 'three/addons/controls/OrbitControls.js';

export default class Game {
	#ambientLight;
	#camera;
	#character;
	#characterController;
	#clock;
	#orbitControls;
	#playerControls;
	#renderer;
	#scene;
	#stage;
	#windowSizeObserver;

	constructor({canvas} = {}) {
		if (!canvas) throw new Error('Cannot instanciate Game as canvas is null');

		this.#ambientLight = new AmbientLight(0xbbbbbb);
		this.#camera = new Camera();
		this.#character = new Character();
		this.#characterController = new CharacterController(this.#character);
		this.#clock = new Clock({callback: this.#tick});
		this.#playerControls = new PlayerControls();
		this.#renderer = new WebGLRenderer({antialias: true, canvas});
		this.#scene = new Scene();
		this.#stage = new Stage(1);
		this.#windowSizeObserver = new WindowSizeObserver({callback: this.#onResize});

		// FIXME: For debug only
		this.#orbitControls = new OrbitControls(this.#camera, canvas);
		this.#orbitControls.enableDamping = true;
		this.#orbitControls.target = this.#character.position;

		this.#character.position.copy(this.#stage.spawn);
		this.#camera.group.position.copy(this.#character.position);
		this.#camera.lookAt(this.#character.position);

		this.#onResize(this.#windowSizeObserver);
		this.#scene.add(this.#ambientLight);
		this.#scene.add(this.#camera.group);
		this.#scene.add(this.#character);
		this.#scene.add(this.#stage);
	}

	destruct() {
		this.#character.destruct();
		this.#clock.destruct();
		this.#playerControls.destruct();
		this.#renderer.dispose();
		this.#scene.children.forEach(function dispose(object) {
			object.dispose?.();
			object.children?.forEach(dispose);
			object.geometry?.dispose();
			object.material?.dispose();
		});
		this.#stage.destruct();
		this.#windowSizeObserver.destruct();
	}

	#onResize = ({aspectRatio, height, pixelRatio, width}) => {
		this.#camera.aspect = aspectRatio;
		this.#camera.updateProjectionMatrix();

		this.#renderer.setSize(width, height);
		this.#renderer.setPixelRatio(pixelRatio);
	};

	pause() {
		this.#clock.stop();
	}

	resume() {
		this.#clock.start();
	}

	#explodeBomb = (bomb) => {
		bomb.explode().then(() => {});
	};

	// #toggleBomb = debounce(() => {
	// 	if (this.#grid.bombIndex !== null) {
	// 		const index = this.#grid.bombIndex;
	// 		const {bomb} = this.#grid.get(index);
	// 		this.#explodeBomb(bomb);
	// 		bomb.explode().then(() => {
	// 			const {cube} = this.#grid.get(index);

	// 			if (cube) {
	// 				this.#scene.remove(cube);
	// 				if (cube instanceof BlackCube) {
	// 					this.removeRow();
	// 				}

	// 				if (cube instanceof GreenCube) {
	// 					let {x, z} = cube.position;
	// 					z--;
	// 					this.#scene.add(new Bomb(x - 1, z - 1, 'green'));
	// 					this.#scene.add(new Bomb(x - 1, z + 1, 'green'));
	// 					this.#scene.add(new Bomb(x - 1, z, 'green'));
	// 					this.#scene.add(new Bomb(x, z - 1, 'green'));
	// 					this.#scene.add(new Bomb(x, z + 1, 'green'));
	// 					this.#scene.add(new Bomb(x, z, 'green'));
	// 					this.#scene.add(new Bomb(x + 1, z - 1, 'green'));
	// 					this.#scene.add(new Bomb(x + 1, z, 'green'));
	// 					this.#scene.add(new Bomb(x + 1, z + 1, 'green'));
	// 				}
	// 			}
	// 			this.#scene.remove(bomb);
	// 			this.#grid.remove(index);
	// 		});
	// 	} else {
	// 		console.log('placing bomb');
	// 		this.#grid.placeBomb(this.#character.position);
	// 	}
	// }, 250);

	#tick = (time, delta) => {
		window.stats.begin();

		if (this.#playerControls.playerActions[PLAYER_ACTIONS.EXPLODE_GREEN_BOMBS]) {
			this.#scene.children
				.filter((object) => object instanceof Bomb && object.bombType === 'green')
				.forEach((bomb) => bomb.explode().then(() => this.#scene.remove(bomb)));
		}

		if (this.#playerControls.playerActions[PLAYER_ACTIONS.TOGGLE_BOMB]) {
			// this.#toggleBomb();
		}

		// this.#orbitControls.update();
		this.#characterController.update(
			this.#playerControls.playerActions,
			this.#stage.collisionables
		);

		this.#camera.group.position.copy(this.#character.position);
		this.#camera.update(this.#playerControls.playerActions);

		this.#renderer.render(this.#scene, this.#camera);
		window.stats.end();
	};
}

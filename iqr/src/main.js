import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import * as THREE from 'three';
import GUI from 'lil-gui';
import CharacterControls from './CharacterController.js';
import PlayerControls from './PlayerControls.js';
import Bomb from './Bomb.js';
import World from './World.js';
// import Grid from './Grid.js';
import Game from './Game.js';

const stats = new Stats();
document.body.appendChild(stats.dom);
window.stats = stats;

const game = new Game({
	canvas: document.getElementById('canvas'),
});

Object.assign(window, {game});
window.game = game;

// const GLOBAL_STATE = {};

// const gui = new GUI();

// const bombs = [];

// let bomb;
// let bombPlanted = false;
// let bombDisappering = false;
// function plantBomb() {
// 	if (bomb) return;
// 	console.log('Planting bomb');
// 	const x = Math.floor(character.position.x) + 0.5;
// 	const z = Math.floor(character.position.z) + 0.5;
// 	bomb = new Bomb(x, z);
// 	scene.add(bomb);
// 	bombPlanted = true;
// }

// function explodeBomb() {
// 	if (!bombPlanted) return;
// 	if (bombDisappering) return;
// 	console.log('Exploding');

// 	bombDisappering = true;

// 	const position = bomb.position.clone();
// 	position.y -= 0.01;
// 	const caster = new THREE.Raycaster(position, new THREE.Vector3(0, 1, 0));
// 	const collisions = caster.intersectObjects(cubes);

// 	if (collisions.length && collisions[0].distance < 0.01) {
// 		const cube = collisions[0].object.parent;
// 		cubes.splice(cubes.indexOf(cube), 1);
// 		scene.remove(cube);
// 	}

// 	const exploding = bomb;
// 	bomb = undefined;
// 	exploding.explode().then(() => {
// 		scene.remove(exploding);
// 		bombPlanted = false;
// 		bombDisappering = false;
// 	});
// }

// const WORLD_WIDTH = 4;
// const WORLD_DEPTH = -14;

// const grid = new Grid([{rows: 2}, {rows: 2}, {rows: 2}], WORLD_WIDTH, WORLD_DEPTH);

// scene.add(...grid.cubes);

// const iterator = grid.getSetIterator();
// let currentSet;
// let cubes;
// function gameLoop() {
// 	if (!currentSet || !cubes.length) {
// 		const result = iterator.next();
// 		if (result.done) {
// 			console.log(`t'as gagné`);
// 			return;
// 		}
// 		currentSet = result.value;
// 		cubes = currentSet.flat();
// 		cubes.forEach((cube) => (cube.waitUntil = Date.now() + 3000));
// 	}

// 	updateCubes(cubes);
// }

// gui.close();

// function updateCubes(cubes) {
// 	cubes.forEach((cube, index) => {
// 		if (cube.waitUntil && cube.waitUntil > Date.now()) return;

// 		if (cube.rotation.x > Math.PI / 2) {
// 			cube.rotation.x = 0;
// 			cube.position.z += 1;
// 			cube.waitUntil = Date.now() + 3000;

// 			if (cube.position.z > 0) {
// 				cubes.splice(index, 1);
// 				scene.remove(cube);
// 			}
// 		}

// 		cube.rotation.x += 0.005;
// 	});
// }

// function toggleBomb() {
// 	console.log('toggleBomb');
// 	if (bombPlanted) {
// 		explodeBomb();
// 	} else {
// 		plantBomb();
// 	}
// }

// function debounce(fn, time) {
// 	let cleared = true;
// 	return (...args) => {
// 		if (cleared) {
// 			fn(...args);
// 			cleared = false;
// 			setTimeout(() => (cleared = true), time);
// 		}
// 	};
// }

// const debounceToggleBomb = debounce(toggleBomb, 250);

// function tick(time) {
// 	gameLoop();
// 	if (playerControls.playerActions.toggleBomb) {
// 		debounceToggleBomb();
// 	}
// }

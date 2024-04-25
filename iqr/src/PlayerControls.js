import {DEFAULT_GAMEPAD_MAPPING, DEFAULT_KEYBOARD_MAPPING} from './constants.js';
import Gamepad from './Gamepad.js';

export default class PlayerControls {
	#gamepad = null;
	#keyboardActions = {};

	constructor({
		gamepadMapping = DEFAULT_GAMEPAD_MAPPING,
		keyboardMapping = DEFAULT_KEYBOARD_MAPPING,
	} = {}) {
		this.gamepadMapping = gamepadMapping;
		this.keyboardMapping = keyboardMapping;
		window.addEventListener('gamepadconnected', this.#onGamepadConnected);
		window.addEventListener('gamepaddisconnected', this.#onGamepadDisconnected);
		window.addEventListener('keydown', this.#onKeyDown);
		window.addEventListener('keyup', this.#onKeyUp);
	}

	destruct() {
		window.removeEventListener('gamepadconnected', this.#onGamepadConnected);
		window.removeEventListener('gamepaddisconnected', this.#onGamepadDisconnected);
		window.removeEventListener('keydown', this.#onKeyDown);
		window.removeEventListener('keyup', this.#onKeyUp);
		this.#gamepad?.destruct();
	}

	get playerActions() {
		const playerActions = {...this.#keyboardActions};

		if (this.#gamepad) {
			for (const [button, pressed] of Object.entries(this.#gamepad.pressed)) {
				const action = this.gamepadMapping[button];
				playerActions[action] = playerActions[action] || pressed;
			}
		}

		return playerActions;
	}

	#onGamepadConnected = ({gamepad}) => {
		this.#gamepad = new Gamepad(gamepad);
	};

	#onGamepadDisconnected = () => {
		this.#gamepad?.destruct();
		this.#gamepad = null;
	};

	#onKeyDown = (event) => {
		const action = this.keyboardMapping[event.code];
		if (action) this.#keyboardActions[action] = true;
	};

	#onKeyUp = (event) => {
		const action = this.keyboardMapping[event.code];
		if (action) this.#keyboardActions[action] = false;
	};
}

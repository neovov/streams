export const GAMEPAD_AXES = {
	LeftStickHorizontal: 0,
	LeftStickVertical: 1,
	RightStickHorizontal: 2,
	RightStickVertical: 3,
};

export const GAMEPAD_BUTTONS = {
	Button0: 0,
	Button1: 1,
	Button2: 2,
	Button3: 3,
	DPadDown: 13,
	DPadLeft: 14,
	DPadRight: 15,
	DPadUp: 12,
	LeftStickButton: 10,
	RightStickButton: 11,
};

export default class Gamepad {
	#gamepad;
	#id;

	#leftStickThreshold = 0.1;
	#rightStickThreshold = 0.1;

	#pressed = {
		Button0: false,
		Button1: false,
		Button2: false,
		Button3: false,
		DPadDown: false,
		DPadLeft: false,
		DPadRight: false,
		DPadUp: false,
		LeftStickButton: false,
		LeftStickDown: false,
		LeftStickLeft: false,
		LeftStickRight: false,
		LeftStickUp: false,
		RightStickButton: false,
		RightStickDown: false,
		RightStickLeft: false,
		RightStickRight: false,
		RightStickUp: false,
	};

	constructor(gamepad) {
		this.#gamepad = gamepad;
		this.#id = window.requestAnimationFrame(this.#update);
	}

	destruct() {
		window.cancelAnimationFrame(this.#id);
	}

	get pressed() {
		return {...this.#pressed};
	}

	#update = () => {
		const gamepads = navigator.getGamepads();
		const gamepad = gamepads[this.#gamepad.index];

		if (gamepad.axes[GAMEPAD_AXES.LeftStickHorizontal] < -this.#leftStickThreshold) {
			this.#pressed.LeftStickLeft = true;
			this.#pressed.LeftStickRight = false;
		} else if (gamepad.axes[GAMEPAD_AXES.LeftStickHorizontal] > this.#leftStickThreshold) {
			this.#pressed.LeftStickLeft = false;
			this.#pressed.LeftStickRight = true;
		} else {
			this.#pressed.LeftStickLeft = false;
			this.#pressed.LeftStickRight = false;
		}

		if (gamepad.axes[GAMEPAD_AXES.LeftStickVertical] < -this.#leftStickThreshold) {
			this.#pressed.LeftStickUp = true;
			this.#pressed.LeftStickDown = false;
		} else if (gamepad.axes[GAMEPAD_AXES.LeftStickVertical] > this.#leftStickThreshold) {
			this.#pressed.LeftStickUp = false;
			this.#pressed.LeftStickDown = true;
		} else {
			this.#pressed.LeftStickUp = false;
			this.#pressed.LeftStickDown = false;
		}

		if (gamepad.axes[GAMEPAD_AXES.RightStickHorizontal] < -this.#rightStickThreshold) {
			this.#pressed.RightStickLeft = true;
			this.#pressed.RightStickRight = false;
		} else if (gamepad.axes[GAMEPAD_AXES.RightStickHorizontal] > this.#rightStickThreshold) {
			this.#pressed.RightStickLeft = false;
			this.#pressed.RightStickRight = true;
		} else {
			this.#pressed.RightStickLeft = false;
			this.#pressed.RightStickRight = false;
		}

		if (gamepad.axes[GAMEPAD_AXES.RightStickVertical] < -this.#rightStickThreshold) {
			this.#pressed.RightStickUp = true;
			this.#pressed.RightStickDown = false;
		} else if (gamepad.axes[GAMEPAD_AXES.RightStickVertical] > this.#rightStickThreshold) {
			this.#pressed.RightStickUp = false;
			this.#pressed.RightStickDown = true;
		} else {
			this.#pressed.RightStickUp = false;
			this.#pressed.RightStickDown = false;
		}

		for (const [name, index] of Object.entries(GAMEPAD_BUTTONS)) {
			this.#pressed[name] = gamepad.buttons[index].pressed;
		}

		this.#id = window.requestAnimationFrame(this.#update);
	};
}

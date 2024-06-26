export const CUBE_SIZE = 1;

export const DEFAULT_FOV = 65;
export const DEFAULT_FPS = 60;

export const PLAYER_ACTIONS = {
	DIRECTION_BACKWARD: 'directionBackward',
	DIRECTION_FORWARD: 'directionForward',
	DIRECTION_LEFT: 'directionLeft',
	DIRECTION_RIGHT: 'directionRight',
	EXPLODE_GREEN_BOMBS: 'explodeGreenBombs',
	TOGGLE_BOMB: 'toggleBomb',
	YAW_LEFT: 'yawLeft',
	YAW_RIGHT: 'yawRight',
};

export const DEFAULT_GAMEPAD_MAPPING = {
	Button0: PLAYER_ACTIONS.TOGGLE_BOMB,
	Button3: PLAYER_ACTIONS.EXPLODE_GREEN_BOMBS,
	DPadDown: PLAYER_ACTIONS.DIRECTION_BACKWARD,
	DPadLeft: PLAYER_ACTIONS.DIRECTION_LEFT,
	DPadRight: PLAYER_ACTIONS.DIRECTION_RIGHT,
	DPadUp: PLAYER_ACTIONS.DIRECTION_FORWARD,
	LeftStickDown: PLAYER_ACTIONS.DIRECTION_BACKWARD,
	LeftStickLeft: PLAYER_ACTIONS.DIRECTION_LEFT,
	LeftStickRight: PLAYER_ACTIONS.DIRECTION_RIGHT,
	LeftStickUp: PLAYER_ACTIONS.DIRECTION_FORWARD,
	RightStickLeft: PLAYER_ACTIONS.YAW_LEFT,
	RightStickRight: PLAYER_ACTIONS.YAW_RIGHT,
};

export const DEFAULT_KEYBOARD_MAPPING = {
	ArrowDown: PLAYER_ACTIONS.DIRECTION_BACKWARD,
	ArrowLeft: PLAYER_ACTIONS.DIRECTION_LEFT,
	ArrowRight: PLAYER_ACTIONS.DIRECTION_RIGHT,
	ArrowUp: PLAYER_ACTIONS.DIRECTION_FORWARD,
	KeyA: PLAYER_ACTIONS.DIRECTION_LEFT,
	KeyC: PLAYER_ACTIONS.EXPLODE_GREEN_BOMBS,
	KeyD: PLAYER_ACTIONS.DIRECTION_RIGHT,
	KeyS: PLAYER_ACTIONS.DIRECTION_BACKWARD,
	KeyW: PLAYER_ACTIONS.DIRECTION_FORWARD,
	Space: PLAYER_ACTIONS.TOGGLE_BOMB,
};

export const WORLD_HEIGHT = 5;
export const WORLD_MIN_WIDTH = 4;

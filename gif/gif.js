import {toASCII, toHex} from './utilities.js';
import Reader from './Reader.js';

/**
 * See GIF specification:
 * https://www.w3.org/Graphics/GIF/spec-gif89a.txt
 */

const APPLICATION_EXTENSION_LABEL = 0xff;
const BLOCK_TERMINATOR = 0x0;
const COMMENT_EXTENSION_LABEL = 0xfe;
const EXTENSION_INTRODUCER = 0x21;
const GRAPHIC_CONTROL_EXTENSION_LABEL = 0xf9;
const IMAGE_SEPARATOR = 0x2c;
const PLAIN_TEXT_EXTENSION_LABEL = 0x01;
const TRAILER_LABEL = 0x3b;

const REGEXP_VERSION = /[0-9]{2}[a-z]/;

/**
 * Utility functions
 */

function objectToRGB(object) {
	return `rgb(${object.r} ${object.g} ${object.b})`;
}

function toUnsigned([a, b]) {
	return (b << 8) | a;
}

/**
 * “Parser”
 */

function assertExtension(reader, LABEL) {
	const [introducer, label] = reader.read(2);

	if (introducer !== EXTENSION_INTRODUCER)
		throw new Error(
			`Expected an extension introducer (${toHex(
				EXTENSION_INTRODUCER
			)}) but got ${toHex(introducer)}`
		);

	if (label !== LABEL)
		throw new Error(
			`Expected a (${toHex(LABEL)}) label but got ${toHex(label)}`
		);
}

function parseApplicationExtension(reader) {
	assertExtension(reader, APPLICATION_EXTENSION_LABEL);
	const output = {extension: APPLICATION_EXTENSION_LABEL};

	const blockSize = reader.read();
	if (blockSize !== 11)
		throw new Error(
			`Block size for application extension should be 11 bytes but got ${blockSize}`
		);

	const applicationIdentifier = reader.read(8).map(toASCII).join('');
	const applicationAutenticationCode = reader.read(3);
	const applicationData = [];

	let data = reader.read();
	while (data !== EXTENSION_INTRODUCER) {
		applicationData.push(data);
		data = reader.read();
	}

	if (applicationData[applicationData.length - 1] === BLOCK_TERMINATOR) {
		applicationData.pop();
		reader.rewind();
	}

	return {
		...output,
		applicationAutenticationCode,
		applicationData,
		applicationIdentifier,
	};
}

function parseColorTable(reader, sizeOfColorTable) {
	const colorTable = [];
	if (sizeOfColorTable === -1) return colorTable;

	const count = 3 * Math.pow(2, sizeOfColorTable + 1);
	for (let i = 0; i < count; i += 3) {
		const [r, g, b] = reader.read(3);
		colorTable.push({r, g, b});
	}

	return colorTable;
}

function parseCommentExtension(reader) {
	assertExtension(reader, COMMENT_EXTENSION_LABEL);

	const blocks = [];
	const output = {extension: COMMENT_EXTENSION_LABEL};
	let blockSize = reader.read();

	while (blockSize !== BLOCK_TERMINATOR) {
		const {offset} = reader;
		blocks.push({
			data: reader.read(blockSize).map(toASCII).join(''),
			length: blockSize,
			offset,
		});

		blockSize = reader.read();
	}

	return {
		...output,
		blocks,
	};
}

function parseData(reader) {
	const data = [];

	while (true) {
		if (reader.offset >= reader.bytes.length - 2) break;
		const [introducer, label] = reader.read(2);
		reader.rewind(2);

		if (introducer === IMAGE_SEPARATOR) {
			data.push(parseGraphicBlock(reader));
			continue;
		}

		switch (label) {
			case APPLICATION_EXTENSION_LABEL:
				data.push(parseApplicationExtension(reader));
				break;

			case COMMENT_EXTENSION_LABEL:
				data.push(parseCommentExtension(reader));
				break;

			case GRAPHIC_CONTROL_EXTENSION_LABEL:
				data.push(parseGraphicBlock(reader));
				break;

			case PLAIN_TEXT_EXTENSION_LABEL:
				data.push(parsePlainTextExtension(reader));
				break;

			default:
				throw new Error(`Unknown label: ${toHex(label)}`);
		}
	}

	return data;
}

function parseGIFDataStream(reader) {
	const header = parseHeader(reader);
	const logicalScreen = parseLogicalScreen(reader);
	const data = parseData(reader);
	parseTrailer(reader);

	return {header, logicalScreen, data};
}

function parseGraphicBlock(reader) {
	const byte = reader.read(); // Can be either an EXTENSION_INTRODUCER or an IMAGE_SEPARATOR
	reader.rewind();

	const output =
		byte === EXTENSION_INTRODUCER ? parseGraphicControlExtension(reader) : {};

	return {...output, rendering: parseGraphicRenderingBlock(reader)};
}

function parseGraphicControlExtension(reader) {
	assertExtension(reader, GRAPHIC_CONTROL_EXTENSION_LABEL);
	const output = {extension: GRAPHIC_CONTROL_EXTENSION_LABEL};

	const blockSize = reader.read();
	if (blockSize !== 4)
		throw new Error(
			`Block size for graphic control extension should be 4 bytes but got ${blockSize}`
		);

	const packed = reader.read();
	// const reserved = packed >> 5;
	const disposalMethod = (packed & 0b0001_1100) >> 2;
	const userInputFlag = Boolean((packed & 0b0010) >> 1);
	const transparentColorFlag = Boolean(packed & 0b0001); // 1

	const delayTime = toUnsigned(reader.read(2));
	const transparentColorIndex = reader.read();

	const terminator = reader.read();
	if (terminator !== BLOCK_TERMINATOR)
		throw new Error(
			`A graphic control extension should finish with a block terminator (${BLOCK_TERMINATOR}) but got ${toHex(
				terminator
			)}`
		);

	return {
		...output,
		delayTime,
		disposalMethod,
		transparentColorFlag,
		transparentColorIndex,
		userInputFlag,
	};
}

function parseGraphicRenderingBlock(reader) {
	const byte = reader.read();
	reader.rewind();

	if (byte === EXTENSION_INTRODUCER) {
		return parsePlainTextExtension(reader);
	} else if (byte === IMAGE_SEPARATOR) {
		return parseTableBasedImage(reader);
	} else {
		throw new Error(
			`Expected either an extension introducer ${toHex(
				EXTENSION_INTRODUCER
			)} or an image separator (${toHex(IMAGE_SEPARATOR)}) but got ${toHex(
				byte
			)}`
		);
	}
}

function parseHeader(reader) {
	const signature = reader.read(3).map(toASCII).join('');
	const version = reader.read(3).map(toASCII).join('');

	if (signature !== 'GIF')
		throw new Error(`Bad signature: ${signature} (expected: GIF)`);
	if (!REGEXP_VERSION.test(version)) throw new Error(`Bad version: ${version}`);

	return {signature, version};
}

function parseImageData(reader) {
	const LZWMinimumCodeSize = reader.read();

	const blocks = [];
	let blockSize = reader.read();
	let total = 0;

	while (blockSize !== BLOCK_TERMINATOR) {
		const {offset} = reader;
		blocks.push({
			data: reader.read(blockSize),
			length: blockSize,
			offset,
		});

		total += blockSize;
		blockSize = reader.read();
	}

	const buffer = new Uint8Array(total);
	let offset = 0;
	for (const block of blocks) {
		buffer.set(block.data, offset);
		offset += block.length;
		delete block.data;
	}

	return {
		blocks,
		buffer,
		LZWMinimumCodeSize,
	};
}

function parseImageDescriptor(reader) {
	const separator = reader.read();
	if (separator !== IMAGE_SEPARATOR)
		throw new Error(
			`Expected an image separator (${toHex(IMAGE_SEPARATOR)}) but got ${toHex(
				separator
			)}`
		);

	const imageLeftPosition = toUnsigned(reader.read(2));
	const imageTopPosition = toUnsigned(reader.read(2));
	const imageWidth = toUnsigned(reader.read(2));
	const imageHeight = toUnsigned(reader.read(2));

	const packed = reader.read();
	const localColorTableFlag = Boolean(packed >> 7);
	const interlaceFlag = Boolean((packed & 0b0100_0000) >> 6);
	const sortFlag = Boolean((packed & 0b0010_0000) >> 5);
	// const reserved = (packed & 0b0001_1000) >> 3;
	const sizeOfLocalColorTable = packed & 0b111;

	return {
		imageHeight,
		imageLeftPosition,
		imageTopPosition,
		imageWidth,
		interlaceFlag,
		localColorTableFlag,
		sizeOfLocalColorTable,
		sortFlag,
	};
}

function parseLogicalScreen(reader) {
	const logicalScreenDescriptor = parseLogicalScreenDescriptor(reader);
	const globalColorTable = parseColorTable(
		reader,
		logicalScreenDescriptor.globalColorTableFlag
			? logicalScreenDescriptor.sizeOfGlobalColorTable
			: -1
	);

	return {
		...logicalScreenDescriptor,
		globalColorTable,
	};
}

function parseLogicalScreenDescriptor(reader) {
	const width = toUnsigned(reader.read(2));
	const height = toUnsigned(reader.read(2));

	const packed = reader.read();
	const globalColorTableFlag = Boolean(packed >> 7);
	const colorResolution = (packed & 0b0111_0000) >> 4;
	const sortFlag = Boolean((packed & 0b1000) >> 3);
	const sizeOfGlobalColorTable = packed & 0b0111;

	const backgroundColorIndex = reader.read();
	const pixelAspectRatio = reader.read();

	return {
		backgroundColorIndex,
		colorResolution,
		globalColorTableFlag,
		height,
		pixelAspectRatio,
		sizeOfGlobalColorTable,
		sortFlag,
		width,
	};
}

function parsePlainTextExtension(reader) {
	assertExtension(reader, PLAIN_TEXT_EXTENSION_LABEL);
	const output = {extension: PLAIN_TEXT_EXTENSION_LABEL};

	let blockSize = reader.read();
	if (blockSize !== 12)
		throw new Error(
			`Block size for plain text extension should be 12 bytes but got ${blockSize}`
		);

	const textGridLeftPosition = toUnsigned(reader.read(2));
	const textGridTopPosition = toUnsigned(reader.read(2));
	const textWidthTopPosition = toUnsigned(reader.read(2));
	const textHeightTopPosition = toUnsigned(reader.read(2));
	const characterCellWidth = reader.read();
	const characterCellHeight = reader.read();
	const textForegroundColorIndex = reader.read();
	const textBackgroundColorIndex = reader.read();

	const blocks = [];
	blockSize = reader.read();

	while (blockSize !== BLOCK_TERMINATOR) {
		const {offset} = reader;
		blocks.push({
			data: reader.read(blockSize),
			length: blockSize,
			offset,
		});

		blockSize = reader.read();
	}

	return {
		...output,
		blocks,
		characterCellHeight,
		characterCellWidth,
		textBackgroundColorIndex,
		textForegroundColorIndex,
		textGridLeftPosition,
		textGridTopPosition,
		textHeightTopPosition,
		textWidthTopPosition,
	};
}

function parseTableBasedImage(reader) {
	const imageDescriptor = parseImageDescriptor(reader);
	const localColorTable = parseColorTable(
		reader,
		imageDescriptor.localColorTableFlag
			? imageDescriptor.sizeOfLocalColorTable
			: -1
	);
	const imageData = parseImageData(reader);

	return {
		...imageDescriptor,
		imageData,
		localColorTable,
	};
}

function parseTrailer(reader) {
	const trailer = reader.read();
	if (trailer !== TRAILER_LABEL) {
		throw new Error(
			`Bad trailer: ${toHex(trailer)} (expected: ${toHex(TRAILER_LABEL)})`
		);
	}
}

/**
 * “App”
 */

// Convert an array of decompressed color indexes to an array of RGBA values
function arrayToImageData(data, {image}) {
	const {rendering, transparentColorFlag, transparentColorIndex} = image;
	const {imageHeight: height, imageWidth: width} = rendering;
	const buffer = new Uint8ClampedArray(width * height * 4);
	const palette = rendering.localColorTableFlag
		? rendering.localColorTable
		: globalColorTable;

	/**
	 * If we encounter a transparentColorIndex in our array of data,
	 * it means we have to pick the RGB value of the previously drawn
	 * image (other dispose methods are not supported).
	 */

	const previous = context.getImageData(
		rendering.imageLeftPosition,
		rendering.imageTopPosition,
		width,
		height
	);

	for (let i = 0; i < data.length; i++) {
		const color =
			transparentColorFlag && data[i] === transparentColorIndex
				? getColorFromImageData(previous, i)
				: palette[data[i]];
		const index = i * 4;

		buffer[index + 0] = color.r;
		buffer[index + 1] = color.g;
		buffer[index + 2] = color.b;
		buffer[index + 3] = 255;
	}

	return new ImageData(buffer, width, height);
}

// Read an image data to extract the RGB value for a given pixel
function getColorFromImageData(pixels, index) {
	const [r, g, b] = pixels.data.slice(index * 4, index * 4 + 3);
	return {r, g, b};
}

function loop() {
	render(images[currentImageIndex]);

	// Set a default minimum delay because some files might have a 0 delayTime
	const delay = images[currentImageIndex].delayTime * 10 || 100;
	currentImageIndex =
		currentImageIndex === images.length - 1 ? 0 : currentImageIndex + 1;

	setTimeout(loop, delay);
}

function LZWDecompress(buffer, LZWMinimumCodeSize) {
	const CLEAR_CODE = Math.pow(2, LZWMinimumCodeSize);
	const END_OF_INFORMATION_CODE = CLEAR_CODE + 1;

	const iterator = buffer.values();
	const output = [];

	let code;
	let codeMask = Math.pow(2, LZWMinimumCodeSize + 1) - 1;
	let codeTable = buildCodeTable();
	let conjecture = [];
	let nbOfBitsForCode = LZWMinimumCodeSize + 1;
	let nbOfBitsForRest = 0;
	let rest;

	function buildCodeTable() {
		return [
			// prettier-ignore
			...Array.from({length: Math.pow(2, LZWMinimumCodeSize)}).map((_, i) => [i]),
			CLEAR_CODE,
			END_OF_INFORMATION_CODE,
		];
	}

	/**
	 * Get the `rest` and prepend at least one byte in from of it.
	 * Repeat until it reaches at least the number of bits required.
	 */
	function fillBits() {
		while (nbOfBitsForRest < nbOfBitsForCode) {
			const {done, value: byte} = iterator.next();
			rest |= byte << nbOfBitsForRest;
			nbOfBitsForRest += 8;

			if (done) return true;
		}

		return false;
	}

	while (true) {
		const mustStop = fillBits();

		code = rest & codeMask;
		rest >>= nbOfBitsForCode;
		nbOfBitsForRest -= nbOfBitsForCode;

		if (code === CLEAR_CODE) {
			codeMask = Math.pow(2, LZWMinimumCodeSize + 1) - 1;
			codeTable = buildCodeTable();
			conjecture = [];
			nbOfBitsForCode = LZWMinimumCodeSize + 1;
			continue;
		}

		if (code === END_OF_INFORMATION_CODE) {
			break;
		}

		const char = codeTable[code];
		if (char !== undefined) {
			const newChar = [...conjecture, char[0]];
			if (conjecture.length) codeTable.push(newChar);
			output.push(...char);
			conjecture = char;
		} else {
			const newChar = [...conjecture, conjecture[0]];
			if (conjecture.length) codeTable.push(newChar);
			output.push(...newChar);
			conjecture = newChar;
		}

		/**
		 * Increment the number of bits to use for the code if the code table is "full".
		 * For example, if codes are coded using 4 bits, it means the code table
		 * cannot hold more than 2**4 (16) values.
		 * The `nbOfBitsForCode` cannot exceed 12. If the code table is "full" and
		 * we need to increase the `nbOfBitsForCode` we simply don't do it.
		 * Next codes will overwrite existing ones.
		 */
		if (
			nbOfBitsForCode < 12 &&
			codeTable.length === Math.pow(2, nbOfBitsForCode)
		) {
			nbOfBitsForCode++;
			codeMask = Math.pow(2, nbOfBitsForCode) - 1;
		}

		if (mustStop) break;
	}

	return output;
}

function render(image) {
	if (cache.has(image)) {
		const imageData = cache.get(image);
		context.putImageData(
			imageData,
			image.rendering.imageLeftPosition,
			image.rendering.imageTopPosition
		);
		return;
	}

	const {rendering} = image;
	const decompressed = LZWDecompress(
		rendering.imageData.buffer,
		rendering.imageData.LZWMinimumCodeSize
	);

	const imageData = arrayToImageData(decompressed, {image});

	cache.set(image, imageData);
	return render(image);
}

const canvas = document.getElementById('canvas');
const context = canvas.getContext('2d', {willReadFrequently: true});

const response = await fetch('nyan.gif');
const bytes = await response.arrayBuffer();

const cache = new Map(); // Prepare a cache to store rendered images so we don't have to re-render them
const reader = new Reader(bytes);
const gif = parseGIFDataStream(reader);
const images = gif.data.filter((d) => d.rendering);
let currentImageIndex = 0;

console.info(reader.status);
console.log('Parsed:', gif);

const {backgroundColorIndex, globalColorTable, height, width} =
	gif.logicalScreen;

// Set the canvas with the GIF's size and background color
canvas.width = width;
canvas.height = height;
context.fillStyle = objectToRGB(globalColorTable[backgroundColorIndex]);
context.fillRect(0, 0, width, height);

if (images.length > 1) {
	loop();
} else {
	render(images[0]);
}

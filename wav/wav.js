import {toASCII} from './utilities.js';
import Reader from './Reader.js';

const WAVE_FORMAT_PCM = 0x0001;
const IBM_FORMAT_MULAW = 0x0101;
const IBM_FORMAT_ALAW = 0x0102;
const IBM_FORMAT_ADPCM = 0x0103;

const KEY_FOR_INFO_CHUNK = {
	IARL: 'archivalLocation',
	IART: 'artist',
	ICMS: 'commissioned',
	ICMT: 'comments',
	ICOP: 'copyright',
	ICRD: 'creationDate',
	ICRP: 'cropped',
	IDIM: 'dimensions',
	IDPI: 'dpi',
	IENG: 'engineer',
	IGNR: 'genre',
	IKEY: 'keywords',
	ILGT: 'lightness',
	IMED: 'medium',
	INAM: 'name',
	IPLT: 'paletteSetting',
	IPRD: 'product',
	ISBJ: 'subject',
	ISFT: 'software',
	ISHP: 'sharpness',
	ISRC: 'source',
	ISRF: 'sourceForm',
	ITCH: 'technician',
};

/**
 * “Parser”
 */

function parseDataChunk(reader) {
	const ckID = reader.getBytes(4).map(toASCII).join('');
	const ckSize = reader.getUint32();
	const data = new Uint8Array(reader.buffer, reader.offset, ckSize);
	reader.offset += ckSize;

	if (ckID !== 'data')
		throw new Error(`Chunk ID should be 'data' but got ${ckID}`);

	return {
		chunk: ckID,
		chunkSize: ckSize,
		data,
	};
}

function parseFormatChunk(reader) {
	const ckID = reader.getBytes(4).map(toASCII).join('');
	const ckSize = reader.getUint32();

	if (ckID !== 'fmt ')
		throw new Error(`Chunk ID should be 'fmt ' but got ${ckID}`);

	const wFormatTag = reader.getUint16();
	const wChannels = reader.getUint16();
	const dwSamplesPerSec = reader.getUint32();
	const dwAvgBytesPerSec = reader.getUint32();
	const wBlockAlign = reader.getUint16();

	const output = {
		chunk: ckID,
		chunkSize: ckSize,

		dwAvgBytesPerSec,
		dwSamplesPerSec,
		wBlockAlign,
		wChannels,
		wFormatTag,
	};

	if (wFormatTag === WAVE_FORMAT_PCM) {
		output.wBitsPerSample = reader.getUint16();
	}

	return output;
}

function parseINFOChunk(reader) {
	const ckID = reader.getBytes(4).map(toASCII).join('');
	const ckSize = reader.getUint32();
	const content = reader.getBytes(ckSize).filter(Boolean).map(toASCII).join('');
	const key = KEY_FOR_INFO_CHUNK[ckID];

	if (!key) throw new Error(`Unknown INFO chunk: ${ckID}`);

	return {
		chunk: ckID,
		chunkSize: ckSize,
		content,
		key,
	};
}

function parseLISTChunk(reader) {
	const chunks = [];
	const ckID = reader.getBytes(4).map(toASCII).join('');
	const ckSize = reader.getUint32();
	const listType = reader.getBytes(4).map(toASCII).join('');
	const subReader = reader.clone({
		length: ckSize - 4,
		offset: reader.offset,
	});
	reader.offset += ckSize - 4;

	if (ckID !== 'LIST')
		throw new Error(`Chunk ID should be 'LIST' but got ${ckID}`);

	switch (listType) {
		case 'INFO':
			while (subReader.remaining) chunks.push(parseINFOChunk(subReader));
			break;

		default:
			throw new Error(`Unknown list type ${listType}`);
	}

	return {
		chunk: ckID,
		chunks,
		chunkSize: ckSize,
		listType,
	};
}

function parseRIFFChunk(reader) {
	const ckID = reader.getBytes(4).map(toASCII).join('');
	const ckSize = reader.getUint32();
	const formType = reader.getBytes(4).map(toASCII).join('');

	if (ckID !== 'RIFF')
		throw new Error(`Chunk ID should be 'RIFF' but got ${ckID}`);

	return {
		chunk: ckID,
		chunkSize: ckSize,
		formType,
	};
}

function parseSubChunk(reader) {
	let output = {};
	while (reader.remaining > 4) {
		// Peek next chunk ID in order to use the right parsing function
		const nextChunkID = reader.getBytes(4).map(toASCII).join('');
		reader.offset -= 4;

		switch (nextChunkID) {
			case 'data': {
				const {data} = parseDataChunk(reader);
				output = {
					...output,
					data,
				};
				break;
			}

			case 'LIST': {
				const {chunks, listType} = parseLISTChunk(reader);
				output = {
					...output,
					[listType.toLowerCase()]: chunks.map(({content, key}) => ({
						[key]: content,
					})),
				};

				break;
			}

			default:
				// Ignore unknown chunk ID
				reader.offset += 4;
				continue;
		}
	}

	return output;
}

function parseWAVDataStream(reader) {
	const {formType} = parseRIFFChunk(reader);
	let output = {};

	switch (formType) {
		case 'WAVE': {
			const format = parseFormatChunk(reader);
			delete format.chunk;
			delete format.chunkSize;
			output = {
				...output,
				...format,
				...parseSubChunk(reader), // Ideally we should use another reader in order to read only the RIFF chunk
			};

			break;
		}

		default:
			throw new Error(`The format ${formType} is not supported.`);
	}

	return output;
}

/**
 * “App”
 */

function parse(bytes) {
	const reader = new Reader(bytes, {endianness: Reader.LITTLE});
	const parsed = parseWAVDataStream(reader);

	console.info(reader.status);
	console.log('Parsed:', parsed);

	return parsed;
}

function render(parsed) {
	const {wChannels: nbOfChannels, dwSamplesPerSec: sampleRate} = parsed;
	const floats = samplesToFloat(parsed.data);

	const context = new AudioContext();
	const buffer = context.createBuffer(
		nbOfChannels,
		floats.l.length,
		sampleRate
	);

	const l = buffer.getChannelData(0);
	const r = buffer.getChannelData(1);
	l.set(floats.l);
	r.set(floats.r);

	const source = context.createBufferSource();
	source.buffer = buffer;
	source.connect(context.destination);
	source.start();
}

function samplesToFloat(samples) {
	const output = {l: [], r: []};
	const MAX = (1 << 16) / 2;
	const view = new DataView(
		samples.buffer,
		samples.bytesOffset,
		samples.byteLength
	);

	for (let i = 0; i < samples.length; i += 4) {
		const l = view.getInt16(i, true);
		const r = view.getInt16(i + 2, true);
		output.l.push(l / MAX); // Normalize to floats (-1.0, 1.0)
		output.r.push(r / MAX);
	}

	return output;
}

const response = await fetch('sine.wav');
const bytes = await response.arrayBuffer();
const parsed = parse(bytes);
document.getElementById('play').addEventListener('click', () => render(parsed));

// Prevent default behaviour on `dragover` and `drop` events to allow dropping files
const preventDefault = (event) => event.preventDefault();
document.body.addEventListener('dragover', preventDefault);
document.body.addEventListener('drop', preventDefault);

document.body.addEventListener('drop', async ({dataTransfer: {files}}) => {
	const bytes = await files.item(0).arrayBuffer();
	const parsed = parse(bytes);
	render(parsed);
});

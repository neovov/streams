import {
	formatBytesToHumanReadable,
	stringToHTML,
	toASCII,
} from './utilities.js';
import Reader from './Reader.js';

/**
 * Utility functions
 */

function toUint32(array) {
	return new DataView(new Uint8Array(array).buffer).getUint32(0, true);
}

/**
 * “Parser”
 */
const CENTRAL_DIRECTORY_SIGNATURE = toUint32([0x50, 0x4b, 0x01, 0x02]);
const DATA_DESCRIPTOR_SIGNATURE = toUint32([0x50, 0x4b, 0x07, 0x08]);
const END_OF_CENTRAL_DIRECTORY_SIGNATURE = toUint32([0x50, 0x4b, 0x05, 0x06]);
const LOCAL_FILE_HEADER_SIGNATURE = toUint32([0x50, 0x4b, 0x03, 0x04]);

const RESERVED = null;

const COMPRESSION_METHODS = [
	'no compression',
	'shrunk',
	'reduced with compression factor 1',
	'reduced with compression factor 2',
	'reduced with compression factor 3',
	'reduced with compression factor 4',
	'imploded',
	RESERVED,
	'deflated',
	'enhanced deflated',
	'PKWare DCL imploded',
	RESERVED,
	'compressed using BZIP2',
	RESERVED,
	'LZMA',
	RESERVED,
	RESERVED,
	RESERVED,
	'compressed using IBM TERSE',
	'IBM LZ77 z',
];

const VERSION_MADE_BY = [
	'MS-DOS and OS/2 (FAT / VFAT / FAT32 file systems)',
	'Amiga',
	'OpenVMS',
	'UNIX',
	'VM/CMS',
	'Atari ST',
	'OS/2 H.P.F.S.',
	'Macintosh',
	'Z-System',
	'CP/M',
	'Windows NTFS',
	'MVS (OS/390 - Z/OS)',
	'VSE',
	'Acorn Risc',
	'VFAT',
	'alternate MVS',
	'BeOS',
	'Tandem',
	'OS/400',
	'OS/X (Darwin)',
];

function findEndOfCentralDirectoryRecord(reader) {
	reader.offset = reader.buffer.byteLength - 22; // End of Central Directory Record is at least 22 bytes
	let bytes = reader.getUint32();

	while (bytes !== END_OF_CENTRAL_DIRECTORY_SIGNATURE) {
		reader.offset -= 5;
		bytes = reader.getUint32();
	}

	return bytes === END_OF_CENTRAL_DIRECTORY_SIGNATURE;
}

function fromMSDOSToDate(date, time) {
	const {day, month, year} = parseMSDOSDate(date);
	const {seconds, minutes, hours} = parseMSDOSTime(time);
	return new Date(year, month - 1, day, hours, minutes, seconds);
}

function parseCentralDirectory(reader) {
	const signature = reader.getUint32();

	if (signature !== CENTRAL_DIRECTORY_SIGNATURE)
		throw new Error('Bad signature for Central Directory');

	const [version, zipSpecificationVersion] = reader.getBytes(2);
	const versionNeeded = reader.getUint16();
	const flags = reader.getUint16();
	const compression = reader.getUint16();
	const modTime = reader.getUint16();
	const modDate = reader.getUint16();
	const crc = reader.getUint32();
	const compressedSize = reader.getUint32();
	const uncompressedSize = reader.getUint32();
	const filenameLength = reader.getUint16();
	const extraLength = reader.getUint16();
	const fileCommentLength = reader.getUint16();
	const diskStart = reader.getUint16();
	const internalAttributes = reader.getUint16();
	const externalAttributes = reader.getUint32();
	const offsetOfLocalHeader = reader.getUint32();

	const filename = reader.getBytes(filenameLength).map(toASCII).join('');
	const extra = reader.getBytes(extraLength);
	const fileComments = fileCommentLength
		? reader.getBytes(fileCommentLength).map(toASCII).join('')
		: '';

	return {
		compressedSize,
		compressionMethod: COMPRESSION_METHODS[compression],
		crc,
		diskStart,
		externalAttributes,
		extra,
		fileComments,
		filename,
		flags,
		internalAttributes,
		modificationTime: fromMSDOSToDate(modDate, modTime),
		offsetOfLocalHeader,
		uncompressedSize,
		versionMadeBy: VERSION_MADE_BY[version] || 'unknown',
		versionNeeded,
		zipSpecificationVersion,
	};
}

function parseDataDescriptor(reader) {
	const signature = reader.getUint32();

	if (signature !== DATA_DESCRIPTOR_SIGNATURE)
		throw new Error('Bad signature for Data Descriptor');

	const crc = reader.getUint32();
	const compressedSize = reader.getUint32();
	const uncompressedSize = reader.getUint32();

	return {compressedSize, crc, uncompressedSize};
}

function parseEndOfCentralDirectoryRecord(reader) {
	const diskNumber = reader.getUint16();
	const diskNumberOfCentralDirectory = reader.getUint16();
	const diskEntries = reader.getUint16();
	const totalEntries = reader.getUint16();
	const centralDirectorySize = reader.getUint32();
	const centralDirectoryOffset = reader.getUint32();
	const commentLength = reader.getUint16();
	const comment = commentLength
		? reader.getBytes(commentLength).map(toASCII).join('')
		: '';

	return {
		centralDirectoryOffset,
		centralDirectorySize,
		comment,
		commentLength,
		diskEntries,
		diskNumber,
		diskNumberOfCentralDirectory,
		totalEntries,
	};
}

function parseLocalFileHeader(reader) {
	const signature = reader.getUint32();

	if (signature !== LOCAL_FILE_HEADER_SIGNATURE)
		throw new Error('Bad signature for Local File Header');

	const version = reader.getUint16();
	const flags = reader.getUint16();
	const compressionMethod = reader.getUint16();
	const modTime = reader.getUint16();
	const modDate = reader.getUint16();
	const crc = reader.getUint32();
	const compressedSize = reader.getUint32();
	const uncompressedSize = reader.getUint32();
	const filenameLength = reader.getUint16();
	const extraFieldLength = reader.getUint16();

	const fileName = reader.getBytes(filenameLength).map(toASCII).join('');
	const extraField = reader.getBytes(extraFieldLength);

	const encrypted = Boolean(flags & 0b1);
	const dataDescriptor = Boolean((flags >> 3) & 0b1);

	return {
		compressedSize,
		compressionMethod: COMPRESSION_METHODS[compressionMethod],
		crc,
		dataDescriptor,
		encrypted,
		extraField,
		fileName,
		modificationTime: fromMSDOSToDate(modDate, modTime),
		uncompressedSize,
		version,
	};
}

function parseMSDOSDate(uint16) {
	const day = uint16 & 0b11111;
	const month = (uint16 >> 5) & 0b1111;
	const year = (uint16 >> 9) + 1980;
	return {day, month, year};
}

function parseMSDOSTime(uint16) {
	const seconds = (uint16 & 0b11111) * 2;
	const minutes = (uint16 >> 5) & 0b111111;
	const hours = uint16 >> 11;
	return {hours, minutes, seconds};
}

function parseZIPDataStream(reader) {
	const found = findEndOfCentralDirectoryRecord(reader);
	if (!found) throw new Error('Cannot find End of Central Directory Record');

	const endOfCentralDirectoryRecord = parseEndOfCentralDirectoryRecord(reader);
	reader.offset = endOfCentralDirectoryRecord.centralDirectoryOffset; // Rewind to the beginning of the Central Directory

	const centralDirectory = [];
	while (
		reader.offset <
		endOfCentralDirectoryRecord.centralDirectoryOffset +
			endOfCentralDirectoryRecord.centralDirectorySize
	) {
		centralDirectory.push(parseCentralDirectory(reader));
	}

	const files = [];
	centralDirectory.map((entry, index) => {
		reader.offset = entry.offsetOfLocalHeader; // Rewind to the beginning of the Local File Header

		const header = parseLocalFileHeader(reader);
		const length = header.compressedSize || entry.compressedSize;
		const data = new Uint8Array(reader.buffer, reader.offset, length);
		reader.offset += length;
		const dataDescriptor = header.dataDescriptor
			? parseDataDescriptor(reader)
			: undefined;

		files[index] = {data, dataDescriptor, header};
	});

	reader.offset = reader.buffer.bytesLength; // Forward to the end of the file to signal we parsed everything
	return {centralDirectory, files};
}

/**
 * “App”
 */

function decompressBitStream(tree, data) {
	function* getCode() {
		const dataIterator = data.values();
		let dataIteratorDone = false;
		let code = '';
		let nbOfBitsForRest = 0;
		let rest;

		function addOneBitToCode() {
			code += rest & 0b1;
			rest >>= 1;
			nbOfBitsForRest -= 1;
		}

		function refillRest() {
			let mustSkipBlockHeader = typeof rest === 'undefined';

			const {done, value: byte} = dataIterator.next();
			if (done) {
				dataIteratorDone = true;
				return;
			}

			rest = byte;
			nbOfBitsForRest = 8;

			if (mustSkipBlockHeader) {
				rest >>= 3;
				nbOfBitsForRest -= 3;
			}
		}

		refillRest();
		while (!dataIteratorDone) {
			code = '';
			while (code.length < 7) {
				addOneBitToCode();

				if (!nbOfBitsForRest) refillRest();
			}

			let success = false;
			while (!success) {
				success = yield code;
				if (!success) addOneBitToCode();
			}
		}
	}

	function* getSymbol() {
		const codeIterator = getCode();
		let done = false;

		while (!done) {
			let result = codeIterator.next(true);
			let value = getValueFromHuffmanTree(tree, result.value);
			done = result.done;
			if (value === END_OF_BLOCK) return;

			while (Array.isArray(value)) {
				result = codeIterator.next(false);
				value = getValueFromHuffmanTree(tree, result.value);
			}

			yield value;
		}
	}

	const iterator = getSymbol();
	// for (const symbol of iterator) {
	// 	console.log({symbol, ascii: String.fromCharCode(symbol)});
	// }

	// TODO: Handle LZ tuples

	// const symbols = Array.from(iterator)
	// 	.map((symbol) => String.fromCharCode(symbol))
	// 	.join('');

	return Uint8Array.from(iterator);
}

function generateNodes(node, code, value) {
	const side = code[0];
	code = code.slice(1);
	node[side] ||= [];

	if (code.length) {
		generateNodes(node[side], code, value);
	} else {
		node[side] = value;
	}

	return node;
}

function generateStaticHuffmanTree() {
	const root = [];

	// TODO: Check if we need to build the tree with largest codes first

	// Literal values from 0 to 143 (included) are coded using 8 bits
	// From 0011 0000 to 1011 1111 (included)
	for (let i = 0b00110000; i <= 0b10111111; i++) {
		const code = i.toString(2).padStart(8, '0');
		const value = i - 0b00110000;
		generateNodes(root, code, value);
	}

	// Literal values from 144 to 255 (included) are coded using 9 bits
	// From 1 1001 0000 to 1 1111 1111 (included)
	for (let i = 0b110010000; i <= 0b111111111; i++) {
		const value = i - 0b110010000 + 144;
		generateNodes(root, i.toString(2), value);
	}

	const lengths = [
		0, 3, 4, 5, 6, 7, 8, 9, 10, 11, 13, 15, 17, 19, 23, 27, 31, 35, 43, 51, 59,
		67, 83, 99, 115, 131, 163, 195, 227, 258,
	];
	const extraBitsForLength = [
		0, 0, 0, 0, 0, 0, 0, 0, 0, 1, 1, 1, 1, 2, 2, 2, 2, 3, 3, 3, 3, 4, 4, 4, 4,
		5, 5, 5, 5, 0,
	];

	// Codes from 256 to 279 represents a LZ tuple and are coded using 7 bits
	// From 000 0000 to 001 0111 (included)
	// Code 256 represent the end of block
	for (let i = 0b0000000; i <= 0b0010111; i++) {
		const code = i.toString(2).padStart(7, '0');
		const value = {length: lengths[i], extraBits: extraBitsForLength[i]};
		generateNodes(root, code, i ? value : END_OF_BLOCK);
	}

	// Codes from 280 to 287 (included) represents a LZ tuple and are coded using 8 bits
	// From 1100 0000 to 1100 0111 (included)
	for (let i = 0b11000000; i <= 0b11000111; i++) {
		const index = i - 0b11000000 + 24;
		const value = {
			length: lengths[index],
			extraBits: extraBitsForLength[index],
		};
		generateNodes(root, i.toString(2), value);
	}

	return root;
}

function getValueFromHuffmanTree(tree, code) {
	function getNode(node, code) {
		const side = code[0];
		code = code.slice(1);
		return code.length ? getNode(node[side], code) : node[side];
	}

	return getNode(tree, code);
}

function parse(bytes) {
	const reader = new Reader(bytes, {endianness: Reader.LITTLE});
	const parsed = parseZIPDataStream(reader);

	console.info(reader.status);
	console.log('Parsed:', parsed);

	return parsed;
}

const ENCODING_RAW = 0b00;
const ENCODING_STATIC_HUFFMAN = 0b01;
const ENCODING_DYNAMIC_HUFFMAN = 0b10;
const CL_LENGTHS_ORDER = [
	16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15,
];
const END_OF_BLOCK = null;

window.getValueFromHuffmanTree = getValueFromHuffmanTree;
window.generateDynamicHuffmanTree = generateDynamicHuffmanTree;

function generateTheCodes(lengths) {
	// lengths = lengths.filter(Boolean);
	const copy = lengths
		.map((value, index) => [value, index])
		.sort(([a], [b]) => a - b);

	let shannonCode = [];

	let code = 0;
	let codeIncrement = 0;
	let lastBitLength = 0;
	let i = copy.length - 1;

	while (i >= 0) {
		code = code + codeIncrement;
		if (copy[i][0] !== lastBitLength) {
			lastBitLength = copy[i][0];
			codeIncrement = 1 << (16 - lastBitLength);
		}

		shannonCode[i] = [code, copy[i][1]];
		i--;
	}

	return shannonCode
		.sort(([, a], [, b]) => a - b)
		.map(([code], index) =>
			Array.from(code.toString(2).padStart(16, '0').slice(0, lengths[index]))
				.reverse()
				.join('')
		);
}

function generateDynamicHuffmanTree(data) {
	// const root = [];

	// TODO: Literal code length are encoded using 5 bits?

	// for (let i = 0; i <= 15; i++) {
	// 	const code = i.toString(2).padStart(5, '0');
	// 	generateNodes(root, code, i);
	// }

	// generateNodes(root, '10000', {bits: 2});
	// generateNodes(root, '10001', {bits: 3});
	// generateNodes(root, '10010', {bits: 7});

	const hlit = (data[0] >> 3) + 257;
	const hdist = (data[1] & 0b11111) + 1;
	const hclen = (data[1] >> 5) + ((data[2] & 0b1) << 3) + 4;

	console.log('number of literal/length codes', hlit);
	console.log('number of distance codes', hdist);
	console.log('number of code length codes', hclen);
	console.log('code lengths for the code length', hclen * 3);

	let byteIndex = 2;
	let rest = data[2] >> 1;
	let nbOfBitsForRest = 7;

	function getBits(nb) {
		if (nbOfBitsForRest < nb) {
			rest += data[++byteIndex] << nbOfBitsForRest;
			nbOfBitsForRest += 8;
		}
		const code = rest & ((1 << nb) - 1);
		rest >>= nb;
		nbOfBitsForRest -= nb;
		return code;
	}

	let lengths = Array.from({length: 19}, () => 0);
	for (let i = 0; i < hclen; i++) {
		lengths[CL_LENGTHS_ORDER[i]] = getBits(3);
	}

	console.log({lengths});

	// const codesForBidule = generateTheCodes(lengths);
	// for (const c of codesForBidule) {
	// 	console.log(`code: ${c}, value:`, getValueFromHuffmanTree(root, c));
	// }

	// console.log({lengths, lengthsR});
	const shannonCodes = generateTheCodes(lengths);
	console.log({shannonCodes});

	const root = [];
	shannonCodes
		.map((value, index) => [value, index])
		.filter(([value]) => Boolean(value))
		.sort(([{length: a}], [{length: b}]) => a - b)
		.reverse()
		.forEach(([code, index]) => generateNodes(root, code, index));

	const {min, max} = shannonCodes.filter(Boolean).reduce(
		(acc, {length}) => {
			acc.min = Math.min(acc.min, length);
			acc.max = Math.max(acc.max, length);
			return acc;
		},
		{min: Infinity, max: -Infinity}
	);

	console.log({min, max});
	console.log(root);

	const hlitTable = [];
	for (let i = 0; i < hlit; i++) {
		let codeSize = min;
		let code = getBits(codeSize);
		let value;
		do {
			value = getValueFromHuffmanTree(
				root,
				code.toString(2).padStart(codeSize, '0')
			);
			if (Array.isArray(value)) {
				code |= getBits(1) << codeSize;
				codeSize++;
			}
		} while (Array.isArray(value) && codeSize < max);
		console.log({
			codeSize,
			value,
			code: code.toString(2).padStart(codeSize, '0'),
		});
		hlitTable.push(value);
	}

	console.log(hlitTable);

	// L  L  L  L  Le  Lo D Do L
	// 65 65 66 66 257 0  4 1  65

	// LL Code lengths
	// Symbol: 0 1 2 … 64 65 … 285
	// Length: 3 3 0    0  6     0

	// Distance Code Lengths
	// Symbol: 0 1 2 … 28 29
	// Length: 3 3 0    0  3

	// CL Symbol
	// 0 -> 0
	// 1 -> 1
	// 15 -> 15
	// 16 -> previous * (readBits(2) + 3)
	// 17 -> 0 * (readBits(3) + 3)
	// 18 -> 0 * (readBits(7) + 11)

	// LL table:
	// CL CL    CL CL
	//  3 16 01  4 17 10
	//  3 3 3 3 3 4 0 0 0 0 0

	// CL Code Lengths
	// Symbol: 0 1 2 … 16 17 18
	// Length: 0 1 0    5  0  0

	return root;
}

function download(file) {
	const {data} = file;

	const a = document.createElement('a');
	a.download = file.header.fileName;

	const byte = data[0];
	const lastBlockInStream = Boolean(byte & 0b1);
	const encodingMethod = (byte >> 1) & 0b11;

	switch (encodingMethod) {
		case ENCODING_RAW:
			debugger;
			break;

		case ENCODING_STATIC_HUFFMAN: {
			const buffer = decompressBitStream(generateStaticHuffmanTree(), data);
			a.href = URL.createObjectURL(
				new File([buffer], file.header.fileName, {
					lastModified: file.header.modificationTime.getTime(),
				})
			);
			a.click();
			URL.revokeObjectURL(a.href);
			break;
		}

		case ENCODING_DYNAMIC_HUFFMAN:
			generateDynamicHuffmanTree(data);
			break;

		default:
			throw new Error('Unhandled encoding method');
	}
}

function render(parsed) {
	const {files} = parsed;

	const tbody = document.querySelector('tbody');
	Array.from(tbody.querySelectorAll('tr')).forEach((tr) => tr.remove());

	files.forEach((file) => {
		const {dataDescriptor, header} = file;
		const {encrypted, fileName, modificationTime} = header;
		const compressedSize =
			header.compressedSize || dataDescriptor.compressedSize;
		const uncompressedSize =
			header.uncompressedSize || dataDescriptor.uncompressedSize;

		const tr = stringToHTML(
			`<table>
				<tr>
					<td>
						<button class="btn btn-primary">
							<i class="bi bi-cloud-arrow-down-fill"></i>
						</button>
					</td>
					<td>${fileName}</td>
					<td>${modificationTime.toLocaleString()}</td>
					<td>${formatBytesToHumanReadable(compressedSize)}</td>
					<td>${formatBytesToHumanReadable(uncompressedSize)}</td>
					<td><i class="bi bi-${encrypted ? 'lock' : 'unlock'}-fill"></i></td>
				</tr>
			</table>`
		).querySelector('tr');

		tr.querySelector('button').addEventListener('click', () => download(file));
		tbody.appendChild(tr);
	});
}

const response = await fetch('archive.zip');
const bytes = await response.arrayBuffer();
const parsed = parse(bytes);
render(parsed);
// download(parsed.files[0]);

// Prevent default behaviour on `dragover` and `drop` events to allow dropping files
const preventDefault = (event) => event.preventDefault();
document.body.addEventListener('dragover', preventDefault);
document.body.addEventListener('drop', preventDefault);

document.body.addEventListener('drop', async ({dataTransfer: {files}}) => {
	const bytes = await files.item(0).arrayBuffer();
	const parsed = parse(bytes);
	render(parsed);
});

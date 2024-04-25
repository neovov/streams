/**
 * The reader class will help yielding bytes from a buffer.
 * It'll allow to rewind the pointer.
 */
export default class Reader {
	static BIG = 'big';
	static LITTLE = 'little';

	#buffer;
	#endianness;
	#offset = 0;
	#view;

	constructor(buffer, {endianness = Reader.BIG, length, offset} = {}) {
		this.#endianness = endianness;

		if (buffer instanceof ArrayBuffer) {
			this.#buffer = buffer;
		} else if (ArrayBuffer.isView(buffer)) {
			this.#buffer = buffer.buffer;
		} else if (Array.isArray(buffer)) {
			this.#buffer = new Uint8Array(buffer).buffer;
		} else {
			throw new Error(
				'Could not instanciate Reader because the provided `buffer` is neither an ArrayBuffer, TypedArray or Array.'
			);
		}

		this.#view = new DataView(this.#buffer, offset, length);
	}

	get buffer() {
		return this.#buffer;
	}

	clone({endianness = this.#endianness, length, offset} = {}) {
		return new Reader(this.#buffer, {endianness, length, offset});
	}

	get endianness() {
		return this.#endianness;
	}

	/**
	 * Get a signed/unsigned integer, coded on the given number of bits and endianness.
	 * @param {Object} options
	 * @param {number} options.bits
	 * @param {"big"|"little"|undefined} options.endianness
	 * @param {boolean} options.signed
	 * @return {number}
	 */
	#get({bits, endianness, signed}) {
		const method = `get${signed ? 'Int' : 'Uint'}${bits}`;
		const value = this.#view[method](
			this.#offset,
			String(endianness || this.#endianness).toLowerCase() === 'little'
		);
		this.#offset += bits / 8;
		return value;
	}

	/**
	 * Get a number of bytes.
	 * @param {number} bytes The number of bytes to get.
	 * @return {number[]}
	 */
	getBytes(bytes) {
		bytes = Math.max(1, bytes);
		const value = Array.from(
			new Uint8Array(
				this.#view.buffer,
				this.#view.byteOffset + this.#offset,
				bytes
			)
		);
		this.#offset += bytes;
		return value;
	}

	/**
	 * Get a signed 16 bits integer.
	 * @param {"big"|"little"} [endianness]
	 * @return {number}
	 */
	getInt16(endianness) {
		return this.#get({bits: 16, endianness, signed: true});
	}

	/**
	 * Get a signed 32 bits integer.
	 * @param {"big"|"little"} [endianness]
	 * @return {number}
	 */
	getInt32(endianness) {
		return this.#get({bits: 32, endianness, signed: true});
	}

	/**
	 * Get a signed 8 bits integer.
	 * @param {"big"|"little"} [endianness]
	 * @return {number}
	 */
	getInt8() {
		return this.#get({bits: 8, signed: true});
	}

	/**
	 * Get an unsigned 16 bits integer.
	 * @param {"big"|"little"} [endianness]
	 * @return {number}
	 */
	getUint16(endianness) {
		return this.#get({bits: 16, endianness, signed: false});
	}

	/**
	 * Get an unsigned 32 bits integer.
	 * @param {"big"|"little"} [endianness]
	 * @return {number}
	 */
	getUint32(endianness) {
		return this.#get({bits: 32, endianness, signed: false});
	}

	/**
	 * Get an unsigned 8 bits integer.
	 * @param {"big"|"little"} [endianness]
	 * @return {number}
	 */
	getUint8() {
		return this.#get({bits: 8, signed: false});
	}

	get offset() {
		return this.#offset;
	}

	set offset(offset) {
		this.#offset = Math.max(0, offset);
	}

	get remaining() {
		return this.#view.byteLength - this.#offset;
	}

	get status() {
		const {remaining} = this;
		return remaining
			? `Stopped reading at offset ${this.#offset}, still ${remaining} ${
					remaining > 1 ? 'bytes' : 'byte'
			  } to read.`
			: 'Finished reading.';
	}
}

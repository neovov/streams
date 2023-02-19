/**
 * The reader class will help yielding bytes from a buffer.
 * It'll allow to rewind the pointer.
 */
export default class Reader {
	#bytes;
	#iterator;
	#offset = 0;

	constructor(bytes) {
		this.#bytes = new Uint8Array(bytes);
	}

	get bytes() {
		return this.#bytes;
	}

	*#getIterator() {
		for (; this.#offset < this.#bytes.length; ) {
			yield this.#bytes[this.#offset++];
		}
	}

	get offset() {
		return this.#offset;
	}

	read(bytes = 1) {
		this.#iterator ||= this.#getIterator();

		if (bytes > 1) {
			const view = new Uint8Array(this.#bytes.buffer, this.#offset, bytes);
			this.#offset += bytes;

			return Array.from(view);
		}

		const {done, value} = this.#iterator.next();
		if (done) throw new Error('End of buffer');
		return value;
	}

	rewind(bytes = 1) {
		this.#offset -= bytes;
	}

	get status() {
		const remaining = this.#bytes.length - this.#offset;
		return this.#offset !== this.#bytes.length
			? `Stopped reading at offset ${this.#offset}, still ${remaining} ${
					remaining > 1 ? 'bytes' : 'byte'
			  } to read.`
			: 'Finished reading.';
	}
}

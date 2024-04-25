import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import * as THREE from 'three';
import FPSCapper from './FPSCapper.js';
import GUI, {OptionController} from 'lil-gui';
import Reader from './Reader.js';

const GLOBAL_STATE = {
	animation: 0,
	animationFPS: 30,
	bounding: false,
	material: true,
	vertices: false,
	wireframe: false,
};

/**
 * Convert a quad to two triangles.
 * @see https://stackoverflow.com/questions/12239876/fastest-way-of-converting-a-quad-to-a-triangle-strip#answer-12244542
 * @param {[[x: number, y: number, z: number], [x: number, y: number, z: number], [x: number, y: number, z: number], [x: number, y: number, z: number]]} quad The quad to convert (ABCD).
 * @return {[[x: number, y: number, z: number], [x: number, y: number, z: number], [x: number, y: number, z: number], [x: number, y: number, z: number], [x: number, y: number, z: number], [x: number, y: number, z: number]]} Return an array of 6 Vector3 (two triangles, either ABCACD or ABDDBC).
 */
function quadToTriangles(quad) {
	const [a, b, c, d] = quad;
	const distanceAC = Math.sqrt(
		(c[0] - a[0]) ** 2 + (c[1] - a[1]) ** 2 + (c[2] - a[2]) ** 2
	);
	const distanceBD = Math.sqrt(
		(d[0] - b[0]) ** 2 + (d[1] - b[1]) ** 2 + (d[2] - b[2]) ** 2
	);

	return distanceAC < distanceBD ? [a, b, c, a, c, d] : [a, b, d, d, b, c];
}

/**
 * “Parser”
 */

function parseBCX(reader) {
	// See https://wiki.ffrtt.ru/index.php/FF7/Field/BSX
	const {offsetModels} = parseBCXHeader(reader);

	reader.offset = offsetModels;
	const model = parseModel(reader);
	return model;
}

function parseBCXHeader(reader) {
	const fileSize = reader.getUint32();
	const offsetModels = reader.getUint32();
	return {fileSize, offsetModels};
}

function parseModel(reader) {
	const {numberOfAnimations, numberOfBones, numberOfParts, offsetSkeleton} =
		parseModelHeader(reader);

	reader.offset = offsetSkeleton;
	const skeleton = Array.from({length: numberOfBones}).map(() => {
		const length = reader.getInt16();
		const parent = reader.getInt8();
		const hasMesh = Boolean(reader.getUint8());
		return {length, hasMesh, parent};
	});

	const parts = Array.from({length: numberOfParts}).map(() => {
		const header = parseModelPartHeader(reader);
		const {offset} = reader; // Keep the offset for the next loop as parsing data will change the offset
		const parts = parseModelPartData(reader, header);
		reader.offset = offset;

		return parts;
	});

	const animations = Array.from({length: numberOfAnimations}).map(() => {
		const header = parseModelAnimationsHeader(reader);
		const {offset} = reader; // Keep the offset for the next loop as parsing data will change the offset
		const animations = parseModelAnimationsData(reader, header);
		reader.offset = offset;

		return animations;
	});

	return {animations, parts, skeleton};
}

function parseModelAnimationsData(reader, header) {
	const {
		numberOfChannels,
		numberOfFrames,
		offsetData,
		offsetFramesRotation,
		offsetFramesTranslation,
		offsetStaticTranslation,
	} = header;

	reader.offset = offsetData;
	reader.offset += 4; // Skip four padding(?) bytes
	const channels = Array.from({length: numberOfChannels}).map(() => {
		const flag = reader.getUint8();
		const rotation = reader.getBytes(3);
		const translation = reader.getBytes(3);
		reader.offset += 1; // Skip one padding(?) byte

		return {flag, rotation, translation};
	});

	const animations = channels.map((channel) =>
		Array.from({length: numberOfFrames}).map((_, frame) => {
			const {flag, rotation, translation} = channel;
			let [rx, ry, rz] = rotation;
			let [tx, ty, tz] = translation;

			if (flag & 0b0000_0001) {
				reader.offset =
					offsetData + offsetFramesRotation + rx * numberOfFrames + frame;
				rx = reader.getUint8();
			}

			if (flag & 0b0000_0010) {
				reader.offset =
					offsetData + offsetFramesRotation + ry * numberOfFrames + frame;
				ry = reader.getUint8();
			}

			if (flag & 0b0000_0100) {
				reader.offset =
					offsetData + offsetFramesRotation + rz * numberOfFrames + frame;
				rz = reader.getUint8();
			}

			if (flag & 0b0001_0000) {
				reader.offset =
					offsetData +
					offsetFramesTranslation +
					tx * numberOfFrames * 2 +
					frame * 2;
				tx = reader.getInt16();
			} else if (tx !== 0xff) {
				reader.offset = offsetData + offsetStaticTranslation + tx * 2;
				tx = reader.getInt16();
			} else {
				tx = 0;
			}

			if (flag & 0b0010_0000) {
				reader.offset =
					offsetData +
					offsetFramesTranslation +
					ty * numberOfFrames * 2 +
					frame * 2;
				ty = reader.getInt16();
			} else if (ty !== 0xff) {
				reader.offset = offsetData + offsetStaticTranslation + ty * 2;
				ty = reader.getInt16();
			} else {
				ty = 0;
			}

			if (flag & 0b0100_0000) {
				reader.offset =
					offsetData +
					offsetFramesTranslation +
					tz * numberOfFrames * 2 +
					frame * 2;
				tz = reader.getInt16();
			} else if (tz !== 0xff) {
				reader.offset = offsetData + offsetStaticTranslation + tz * 2;
				tz = reader.getInt16();
			} else {
				tz = 0;
			}

			return {
				rotation: [rx, ry, rz],
				translation: [tx, ty, tz],
			};
		})
	);

	return animations;
}

function parseModelAnimationsHeader(reader) {
	const numberOfFrames = reader.getUint16();
	const numberOfChannels = reader.getUint8();
	const numberOfFramesTranslation = reader.getUint8();
	const numberOfStaticTranslation = reader.getUint8();
	const numberOfFramesRotation = reader.getUint8();
	const offsetFramesTranslation = reader.getUint16();
	const offsetStaticTranslation = reader.getUint16();
	const offsetFramesRotation = reader.getUint16();
	const offsetData = reader.getUint32() & 0x7fffffff; // The offset seems to be coded on 31 bits instead of 32

	return {
		numberOfChannels,
		numberOfFrames,
		numberOfFramesRotation,
		numberOfFramesTranslation,
		numberOfStaticTranslation,
		offsetData,
		offsetFramesRotation,
		offsetFramesTranslation,
		offsetStaticTranslation,
	};
}

function parseModelHeader(reader) {
	const unknown = reader.getUint16(); // Always 0xFF01
	const numberOfBones = reader.getUint8();
	const numberOfParts = reader.getUint8();
	const numberOfAnimations = reader.getUint8();
	const blank = reader.getBytes(17);
	const scale = reader.getUint16();
	const offsetParts = reader.getUint16();
	const offsetAnimations = reader.getUint16();
	const offsetSkeleton = reader.getUint32() & 0x7fffffff; // The offset seems to be coded on 31 bits instead of 32

	return {
		blank,
		numberOfAnimations,
		numberOfBones,
		numberOfParts,
		offsetAnimations,
		offsetParts,
		offsetSkeleton,
		scale,
		unknown,
	};
}

function parseModelPartData(reader, header) {
	const {
		boneIndex,
		numberOfColorQuads,
		numberOfColorTexturedQuads,
		numberOfColorTexturedTriangles,
		numberOfColorTriangles,
		numberOfMonochromeQuads,
		numberOfMonochromeTexturedQuads,
		numberOfMonochromeTexturedTriangles,
		numberOfMonochromeTriangles,
		numberOfTextureCoords,
		numberOfVertices,
		offsetPolygon,
		offsetTextureCoords,
		offsetVertices,
	} = header;

	reader.offset = offsetVertices;
	reader.offset += 4; // Skip four padding(?) bytes
	const vertices = Array.from({length: numberOfVertices}).map(() => {
		const x = reader.getInt16();
		const y = reader.getInt16();
		const z = reader.getInt16();
		reader.offset += 2; // Skip two padding(?) bytes
		return [x, y, z];
	});

	reader.offset = offsetVertices + offsetTextureCoords;
	const textureCoords = Array.from({length: numberOfTextureCoords}).map(() =>
		reader.getBytes(2)
	);

	reader.offset = offsetVertices + offsetPolygon;
	const colorTexturedQuads = Array.from({
		length: numberOfColorTexturedQuads,
	}).map(() => {
		const [av, bv, cv, dv] = reader.getBytes(4);
		const [ar, ag, ab] = reader.getBytes(4); // The fourth byte is a padding byte (?)
		const [br, bg, bb] = reader.getBytes(4); // The fourth byte is a padding byte (?)
		const [cr, cg, cb] = reader.getBytes(4); // The fourth byte is a padding byte (?)
		const [dr, dg, db] = reader.getBytes(4); // The fourth byte is a padding byte (?)
		const [at, bt, ct, dt] = reader.getBytes(4);

		return {
			a: {color: [ar, ag, ab], textureCoordIndex: at, vertexIndex: av},
			b: {color: [br, bg, bb], textureCoordIndex: bt, vertexIndex: bv},
			c: {color: [cr, cg, cb], textureCoordIndex: ct, vertexIndex: cv},
			d: {color: [dr, dg, db], textureCoordIndex: dt, vertexIndex: dv},
		};
	});

	const colorTexturedTriangles = Array.from({
		length: numberOfColorTexturedTriangles,
	}).map(() => {
		const [av, bv, cv] = reader.getBytes(4); // The fourth byte is a padding byte (?)
		const [ar, ag, ab] = reader.getBytes(4); // The fourth byte is a padding byte (?)
		const [br, bg, bb] = reader.getBytes(4); // The fourth byte is a padding byte (?)
		const [cr, cg, cb] = reader.getBytes(4); // The fourth byte is a padding byte (?)
		const [at, bt, ct] = reader.getBytes(4); // The fourth byte is a padding byte (?)

		return {
			a: {color: [ar, ag, ab], textureCoordIndex: at, vertexIndex: av},
			b: {color: [br, bg, bb], textureCoordIndex: bt, vertexIndex: bv},
			c: {color: [cr, cg, cb], textureCoordIndex: ct, vertexIndex: cv},
		};
	});

	const monochromeTexturedQuads = Array.from({
		length: numberOfMonochromeTexturedQuads,
	}).map(() => {
		const [av, bv, cv, dv] = reader.getBytes(4);
		const [r, g, b] = reader.getBytes(4); // The fourth byte is a padding byte (?)
		const [at, bt, ct, dt] = reader.getBytes(4);

		return {
			a: {textureCoordIndex: at, vertexIndex: av},
			b: {textureCoordIndex: bt, vertexIndex: bv},
			c: {textureCoordIndex: ct, vertexIndex: cv},
			d: {textureCoordIndex: dt, vertexIndex: dv},
			color: [r, g, b],
		};
	});

	const monochromeTexturedTriangles = Array.from({
		length: numberOfMonochromeTexturedTriangles,
	}).map(() => {
		const [av, bv, cv] = reader.getBytes(4); // The fourth byte is a padding byte (?)
		const [r, g, b] = reader.getBytes(4); // The fourth byte is a padding byte (?)
		const [at, bt, ct] = reader.getBytes(4); // The fourth byte is a padding byte (?)

		return {
			a: {textureCoordIndex: at, vertexIndex: av},
			b: {textureCoordIndex: bt, vertexIndex: bv},
			c: {textureCoordIndex: ct, vertexIndex: cv},
			color: [r, g, b],
		};
	});

	const monochromeTriangles = Array.from({
		length: numberOfMonochromeTriangles,
	}).map(() => {
		const [av, bv, cv] = reader.getBytes(4); // The fourth byte is a padding byte (?)
		const [r, g, b] = reader.getBytes(4); // The fourth byte is a padding byte (?)

		return {
			a: {vertexIndex: av},
			b: {vertexIndex: bv},
			c: {vertexIndex: cv},
			color: [r, g, b],
		};
	});

	const monochromeQuads = Array.from({length: numberOfMonochromeQuads}).map(
		() => {
			const [av, bv, cv, dv] = reader.getBytes(4);
			const [r, g, b] = reader.getBytes(4); // The fourth byte is a padding byte (?)

			return {
				a: {vertexIndex: av},
				b: {vertexIndex: bv},
				c: {vertexIndex: cv},
				d: {vertexIndex: dv},
				color: [r, g, b],
			};
		}
	);

	const colorTriangles = Array.from({length: numberOfColorTriangles}).map(
		() => {
			const [av, bv, cv] = reader.getBytes(4); // The fourth byte is a padding byte (?)
			const [ar, ag, ab] = reader.getBytes(4); // The fourth byte is a padding byte (?)
			const [br, bg, bb] = reader.getBytes(4); // The fourth byte is a padding byte (?)
			const [cr, cg, cb] = reader.getBytes(4); // The fourth byte is a padding byte (?)

			return {
				a: {color: [ar, ag, ab], vertexIndex: av},
				b: {color: [br, bg, bb], vertexIndex: bv},
				c: {color: [cr, cg, cb], vertexIndex: cv},
			};
		}
	);

	const colorQuads = Array.from({length: numberOfColorQuads}).map(() => {
		const [av, bv, cv, dv] = reader.getBytes(4);
		const [ar, ag, ab] = reader.getBytes(4); // The fourth byte is a padding byte (?)
		const [br, bg, bb] = reader.getBytes(4); // The fourth byte is a padding byte (?)
		const [cr, cg, cb] = reader.getBytes(4); // The fourth byte is a padding byte (?)
		const [dr, dg, db] = reader.getBytes(4); // The fourth byte is a padding byte (?)

		return {
			a: {color: [ar, ag, ab], vertexIndex: av},
			b: {color: [br, bg, bb], vertexIndex: bv},
			c: {color: [cr, cg, cb], vertexIndex: cv},
			d: {color: [dr, dg, db], vertexIndex: dv},
		};
	});

	return {
		boneIndex,
		colorQuads,
		colorTexturedQuads,
		colorTexturedTriangles,
		colorTriangles,
		monochromeQuads,
		monochromeTexturedQuads,
		monochromeTexturedTriangles,
		monochromeTriangles,
		textureCoords,
		vertices,
	};
}

function parseModelPartHeader(reader) {
	const unknown = reader.getUint8(); // 0 = don't calculate stage lighting and color, 1 = calculate
	const boneIndex = reader.getUint8();
	const numberOfVertices = reader.getUint8();
	const numberOfTextureCoords = reader.getUint8();
	const numberOfColorTexturedQuads = reader.getUint8();
	const numberOfColorTexturedTriangles = reader.getUint8();
	const numberOfMonochromeTexturedQuads = reader.getUint8();
	const numberOfMonochromeTexturedTriangles = reader.getUint8();
	const numberOfMonochromeTriangles = reader.getUint8();
	const numberOfMonochromeQuads = reader.getUint8();
	const numberOfColorTriangles = reader.getUint8();
	const numberOfColorQuads = reader.getUint8();
	const numberOfBytesForFlags = reader.getUint8();
	const numberOfBytesForControl = reader.getUint8();
	const offsetPolygon = reader.getUint16();
	const offsetTextureCoords = reader.getUint16();
	const offsetFlags = reader.getUint16();
	const offsetControl = reader.getUint16();
	const bufferSize = reader.getUint16();
	const offsetVertices = reader.getUint32() & 0x7fffffff; // The offset seems to be coded on 31 bits instead of 32
	const offsetPrec = reader.getUint32();

	return {
		boneIndex,
		bufferSize,
		numberOfBytesForControl,
		numberOfBytesForFlags,
		numberOfColorQuads,
		numberOfColorTexturedQuads,
		numberOfColorTexturedTriangles,
		numberOfColorTriangles,
		numberOfMonochromeQuads,
		numberOfMonochromeTexturedQuads,
		numberOfMonochromeTexturedTriangles,
		numberOfMonochromeTriangles,
		numberOfTextureCoords,
		numberOfVertices,
		offsetControl,
		offsetFlags,
		offsetPolygon,
		offsetPrec,
		offsetTextureCoords,
		offsetVertices,
		unknown,
	};
}

function parseTDB(reader) {
	// See https://wiki.ffrtt.ru/index.php/FF7/Field/FIELD.TDB
	const header = parseTDBHeader(reader);
	const textures = parseTDBData(reader, header);
	return textures;
}

function parseTDBData(reader, header) {
	const {imageCount, paletteCount} = header;

	const images = Array.from({length: imageCount}).map(() =>
		// Images are 32x32 pixels wide
		// Each pixel is an index of the palette, coded on 4 bits
		// 32*32*4 = 4096 bits = 512 bytes
		reader
			.getBytes(512)
			.map((byte) => [byte & 0b1111, byte >> 4])
			.flat()
	);

	const palettes = Array.from({length: paletteCount}).map(() =>
		// Each palette has 16 colors
		Array.from({length: 16}).map(() => {
			// Colors are coded in AB5G5R5 format (16 bits: abbb bbgg gggr rrrr)
			const colors = reader.getUint16();
			const r = (colors & 0b11111) * 8; // Normalize (5 bits to 8 bits)
			const g = ((colors >> 5) & 0b11111) * 8; // Normalize (5 bits to 8 bits)
			const b = ((colors >> 10) & 0b11111) * 8; // Normalize (5 bits to 8 bits)
			const a = colors >> 15 ? 0 : 255; // 1 means the color is opaque, 0 that it is fully transparent
			return [r, g, b, a];
		})
	);

	return {images, palettes};
}

function parseTDBHeader(reader) {
	const totalDataSize = reader.getUint32();
	const imageCount = reader.getUint16();
	const paletteCount = reader.getUint16();
	const imageOffset = reader.getUint32();
	const paletteOffset = reader.getUint32();

	return {
		imageCount,
		imageOffset,
		paletteCount,
		paletteOffset,
		totalDataSize,
	};
}

/**
 * “App”
 */

function animate(animationIndex, frame = 0) {
	const {model} = scene.userData;
	const {bones, defaultPosition, parsed} = model.userData;
	const animation = parsed.animations[animationIndex];

	animation.forEach((bone, index) => {
		const mesh = bones[index];
		const {rotation, translation} = bone[frame];
		const [rx, ry, rz] = rotation;
		const [tx, ty, tz] = translation;
		mesh.setRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));

		// For bone[0], we need to reset the position before translating
		if (!index)
			mesh.position.set(
				defaultPosition.x,
				defaultPosition.y,
				defaultPosition.z
			);

		mesh.translateX(tx);
		mesh.translateY(ty);
		mesh.translateZ(tz);
	});
}

function createMesh({colors, positions, uv}, material) {
	if (!positions) return;

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute(
		'position',
		new THREE.BufferAttribute(new Float32Array(positions), 3)
	);

	if (uv.length) {
		geometry.setAttribute(
			'uv',
			new THREE.BufferAttribute(new Float32Array(uv), 2)
		);
	}

	if (material.userData.monochrome) {
		material.color = colors;
	}

	if (material.vertexColors) {
		geometry.setAttribute(
			'color',
			new THREE.BufferAttribute(new Float32Array(colors), 3)
		);
	}

	geometry.computeVertexNormals();
	return new THREE.Mesh(geometry, material);
}

function createMeshHelper(mesh, {name}) {
	const {colors, positions} = mesh.children
		.map((m) => ({
			colors: Array.from(m.geometry.getAttribute('color').array),
			positions: Array.from(m.geometry.getAttribute('position').array),
		}))
		.reduce((accumulator, {colors, positions}) => ({
			colors: [...(accumulator.colors || []), ...colors],
			positions: [...(accumulator.positions || []), ...positions],
		}));

	const geometry = new THREE.BufferGeometry();
	geometry.setAttribute(
		'position',
		new THREE.BufferAttribute(new Float32Array(positions), 3)
	);

	const bounding = new THREE.Box3Helper(new THREE.Box3().setFromObject(mesh));

	const points = new THREE.Points(
		geometry,
		new THREE.PointsMaterial({size: 0.03})
	);

	const wireframe = new THREE.LineSegments(
		new THREE.WireframeGeometry(geometry),
		new THREE.LineBasicMaterial({vertexColors: !GLOBAL_STATE.material})
	);

	const difference =
		wireframe.geometry.getAttribute('position').array.length - colors.length;

	// WireframeGeometry may create new vertices so we'll have to fill the colors
	if (difference) {
		colors.push(
			...Array.from({length: difference / 3})
				.fill([1, 0, 0])
				.flat()
		);
	}

	wireframe.geometry.setAttribute(
		'color',
		new THREE.BufferAttribute(new Float32Array(colors), 3)
	);

	bounding.visible = GLOBAL_STATE.bounding;
	mesh.children.forEach((m) => (m.material.visible = GLOBAL_STATE.material));
	points.visible = GLOBAL_STATE.vertices;
	wireframe.visible = GLOBAL_STATE.wireframe;

	const folder = gui.folders
		.find((folder) => folder._title === 'Parts')
		.addFolder(name)
		.close();

	folder.add(bounding, 'visible').name('bounding');
	folder
		.add({visible: GLOBAL_STATE.material}, 'visible')
		.name('material')
		.onChange((value) => {
			mesh.children.forEach((m) => m.material && (m.material.visible = value));
			wireframe.material.vertexColors = !value;
			wireframe.material.needsUpdate = true;
		});
	folder.add(points, 'visible').name('vertices');
	folder.add(wireframe, 'visible').name('wireframe');

	const group = new THREE.Group();
	group.add(bounding);
	group.add(points);
	group.add(wireframe);

	return group;
}

function createModel(bcx) {
	const {animations, parts, skeleton} = bcx;
	const animation = animations[0];
	const bones = [];
	const material = new THREE.LineBasicMaterial({
		color: new THREE.Color(1, 0, 1),
	});
	const root = new THREE.Group();

	const colors = [
		[0.0, 0.0, 0.0], // 0 ø
		[0.0, 0.0, 0.0], // 1 ø
		[0.0, 0.0, 1.0], // 2 blue
		[0.0, 1.0, 0.0], // 3 green
		[0.0, 1.0, 1.0], // 4 turquoise
		[1.0, 0.0, 0.0], // 5 red
		[1.0, 0.0, 1.0], // 6 pink
		[1.0, 1.0, 0.0], // 7 yellow
		[1.0, 1.0, 1.0], // 8 white
		[0.0, 0.0, 1.0], // 9 blue
		[0.0, 1.0, 0.0], // 10 green
		[0.0, 1.0, 1.0], // 11 turquoise
		[1.0, 0.0, 0.0], // 12 red
		[1.0, 0.0, 1.0], // 13 pink
		[0.0, 0.0, 0.0], // 14 ø
		[1.0, 1.0, 0.0], // 15 yellow
		[1.0, 1.0, 1.0], // 16 white
		[0.0, 0.0, 1.0], // 17 blue
		[0.0, 0.0, 0.0], // 18 ø
		[0.0, 0.0, 1.0], // 19 blue
		[0.0, 1.0, 0.0], // 20 green
		[0.0, 1.0, 1.0], // 21 turquoise
	];

	let partIndex = 0;
	skeleton.forEach((bone, index) => {
		// if (index > 2) return;
		const {length} = bone;
		const {rotation, translation} = animation[index][0];
		const [rx, ry, rz] = rotation;
		const [tx, ty, tz] = translation;
		const parent = bone.parent === -1 ? root : bones[bone.parent];

		let group = new THREE.Group();
		// if (length) {
		// 	const geometry = new THREE.BufferGeometry().setFromPoints([
		// 		new THREE.Vector3(0, 0, 0),
		// 		new THREE.Vector3(0, 0, length),
		// 	]);

		// 	// XXX
		// 	const material = new THREE.LineBasicMaterial({
		// 		color: new THREE.Color(...colors[index]),
		// 	});

		// 	const mesh = new THREE.Line(geometry, material);
		// 	// mesh.setRotationFromEuler(new THREE.Euler(-rx, -ry, -rz, 'YXZ'));
		// 	group.add(mesh);
		// }

		// console.log({
		// 	bone,
		// 	mesh,
		// 	rotation: [rx, ry, rz],
		// 	translation: [tx, ty, tz],
		// });

		if (bone.hasMesh) {
			const mesh = createPart(parts[partIndex], {name: `part[${partIndex++}]`});
			group.add(mesh);
		}

		group.translateZ(length);
		group.setRotationFromEuler(new THREE.Euler(rx, ry, rz, 'YXZ'));
		group.translateX(tx);
		group.translateY(ty);
		group.translateZ(tz);

		parent.add(group);
		bones.push(group);
	});

	root.rotation.x = Math.PI;
	root.userData = {
		...root.userData,
		bones,
		defaultPosition: root.position.clone(),
		parsed: bcx,
	};

	return root;
}

function createPart(part, {name}) {
	const {
		colorQuads,
		colorTexturedQuads,
		colorTexturedTriangles,
		colorTriangles,
		monochromeQuads,
		monochromeTexturedQuads,
		monochromeTexturedTriangles,
		monochromeTriangles,
		textureCoords,
		vertices,
	} = part;

	const reducer = (accumulator, {colors, positions, uv}) => ({
		colors: [...(accumulator.colors || []), ...colors],
		positions: [...(accumulator.positions || []), ...positions],
		uv: [...(accumulator.uv || []), ...uv],
	});

	const normalizedTextureCoords = textureCoords.map(([u, v]) => [
		u / 32,
		v / 32,
	]);

	const meshes = [
		createMesh(
			colorQuads
				.map((quad) => prepareQuads(quad, vertices))
				.reduce(reducer, {}),
			new THREE.MeshLambertMaterial({
				side: THREE.DoubleSide,
				vertexColors: true,
			})
		),
		createMesh(
			colorTexturedQuads
				.map((quad) => prepareQuads(quad, vertices, normalizedTextureCoords))
				.reduce(reducer, {}),
			new THREE.MeshStandardMaterial({
				// blending: THREE.AdditiveBlending,
				// alphaMap: (() => {
				// 	if (colorTexturedQuads[0]?.a.textureCoordIndex === undefined)
				// 		return null;

				// 	const imageData = getImageData(textures, 16, 4);
				// 	console.log(imageData);
				// 	const texture = new THREE.Texture(imageData);
				// 	texture.needsUpdate = true;
				// 	texture.center = new THREE.Vector2(0.5, 0.5);
				// 	texture.rotation = -Math.PI;
				// 	texture.repeat.set(-1, 1);
				// 	texture.offset.set(-1, 0);
				// 	texture.wrapS = THREE.RepeatWrapping;
				// 	return texture;
				// })(),
				map: (() => {
					if (colorTexturedQuads[0]?.a.textureCoordIndex === undefined)
						return null;

					const imageData = getImageData(textures, 16, 5);
					const texture = new THREE.Texture(imageData);
					texture.center = new THREE.Vector2(0.5, 0.5);
					texture.needsUpdate = true;
					texture.offset.set(-1, 0);
					texture.repeat.set(-1, 1);
					texture.rotation = -Math.PI;
					texture.wrapS = THREE.RepeatWrapping;
					return texture;
				})(),
				// alphaTest: 255,
				transparent: true,
				side: THREE.DoubleSide,
				vertexColors: true,
			})
		),
		createMesh(
			colorTexturedTriangles
				.map((triangle) =>
					prepareTriangles(triangle, vertices, normalizedTextureCoords)
				)
				.reduce(reducer, {}),
			new THREE.MeshLambertMaterial({
				map: (() => {
					if (colorTexturedQuads[0]?.a.textureCoordIndex === undefined)
						return null;

					const imageData = getImageData(textures, 16, 0);
					const texture = new THREE.Texture(imageData);
					return texture;
				})(), // TODO
				side: THREE.DoubleSide,
				vertexColors: true,
			})
		),
		createMesh(
			colorTriangles
				.map((triangle) => prepareTriangles(triangle, vertices))
				.reduce(reducer, {}),
			new THREE.MeshLambertMaterial({
				side: THREE.DoubleSide,
				vertexColors: true,
			})
		),
		createMesh(
			monochromeQuads
				.map((quad) => prepareQuads(quad, vertices))
				.reduce(reducer, {}),
			new THREE.MeshLambertMaterial({
				side: THREE.DoubleSide,
				userData: {monochrome: true},
			})
		),
		createMesh(
			monochromeTexturedQuads
				.map((quad) => prepareQuads(quad, vertices))
				.reduce(reducer, {}),
			new THREE.MeshLambertMaterial({
				// map: new THREE.Texture(), // TODO
				side: THREE.DoubleSide,
				userData: {monochrome: true},
			})
		),
		createMesh(
			monochromeTexturedTriangles
				.map((triangle) => prepareTriangles(triangle, vertices))
				.reduce(reducer, {}),
			new THREE.MeshLambertMaterial({
				// map: new THREE.Texture(), // TODO
				side: THREE.DoubleSide,
				userData: {monochrome: true},
			})
		),
		createMesh(
			monochromeTriangles
				.map((triangle) => prepareTriangles(triangle, vertices))
				.reduce(reducer, {}),
			new THREE.MeshLambertMaterial({
				side: THREE.DoubleSide,
				userData: {monochrome: true},
			})
		),
	].filter(Boolean);

	const group = new THREE.Group();
	group.add(...meshes);
	group.add(createMeshHelper(group, {name}));

	return group;
}

function getImageData(tdb, imageIndex, paletteIndex) {
	const {images, palettes} = tdb;
	const image = images[imageIndex];
	const palette = palettes[paletteIndex];
	const data = new Uint8ClampedArray(
		image.map((index) => palette[index]).flat()
	);
	return new ImageData(data, 32, 32);
}

function normalizeModel(model) {
	let {animations, parts, skeleton} = model;

	const normalizeColor = (color) => color / 255;
	const normalizeLength = (length) => length / 255;
	const normalizeRotation = (axis) =>
		THREE.MathUtils.degToRad((axis * 360) / 255);
	const normalizeTranslation = (axis) => axis / 255;
	const normalizeVertex = (vertex) => vertex / 255;

	function normalizePolygonColor(polygon) {
		return polygon.color
			? {...polygon, color: polygon.color.map(normalizeColor)}
			: Object.fromEntries(
					Object.entries(polygon).map(([key, value]) => [
						key,
						{...value, color: value.color.map(normalizeColor)},
					])
			  );
	}

	animations = animations.map((animation) =>
		animation.map((bone) =>
			bone.map((frame) => ({
				...frame,
				rotation: frame.rotation.map(normalizeRotation),
				translation: frame.translation.map(normalizeTranslation),
			}))
		)
	);

	parts = parts.map((part) => {
		const {
			colorQuads,
			colorTexturedQuads,
			colorTexturedTriangles,
			colorTriangles,
			monochromeQuads,
			monochromeTexturedQuads,
			monochromeTexturedTriangles,
			monochromeTriangles,
			vertices,
		} = part;

		return {
			...part,
			...Object.fromEntries(
				Object.entries({
					colorQuads,
					colorTexturedQuads,
					colorTexturedTriangles,
					colorTriangles,
					monochromeQuads,
					monochromeTexturedQuads,
					monochromeTexturedTriangles,
					monochromeTriangles,
				}).map(([key, array]) => [key, array.map(normalizePolygonColor)])
			),
			vertices: vertices.map((array) => array.map(normalizeVertex)),
		};
	});

	skeleton = skeleton.map((bone) => ({
		...bone,
		length: normalizeLength(bone.length),
	}));

	return {...model, animations, parts, skeleton};
}

function parse(bytes) {
	const reader = new Reader(bytes, {endianness: Reader.LITTLE});
	const parsed = parseBCX(reader);

	console.info(reader.status);
	console.log('Parsed:', parsed);

	return parsed;
}

function render(parsed) {
	if (scene.userData.model) {
		scene.remove(scene.userData.model);
		disposeRecursive(scene.userData.model);
		delete scene.model;
		delete scene.parsed;

		function disposeRecursive(object) {
			object.children?.forEach(disposeRecursive);
			object.geometry?.dispose();
			object.material?.dispose();
		}
	}

	const folder = gui.folders.find((folder) => folder._title === 'Parts');
	Array.from(folder.$children.childNodes).forEach((node) => node.remove());
	folder.children = [];
	folder.folders = [];

	const normalized = normalizeModel(parsed);
	const model = createModel(normalized);
	const center = new THREE.Box3()
		.setFromObject(model)
		.getCenter(new THREE.Vector3());

	camera.position.setY(center.y);
	controls.target = center;
	lights.forEach((light) => light.position.setY(center.y));

	const oldController = gui.controllers.find(
		({property}) => property === 'animation'
	);
	const newController = new OptionController(
		oldController.parent,
		oldController.object,
		oldController.property,
		Array.from({length: parsed.animations.length}).map((_, index) => index)
	);

	newController._onChange = oldController._onChange;
	newController.domElement.remove();
	oldController.domElement.replaceWith(newController.domElement);

	scene.add(model);
	scene.userData = {...scene.userData, model};
}

function prepareQuads(quad, vertices, textureCoords = []) {
	const a = vertices[quad.a.vertexIndex];
	const b = vertices[quad.b.vertexIndex];
	const c = vertices[quad.c.vertexIndex];
	const d = vertices[quad.d.vertexIndex];
	const triangles = quadToTriangles([a, b, d, c]); // ABDC is intended here

	// `quadToTriangles` will return either ABDADC or ABCCBD so we have to re-map the colors
	const colors =
		quad.color ||
		(triangles[2] === d
			? [
					...quad.a.color,
					...quad.b.color,
					...quad.d.color,
					...quad.a.color,
					...quad.d.color,
					...quad.c.color,
			  ]
			: [
					...quad.a.color,
					...quad.b.color,
					...quad.c.color,
					...quad.c.color,
					...quad.b.color,
					...quad.d.color,
			  ]);

	const uv = textureCoords.length
		? triangles[2] === d
			? [
					...textureCoords[quad.a.textureCoordIndex],
					...textureCoords[quad.b.textureCoordIndex],
					...textureCoords[quad.d.textureCoordIndex],
					...textureCoords[quad.a.textureCoordIndex],
					...textureCoords[quad.d.textureCoordIndex],
					...textureCoords[quad.c.textureCoordIndex],
			  ]
			: [
					...textureCoords[quad.a.textureCoordIndex],
					...textureCoords[quad.b.textureCoordIndex],
					...textureCoords[quad.c.textureCoordIndex],
					...textureCoords[quad.c.textureCoordIndex],
					...textureCoords[quad.b.textureCoordIndex],
					...textureCoords[quad.d.textureCoordIndex],
			  ]
		: [];

	return {colors, positions: triangles.flat(), uv};
}

function prepareTriangles(triangle, vertices, textureCoords = []) {
	return {
		colors: triangle.color || [
			...triangle.a.color,
			...triangle.b.color,
			...triangle.c.color,
		],
		positions: [
			...vertices[triangle.a.vertexIndex],
			...vertices[triangle.b.vertexIndex],
			...vertices[triangle.c.vertexIndex],
		],
		uv: textureCoords.length
			? [
					...textureCoords[triangle.a.textureCoordIndex],
					...textureCoords[triangle.b.textureCoordIndex],
					...textureCoords[triangle.c.textureCoordIndex],
			  ]
			: [],
	};
}

const canvas = document.querySelector('#canvas');
let {innerWidth: WIDTH, innerHeight: HEIGHT} = window;

const animationCapper = new FPSCapper(GLOBAL_STATE.animationFPS, () => {
	const {animation: animationIndex, frame = 0} = GLOBAL_STATE;
	if (!animationIndex) return;

	const {length: numberOfFrames} =
		scene.userData.model.userData.parsed.animations[animationIndex][0];

	animate(animationIndex, frame);
	GLOBAL_STATE.frame = frame >= numberOfFrames - 1 ? 0 : frame + 1;
});
const camera = new THREE.PerspectiveCamera(75, WIDTH / HEIGHT, 0.1, 100);
const controls = new OrbitControls(camera, canvas);
const gui = new GUI();
const lights = [
	new THREE.PointLight(0xffffff, 0.75, 0),
	new THREE.PointLight(0xffffff, 0.75, 0),
	new THREE.PointLight(0xffffff, 0.75, 0),
];
const renderer = new THREE.WebGLRenderer({antialias: true, canvas});
const scene = new THREE.Scene();

const textures = parseTDB(
	new Reader(
		await fetch('assets/field.tdb').then((response) => response.arrayBuffer()),
		{endianness: Reader.LITTLE}
	)
);

function createOnChange(name) {
	return (value) =>
		gui
			.foldersRecursive()
			.filter((folder) => folder._title.startsWith('part'))
			.forEach((folder) =>
				folder.controllers
					.find((controller) => controller._name === name)
					?.setValue(value)
			);
}

camera.position.set(0, 3, 3.5);
controls.enableDamping = true;
gui.add(controls, 'autoRotate');
gui.add(controls, 'autoRotateSpeed').min(2).max(15).step(1);
gui.add(GLOBAL_STATE, 'animation', [0]).onChange((index) => {
	GLOBAL_STATE.frame = 0;
	if (!index) animate(index); // Reset to idle "animation" if the index is 0
});
gui
	.add(GLOBAL_STATE, 'animationFPS')
	.min(1)
	.max(60)
	.step(1)
	.onChange((value) => (animationCapper.fps = value));
gui.add(GLOBAL_STATE, 'bounding').onChange(createOnChange('bounding'));
gui.add(GLOBAL_STATE, 'material').onChange(createOnChange('material'));
gui.add(GLOBAL_STATE, 'vertices').onChange(createOnChange('vertices'));
gui.add(GLOBAL_STATE, 'wireframe').onChange(createOnChange('wireframe'));
gui.add(lights[0], 'visible').name('lights[0]');
gui.add(lights[1], 'visible').name('lights[1]');
gui.add(lights[2], 'visible').name('lights[2]');
gui.addFolder('Parts').close();

lights[0].position.set(-5, 3, 5);
lights[1].position.set(5, 3, 5);
lights[2].position.set(0, 3, -5);

scene.add(...lights.map((light) => new THREE.PointLightHelper(light, 0.5)));
scene.add(...lights);
scene.add(new THREE.AxesHelper());
scene.add(new THREE.GridHelper(10, 10));

function onResize() {
	WIDTH = window.innerWidth;
	HEIGHT = window.innerHeight;

	camera.aspect = WIDTH / HEIGHT;
	camera.updateProjectionMatrix();

	renderer.setSize(WIDTH, HEIGHT);
	renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
}

function tick(time) {
	animationCapper.loop(time);
	controls.update();
	renderer.render(scene, camera);
	window.requestAnimationFrame(tick);
}

onResize();
render(
	parse(
		await fetch('./assets/cloud.bcx').then((response) => response.arrayBuffer())
	)
);
tick();
window.addEventListener('resize', onResize);

// Prevent default behaviour on `dragover` and `drop` events to allow dropping files
const preventDefault = (event) => event.preventDefault();
document.body.addEventListener('dragover', preventDefault);
document.body.addEventListener('drop', preventDefault);

document.body.addEventListener('drop', async ({dataTransfer: {files}}) => {
	const bytes = await files.item(0).arrayBuffer();
	const parsed = parse(bytes);
	render(parsed);
});

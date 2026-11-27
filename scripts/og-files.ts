// PNG and ICO bytes for pnpm og and its tests (seo requirements 7.5 and 7.7). Pure.

const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];

/** Width and height from the IHDR chunk; throws unless the bytes start like a PNG. */
export function pngSize(bytes: Uint8Array): { width: number; height: number } {
	if (bytes.length < 24 || SIGNATURE.some((b, i) => bytes[i] !== b))
		throw new Error("not a PNG");
	const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
	if (String.fromCharCode(...bytes.subarray(12, 16)) !== "IHDR")
		throw new Error("a PNG with no IHDR chunk first");
	return { width: view.getUint32(16), height: view.getUint32(20) };
}

/** A one-image ICO holding the PNG as it is (a PNG-in-ICO container, Windows Vista on). */
export function icoFromPng(png: Uint8Array, size: number): Uint8Array {
	const HEADER = 6;
	const ENTRY = 16;
	const out = new Uint8Array(HEADER + ENTRY + png.length);
	const view = new DataView(out.buffer);
	view.setUint16(2, 1, true); // type: icon
	view.setUint16(4, 1, true); // one image
	// 0 stands for 256 in the one-byte width and height.
	out[6] = size >= 256 ? 0 : size;
	out[7] = size >= 256 ? 0 : size;
	view.setUint16(10, 1, true); // colour planes
	view.setUint16(12, 32, true); // bits per pixel
	view.setUint32(14, png.length, true);
	view.setUint32(18, HEADER + ENTRY, true);
	out.set(png, HEADER + ENTRY);
	return out;
}

/** The PNG inside a one-image ICO, and the size its entry states. */
export function pngFromIco(ico: Uint8Array): { png: Uint8Array; size: number } {
	const view = new DataView(ico.buffer, ico.byteOffset, ico.byteLength);
	if (view.getUint16(0, true) !== 0 || view.getUint16(2, true) !== 1)
		throw new Error("not an ICO");
	const length = view.getUint32(14, true);
	const offset = view.getUint32(18, true);
	return {
		png: ico.subarray(offset, offset + length),
		size: ico[6] === 0 ? 256 : (ico[6] as number),
	};
}

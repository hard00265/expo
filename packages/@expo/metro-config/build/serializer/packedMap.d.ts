/**
 * Copyright © 2026 650 Industries.
 *
 * This source code is licensed under the MIT license found in the
 * LICENSE file in the root directory of this source tree.
 */
import type { MetroSourceMapSegmentTuple } from '@expo/metro/metro-source-map';
export declare const STRIDE = 5;
export declare const SENTINEL = -1;
export interface PackedMapWire {
    __packed: number[];
    __names: string[];
    __count: number;
    __version: 1;
}
export declare function isPackedWire(x: unknown): x is PackedMapWire;
export declare class PackedMap {
    readonly count: number;
    readonly names: string[];
    private _wire;
    private _buf;
    private constructor();
    static fromWire(wire: PackedMapWire): PackedMap;
    static fromInts(buf: Int32Array, names: string[], count: number): PackedMap;
    get buf(): Int32Array;
    toWire(): PackedMapWire;
}
export declare function tupleAt(p: PackedMap, i: number): MetroSourceMapSegmentTuple | undefined;
export declare function installPackedMap(data: {
    map?: unknown;
    __packedMap?: PackedMap;
}, source: PackedMapWire | readonly MetroSourceMapSegmentTuple[]): void;
export declare function wrapTransformResultMaps<T extends {
    output?: readonly unknown[] | null;
}>(result: T): T;
export declare function patchTransformFileForPackedMaps(bundler: {
    transformFile: (...args: any[]) => Promise<unknown>;
}): void;
export declare function materializeMap(map: PackedMapWire | readonly MetroSourceMapSegmentTuple[] | null | undefined): MetroSourceMapSegmentTuple[];
export declare function packTuples(tuples: readonly MetroSourceMapSegmentTuple[]): PackedMapWire;
export declare function makeProxy(packed: PackedMap): MetroSourceMapSegmentTuple[];

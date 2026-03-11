import * as THREE from "three";
import { getSolid3dMesh } from "@/features/workbook/model/solid3dGeometry";

const BASE_GEOMETRY_SIZE = 4;
const geometryCache = new Map<string, THREE.BufferGeometry>();

const buildGeometry = (presetId: string) => {
  const mesh = getSolid3dMesh(presetId, BASE_GEOMETRY_SIZE, BASE_GEOMETRY_SIZE);
  if (!mesh) return null;

  const positions: number[] = [];
  const indices: number[] = [];

  mesh.vertices.forEach((vertex) => {
    positions.push(vertex.x, vertex.y, vertex.z);
  });

  mesh.faces.forEach((face) => {
    if (face.length < 3) return;
    for (let index = 1; index < face.length - 1; index += 1) {
      indices.push(face[0], face[index], face[index + 1]);
    }
  });

  const geometry = new THREE.BufferGeometry();
  geometry.setAttribute("position", new THREE.Float32BufferAttribute(positions, 3));
  geometry.setIndex(indices);
  geometry.computeVertexNormals();
  geometry.computeBoundingSphere();
  geometry.center();

  return geometry;
};

export const getAmbientGeometry = (presetId: string) => {
  const cached = geometryCache.get(presetId);
  if (cached) return cached;

  const geometry = buildGeometry(presetId);
  if (!geometry) return null;
  geometryCache.set(presetId, geometry);
  return geometry;
};

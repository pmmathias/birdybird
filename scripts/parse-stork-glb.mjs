/* Parse Stork.glb directly to inspect bones + animations.
 * GLB layout: 12-byte header, JSON chunk, BIN chunk.
 * We only need the JSON metadata (no need to decode buffers). */
import fs from 'node:fs';

const buf = fs.readFileSync('/Users/mathiasleonhardt/Dev/birdybird/public/models/Stork.glb');
const view = new DataView(buf.buffer, buf.byteOffset, buf.byteLength);

// Header
const magic = String.fromCharCode(...buf.slice(0, 4));
const version = view.getUint32(4, true);
const totalLen = view.getUint32(8, true);
console.log(`GLB ${magic} v${version}, ${totalLen} bytes`);

// First chunk = JSON
const jsonLen = view.getUint32(12, true);
const jsonType = String.fromCharCode(...buf.slice(16, 20)).trim();
const jsonStr = new TextDecoder().decode(buf.slice(20, 20 + jsonLen));
const gltf = JSON.parse(jsonStr);

console.log(`\nJSON chunk: ${jsonLen} bytes, type=${jsonType}`);
console.log(`scenes:        ${gltf.scenes?.length || 0}`);
console.log(`nodes:         ${gltf.nodes?.length || 0}`);
console.log(`meshes:        ${gltf.meshes?.length || 0}`);
console.log(`skins:         ${gltf.skins?.length || 0}`);
console.log(`animations:    ${gltf.animations?.length || 0}`);

if (gltf.skins) {
  for (const skin of gltf.skins) {
    console.log(`\nSKIN: name=${skin.name || '(unnamed)'} joints=${skin.joints.length}`);
    const boneNames = skin.joints.map((idx) => gltf.nodes[idx].name || `node_${idx}`);
    console.log('Bones:');
    boneNames.forEach((n, i) => console.log(`  [${i}] ${n}`));
  }
}

if (gltf.animations) {
  for (const a of gltf.animations) {
    console.log(`\nANIMATION: ${a.name || '(unnamed)'} — ${a.channels.length} channels`);
    // Group channels by node + path
    const byNode = new Map();
    for (const ch of a.channels) {
      const nodeName = gltf.nodes[ch.target.node]?.name || `node_${ch.target.node}`;
      if (!byNode.has(nodeName)) byNode.set(nodeName, new Set());
      byNode.get(nodeName).add(ch.target.path);
    }
    for (const [n, paths] of byNode) {
      console.log(`  ${n}: [${[...paths].join(', ')}]`);
    }
    // Show samplers stats
    const samplerCounts = a.samplers.map((s) => {
      const acc = gltf.accessors[s.input];
      return acc.count;
    });
    const uniqueCounts = [...new Set(samplerCounts)];
    console.log(`  keyframes per sampler: ${uniqueCounts.join(', ')}`);
  }
}

// Morph targets — names + keyframe weights
let morphCount = 0;
if (gltf.meshes) {
  for (const m of gltf.meshes) {
    const namesFromMesh = m.extras?.targetNames || [];
    console.log(`\nMesh: ${m.name || '(unnamed)'}`);
    for (const p of m.primitives || []) {
      const namesFromPrim = p.extras?.targetNames || [];
      const names = namesFromMesh.length ? namesFromMesh : namesFromPrim;
      morphCount += p.targets?.length || 0;
      if (names.length) {
        console.log(`  Morph target names:`);
        names.forEach((n, i) => console.log(`    [${i}] ${n}`));
      } else if (p.targets) {
        console.log(`  ${p.targets.length} morph targets (no names)`);
      }
    }
  }
}
console.log(`\nMorph targets total: ${morphCount}`);

// Decode the animation's weight keyframes to see what poses it interpolates
if (gltf.animations?.[0]) {
  const anim = gltf.animations[0];
  const ch = anim.channels[0];
  const sampler = anim.samplers[ch.sampler];
  const inputAcc = gltf.accessors[sampler.input];
  const outputAcc = gltf.accessors[sampler.output];
  const inputBV = gltf.bufferViews[inputAcc.bufferView];
  const outputBV = gltf.bufferViews[outputAcc.bufferView];

  // BIN chunk starts after JSON chunk
  const binStart = 20 + jsonLen;
  const binChunkLen = view.getUint32(binStart, true);
  const binChunkType = String.fromCharCode(...buf.slice(binStart + 4, binStart + 8)).trim();
  const binData = buf.slice(binStart + 8, binStart + 8 + binChunkLen);
  console.log(`\nBIN chunk: ${binChunkLen} bytes, type=${binChunkType}`);

  const inputView = new Float32Array(
    binData.buffer,
    binData.byteOffset + (inputBV.byteOffset || 0),
    inputAcc.count,
  );
  const outputView = new Float32Array(
    binData.buffer,
    binData.byteOffset + (outputBV.byteOffset || 0),
    outputAcc.count,
  );

  console.log(`\nAnimation keyframes (time [s] → weights[13]):`);
  const weightsPerKey = morphCount;
  for (let k = 0; k < inputAcc.count; k++) {
    const t = inputView[k];
    const weights = [];
    for (let w = 0; w < weightsPerKey; w++) {
      weights.push(outputView[k * weightsPerKey + w].toFixed(2));
    }
    console.log(`  ${t.toFixed(3)}s  [${weights.join(', ')}]`);
  }
}

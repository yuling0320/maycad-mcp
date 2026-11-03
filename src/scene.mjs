import { createDecipheriv } from 'node:crypto';
import { DOMParser, XMLSerializer } from '@xmldom/xmldom';

// Verified against the profiles referenced by the installed MayCAD samples.
// All public dimensions are mm. MayCAD XML stores centimetres, with Y up.
export const PROFILES = Object.freeze({
  'PROF20-2020': { width_mm: 20, depth_mm: 20, label: '20×20 (installed MayTec catalogue)' },
  'PROF40-4040': { width_mm: 40, depth_mm: 40, label: '40×40' },
  'PROF40-4040L': { width_mm: 40, depth_mm: 40, label: '40×40 light' },
  'PROF40-4080L': { width_mm: 80, depth_mm: 40, label: '40×80 light' },
});
const children = (node, tag) => Array.from(node.childNodes).filter(n => n.nodeType === 1 && (!tag || n.tagName === tag));
const child = (node, tag) => children(node, tag)[0];
const get = (node, tag, fallback = '') => child(node, tag)?.textContent ?? fallback;
function set(node, tag, value) {
  let el = child(node, tag);
  if (!el) { el = node.ownerDocument.createElement(tag); node.appendChild(el); }
  el.textContent = String(value);
  return el;
}
const num = x => Number(Number(x).toFixed(9));
function finite(value, label) {
  if (typeof value !== 'number' || !Number.isFinite(value)) throw new Error(`${label} must be finite`);
  return value;
}
export function decodeScene(buffer) {
  if (buffer.length > 20 * 1024 * 1024) throw new Error('Scene exceeds 20 MB limit');
  let text = buffer.toString('utf8').replace(/^\uFEFF/, '');
  if (!text.trimStart().startsWith('<?xml')) {
    if (!buffer.length || buffer.length % 8) throw new Error('Unsupported scene encoding');
    // Legacy MayCAD file encoding, not an authentication credential.
    const key = Buffer.from('28.04.20'.repeat(3));
    const decipher = createDecipheriv('des-ede3', key, null);
    decipher.setAutoPadding(false);
    text = Buffer.concat([decipher.update(buffer), decipher.final()]).toString('utf8').replace(/[\x00-\x08]+$/, '');
  }
  if (!text.trimStart().startsWith('<?xml')) throw new Error('Unsupported MayCAD scene format');
  if (/<!DOCTYPE|<!ENTITY/i.test(text)) throw new Error('DTD and entities are not supported');
  const errors = [];
  const doc = new DOMParser({ onError: (level, message) => errors.push(`${level}: ${message}`) }).parseFromString(text, 'text/xml');
  if (errors.length || doc.documentElement?.tagName !== 'scene') throw new Error(`Invalid scene XML: ${errors.join('; ')}`);
  if (!child(doc.documentElement, 'objects')) throw new Error('Scene has no objects container');
  return doc;
}
export const encodeScene = doc => new XMLSerializer().serializeToString(doc);
export const objects = doc => children(child(doc.documentElement, 'objects'), 'object');
export function createScene(title = 'MayCAD MCP model') {
  const doc = decodeScene(Buffer.from('<?xml version="1.0" encoding="UTF-8"?><scene><version>7</version><software_version>11.200.00</software_version><vendors>MAYTEC</vendors><metric>1</metric><objects/><connection_data/><variable_manager/></scene>'));
  set(doc.documentElement, 'design_title', title);
  return doc;
}
export function addProfile(doc, { profile = 'PROF40-4040L', length_mm, origin_mm = [0, 0, 0], axis = 'y', name }) {
  const spec = PROFILES[profile];
  if (!spec) throw new Error(`Unsupported profile: ${profile}`);
  if (finite(length_mm, 'length_mm') <= 0 || length_mm > 100000) throw new Error('Length must be in (0, 100000] mm');
  if (!Array.isArray(origin_mm) || origin_mm.length !== 3) throw new Error('origin_mm must have three coordinates');
  const [x, y, z] = origin_mm.map((v, i) => num(finite(v, `origin_mm[${i}]`) / 10));
  // Row-major affine matrix. Local +Y is the extrusion axis; origin is the
  // centre of its bottom end. Local X/Z form the profile cross-section.
  const rotations = {
    x: [0,1,0,x, -1,0,0,y, 0,0,1,z, 0,0,0,1],
    y: [1,0,0,x, 0,1,0,y, 0,0,1,z, 0,0,0,1],
    z: [1,0,0,x, 0,0,-1,y, 0,1,0,z, 0,0,0,1],
  };
  if (!rotations[axis]) throw new Error('axis must be x, y or z');
  const ids = objects(doc).map(o => Number(get(o, 'id')));
  if (ids.some(id => !Number.isSafeInteger(id) || id < 0) || new Set(ids).size !== ids.length) throw new Error('Invalid or duplicate object IDs');
  const id = Math.max(0, ...ids) + 1;
  const el = doc.createElement('object');
  const values = { height: num(length_mm / 10), width: spec.width_mm / 10, length: spec.depth_mm / 10, type: 'Profile', id, name: name ?? `Profile(${id})`, rotation: rotations[axis].join(','), profile, bom_exclude: 0, black_finish: 0 };
  for (const [tag, value] of Object.entries(values)) set(el, tag, value);
  const vec = doc.createElement('Vector3d');
  for (const tag of ['x', 'y', 'z']) set(vec, tag, 0);
  set(el, 'position', '').appendChild(vec);
  child(doc.documentElement, 'objects').appendChild(el);
  return id;
}
function matrixOf(el) {
  const m = get(el, 'rotation').split(',').map(Number);
  if (m.length !== 16 || !m.every(Number.isFinite)) throw new Error(`Invalid matrix for object ${get(el, 'id')}`);
  return m;
}
export function inspectScene(doc) {
  const root = doc.documentElement;
  const items = objects(doc).map(el => {
    const item = { id: get(el, 'id'), type: get(el, 'type'), name: get(el, 'name'), profile: get(el, 'profile') };
    if (item.type === 'Profile') {
      const m = matrixOf(el);
      item.length_mm = num(Number(get(el, 'height')) * 10);
      item.cross_section_mm = [num(Number(get(el, 'width')) * 10), num(Number(get(el, 'length')) * 10)];
      item.origin_mm = [m[3], m[7], m[11]].map(v => num(v * 10));
      item.direction = [m[1], m[5], m[9]].map(num);
      item.end_mm = item.origin_mm.map((v, i) => num(v + item.direction[i] * item.length_mm));
    }
    return item;
  });
  return { title: get(root, 'design_title'), format_version: get(root, 'version'), software_version: get(root, 'software_version'), units: 'mm', vertical_axis: 'y', object_count: items.length, profile_count: items.filter(x => x.type === 'Profile').length, connection_count: root.getElementsByTagName('connectorset').length, objects: items };
}
export function editProfile(doc, { id, length_mm, translate_mm, name }) {
  const el = objects(doc).find(o => get(o, 'id') === String(id));
  if (!el || get(el, 'type') !== 'Profile') throw new Error(`Profile ${id} not found`);
  const geometric = length_mm !== undefined || translate_mm !== undefined;
  if (geometric) {
    const allowed = new Set(['height','width','length','type','id','name','rotation','position','profile','bom_exclude','black_finish','cust_color']);
    if (children(el).some(n => !allowed.has(n.tagName))) throw new Error('This profile has attachments, machining or unsupported fields; geometry editing is refused');
    const root = doc.documentElement;
    if (children(child(root, 'variable_manager') ?? root.ownerDocument.createElement('empty')).length) throw new Error('Parametric scene editing is not supported');
    if (Array.from(root.getElementsByTagName('connectorset')).some(c => [get(c, 'src_id'), get(c, 'dst_id')].includes(String(id)))) throw new Error('Profile has connections; edit in MayCAD to preserve connection geometry');
    // Complex assemblies may reference this ID in vendor-specific structures.
    if (objects(doc).some(o => get(o, 'type') !== 'Profile')) throw new Error('Geometry editing of mixed assemblies is not supported in v0.1');
    if (children(root).some(n => ['door_states','conveyors','addition_objects','scene_measure_items'].includes(n.tagName) && children(n).length)) throw new Error('Scene has dependent assembly data');
  }
  if (length_mm !== undefined) {
    if (finite(length_mm, 'length_mm') <= 0 || length_mm > 100000) throw new Error('Invalid length');
    set(el, 'height', num(length_mm / 10));
  }
  if (translate_mm !== undefined) {
    if (!Array.isArray(translate_mm) || translate_mm.length !== 3) throw new Error('translate_mm must have three coordinates');
    const m = matrixOf(el);
    [3,7,11].forEach((idx, i) => { m[idx] = num(m[idx] + finite(translate_mm[i], 'translation') / 10); });
    set(el, 'rotation', m.join(','));
  }
  if (name !== undefined) set(el, 'name', name);
}
export function createFrame({ width_mm, depth_mm, height_mm, profile = 'PROF40-4040L', title = 'Rectangular frame' }) {
  const spec = PROFILES[profile];
  if (!spec || spec.width_mm !== spec.depth_mm) throw new Error('Frame requires a supported square profile');
  const s = spec.width_mm;
  for (const [label, value] of Object.entries({width_mm,depth_mm,height_mm})) {
    if (finite(value, label) <= 2*s || value > 100000) throw new Error(`${label} must be greater than ${2*s} and at most 100000 mm`);
  }
  const doc = createScene(title);
  const add = (name, axis, length_mm, origin_mm) => addProfile(doc, { name, axis, length_mm, origin_mm, profile });
  for (const x of [s/2,width_mm-s/2]) for (const z of [s/2,depth_mm-s/2]) add(`Post ${x},${z}`, 'y', height_mm, [x,0,z]);
  for (const y of [s/2,height_mm-s/2]) {
    for (const z of [s/2,depth_mm-s/2]) add(`X rail ${y},${z}`, 'x', width_mm-2*s, [s,y,z]);
    for (const x of [s/2,width_mm-s/2]) add(`Z rail ${x},${y}`, 'z', depth_mm-2*s, [x,y,s]);
  }
  return doc;
}

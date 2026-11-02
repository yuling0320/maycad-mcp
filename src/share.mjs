import { decodeScene, encodeScene } from './scene.mjs';

// MayCAD inserts device/session identifiers and author details when saving.
// Strip these from distribution copies while retaining model/connection data.
const privateFields = new Set([
  'software_computer_id', 'software_session_id', 'authorname',
  'authorlastname', 'authoremail', 'authorcompany', 'authoruuid', 'approved_by',
]);
export function sceneForSharing(buffer) {
  const doc = decodeScene(buffer);
  for (const el of Array.from(doc.getElementsByTagName('*'))) {
    if (privateFields.has(el.tagName.toLowerCase())) el.parentNode.removeChild(el);
  }
  return encodeScene(doc);
}

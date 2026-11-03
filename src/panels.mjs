// Native MayCAD polygon panels. Catalogue IDs are from the installed catalogue.
// Local panel coordinates lie in XY; extrusion follows their cross-product.
export function addPanel(doc, {name, material='PANL_CHIP-8.0MM', color='#bf995fff', width, height, origin=[0,0,0], u=[1,0,0], v=[0,1,0], points}) {
  if (!(width>0&&height>0)) throw new Error('Positive panel dimensions required');
  if (![...origin,...u,...v,width,height].every(Number.isFinite)) throw new Error('Non-finite panel geometry');
  const cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]];
  if(Math.abs(Math.hypot(...cross)-1)>1e-6||Math.abs(Math.hypot(...u)-1)>1e-6||Math.abs(Math.hypot(...v)-1)>1e-6)throw new Error('Panel basis must be orthonormal');
  const set=(el,tag,value)=>{const n=doc.createElement(tag);n.textContent=String(value);el.appendChild(n);return n;};
  const vector=(el,p)=>{const n=doc.createElement('Vector3d');['x','y','z'].forEach((tag,i)=>set(n,tag,(p[i]||0)/10));el.appendChild(n);};
  const all=[...doc.getElementsByTagName('object')];
  const id=Math.max(0,...all.map(e=>Number(e.getElementsByTagName('id')[0].textContent)))+1;
  const obj=doc.createElement('object');
  const poly=points||[[0,0,0],[width,0,0],[width,height,0],[0,height,0]];
  set(obj,'points_count',poly.length);const contour=set(obj,'contour','');poly.forEach(p=>vector(contour,p));
  set(obj,'expanded_points_count',poly.length);const expanded=set(obj,'expanded_contour','');poly.forEach(p=>vector(expanded,p));
  for(const[tag,value]of Object.entries({pseudo_slots_count:0,pseudo_holes_count:0,custom_mount:1,framed_panel:0,type:'Panel',id,cust_color:color,name,profile:material,bom_exclude:0,black_finish:0,is_anchored:0,is_conveyor_part:0}))set(obj,tag,value);
  set(obj,'pseudo_slot_list','');set(obj,'pseudo_hole_list','');
  const matrix=[u[0],v[0],cross[0],origin[0]/10,u[1],v[1],cross[1],origin[1]/10,u[2],v[2],cross[2],origin[2]/10,0,0,0,1];
  set(obj,'rotation',matrix.join(','));vector(set(obj,'position',''),[0,0,0]);
  doc.documentElement.getElementsByTagName('objects')[0].appendChild(obj);
  return id;
}

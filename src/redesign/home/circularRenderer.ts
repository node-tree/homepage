import * as THREE from 'three';
import { ClockGlyphSet, GlyphGroup, RING_SPEC, Slot } from '../../components/DharaniClock/atlas';
import { CircularFrame, CircularModel, Material, materials } from './circular';
import { createPlateRenderer } from './renderer';
import { Tile } from './scene';

const color = (hex: string) => new THREE.Vector3(...[1, 3, 5].map(i => parseInt(hex.slice(i, i + 2), 16) / 255) as [number, number, number]);
const VS = `
attribute float aGate; attribute float aVerm; attribute float aSlot;
varying vec2 vUv; varying float vGate; varying float vVerm; varying float vVisible;
uniform float uActive;
void main(){vUv=uv;vGate=aGate;vVerm=aVerm;vVisible=abs(aSlot-uActive)<.1?0.:1.;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`;
const FS = `
precision highp float;
varying vec2 vUv; varying float vGate; varying float vVerm; varying float vVisible;
uniform sampler2D uAtlas;
uniform vec3 uInk; uniform vec3 uRead; uniform vec3 uTrace;
uniform float uAmount; uniform float uKind; uniform float uOpacity;
void main(){
  vec2 tex=texture2D(uAtlas,vUv).rg;
  float aa=clamp(fwidth(tex.r)*.75,.002,.25);
  float coverage=smoothstep(128./255.-aa,128./255.+aa,tex.r)*smoothstep(vGate*.5,vGate,tex.g);
  float alpha=coverage*vVisible;
  vec3 ink=mix(mix(uInk,uTrace,vVerm),uRead,uAmount);
  vec3 rgb=ink*(.68+.32*tex.g);
  if(uKind>.5&&uKind<1.5){
    // SDF bevel normal in screen coordinates; one fixed grazing light, no specular term.
    vec2 slope=vec2(dFdx(tex.r),dFdy(tex.r))/max(fwidth(tex.r),.001);
    float edge=1.-smoothstep(.50,.70,tex.r);
    vec3 normal=normalize(vec3(-slope*(1.8+uAmount*.9)*edge,1.));
    float diffuse=max(0.,dot(normal,normalize(vec3(-.84,.48,.22))));
    rgb=ink*(.54+.82*diffuse)*(.78+.22*tex.g);
  }
  alpha*=mix(uOpacity,1.,uAmount);
  if(alpha<.002)discard;
  gl_FragColor=vec4(rgb,alpha);
}`;

function glyphGeometry(slots: (Slot & { id: number })[]) {
  const pos: number[] = [], uv: number[] = [], gate: number[] = [], verm: number[] = [], ids: number[] = [], indices: number[] = [];
  slots.forEach(s => {
    const g = s.group; if (!g) return;
    const a = s.a * Math.PI / 180, rotation = -a + (s.a > 90 && s.a < 270 ? Math.PI : 0);
    const cx = Math.sin(a) * s.r, cy = Math.cos(a) * s.r, c = Math.cos(rotation), sn = Math.sin(rotation);
    const [u0, v0, u1, v1] = g.uv;
    const corners = [[-s.w / 2, -s.h / 2], [s.w / 2, -s.h / 2], [s.w / 2, s.h / 2], [-s.w / 2, s.h / 2]];
    const uvs = [[u0, 1-v1], [u1, 1-v1], [u1, 1-v0], [u0, 1-v0]];
    const start = pos.length / 3;
    corners.forEach(([x,y], i) => { pos.push(cx+x*c-y*sn,cy+x*sn+y*c,0); uv.push(...uvs[i]);gate.push(g.densGate);verm.push(g.vermilion?1:0);ids.push(s.id); });
    indices.push(start,start+1,start+2,start,start+2,start+3);
  });
  const geo = new THREE.BufferGeometry();
  for (const [name, data, n] of [['position',pos,3],['uv',uv,2],['aGate',gate,1],['aVerm',verm,1],['aSlot',ids,1]] as [string,number[],number][]) geo.setAttribute(name,new THREE.Float32BufferAttribute(data,n));
  geo.setIndex(indices);return geo;
}
function seedSlot(g: GlyphGroup): Slot & { id: number } {
  return { ri: 0, ring: 'seed', i: 0, a: 0, r: 0, w: 114*g.aspect, h: 114, red: false, group: g, id: -2 };
}
function dimensions(w: number, h: number) {
  return { scale: Math.min(w*(w<768?.46:.43)/415, (h-125)*.49/415), cx: w/2, cy: (h-65)/2 };
}
// Fixed twelve-o'clock marker, outside even the enlarged outer glyph (r=380, h=26).
const MARKER_INNER = 414, MARKER_OUTER = 426;
export function createCircularRenderer(canvas: HTMLCanvasElement, set: ClockGlyphSet, model: CircularModel, mat: Material, force2d: boolean) {
  if (force2d) return raster(canvas,set,model,mat);
  const context = canvas.getContext('webgl2', { antialias: true, alpha: false });
  if (!context) return raster(canvas,set,model,mat);
  const pal = materials[mat], renderer = new THREE.WebGLRenderer({ canvas, context, antialias: true, alpha: false });
  renderer.setClearColor(pal.bg); renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,window.innerWidth<768?1.5:2));
  const scene = new THREE.Scene(), camera = new THREE.OrthographicCamera(-500,500,500,-500,.1,100);
  camera.position.z=20;
  const texture = new THREE.Texture(set.image);texture.minFilter=THREE.LinearFilter;texture.magFilter=THREE.LinearFilter;texture.generateMipmaps=false;texture.needsUpdate=true;
  const resources: { dispose(): void }[] = [texture];
  const inspect = new URLSearchParams(window.location.search).get('inspect') === '1';
  const kind = mat==='geumni'?0:mat==='relief'?1:2;
  const material = (opacity=1) => {
    const m = new THREE.ShaderMaterial({vertexShader:VS,fragmentShader:FS,transparent:true,depthWrite:false,side:THREE.DoubleSide,
      uniforms:{uAtlas:{value:texture},uInk:{value:color(pal.ink)},uRead:{value:color(pal.read)},uTrace:{value:color(pal.trace)},uAmount:{value:0},uKind:{value:kind},uOpacity:{value:opacity},uActive:{value:-999}},extensions:{derivatives:true}});
    resources.push(m);return m;
  };
  const rings = [0,1,2,3,4].map(ri=>{
    const group=new THREE.Group(), geo=glyphGeometry(model.readable.filter(s=>s.ri===ri)), m=material(mat==='silk'?.48+ri*.075:1);
    resources.push(geo);const mesh=new THREE.Mesh(geo,m);mesh.renderOrder=2;group.add(mesh);scene.add(group);
    // Original redacted cells remain gaps with quiet material-colored faces.
    for(const s of model.slots.filter(s=>s.ri===ri&&s.red)){
      const geometry=new THREE.PlaneGeometry(s.w,s.h), material=new THREE.MeshBasicMaterial({color:pal.ink,transparent:true,opacity:.065,depthWrite:false});
      const face=new THREE.Mesh(geometry,material);const a=s.a*Math.PI/180;face.position.set(Math.sin(a)*s.r,Math.cos(a)*s.r,0);face.rotation.z=-a;face.renderOrder=1;group.add(face);resources.push(geometry,material);
    }
    if(mat==='silk'){
      const r=RING_SPEC[ri].r, geometry=new THREE.RingGeometry(r-40,r+40,160);
      const film=new THREE.MeshBasicMaterial({color:pal.ink,transparent:true,opacity:.034+ri*.009,side:THREE.DoubleSide,depthWrite:false});
      const membrane=new THREE.Mesh(geometry,film);membrane.renderOrder=0;scene.add(membrane);resources.push(geometry,film);
    }
    return {group,m};
  });
  const sg=seedGeometry(set), sm=material(.7), seed=new THREE.Mesh(sg,sm);seed.renderOrder=2;scene.add(seed);resources.push(sg);
  let activeId=-1;
  const ag=new THREE.BufferGeometry(), activeMat=material(mat==='silk'?.65:1);
  const active=new THREE.Mesh(ag,activeMat);active.renderOrder=5;scene.add(active);
  const markerGeo=new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0,MARKER_OUTER,.1),new THREE.Vector3(0,MARKER_INNER,.1)]);
  const markerMat=new THREE.LineBasicMaterial({color:pal.ink,transparent:true,opacity:.28,depthWrite:false});
  const marker=new THREE.Line(markerGeo,markerMat);marker.renderOrder=3;scene.add(marker);resources.push(markerGeo,markerMat);
  // Only the current silk cell becomes opaque, never an entire ring.
  const cellGeo=new THREE.PlaneGeometry(1,1),cellMat=new THREE.MeshBasicMaterial({color:pal.bg,transparent:true,opacity:0,depthWrite:false});
  const cell=new THREE.Mesh(cellGeo,cellMat);cell.renderOrder=3;scene.add(cell);resources.push(cellGeo,cellMat);
  let oldSize='';
  return { mode:'webgl2', draw(f:CircularFrame,w:number,h:number){
    const {scale,cx,cy}=dimensions(w,h);
    if(oldSize!==`${w}:${h}`){renderer.setSize(w,h,false);camera.left=-cx/scale;camera.right=(w-cx)/scale;camera.top=cy/scale;camera.bottom=-(h-cy)/scale;camera.updateProjectionMatrix();oldSize=`${w}:${h}`;}
    rings.forEach(({group,m},ri)=>{group.rotation.z=f.angles[ri];m.uniforms.uActive.value=f.active.id;});
    if(activeId!==f.active.id){
      active.geometry.dispose();const geo=glyphGeometry([f.active]), original=f.active.a*Math.PI/180;
      geo.translate(-Math.sin(original)*f.active.r,-Math.cos(original)*f.active.r,0);
      active.geometry=geo;activeId=f.active.id;
    }
    active.rotation.z=f.angles[f.active.ri];active.scale.setScalar(1+f.amount*.8);
    activeMat.uniforms.uAmount.value=f.amount;
    activeMat.uniforms.uOpacity.value=mat==='silk'?.48+f.active.ri*.075:1;
    const a=f.active.a*Math.PI/180-f.angles[f.active.ri],s=Math.sin(a),c=Math.cos(a),r=f.active.r;
    active.position.set(s*r,c*r,0);
    cell.visible=mat==='silk'&&f.amount>0;cell.position.set(s*r,c*r,.02);cell.rotation.z=-a;cell.scale.set(f.active.w*(1+f.amount*.8)+3,f.active.h*(1+f.amount*.8)+3,1);cellMat.opacity=f.amount*.95;
    renderer.render(scene,camera);
    if(inspect) canvas.dataset.geometry=JSON.stringify({rings:rings.map(({group})=>({z:group.position.z,rotation:group.rotation.toArray().slice(0,3)})),camera:camera.position.toArray(),activeZ:active.position.z,activeCenter:[cx+s*r*scale,cy-c*r*scale],activeSize:[f.active.w*active.scale.x*scale,f.active.h*active.scale.y*scale],activeAngle:a+(f.active.a>90&&f.active.a<270?Math.PI:0),readScale:active.scale.x,seedHeight:114*scale,seedOpacity:.7,plateCenter:[cx,cy],activeRing:f.active.ri,marker:{start:[cx,cy-MARKER_OUTER*scale],end:[cx,cy-MARKER_INNER*scale]},drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles});
  },dispose(){active.geometry.dispose();resources.forEach(r=>r.dispose());renderer.dispose();}};
}
function seedGeometry(set:ClockGlyphSet){
  const g=set.groups[set.rings.seed[0]],geo=glyphGeometry([seedSlot(g)]),[ox,oy]=g.centerOffset||[0,0];
  geo.translate(-ox*114*g.aspect,oy*114,0);return geo;
}
function raster(canvas:HTMLCanvasElement,set:ClockGlyphSet,model:CircularModel,mat:Material){
  const pal=materials[mat];
  const base=createPlateRenderer(canvas,set,{bg:pal.bg,ink:pal.read,residual:pal.ink,mark:pal.trace,text:pal.text},true);
  return {mode:'raster',draw(f:CircularFrame,w:number,h:number){
    const {scale,cx,cy}=dimensions(w,h);
    const baseColor=f.active.group!.vermilion?pal.trace:pal.ink;
    const readingColor = '#' + [1,3,5].map(i => Math.round(parseInt(baseColor.slice(i,i+2),16)*(1-f.amount)+parseInt(pal.read.slice(i,i+2),16)*f.amount).toString(16).padStart(2,'0')).join('');
    const tiles:Tile[]=model.readable.map(s=>{const a=s.a*Math.PI/180-f.angles[s.ri];return {color:s.id===f.active.id?readingColor:s.group!.vermilion?pal.trace:pal.ink,g:s.group!,x:cx+Math.sin(a)*s.r*scale,y:cy-Math.cos(a)*s.r*scale,h:s.h*scale*(s.id===f.active.id?1+f.amount*.8:1),angle:a+(s.a>90&&s.a<270?Math.PI:0),alpha:mat==='silk'?.48+s.ri*.075:1,front:s.id===f.active.id,inkMix:s.id===f.active.id?f.amount:0};});
    const g=set.groups[set.rings.seed[0]], [ox,oy]=g.centerOffset||[0,0];
    tiles.sort((a,b)=>Number(a.front)-Number(b.front));
    tiles.push({color:pal.ink,g,x:cx-ox*114*g.aspect*scale,y:cy-oy*114*scale,h:114*scale,angle:0,alpha:.7});
    base.draw(tiles,w,h);
    const ctx=canvas.getContext('2d')!;
    if(mat==='silk') { ctx.save();ctx.globalCompositeOperation='destination-over';RING_SPEC.forEach(({r},ri)=>{ctx.globalAlpha=.034+ri*.009;ctx.strokeStyle=pal.ink;ctx.lineWidth=80*scale;ctx.beginPath();ctx.arc(cx,cy,r*scale,0,Math.PI*2);ctx.stroke();});ctx.restore(); }
    ctx.save();ctx.strokeStyle=pal.ink;ctx.globalAlpha=.28;ctx.lineWidth=1;ctx.beginPath();ctx.moveTo(cx,cy-MARKER_OUTER*scale);ctx.lineTo(cx,cy-MARKER_INNER*scale);ctx.stroke();ctx.restore();
  },dispose:()=>base.dispose()};
}

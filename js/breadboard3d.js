/* IoT Guardian — standalone 3D breadboard wiring lab.
 * Keeps the lesson renderer untouched. Learners drag a colored jumper from an ESP32 GPIO
 * to a breadboard hole; a simple LED + 220Ω + GND circuit is validated by physical
 * breadboard strip connectivity (same terminal strip = connected).
 */
(function (root) {
  'use strict';
  const THREE = root.THREE;
  if (!THREE) { root.IoT3DBreadboard = { open: () => false }; return; }

  const COLORS = [
    { name: 'Κόκκινο', hex: '#ef4444' }, { name: 'Μαύρο', hex: '#30343b' },
    { name: 'Κίτρινο', hex: '#eab308' }, { name: 'Μπλε', hex: '#3b82f6' },
    { name: 'Πράσινο', hex: '#22a06b' }, { name: 'Πορτοκαλί', hex: '#f97316' }
  ];
  const PINS = ['GPIO 2', 'GPIO 4', 'GPIO 5', 'GPIO 15', 'GPIO 18', 'GPIO 19', 'GPIO 21', 'GPIO 22', 'GPIO 23', '3V3', 'GND'];
  const esc = s => String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' }[c]));

  function open(opts) {
    opts = opts || {};
    const host = document.createElement('div');
    host.className = 'iot3dbb-modal';
    host.innerHTML = `
      <section class="iot3dbb-panel" role="dialog" aria-modal="true" aria-label="3D Breadboard">
        <header class="iot3dbb-head"><div><small>IoT GUARDIAN · ΕΡΓΑΣΤΗΡΙΟ</small><h2>3D Breadboard</h2><p>Σύνδεσε το κύκλωμα LED με πραγματική λογική breadboard.</p></div>
          <button type="button" class="iot3dbb-close" aria-label="Κλείσιμο">×</button></header>
        <div class="iot3dbb-tools">
          <label>Τύπος πλακέτας <select data-size><option value="mini">Mini breadboard</option><option value="full">Full-size breadboard</option></select></label>
          <label>Χρώμα καλωδίου <select data-color>${COLORS.map((c,i)=>`<option value="${i}">${c.name}</option>`).join('')}</select></label>
          <button type="button" class="iot3dbb-add">Πώς συνδέω</button>
          <button type="button" class="iot3dbb-reset">Επαναφορά</button>
        </div>
        <div class="iot3dbb-stage"><div class="iot3dbb-canvas"></div>
          <div class="iot3dbb-status" role="status" aria-live="polite">Σύρε το βύσμα από ένα GPIO σε μια τρύπα.</div>
          <div class="iot3dbb-help">Σύρε για περιστροφή · ροδέλα για zoom · σύρε το ελεύθερο βύσμα σε οπή</div>
        </div>
        <footer class="iot3dbb-foot"><span class="iot3dbb-count">0 συνδέσεις</span><span>Στόχος: GPIO 2 → αντίσταση → LED → GND</span></footer>
      </section>`;
    document.body.appendChild(host);
    const stage = host.querySelector('.iot3dbb-canvas');
    const status = host.querySelector('.iot3dbb-status');
    const colorSelect = host.querySelector('[data-color]');
    const sizeSelect = host.querySelector('[data-size]');
    const count = host.querySelector('.iot3dbb-count');
    let renderer, scene, camera, board, esp, raycaster, pointer, drag = null, wires = [], holeMeshes = [], pinMeshes = [];
    let raf = 0, disposed = false, yaw = .72, pitch = .76, zoom = 1, orbit = null, ledLens = null, liveParticles = [];
    const setStatus = (text, kind) => { status.textContent = text; status.dataset.kind = kind || ''; };
    const V = (x,y,z) => new THREE.Vector3(x,y,z);
    const material = (color, roughness=.65, metalness=0) => new THREE.MeshStandardMaterial({ color, roughness, metalness });
    const addBox = (parent, x,y,z, sx,sy,sz, mat, radius) => {
      const mesh = new THREE.Mesh(new THREE.BoxGeometry(sx,sy,sz), mat);
      mesh.position.set(x,y,z); mesh.castShadow = true; mesh.receiveShadow = true; parent.add(mesh); return mesh;
    };
    function init() {
      scene = new THREE.Scene(); scene.background = new THREE.Color(0x0b1728);
      camera = new THREE.PerspectiveCamera(38,1,.1,1000);
      renderer = new THREE.WebGLRenderer({antialias:true,alpha:false});
      renderer.setPixelRatio(Math.min(2, devicePixelRatio || 1));
      renderer.shadowMap.enabled = true; renderer.shadowMap.type = THREE.PCFSoftShadowMap;
      renderer.outputEncoding = THREE.sRGBEncoding;
      stage.appendChild(renderer.domElement);
      scene.add(new THREE.HemisphereLight(0xcfe8ff,0x263247,1.3));
      const key = new THREE.DirectionalLight(0xffffff,2.1); key.position.set(-20,35,24); key.castShadow=true; key.shadow.mapSize.set(2048,2048); scene.add(key);
      const fill = new THREE.DirectionalLight(0x4aa4df,.75); fill.position.set(24,18,-22); scene.add(fill);
      const floor = new THREE.Mesh(new THREE.PlaneGeometry(300,300),material(0x101d30,.9)); floor.rotation.x=-Math.PI/2; floor.position.y=-.3; floor.receiveShadow=true; scene.add(floor);
      raycaster = new THREE.Raycaster(); pointer = new THREE.Vector2();
      buildBoard();
      const ro = new ResizeObserver(resize); ro.observe(stage); host._ro=ro;
      renderer.domElement.addEventListener('pointerdown', onPointerDown);
      renderer.domElement.addEventListener('pointermove', onPointerMove);
      renderer.domElement.addEventListener('pointerup', onPointerUp);
      renderer.domElement.addEventListener('pointercancel', cancelDrag);
      renderer.domElement.addEventListener('wheel', onWheel,{passive:false});
      host.querySelector('.iot3dbb-close').onclick=close;
      host.querySelector('.iot3dbb-reset').onclick=reset;
      host.querySelector('.iot3dbb-add').onclick=addWire;
      sizeSelect.onchange=()=>{ clearWires(); buildBoard(); };
      colorSelect.onchange=()=>{ if(drag) drag.color=COLORS[+colorSelect.value].hex; };
      host.addEventListener('keydown',e=>{if(e.key==='Escape') close();});
      resize(); render();
      addWire();
    }
    function buildBoard() {
      if(board) { scene.remove(board); disposeTree(board); }
      holeMeshes=[]; pinMeshes=[]; wires=[];
      board=new THREE.Group(); scene.add(board);
      const full=sizeSelect.value==='full', cols=full?63:17, rows=10;
      board.userData={cols,rows,full};
      const width=(cols-1)*1.1+5, depth=rows*1.1+7;
      addBox(board,0,0,0,width,.9,depth,material(0xe9e7df,.85));
      const centerX=-(cols-1)*1.1/2;
      // split centre channel between rows E and F
      for(let c=0;c<cols;c++){
        const x=centerX+c*1.1;
        for(let r=0;r<rows;r++){
          const z=(r<5 ? -3.2+r*1.1 : 3.2+(r-5)*1.1);
          const hole=new THREE.Mesh(new THREE.CylinderGeometry(.19,.19,.12,16),material(0x544f48,.75));
          hole.position.set(x,.49,z); hole.userData={type:'hole',col:c,row:r,net:r<5?'a'+c:'b'+c,baseColor:0x544f48};
          board.add(hole); holeMeshes.push(hole);
          const rim=new THREE.Mesh(new THREE.TorusGeometry(.18,.035,6,20),material(0xb6b0a4,.5,.25));rim.rotation.x=Math.PI/2;rim.position.set(x,.55,z);board.add(rim);
        }
      }
      // Red/blue power rails.
      for(const z of [-depth/2+1.05,depth/2-1.05]){
        addBox(board,0,.5,z,width-2,.06,.13,material(0xd84b47,.45));
        addBox(board,0,.5,z+.3,width-2,.06,.13,material(0x3975d2,.45));
      }
      // ESP32 DevKit to the left of board.
      esp=new THREE.Group(); board.add(esp);
      const ex=centerX-width*.12-5.5;
      addBox(esp,ex,2,0,7.5,.55,23,material(0x171d26,.46,.35));
      addBox(esp,ex,2.3,1,4.8,.25,9,material(0x323b47,.4,.2));
      const pinNames=['GPIO 2','GPIO 4','GPIO 5','GPIO 15','GPIO 18','GPIO 19','GPIO 21','GPIO 22','GPIO 23','3V3','GND'];
      pinNames.forEach((name,i)=>{
        const z=-10+i*1.95, x=ex+ (i%2?3:-3);
        const pin=addBox(esp,x,1.55,z,.65,1.2,.65,material(0xc8a75b,.3,.7));
        pin.userData={type:'pin',name}; pinMeshes.push(pin);
        const cap=addBox(esp,x,2.35,z,.95,.25,.95,material(0x111821,.5));
        cap.userData={type:'pin-cap',name}; cap.userData.pin=pin;
        const labelCanvas=document.createElement('canvas');labelCanvas.width=256;labelCanvas.height=72;
        const ctx=labelCanvas.getContext('2d');ctx.fillStyle='rgba(7,20,35,.96)';ctx.beginPath();ctx.roundRect(4,4,248,64,12);ctx.fill();
        ctx.strokeStyle='#4d82aa';ctx.lineWidth=3;ctx.stroke();
        ctx.fillStyle='#e8f5ff';ctx.font='bold 34px sans-serif';ctx.textAlign='center';ctx.textBaseline='middle';ctx.fillText(name,128,37);
        const tex=new THREE.CanvasTexture(labelCanvas);tex.encoding=THREE.sRGBEncoding;
        const tag=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));
        tag.position.set(x+(i%2?2.5:-2.5),3.2,z);tag.scale.set(4.2,1.18,1);esp.add(tag);
      });
      // Physical path: GPIO2 → resistor across the centre gap → LED → GND.
      const c0=full?Math.floor((cols-9)/2):1;
      const holeAt=(col,row)=>V(centerX+col*1.1,.55,row<5?-3.2+row*1.1:3.2+(row-5)*1.1);
      const upperSignal=holeAt(c0+1,4), lowerAfterRes=holeAt(c0+3,5), lowerGround=holeAt(c0+4,6);
      const addLead=(a,b)=>{const d=b.clone().sub(a),m=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,d.length(),8),material(0xb6bfc6,.3,.8));m.position.copy(a).add(b).multiplyScalar(.5);m.quaternion.setFromUnitVectors(V(0,1,0),d.normalize());board.add(m);};
      addLead(upperSignal,V(upperSignal.x,1.65,upperSignal.z)); addLead(lowerAfterRes,V(lowerAfterRes.x,1.65,lowerAfterRes.z));
      const rStart=V(upperSignal.x,1.65,upperSignal.z),rEnd=V(lowerAfterRes.x,1.65,lowerAfterRes.z),rd=rEnd.clone().sub(rStart);
      const resistorBody=new THREE.Mesh(new THREE.CylinderGeometry(.42,.42,rd.length()*.72,18),material(0xd8bd93,.55));resistorBody.position.copy(rStart).add(rEnd).multiplyScalar(.5);resistorBody.quaternion.setFromUnitVectors(V(0,1,0),rd.normalize());board.add(resistorBody);
      const LEDx=(lowerAfterRes.x+lowerGround.x)/2, LEDz=lowerAfterRes.z;
      addLead(V(lowerAfterRes.x,.55,LEDz),V(lowerAfterRes.x,1.45,LEDz)); addLead(V(lowerGround.x,.55,LEDz),V(lowerGround.x,1.45,LEDz));
      addBox(board,LEDx,2.1,LEDz,1.05,1.5,.85,material(0xc3423b,.3,.15));
      const lens=new THREE.Mesh(new THREE.SphereGeometry(.62,20,14),new THREE.MeshStandardMaterial({color:0xff4a3c,emissive:0x000000,roughness:.2,metalness:.05}));lens.position.set(LEDx,3.0,LEDz);board.add(lens);ledLens=lens;
      board.userData.circuit={signalNet:'a'+(c0+1),groundNet:'b'+(c0+4)};
      const rails = addBox(board,0,.7,-depth/2+1.05,width-2,.15,.35,material(0xd84b47,.5)); rails.visible=false;
      setStatus('Διάλεξε GPIO και σύρε το βύσμα στην οπή που θέλεις.','');
      setCount();
      focusCamera(width,depth);
    }
    function focusCamera(width,depth) {
      const max=Math.max(width,depth);
      camera.position.set(max*.85,max*.85,max*1.1); camera.lookAt(0,1,0);
      yaw=.72; pitch=.76; zoom=1;
    }
    function resize(){
      if(!renderer||disposed)return;
      const w=Math.max(1,stage.clientWidth),h=Math.max(1,stage.clientHeight);
      renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix();
    }
    function render(){
      if(disposed)return;
      raf=requestAnimationFrame(render);
      updateCamera(); renderer.render(scene,camera);
      updateParticles();
    }
    function updateCamera(){
      const target=V(0,1,0), radius=(sizeSelect.value==='full'?88:37)/zoom;
      camera.position.set(target.x+radius*Math.cos(pitch)*Math.sin(yaw),target.y+radius*Math.sin(pitch),target.z+radius*Math.cos(pitch)*Math.cos(yaw));
      camera.lookAt(target);
    }
    function setPointer(e){
      const rect=renderer.domElement.getBoundingClientRect();pointer.x=((e.clientX-rect.left)/rect.width)*2-1;pointer.y=-((e.clientY-rect.top)/rect.height)*2+1;
      raycaster.setFromCamera(pointer,camera);
    }
    function pick(e, objects){setPointer(e);const hits=raycaster.intersectObjects(objects,true);return hits[0]||null;}
    function onPointerDown(e){
      if(e.button!==0)return;
      const pinHit=pick(e,pinMeshes);
      if(pinHit){const pin=pinHit.object;drag=Object.assign(makeLoose(pin),{pointer:e.pointerId});renderer.domElement.setPointerCapture(e.pointerId);setStatus(`Καλώδιο από ${drag.pin}: σύρε το στην επιθυμητή οπή.`,'');return;}
      orbit={x:e.clientX,y:e.clientY,yaw,pitch};
      renderer.domElement.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e){
      if(drag&&drag.pointer===e.pointerId){setPointer(e);const hit=raycaster.intersectObjects(holeMeshes,false)[0];const next=hit?hit.object:null;if(drag.target&&drag.target!==next)drag.target.material.color.setHex(drag.target.userData.baseColor);drag.target=next;if(drag.target)drag.target.material.color.setHex(0x2bbf88);updateLoose(drag,hit?hit.point:rayOnBoard(e));setStatus(drag.target?`Οπή ${String.fromCharCode(65+drag.target.userData.row)}${drag.target.userData.col+1} · άφησε για σύνδεση.`:'Σύρε το βύσμα πάνω στο breadboard.','');return;}
      if(orbit){yaw=orbit.yaw-(e.clientX-orbit.x)*.009;pitch=Math.max(.18,Math.min(1.45,orbit.pitch+(e.clientY-orbit.y)*.006));}
    }
    function onPointerUp(e){
      if(drag&&drag.pointer===e.pointerId){const d=drag;drag=null;renderer.domElement.releasePointerCapture(e.pointerId);setPointer(e);const finalHit=raycaster.intersectObjects(holeMeshes,false)[0];if(finalHit)d.target=finalHit.object;if(d.target){d.target.material.color.setHex(d.target.userData.baseColor);commitWire(d,d.target);}else{board.remove(d.mesh);setStatus('Το καλώδιο επέστρεψε στο pin. Άφησέ το πάνω σε μία οπή.','err');}return;}
      orbit=null;
    }
    function cancelDrag(){if(drag){board.remove(drag.mesh);drag=null;}orbit=null;}
    function onWheel(e){e.preventDefault();zoom=Math.max(.55,Math.min(2.8,zoom*(e.deltaY>0?.91:1.1)));}
    function rayOnBoard(e){
      const p=pick(e,[board.children[0]]);return p?p.point:V(0,2,0);
    }
    function makeLoose(pin){
      const group=new THREE.Group();board.add(group);
      const start=pin.getWorldPosition(V(0,0,0));start.y+=.7;
      const mesh=new THREE.Mesh(new THREE.BufferGeometry(),material(COLORS[+colorSelect.value].hex,.35,.15));group.add(mesh);
      const d={mesh:group,start,pin:pin.userData.name,color:COLORS[+colorSelect.value].hex};updateLoose(d,start.clone().add(V(0,1,0)));return d;
    }
    function updateLoose(d,end){
      const curve=new THREE.CatmullRomCurve3([d.start,d.start.clone().add(V(0,4,0)),end.clone().add(V(0,3,0)),end]);
      const child=d.mesh.children[0],old=child.geometry;child.geometry=new THREE.TubeGeometry(curve,48,.13,8,false);old.dispose();child.material.color.set(d.color);
    }
    function commitWire(d,hole){
      const from=pinMeshes.find(p=>p.userData.name===d.pin);
      if(wires.some(w=>w.pin===d.pin)){board.remove(d.mesh);setStatus('Αυτό το GPIO έχει ήδη καλώδιο. Επίλεξε άλλο pin.','err');return;}
      const start=from.getWorldPosition(V(0,0,0));start.y+=.7;
      const end=hole.getWorldPosition(V(0,0,0));end.y+=.24;
      const mid1=start.clone().add(V(0,5,0)),mid2=end.clone().add(V(0,5,0));
      const curve=new THREE.CatmullRomCurve3([start,mid1,mid2,end]);
      const m=new THREE.Mesh(new THREE.TubeGeometry(curve,60,.14,8,false),material(d.color,.32,.1));m.castShadow=true;
      board.remove(d.mesh);board.add(m);
      const plug=new THREE.Mesh(new THREE.CylinderGeometry(.23,.23,.34,12),material(d.color,.32));
      plug.position.copy(end);board.add(plug);
      wires.push({pin:d.pin,net:(hole.userData.row<5?'a':'b')+hole.userData.col,hole:hole.userData,col:d.color,curve,mesh:m,plug});
      setStatus(`✓ ${d.pin} συνδέθηκε στην οπή ${String.fromCharCode(65+hole.userData.row)}${hole.userData.col+1}.`,'ok');
      validateCircuit();setCount();
      animateConnection(curve);
    }
    function animateConnection(curve){
      const ball=new THREE.Mesh(new THREE.SphereGeometry(.22,12,8),material(0xffffff,.25,.1));
      board.add(ball);const t0=performance.now(),duration=700;
      const step=()=>{if(disposed||!ball.parent)return;const t=Math.min(1,(performance.now()-t0)/duration);curve.getPointAt(t,ball.position);if(t<1)requestAnimationFrame(step);else board.remove(ball);};step();
    }
    function validateCircuit(){
      const byPin=pin=>wires.find(w=>w.pin===pin);
      const sig=byPin('GPIO 2'), ground=byPin('GND'), circuit=board.userData.circuit;
      const hasR=!!(sig&&sig.net===circuit.signalNet);
      const hasLed=!!(ground&&ground.net===circuit.groundNet);
      const valid=!!(hasR&&hasLed&&wires.length===2);
      ledLens.material.emissive.setHex(valid?0xff382c:0);
      ledLens.material.emissiveIntensity=valid?1.6:0;
      if(valid){setStatus('Κύκλωμα σωστό! GPIO 2 → 220 Ω → LED → GND. Το LED άναψε.','ok');startParticles();}
      else if(wires.length){setStatus('Η σύνδεση καταγράφηκε, αλλά το κύκλωμα δεν είναι ακόμη σωστό. Χρειάζεται μόνο GPIO 2 και GND στις σωστές λωρίδες. Αν έβαλες λάθος καλώδιο, πάτα Επαναφορά.','warn');stopParticles();}
    }
    function startParticles(){
      if(liveParticles.length)return;
      const curves=wires.map(w=>w.curve);
      curves.forEach(curve=>{const dot=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),material(0xfff4a8,.2));board.add(dot);liveParticles.push({dot,curve,offset:Math.random()});});
    }
    function stopParticles(){liveParticles.forEach(p=>board.remove(p.dot));liveParticles=[];}
    function updateParticles(){if(!liveParticles.length)return;const t=performance.now()*.0006;liveParticles.forEach(p=>p.curve.getPointAt((t+p.offset)%1,p.dot.position));}
    function addWire(){setStatus(`Σύρε ένα pin της ESP32 στο breadboard. Χρώμα καλωδίου: ${COLORS[+colorSelect.value].name}.`,'');}
    function clearWires(){wires.forEach(w=>{board.remove(w.mesh,w.plug);});wires=[];stopParticles();if(ledLens){ledLens.material.emissive.setHex(0);ledLens.material.emissiveIntensity=0;}setCount();}
    function reset(){clearWires();setStatus('Οι συνδέσεις καθαρίστηκαν. Ξεκίνα ξανά από το GPIO 2.','');}
    function setCount(){count.textContent=wires.length+' συνδέσεις';}
    function disposeTree(obj){obj.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){const list=Array.isArray(o.material)?o.material:[o.material];list.forEach(m=>{if(m.map)m.map.dispose();m.dispose();});}});}
    function close(){
      if(disposed)return;disposed=true;cancelAnimationFrame(raf);stopParticles();
      host._ro&&host._ro.disconnect();
      if(scene)disposeTree(scene);
      if(renderer){renderer.domElement.removeEventListener('pointerdown',onPointerDown);renderer.domElement.removeEventListener('pointermove',onPointerMove);renderer.domElement.removeEventListener('pointerup',onPointerUp);renderer.domElement.removeEventListener('pointercancel',cancelDrag);renderer.domElement.removeEventListener('wheel',onWheel);renderer.dispose();}
      host.remove();if(opts.onClose)opts.onClose();
    }
    init();
    return {close};
  }

  root.IoT3DBreadboard = { open };
})(typeof window !== 'undefined' ? window : globalThis);

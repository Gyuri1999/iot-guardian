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
          <label>Pin ESP32 <select data-pin>${PINS.map(p=>`<option>${p}</option>`).join('')}</select></label>
          <button type="button" class="iot3dbb-add">+ Νέο καλώδιο</button>
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
    const pinSelect = host.querySelector('[data-pin]');
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
      pinSelect.onchange=()=>{ if(drag){ drag.pin=pinSelect.value; placeWire(drag); } };
      host.addEventListener('keydown',e=>{if(e.key==='Escape') close();});
      resize(); render();
      addWire();
    }
    function buildBoard() {
      if(board) { scene.remove(board); disposeTree(board); }
      holeMeshes=[]; pinMeshes=[]; wires=[];
      board=new THREE.Group(); scene.add(board);
      const full=sizeSelect.value==='full', cols=full?52:17, rows=10;
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
          hole.rotation.x=Math.PI/2; // cylinder axis y remains vertical (no-op visual alignment)
          hole.position.set(x,.49,z); hole.userData={type:'hole',col:c,row:r,net:r<5?'a'+c:'b'+c};
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
      });
      // LED and resistor are visual learning targets with legs inserted into distinct hole groups.
      const ledX=centerX+2*1.1, ledZ=1.1;
      const leadA=V(ledX-.55,.6,ledZ), leadB=V(ledX+.55,.6,ledZ);
      const leg1=new THREE.Mesh(new THREE.CylinderGeometry(.055,.055,1,8),material(0xb6bfc6,.3,.8));leg1.position.set(leadA.x,.9,leadA.z);board.add(leg1);
      const leg2=leg1.clone();leg2.position.x=leadB.x;board.add(leg2);
      const shell=addBox(board,ledX,2.3,ledZ,1.1,2.2,1.1,material(0xc3423b,.3,.15));
      const lens=new THREE.Mesh(new THREE.SphereGeometry(.62,20,14),new THREE.MeshStandardMaterial({color:0xff4a3c,emissive:0x000000,roughness:.2,metalness:.05}));
      lens.position.set(ledX,3.3,ledZ);board.add(lens);ledLens=lens;
      // 220-ohm resistor across a different pair of columns. Ends map to holes.
      const rx=centerX+1.1, rz=-3.2+3*1.1;
      const body=addBox(board,rx,1.2,rz,2.3,.65,.65,material(0xd8bd93,.55));
      for(let i=0;i<4;i++){const stripe=addBox(board,rx-0.75+i*.5,1.54,rz,.12,.08,.68,material([0xc0392b,0xc0392b,0x7a4a26,0xc9a227][i],.4));}
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
      if(pinHit){const pin=pinHit.object;drag={pin:pin.userData.name,color:COLORS[+colorSelect.value].hex,points:[pin.position.clone()],mesh:makeLoose(pin),pointer:e.pointerId};renderer.domElement.setPointerCapture(e.pointerId);setStatus(`Καλώδιο από ${drag.pin}: σύρε το στην επιθυμητή οπή.`,'');return;}
      orbit={x:e.clientX,y:e.clientY,yaw,pitch};
      renderer.domElement.setPointerCapture(e.pointerId);
    }
    function onPointerMove(e){
      if(drag&&drag.pointer===e.pointerId){setPointer(e);const hit=raycaster.intersectObjects(holeMeshes,false)[0];drag.target=hit?hit.object:null;if(drag.target){drag.mesh.position.copy(hit.point);drag.mesh.position.y=.85;}else{const v=rayOnBoard(e);drag.mesh.position.copy(v);}setStatus(drag.target?`Οπή ${String.fromCharCode(65+drag.target.userData.row)}${drag.target.userData.col+1} · άφησε για σύνδεση.`:'Σύρε το βύσμα πάνω στο breadboard.','');return;}
      if(orbit){yaw=orbit.yaw-(e.clientX-orbit.x)*.009;pitch=Math.max(.18,Math.min(1.45,orbit.pitch+(e.clientY-orbit.y)*.006));}
    }
    function onPointerUp(e){
      if(drag&&drag.pointer===e.pointerId){const d=drag;drag=null;renderer.domElement.releasePointerCapture(e.pointerId);if(d.target)commitWire(d,d.target);else{board.remove(d.mesh);setStatus('Το καλώδιο επέστρεψε στο pin. Άφησέ το πάνω σε μία οπή.','err');}return;}
      orbit=null;
    }
    function cancelDrag(){if(drag){board.remove(drag.mesh);drag=null;}orbit=null;}
    function onWheel(e){e.preventDefault();zoom=Math.max(.55,Math.min(2.8,zoom*(e.deltaY>0?.91:1.1)));}
    function rayOnBoard(e){
      const p=pick(e,[board.children[0]]);return p?p.point:V(0,2,0);
    }
    function makeLoose(pin){
      const group=new THREE.Group();board.add(group);
      const color=new THREE.Color(COLORS[+colorSelect.value].hex);
      const a=pin.position.clone();a.y+=.7;
      const b=a.clone();
      const mesh=new THREE.Mesh(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([a,a.clone().add(V(0,5,0)),b]),40,.13,8,false),material(color,.35,.15));
      group.add(mesh);return group;
    }
    function commitWire(d,hole){
      const from=pinMeshes.find(p=>p.userData.name===d.pin);
      if(wires.some(w=>w.pin===d.pin)){board.remove(d.mesh);setStatus('Αυτό το GPIO έχει ήδη καλώδιο. Επίλεξε άλλο pin.','err');return;}
      const start=from.position.clone();start.y+=.7;
      const end=hole.position.clone();end.y+=.24;
      const mid1=start.clone().add(V(0,5,0)),mid2=end.clone().add(V(0,5,0));
      const curve=new THREE.CatmullRomCurve3([start,mid1,mid2,end]);
      const m=new THREE.Mesh(new THREE.TubeGeometry(curve,60,.14,8,false),material(d.color,.32,.1));m.castShadow=true;
      board.remove(d.mesh);board.add(m);
      const plug=new THREE.Mesh(new THREE.CylinderGeometry(.23,.23,.34,12),material(d.color,.32));
      plug.position.copy(end);board.add(plug);
      wires.push({pin:d.pin,net:hole.userData.net,hole:hole.userData,col:d.color,curve,mesh:m,plug});
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
      const sig=byPin('GPIO 2'), ground=byPin('GND');
      const resistorEndNets = [ 'a1','a3' ];
      const ledSignal='b2', ledGround='b3';
      const hasR = sig && sig.net==='a1' && wires.some(w=>w.net==='a3');
      const hasLed = wires.some(w=>w.net===ledSignal) && ground && ground.net===ledGround;
      const valid=!!(hasR&&hasLed);
      ledLens.material.emissive.setHex(valid?0xff382c:0);
      ledLens.material.emissiveIntensity=valid?1.6:0;
      if(valid){setStatus('Κύκλωμα σωστό! GPIO 2 → 220 Ω → LED → GND. Το LED άναψε.','ok');startParticles();}
      else if(wires.length){setStatus('Η σύνδεση καταγράφηκε, αλλά το κύκλωμα δεν είναι ακόμη σωστό. Έλεγξε αντίσταση, LED και GND.','warn');stopParticles();}
    }
    function startParticles(){
      if(liveParticles.length)return;
      const curves=wires.map(w=>w.curve);
      curves.forEach(curve=>{const dot=new THREE.Mesh(new THREE.SphereGeometry(.16,8,6),material(0xfff4a8,.2));board.add(dot);liveParticles.push({dot,curve,offset:Math.random()});});
    }
    function stopParticles(){liveParticles.forEach(p=>board.remove(p.dot));liveParticles=[];}
    function updateParticles(){if(!liveParticles.length)return;const t=performance.now()*.0006;liveParticles.forEach(p=>p.curve.getPointAt((t+p.offset)%1,p.dot.position));}
    function addWire(){pinSelect.value='GPIO 2';setStatus('Σύρε το pin GPIO 2 προς την αντίστοιχη οπή για να ξεκινήσεις.','');}
    function clearWires(){wires.forEach(w=>{board.remove(w.mesh,w.plug);});wires=[];stopParticles();if(ledLens){ledLens.material.emissive.setHex(0);ledLens.material.emissiveIntensity=0;}setCount();}
    function reset(){clearWires();setStatus('Οι συνδέσεις καθαρίστηκαν. Ξεκίνα ξανά από το GPIO 2.','');}
    function setCount(){count.textContent=wires.length+' συνδέσεις';}
    function disposeTree(obj){obj.traverse(o=>{if(o.geometry)o.geometry.dispose();if(o.material){if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material.dispose();}});}
    function close(){
      if(disposed)return;disposed=true;cancelAnimationFrame(raf);stopParticles();
      host._ro&&host._ro.disconnect();
      if(renderer){renderer.domElement.removeEventListener('pointerdown',onPointerDown);renderer.domElement.removeEventListener('pointermove',onPointerMove);renderer.domElement.removeEventListener('pointerup',onPointerUp);renderer.domElement.removeEventListener('pointercancel',cancelDrag);renderer.domElement.removeEventListener('wheel',onWheel);renderer.dispose();}
      host.remove();if(opts.onClose)opts.onClose();
    }
    init();
    return {close};
  }

  root.IoT3DBreadboard = { open };
})(typeof window !== 'undefined' ? window : globalThis);

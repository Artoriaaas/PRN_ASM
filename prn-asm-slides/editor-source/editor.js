(() => {
  'use strict';
  const COUNT = 18;
  const STORE = 'prn-asm-slide-editor-state-v2';
  const embedded = document.getElementById('prn-baked-state');
  let state = {version:2, slides:Array.from({length:COUNT},()=>({texts:{},objects:[]})), updatedAt:null};
  const readState = value => {
    if (!value || typeof value !== 'object' || !Array.isArray(value.slides) || value.slides.length !== COUNT) throw new Error('Tệp dữ liệu phải có chính xác 18 slide');
    return {version:2,slides:value.slides.map(s=>({texts:s.texts && typeof s.texts==='object'?s.texts:{},objects:Array.isArray(s.objects)?s.objects:[]})),updatedAt:value.updatedAt||null};
  };
  try { if(embedded && embedded.textContent.trim()) state=readState(JSON.parse(embedded.textContent)); }catch(err){console.warn('Embedded state ignored',err);}
  try { const s=localStorage.getItem(STORE); if(s) state=readState(JSON.parse(s)); }catch(err){console.warn('Local editor state unavailable',err);}
  let editing=false, selected=null, selectedElement=null, slideIndex=0, noticeTimer=0, activeSlide=null, applyScheduled=false, hasDraftWarning=false;
  const $ = (sel,ctx=document)=>ctx.querySelector(sel);
  const el = (tag,attrs={},textValue)=>{const v=document.createElement(tag);for(const [k,value] of Object.entries(attrs)){if(k==='className')v.className=value;else if(k==='dataset')for(const [x,z] of Object.entries(value))v.dataset[x]=z;else v.setAttribute(k,value);}if(textValue!==undefined)v.textContent=textValue;return v;};
  const safeHTML = text => String(text).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const getSlide = () => $('.slide-inner');
  const getCurrent = () => Math.max(0,Math.min(17,(Number(location.hash.replace('#',''))||1)-1));
  const newId = () => 'obj-'+Math.random().toString(36).slice(2,11);
  const toast = msg =>{const n=$('#prn-notice');n.textContent=msg;n.classList.add('prn-on');clearTimeout(noticeTimer);noticeTimer=setTimeout(()=>n.classList.remove('prn-on'),3400);};
  const store = () => {state.updatedAt=new Date().toISOString();try{localStorage.setItem(STORE,JSON.stringify(state));hasDraftWarning=false;}catch(err){if(!hasDraftWarning){toast('Bộ nhớ trình duyệt đã đầy. Hãy xuất JSON hoặc HTML để tránh mất dữ liệu.');hasDraftWarning=true;}console.warn(err);}};
  function keyFor(node,root){let parts=[];while(node&&node!==root){let p=node.parentElement;if(!p)return null;parts.unshift(Array.prototype.indexOf.call(p.children,node));node=p;}return node===root?parts.join('.'):null;}
  const editableTags='h1,h2,h3,h4,h5,p,span,strong,b,small,li,.slide-title,.kicker,.header-brand,.header-right,.deploy-label,.member-id,.team-vert,.cover-title,.cover-sub,.footer-name,.footer-index,.diagram-title,.flow-count,.mflow-n,.service-sub,.thumb-name,.chip';
  function candidates(root){
    if(!root)return [];
    const picks=new Set();
    const tw=document.createTreeWalker(root,NodeFilter.SHOW_TEXT);
    while(tw.nextNode()){
      const n=tw.currentNode, v=(n.textContent||'').trim();if(!v)continue;
      const parent=n.parentElement;if(!parent||parent.closest('svg,script,style,.sudoku-grid,.prn-overlay-object,.prn-object-grip'))continue;
      if(parent.closest('button,a'))continue;
      let target=parent;
      // Direct text-bearing nodes are safer than editing a whole container with nested child blocks.
      if(!target.matches(editableTags)&&target.children.length>0)continue;
      if(target.childElementCount && target.querySelector('svg,img,button,canvas'))continue;
      picks.add(target);
    }
    return Array.from(picks);
  }
  function patchText(root,i){
    for(const node of candidates(root)){
      const key=keyFor(node,root);if(!key)continue;
      node.dataset.prnTextKey=key;
      const p=state.slides[i].texts[key];if(p){
        if(typeof p.html==='string')node.innerHTML=p.html;
        if(typeof p.style==='string')node.style.cssText=p.style;
      }
      if(editing){node.classList.add('prn-edit-target');node.setAttribute('contenteditable','plaintext-only');node.spellcheck=false;}
      else{node.classList.remove('prn-edit-target');node.removeAttribute('contenteditable');}
    }
  }
  function makeDiagram(node,obj){
    const items=Array.isArray(obj.nodes)?obj.nodes:['Bắt đầu','Xử lý','Kết thúc'];node.replaceChildren();
    const wrap=el('div',{className:'prn-diagram-layout'});
    items.slice(0,7).forEach((t,i)=>{if(i)wrap.append(el('span',{className:'prn-diagram-arrow'},'→'));wrap.append(el('div',{className:'prn-diagram-node'},t));});
    node.append(wrap);
  }
  function drawObjects(root,i){
    root.querySelectorAll('.prn-overlay-object').forEach(n=>n.remove());
    for(const object of state.slides[i].objects){
      const n=el('div',{className:'prn-overlay-object prn-kind-'+object.kind,dataset:{prnId:object.id}});
      n.style.left=object.x+'px';n.style.top=object.y+'px';n.style.width=object.w+'px';n.style.height=object.h+'px';
      if(object.kind==='image'){
        const img=el('img',{alt:object.name||'User added image'});img.src=object.src||'';n.append(img);
      }else if(object.kind==='text'){
        const text=el('div',{className:'prn-text-body'},object.text||'');text.style.fontSize=(object.fontSize||32)+'px';text.style.color=object.color||'#e7fcff';text.style.fontFamily=object.fontFamily||'Inter, sans-serif';text.style.fontWeight=object.bold===false?'400':'700';n.append(text);
      }else if(object.kind==='diagram'){makeDiagram(n,object);}
      const grip=el('div',{className:'prn-object-grip'},object.kind==='image'?'Ảnh · kéo thả':object.kind==='diagram'?'Diagram · kéo thả':'Chữ · kéo thả');
      const resize=el('div',{className:'prn-object-resizer',title:'Kéo để đổi kích thước'});
      n.append(grip,resize);
      n.classList.toggle('prn-selected',!!selected&&selected.id===object.id&&i===slideIndex&&editing);
      n.addEventListener('pointerdown',event=>{if(!editing)return;selectObject(object.id);event.preventDefault();event.stopPropagation();startDrag(event,object,n,event.target===resize?'resize':'move');});
      root.append(n);
    }
  }
  function updateScale(){if(!editing)return;const root=document.documentElement;let x=Math.min(Math.max(130,innerWidth-380)/1600,Math.max(170,innerHeight-100)/900);root.style.setProperty('--prn-editor-stage-scale',String(x));}
  function refreshSlide(){
    let root=getSlide();if(!root)return;
    const canvas=$('.slide-canvas');
    // React owns the outer slide DOM; only apply on a new rendered slide or when specifically requested.
    const nextIndex=getCurrent();if(activeSlide!==canvas || slideIndex!==nextIndex){selected=null;selectedElement=null;slideIndex=nextIndex;activeSlide=canvas;}
    patchText(root,slideIndex);
    drawObjects(root,slideIndex);
    refreshPanel();
  }
  function scheduleRefresh(){if(applyScheduled)return;applyScheduled=true;requestAnimationFrame(()=>{applyScheduled=false;refreshSlide();});}
  function selectObject(id){selected={id};selectedElement=null;refreshPanel();let root=getSlide();root?.querySelectorAll('.prn-overlay-object').forEach(n=>n.classList.toggle('prn-selected',n.dataset.prnId===id));}
  function findObject(){return selected?state.slides[slideIndex].objects.find(x=>x.id===selected.id):null;}
  function startDrag(event,obj,node,mode){
    const scale=node.getBoundingClientRect().width/(obj.w||1)||1;
    const x=event.clientX,y=event.clientY,ix=obj.x,iy=obj.y,iw=obj.w,ih=obj.h;
    const move=e=>{const dx=(e.clientX-x)/scale,dy=(e.clientY-y)/scale;
      if(mode==='resize'){
        obj.w=Math.max(100,Math.round(iw+dx));obj.h=Math.max(70,Math.round(ih+dy));node.style.width=obj.w+'px';node.style.height=obj.h+'px';
      }else{
        obj.x=Math.round(Math.max(-obj.w+40,Math.min(1560,ix+dx)));obj.y=Math.round(Math.max(-obj.h+40,Math.min(860,iy+dy)));
        node.style.left=obj.x+'px';node.style.top=obj.y+'px';
      }
      updatePropsFields();
    };
    const stop=()=>{document.removeEventListener('pointermove',move,true);document.removeEventListener('pointerup',stop,true);store();};
    document.addEventListener('pointermove',move,true);document.addEventListener('pointerup',stop,true);
  }
  const tb=el('button',{id:'prn-editor-toggle',type:'button'},'✎  Chỉnh sửa');
  const panel=el('aside',{id:'prn-editor-panel','aria-label':'Bảng chỉnh sửa slide'});
  panel.innerHTML=`
    <div style="display:flex;align-items:center;justify-content:space-between"><h3>✦ PRN ASM Editor</h3><span class="prn-badge" id="prn-slide-indicator">Slide 01 / 18</span></div>
    <p>Nhấp vào chữ trên slide để sửa trực tiếp. Nhấp vào đối tượng để kéo thả, định dạng hoặc thay kích thước.</p>
    <h4>Chèn nội dung</h4>
    <div class="prn-buttons"><button type="button" id="prn-add-text">＋ Hộp chữ</button><button type="button" id="prn-add-image">＋ Ảnh / logo</button><button type="button" id="prn-add-diagram">＋ Diagram</button><button type="button" id="prn-duplicate-object">⧉ Nhân đôi</button></div>
    <input id="prn-image-file" class="prn-upload-hidden" type="file" accept="image/png,image/jpeg,image/webp,image/svg+xml,image/gif" />
    <div class="prn-rule"></div>
    <div id="prn-object-props"><span class="prn-badge">Chưa chọn đối tượng</span><p>Để chỉnh font, màu chữ: nhấp vào chữ của slide, rồi sử dụng các thuộc tính bên dưới.</p></div>
    <h4>Lưu và chia sẻ</h4>
    <div class="prn-buttons"><button class="prn-primary" id="prn-save-local">✓ Lưu trên máy</button><button id="prn-export-html">⬇ Xuất HTML</button><button id="prn-export-json">⬇ Xuất JSON</button><button id="prn-import-json">⬆ Nhập JSON</button></div>
    <input id="prn-json-file" class="prn-upload-hidden" type="file" accept="application/json,.json" />
    <div class="prn-alert"><b>Lưu ý về chia sẻ nhóm:</b> GitHub Pages cho phép mọi người mở và chỉnh sửa bản riêng trên trình duyệt; các thay đổi KHÔNG tự đồng bộ. Muốn nhóm thấy bản mới, hãy xuất HTML rồi cập nhật <code>index.html</code> trên GitHub; hoặc trao đổi tệp JSON để nhập thay đổi.</div>
    <div class="prn-buttons full" style="margin-top:10px"><button id="prn-reset-slide" class="prn-danger">↺ Khôi phục thay đổi slide hiện tại</button></div>
    <div class="prn-hotkeys"><span><span class="prn-shortcut">Esc</span> Bỏ chọn</span><span><span class="prn-shortcut">Delete</span> Xóa đối tượng</span></div>
  `;
  const notice=el('div',{id:'prn-notice',role:'status','aria-live':'polite'});
  document.body.append(tb,panel,notice);
  const props=$('#prn-object-props');
  const inputLine=(name,value,type='text')=>`<label class="prn-field"><span>${name}</span><input data-prn-prop="${safeHTML(name)}" type="${type}" value="${safeHTML(value)}"></label>`;
  function refreshPanel(){
    $('#prn-slide-indicator').textContent='Slide '+String(slideIndex+1).padStart(2,'0')+' / 18';
    const obj=findObject();
    if(selectedElement && editing){
      props.innerHTML=`<span class="prn-badge">Đang chỉnh chữ gốc</span>
        <div class="prn-field"><span>Font chữ</span><select id="prn-font"><option value="Inter, Arial, sans-serif">Inter</option><option value="Arial, sans-serif">Arial</option><option value="'Segoe UI', sans-serif">Segoe UI</option><option value="Georgia, serif">Georgia</option></select></div>
        <div class="prn-grid-row"><label class="prn-field"><span>Cỡ chữ (px)</span><input id="prn-font-size" type="number" min="10" max="210" value="${parseInt(getComputedStyle(selectedElement).fontSize)||30}"></label><label class="prn-field"><span>Màu</span><input id="prn-font-color" type="color" value="${rgbToHex(getComputedStyle(selectedElement).color)}"></label></div>
        <div class="prn-buttons"><button id="prn-bold-text">Bật/tắt in đậm</button><button id="prn-center-text">Căn giữa</button></div>
        <p class="prn-selected-note">Sửa nội dung ngay trên slide; các thay đổi được lưu cục bộ tự động.</p>`;
      $('#prn-font').value=selectedElement.style.fontFamily||'Inter, Arial, sans-serif';
      const changeStyle=()=>{const k=selectedElement.dataset.prnTextKey;if(!k)return;state.slides[slideIndex].texts[k]={html:selectedElement.innerHTML,style:selectedElement.style.cssText};store();};
      $('#prn-font').onchange=e=>{selectedElement.style.fontFamily=e.target.value;changeStyle();};
      $('#prn-font-size').onchange=e=>{selectedElement.style.fontSize=Math.max(10,Math.min(210,Number(e.target.value)||30))+'px';changeStyle();};
      $('#prn-font-color').onchange=e=>{selectedElement.style.color=e.target.value;changeStyle();};
      $('#prn-bold-text').onclick=()=>{selectedElement.style.fontWeight=getComputedStyle(selectedElement).fontWeight==='700'?'400':'700';changeStyle();};
      $('#prn-center-text').onclick=()=>{selectedElement.style.textAlign='center';changeStyle();};
    }else if(obj){
      props.innerHTML=`<span class="prn-badge">Đã chọn ${obj.kind==='image'?'hình ảnh':obj.kind==='diagram'?'diagram':'hộp chữ'}</span>
        <div class="prn-grid-row">${inputLine('X',obj.x,'number')}${inputLine('Y',obj.y,'number')}${inputLine('Rộng',obj.w,'number')}${inputLine('Cao',obj.h,'number')}</div>
        ${obj.kind==='text'?`<label class="prn-field"><span>Nội dung hộp chữ</span><textarea id="prn-object-text">${safeHTML(obj.text||'')}</textarea></label><div class="prn-grid-row">${inputLine('Cỡ chữ',obj.fontSize||32,'number')}<label class="prn-field"><span>Màu</span><input type="color" id="prn-object-color" value="${safeHTML(obj.color||'#e7fcff')}"></label></div><label class="prn-field"><span>Font</span><select id="prn-object-family"><option value="Inter, sans-serif">Inter</option><option value="Arial, sans-serif">Arial</option><option value="Georgia, serif">Georgia</option></select></label>`:''}
        ${obj.kind==='diagram'?`<label class="prn-field"><span>Các ô diagram (mỗi dòng một ô)</span><textarea rows="6" id="prn-diagram-nodes">${safeHTML((obj.nodes||[]).join('\n'))}</textarea></label>`:''}
        <div class="prn-buttons"><button class="prn-danger" id="prn-delete-object">✕ Xóa đối tượng</button></div>`;
      props.querySelectorAll('[data-prn-prop]').forEach(inp=>inp.onchange=e=>{const key=({'X':'x','Y':'y','Rộng':'w','Cao':'h','Cỡ chữ':'fontSize'})[e.target.dataset.prnProp];if(!key)return;obj[key]=Number(e.target.value)||0;if(key==='w'||key==='h')obj[key]=Math.max(80,obj[key]);store();drawObjects(getSlide(),slideIndex);});
      const ta=$('#prn-object-text');if(ta)ta.oninput=e=>{obj.text=e.target.value;store();drawObjects(getSlide(),slideIndex)};
      const co=$('#prn-object-color');if(co)co.oninput=e=>{obj.color=e.target.value;store();drawObjects(getSlide(),slideIndex)};
      const fam=$('#prn-object-family');if(fam){fam.value=obj.fontFamily||'Inter, sans-serif';fam.onchange=e=>{obj.fontFamily=e.target.value;store();drawObjects(getSlide(),slideIndex)}}
      const nd=$('#prn-diagram-nodes');if(nd)nd.oninput=e=>{obj.nodes=e.target.value.split('\n').map(x=>x.trim()).filter(Boolean).slice(0,7);store();drawObjects(getSlide(),slideIndex)};
      $('#prn-delete-object').onclick=()=>removeSelected();
    }else{
      props.innerHTML='<span class="prn-badge">Chưa chọn đối tượng</span><p>Nhấp vào chữ để thay font, cỡ chữ và màu. Nhấp ảnh/diagram để kéo thả hoặc thay kích thước.</p>';
    }
  }
  function rgbToHex(color){if(/^#[0-9a-f]{6}$/i.test(color))return color;const nums=(color.match(/\d+/g)||[]).slice(0,3).map(x=>Math.max(0,Math.min(255,+x)));return nums.length===3?'#'+nums.map(n=>n.toString(16).padStart(2,'0')).join(''):'#ffffff';}
  function removeSelected(){const a=state.slides[slideIndex].objects;const idx=a.findIndex(x=>x.id===selected?.id);if(idx>=0){a.splice(idx,1);selected=null;store();drawObjects(getSlide(),slideIndex);refreshPanel();}}
  function addObject(data){const obj={id:newId(),...data};state.slides[slideIndex].objects.push(obj);store();drawObjects(getSlide(),slideIndex);selectObject(obj.id);toast('Đã chèn đối tượng vào slide '+(slideIndex+1));return obj;}
  $('#prn-add-text').onclick=()=>addObject({kind:'text',x:420,y:330,w:570,h:112,text:'Nhập nội dung...',fontSize:38,color:'#e7fcff',fontFamily:'Inter, sans-serif'});
  $('#prn-add-diagram').onclick=()=>addObject({kind:'diagram',x:150,y:325,w:1260,h:270,nodes:['Bước 1','Bước 2','Bước 3']});
  $('#prn-add-image').onclick=()=>$('#prn-image-file').click();
  $('#prn-image-file').onchange=e=>{const f=e.target.files?.[0];if(!f)return;if(f.size>7*1024*1024){toast('Ảnh lớn hơn 7MB. Hãy nén ảnh trước khi tải lên.');return;}const reader=new FileReader();reader.onload=()=>addObject({kind:'image',x:490,y:300,w:530,h:360,src:String(reader.result),name:f.name});reader.readAsDataURL(f);e.target.value='';};
  $('#prn-duplicate-object').onclick=()=>{const obj=findObject();if(!obj){toast('Hãy chọn một đối tượng trước.');return;}addObject({...obj,id:newId(),x:obj.x+24,y:obj.y+24})};
  $('#prn-save-local').onclick=()=>{store();toast('Đã lưu trên trình duyệt này. Hãy xuất HTML hoặc JSON để gửi cho người khác.');};
  function download(name,text,type){const blob=new Blob([text],{type});const url=URL.createObjectURL(blob);const a=el('a',{href:url,download:name});document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),3000);}
  $('#prn-export-json').onclick=()=>{store();download('PRN_ASM_18_Slides.project.json',JSON.stringify(state,null,2),'application/json');toast('Đã xuất dự án JSON: gửi cho bạn bè để nhập vào cùng bản HTML Editor.');};
  function buildStandalone(){
    const clone=document.documentElement.cloneNode(true);
    const root=clone.querySelector('#root');if(root)root.replaceChildren();
    clone.querySelectorAll('#prn-editor-toggle,#prn-editor-panel,#prn-notice').forEach(n=>n.remove());
    clone.classList.remove('prn-editing');clone.style.removeProperty('--prn-editor-stage-scale');
    const holder=clone.querySelector('#prn-baked-state');if(holder)holder.textContent=JSON.stringify(state).replace(/</g,'\\u003c');
    return '<!doctype html>\n'+clone.outerHTML;
  }
  $('#prn-export-html').onclick=()=>{store();download('index.html',buildStandalone(),'text/html');toast('Đã xuất index.html – có thể đăng GitHub Pages hoặc chia sẻ như một file độc lập.');};
  $('#prn-import-json').onclick=()=>$('#prn-json-file').click();
  $('#prn-json-file').onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{const v=readState(JSON.parse(await f.text()));if(!confirm('Nhập file dự án sẽ thay thế các chỉnh sửa đang lưu trên trình duyệt. Tiếp tục?'))return;state=v;selected=null;selectedElement=null;store();refreshSlide();toast('Đã nhập dự án 18 slide.');}catch(err){toast('Không đọc được dự án: '+err.message)}finally{e.target.value='';}};
  $('#prn-reset-slide').onclick=()=>{if(!confirm('Khôi phục toàn bộ thay đổi trên slide '+(slideIndex+1)+'?'))return;state.slides[slideIndex]={texts:{},objects:[]};selected=null;selectedElement=null;store();location.reload();};
  tb.addEventListener('click',()=>{
    editing=!editing;document.documentElement.classList.toggle('prn-editing',editing);tb.textContent=editing?'✓  Xong chỉnh sửa':'✎  Chỉnh sửa';selected=null;selectedElement=null;updateScale();refreshSlide();
    if(editing)toast('Chế độ chỉnh sửa: nhấp chữ để sửa, chèn ảnh/diagram bằng bảng bên phải.');
  });
  document.addEventListener('focusin',e=>{if(!editing)return;const t=e.target.closest?.('.prn-edit-target');if(!t)return;selectedElement=t;selected=null;refreshPanel();});
  document.addEventListener('input',e=>{if(!editing)return;const t=e.target.closest?.('.prn-edit-target');if(!t)return;const k=t.dataset.prnTextKey;if(!k)return;state.slides[slideIndex].texts[k]={html:t.innerHTML,style:t.style.cssText};store();},true);
  document.addEventListener('keydown',e=>{
    if(!editing)return;
    const focus=document.activeElement;
    const inEditor=focus?.closest?.('#prn-editor-panel,.prn-edit-target') || focus?.isContentEditable;
    if(inEditor){e.stopPropagation();if(['ArrowLeft','ArrowRight','ArrowUp','ArrowDown',' ','Enter','Backspace','Delete'].includes(e.key))e.stopImmediatePropagation();return;}
    if(e.key==='Escape'){selected=null;selectedElement=null;refreshPanel();getSlide()?.querySelectorAll('.prn-selected').forEach(n=>n.classList.remove('prn-selected'));}
    if((e.key==='Delete'||e.key==='Backspace')&&selected){e.preventDefault();e.stopImmediatePropagation();removeSelected();}
  },true);
  window.addEventListener('wheel',e=>{if(editing)e.stopImmediatePropagation();},true);
  window.addEventListener('resize',()=>{updateScale();scheduleRefresh();});
  window.addEventListener('hashchange',()=>scheduleRefresh());
  document.addEventListener('click',e=>{if(editing&&e.target.closest?.('.slide-inner')&&!e.target.closest('.prn-overlay-object,.prn-edit-target')){selected=null;selectedElement=null;refreshPanel();}},true);
  const obs=new MutationObserver(mutations=>{
    if(mutations.some(m=>Array.from(m.addedNodes).some(n=>n.nodeType===1 && (n.classList?.contains('slide-canvas')||n.querySelector?.('.slide-canvas')))))scheduleRefresh();
  });
  const main=$('#root');if(main)obs.observe(main,{childList:true,subtree:true});
  if(!location.hash)history.replaceState(null,'','#1');
  updateScale();scheduleRefresh();
})();

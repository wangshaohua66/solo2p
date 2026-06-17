(function(global){
  const TOOLS = ['select','rectangle','circle','ellipse','arrow','freehand','measure','text'];
  const DEFAULTS = {
    strokeStyle:'#00b42a',
    fillStyle:'rgba(0,180,42,0.12)',
    lineWidth: 2,
    fontSize: 14,
    fontFamily: 'system-ui, "PingFang SC", sans-serif',
    globalAlpha: 1,
    arrowSize: 10,
    measureUnit: 'px',
    scaleRatio: 1
  };

  class AnnotationCanvas {
    constructor(container, opts={}) {
      this.container = typeof container==='string' ? document.querySelector(container) : container;
      if (!this.container) throw new Error('容器不存在');
      this.opts = Object.assign({imageUrl:'',imageId:'',artifactId:'',appraisalId:'',readOnly:false}, DEFAULTS, opts);
      this.annotations = [];
      this.selectedId = null;
      this.history = [];
      this.future = [];
      this.currentTool = 'select';
      this.isDrawing = false;
      this.temp = null;
      this.styles = Object.assign({}, DEFAULTS);
      this.dpr = window.devicePixelRatio || 1;
      this._init();
    }

    _init() {
      this.wrapper = document.createElement('div');
      this.wrapper.style.cssText = 'position:relative;display:inline-block;max-width:100%;background:#1a1a1a;user-select:none;';
      this.canvas = document.createElement('canvas');
      this.canvas.style.cssText = 'display:block;max-width:100%;cursor:crosshair;';
      this.hitCanvas = document.createElement('canvas');
      this.hitCanvas.style.cssText = 'display:none;';
      this.wrapper.appendChild(this.canvas);
      this.wrapper.appendChild(this.hitCanvas);
      this.ctx = this.canvas.getContext('2d');
      this.hitCtx = this.hitCanvas.getContext('2d');
      this.container.innerHTML = '';
      this.container.appendChild(this.wrapper);
      this._bindEvents();
      if (this.opts.imageUrl) this.loadImage(this.opts.imageUrl);
    }

    _bindEvents() {
      const cv = this.canvas;
      cv.addEventListener('mousedown', e=>this._onDown(e));
      cv.addEventListener('mousemove', e=>this._onMove(e));
      document.addEventListener('mouseup', e=>this._onUp(e));
      cv.addEventListener('mouseleave', e=>this._onLeave(e));
      cv.addEventListener('dblclick', e=>this._onDblClick(e));
      cv.addEventListener('wheel', e=>this._onWheel(e), {passive:false});
      window.addEventListener('keydown', e=>this._onKey(e));
      const startX = s => s.clientX ?? s.touches?.[0]?.clientX;
      const startY = s => s.clientY ?? s.touches?.[0]?.clientY;
      cv.addEventListener('touchstart', e=>{e.preventDefault(); this._onDown({...e,clientX:startX(e),clientY:startY(e),shiftKey:false,button:0});},{passive:false});
      cv.addEventListener('touchmove',  e=>{e.preventDefault(); this._onMove({...e,clientX:startX(e),clientY:startY(e)});},{passive:false});
      cv.addEventListener('touchend',   e=>{e.preventDefault(); this._onUp({...e,clientX:null,clientY:null});},{passive:false});
    }

    _pos(e) {
      const r = this.canvas.getBoundingClientRect();
      return { x:(e.clientX - r.left) * (this.canvas.width  / r.width),
               y:(e.clientY - r.top)  * (this.canvas.height / r.height) };
    }

    loadImage(url) {
      return new Promise((res,rej)=>{
        const img = new Image();
        img.crossOrigin = 'anonymous';
        img.onload = () => {
          this.img = img;
          const W = img.naturalWidth, H = img.naturalHeight;
          this.canvas.width = W; this.canvas.height = H;
          this.hitCanvas.width = W; this.hitCanvas.height = H;
          this.canvas.style.width = '100%';
          this.render();
          res({width:W,height:H});
        };
        img.onerror = rej;
        img.src = url;
      });
    }

    setTool(t) { if (TOOLS.includes(t)) { this.currentTool = t; this.selectedId = null; this.render(); } }

    setStyle(key, val) { if (val!=null) { this.styles[key] = val; if (this.selectedId) this._updateSelectedStyle(key,val); this.render(); } }

    _updateSelectedStyle(key,val) {
      const a = this.annotations.find(x=>x.id===this.selectedId);
      if (!a) return;
      if (['strokeStyle','fillStyle','lineWidth','globalAlpha','lineDash'].includes(key)) a[key] = val;
    }

    _onDown(e) {
      if (this.opts.readOnly) return;
      if (e.button !== undefined && e.button !== 0) return;
      const p = this._pos(e);
      if (this.currentTool === 'select') {
        const id = this._hitTest(p.x, p.y);
        this.selectedId = id;
        if (id) { this._dragOffset = p; this._dragging = true; }
        this.render();
        return;
      }
      this.isDrawing = true;
      this.temp = this._makeTemp(this.currentTool, p);
      this.render();
    }

    _onMove(e) {
      if (!this.img) return;
      const p = this._pos(e);
      if (this._dragging && this.selectedId) {
        const a = this.annotations.find(x=>x.id===this.selectedId);
        if (a) {
          const dx = p.x - this._dragOffset.x, dy = p.y - this._dragOffset.y;
          this._moveAnnotation(a, dx, dy);
          this._dragOffset = p;
          this.render();
        }
        return;
      }
      if (!this.isDrawing || !this.temp) return;
      this._updateTemp(this.temp, p);
      this.render();
    }

    _onUp(e) {
      this._dragging = false;
      if (!this.isDrawing) return;
      this.isDrawing = false;
      if (!this.temp) return;
      const valid = this._finalizeTemp(this.temp);
      if (valid) {
        this._pushHistory();
        this.annotations.push(this.temp);
        this.selectedId = this.temp.id;
      }
      this.temp = null;
      this.render();
      if (valid) this._onChange?.('create', this.annotations[this.annotations.length-1]);
    }

    _onLeave(e) { if (!this.isDrawing && !this._dragging) return; this._onUp(e); }

    _onDblClick(e) {
      if (this.opts.readOnly || !this.img) return;
      if (this.currentTool !== 'text') { this.setTool('text'); }
      const p = this._pos(e);
      const txt = prompt('请输入文字：', '标注文字');
      if (txt) {
        const a = this._newAnnotation('text');
        Object.assign(a, { x:p.x, y:p.y, content:txt, fontSize:this.styles.fontSize, fontFamily:this.styles.fontFamily, textAlign:'left' });
        this._pushHistory(); this.annotations.push(a); this.selectedId=a.id; this.render();
        this._onChange?.('create', a);
      }
    }

    _onWheel(e) {
      if (!this.opts.readOnly && e.ctrlKey) {
        e.preventDefault();
        const delta = -Math.sign(e.deltaY);
        if (e.altKey) {
          this.styles.lineWidth = Math.max(0.5, Math.min(20, this.styles.lineWidth + delta));
          this._onChange?.('style', 'lineWidth', this.styles.lineWidth);
        } else {
          this.styles.fontSize = Math.max(8, Math.min(120, this.styles.fontSize + delta*2));
        }
      }
    }

    _onKey(e) {
      if (e.target && (e.target.tagName==='INPUT'||e.target.tagName==='TEXTAREA')) return;
      if ((e.ctrlKey||e.metaKey) && e.key==='z') { e.preventDefault(); this.undo(); }
      else if ((e.ctrlKey||e.metaKey) && e.key==='y' || ((e.ctrlKey||e.metaKey) && e.shiftKey && e.key==='Z')) { e.preventDefault(); this.redo(); }
      else if ((e.key==='Delete'||e.key==='Backspace') && this.selectedId) { e.preventDefault(); this.deleteSelected(); }
      else if (e.key==='Escape') { this.selectedId=null; this.temp=null; this.isDrawing=false; this.render(); }
      const m = {r:'rectangle',c:'circle',o:'ellipse',a:'arrow',f:'freehand',m:'measure',t:'text',v:'select'};
      if (m[e.key.toLowerCase()]) this.setTool(m[e.key.toLowerCase()]);
    }

    _makeTemp(tool, p) {
      const a = this._newAnnotation(tool);
      switch (tool) {
        case 'rectangle': return {...a, x:p.x, y:p.y, width:0, height:0, startX:p.x, startY:p.y};
        case 'circle':    return {...a, x:p.x, y:p.y, radius:0, startX:p.x, startY:p.y};
        case 'ellipse':   return {...a, x:p.x, y:p.y, radiusX:0, radiusY:0, startX:p.x, startY:p.y, rotation:0};
        case 'arrow':     return {...a, startX:p.x, startY:p.y, endX:p.x, endY:p.y, arrowSize:this.styles.arrowSize};
        case 'freehand':  return {...a, points:[[p.x,p.y]]};
        case 'measure':   return {...a, startX:p.x, startY:p.y, endX:p.x, endY:p.y, measureUnit:this.styles.measureUnit, scaleRatio:this.styles.scaleRatio};
        default:          return a;
      }
    }

    _newAnnotation(tool) {
      return {
        id: 'ann_'+Date.now().toString(36)+Math.random().toString(36).slice(2,8),
        tool, imageId:this.opts.imageId, artifactId:this.opts.artifactId, appraisalId:this.opts.appraisalId,
        strokeStyle:this.styles.strokeStyle, fillStyle:this.styles.fillStyle, lineWidth:this.styles.lineWidth,
        globalAlpha:this.styles.globalAlpha, zIndex:this.annotations.length, visible:true, locked:false, version:1
      };
    }

    _updateTemp(a, p) {
      switch (a.tool) {
        case 'rectangle':
          a.x = Math.min(p.x, a.startX); a.y = Math.min(p.y, a.startY);
          a.width = Math.abs(p.x - a.startX); a.height = Math.abs(p.y - a.startY);
          break;
        case 'circle':
          a.x = a.startX; a.y = a.startY;
          a.radius = Math.hypot(p.x-a.startX, p.y-a.startY);
          break;
        case 'ellipse':
          a.x = (p.x+a.startX)/2; a.y = (p.y+a.startY)/2;
          a.radiusX = Math.abs(p.x-a.startX)/2; a.radiusY = Math.abs(p.y-a.startY)/2;
          break;
        case 'arrow':
        case 'measure':
          a.endX = p.x; a.endY = p.y;
          if (a.tool==='measure') {
            const d = Math.hypot(p.x-a.startX, p.y-a.startY) / (a.scaleRatio||1);
            a.measureValue = Math.round(d*100)/100;
          }
          break;
        case 'freehand':
          const last = a.points[a.points.length-1];
          if (!last || Math.hypot(p.x-last[0],p.y-last[1]) >= 1.5) a.points.push([p.x,p.y]);
          break;
      }
    }

    _finalizeTemp(a) {
      switch (a.tool) {
        case 'rectangle': return a.width>2 || a.height>2;
        case 'circle':    return a.radius>2;
        case 'ellipse':   return a.radiusX>2 || a.radiusY>2;
        case 'arrow':
        case 'measure':   return Math.hypot(a.endX-a.startX, a.endY-a.startY) > 3;
        case 'freehand':  return a.points && a.points.length>2;
        default: return false;
      }
    }

    _moveAnnotation(a, dx, dy) {
      if (a.locked) return;
      switch (a.tool) {
        case 'rectangle': a.x+=dx; a.y+=dy; break;
        case 'circle': a.x+=dx; a.y+=dy; break;
        case 'ellipse': a.x+=dx; a.y+=dy; break;
        case 'arrow':
        case 'measure': a.startX+=dx; a.startY+=dy; a.endX+=dx; a.endY+=dy; break;
        case 'freehand': a.points = a.points.map(pt=>[pt[0]+dx,pt[1]+dy]); break;
        case 'text': a.x+=dx; a.y+=dy; break;
      }
    }

    _hitTest(x, y) {
      const cx = this.hitCtx;
      cx.clearRect(0,0,this.hitCanvas.width,this.hitCanvas.height);
      for (let i=this.annotations.length-1; i>=0; i--) {
        const a = this.annotations[i];
        if (!a.visible) continue;
        cx.globalAlpha = 1;
        cx.fillStyle = '#'+a.id.slice(-6).padStart(6,'0').replace(/[^0-9a-f]/g,'0');
        this._drawShape(cx, a, true);
        const [r,g,b] = cx.getImageData(x|0,y|0,1,1).data;
        if (r||g||b) return a.id;
      }
      return null;
    }

    render() {
      const ctx = this.ctx;
      const W = this.canvas.width, H = this.canvas.height;
      ctx.clearRect(0,0,W,H);
      if (this.img) ctx.drawImage(this.img, 0, 0, W, H);
      const sorted = [...this.annotations].sort((a,b)=>(a.zIndex||0)-(b.zIndex||0));
      sorted.forEach(a=>{ if (a.visible!==false) this._drawShape(ctx, a, false); });
      if (this.temp) this._drawShape(ctx, this.temp, false);
      if (this.selectedId) {
        const a = this.annotations.find(x=>x.id===this.selectedId);
        if (a) this._drawSelection(ctx, a);
      }
    }

    _drawShape(ctx, a, forHit) {
      ctx.save();
      if (!forHit) {
        ctx.strokeStyle = a.strokeStyle || this.styles.strokeStyle;
        ctx.fillStyle = a.fillStyle || this.styles.fillStyle;
        ctx.lineWidth = a.lineWidth || this.styles.lineWidth;
        ctx.globalAlpha = a.globalAlpha ?? this.styles.globalAlpha;
      }
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      const drawMethod = forHit ? 'fill' : null;

      switch (a.tool) {
        case 'rectangle':
          if (forHit) ctx.fillRect(a.x,a.y,a.width,a.height);
          else {
            ctx.fillRect(a.x,a.y,a.width,a.height);
            ctx.strokeRect(a.x,a.y,a.width,a.height);
          }
          break;
        case 'circle':
          ctx.beginPath(); ctx.arc(a.x,a.y,a.radius,0,Math.PI*2);
          if (forHit) ctx.fill(); else { ctx.fill(); ctx.stroke(); }
          break;
        case 'ellipse':
          ctx.beginPath(); ctx.ellipse(a.x,a.y,a.radiusX,a.radiusY,a.rotation||0,0,Math.PI*2);
          if (forHit) ctx.fill(); else { ctx.fill(); ctx.stroke(); }
          break;
        case 'arrow':
          this._drawArrow(ctx, a, forHit);
          break;
        case 'freehand':
          if (!a.points || !a.points.length) break;
          ctx.beginPath();
          ctx.moveTo(a.points[0][0], a.points[0][1]);
          for (let i=1; i<a.points.length; i++) ctx.lineTo(a.points[i][0], a.points[i][1]);
          if (forHit) { ctx.lineWidth = Math.max(6, (a.lineWidth||2)+4); ctx.strokeStyle = ctx.fillStyle; }
          ctx.stroke();
          break;
        case 'measure':
          this._drawMeasure(ctx, a, forHit);
          break;
        case 'text':
          if (!a.content) break;
          const fs = a.fontSize || this.styles.fontSize;
          ctx.font = `400 ${fs}px ${a.fontFamily || this.styles.fontFamily}`;
          ctx.textBaseline = 'top';
          if (forHit) {
            const w = ctx.measureText(a.content).width;
            ctx.fillRect(a.x, a.y, w, fs*1.4);
          } else {
            ctx.fillStyle = a.strokeStyle || this.styles.strokeStyle;
            ctx.fillText(a.content, a.x, a.y);
          }
          break;
      }
      ctx.restore();
    }

    _drawArrow(ctx, a, forHit) {
      const { startX:x1, startY:y1, endX:x2, endY:y2 } = a;
      const size = a.arrowSize || this.styles.arrowSize;
      const angle = Math.atan2(y2-y1, x2-x1);
      ctx.beginPath();
      ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
      if (forHit) { ctx.lineWidth = Math.max(6, (a.lineWidth||2)+4); ctx.strokeStyle = ctx.fillStyle; }
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x2,y2);
      ctx.lineTo(x2 - size*Math.cos(angle - Math.PI/6), y2 - size*Math.sin(angle - Math.PI/6));
      ctx.lineTo(x2 - size*Math.cos(angle + Math.PI/6), y2 - size*Math.sin(angle + Math.PI/6));
      ctx.closePath();
      if (forHit) ctx.fill(); else ctx.fill();
    }

    _drawMeasure(ctx, a, forHit) {
      const { startX:x1, startY:y1, endX:x2, endY:y2 } = a;
      ctx.setLineDash([6, 4]);
      ctx.beginPath();
      ctx.moveTo(x1,y1); ctx.lineTo(x2,y2);
      if (forHit) { ctx.lineWidth = 8; ctx.strokeStyle = ctx.fillStyle; }
      ctx.stroke();
      ctx.setLineDash([]);
      if (!forHit) {
        const mx = (x1+x2)/2, my = (y1+y2)/2;
        const txt = `${a.measureValue ?? Math.hypot(x2-x1,y2-y1).toFixed(1)} ${a.measureUnit||this.styles.measureUnit}`;
        ctx.font = `${this.styles.fontSize}px ${this.styles.fontFamily}`;
        const w = ctx.measureText(txt).width;
        ctx.fillStyle = 'rgba(255,255,255,0.85)';
        ctx.fillRect(mx-w/2-4, my-10, w+8, 22);
        ctx.fillStyle = a.strokeStyle || this.styles.strokeStyle;
        ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
        ctx.fillText(txt, mx, my+1);
      }
    }

    _drawSelection(ctx, a) {
      let bx, by, bw, bh;
      switch (a.tool) {
        case 'rectangle': bx=a.x; by=a.y; bw=a.width; bh=a.height; break;
        case 'circle': bx=a.x-a.radius; by=a.y-a.radius; bw=bh=2*a.radius; break;
        case 'ellipse': bx=a.x-a.radiusX; by=a.y-a.radiusY; bw=2*a.radiusX; bh=2*a.radiusY; break;
        case 'arrow':
        case 'measure':
          bx = Math.min(a.startX,a.endX)-6; by=Math.min(a.startY,a.endY)-6;
          bw=Math.abs(a.endX-a.startX)+12; bh=Math.abs(a.endY-a.startY)+12;
          break;
        case 'freehand':
          if (!a.points?.length) return;
          const xs=a.points.map(p=>p[0]), ys=a.points.map(p=>p[1]);
          bx=Math.min(...xs)-4; by=Math.min(...ys)-4; bw=Math.max(...xs)-bx+8; bh=Math.max(...ys)-by+8;
          break;
        case 'text':
          ctx.font = `${a.fontSize||this.styles.fontSize}px ${a.fontFamily||this.styles.fontFamily}`;
          const w = ctx.measureText(a.content||'').width;
          const fs = a.fontSize||this.styles.fontSize;
          bx=a.x-4; by=a.y-4; bw=w+8; bh=fs*1.4+8;
          break;
        default: return;
      }
      ctx.save();
      ctx.setLineDash([4,3]);
      ctx.strokeStyle = '#165dff';
      ctx.lineWidth = 1.2;
      ctx.strokeRect(bx, by, bw, bh);
      ctx.setLineDash([]);
      const hs = 6;
      [[bx,by],[bx+bw,by],[bx,by+bh],[bx+bw,by+bh],[bx+bw/2,by],[bx+bw/2,by+bh],[bx,by+bh/2],[bx+bw,by+bh/2]].forEach(([x,y])=>{
        ctx.fillStyle = '#fff'; ctx.strokeStyle = '#165dff'; ctx.lineWidth=1;
        ctx.beginPath(); ctx.rect(x-hs/2,y-hs/2,hs,hs); ctx.fill(); ctx.stroke();
      });
      ctx.restore();
    }

    _pushHistory() {
      this.history.push(JSON.stringify(this.annotations));
      if (this.history.length > 200) this.history.shift();
      this.future = [];
    }

    undo() {
      if (!this.history.length) return;
      this.future.push(JSON.stringify(this.annotations));
      this.annotations = JSON.parse(this.history.pop());
      this.selectedId = null; this.render();
      this._onChange?.('undo');
    }

    redo() {
      if (!this.future.length) return;
      this.history.push(JSON.stringify(this.annotations));
      this.annotations = JSON.parse(this.future.pop());
      this.selectedId = null; this.render();
      this._onChange?.('redo');
    }

    deleteSelected() {
      if (!this.selectedId || this.opts.readOnly) return;
      const a = this.annotations.find(x=>x.id===this.selectedId);
      if (!a || a.locked) return;
      this._pushHistory();
      this.annotations = this.annotations.filter(x=>x.id!==this.selectedId);
      this.selectedId = null; this.render();
      this._onChange?.('delete', a);
    }

    clear() {
      if (!this.annotations.length || this.opts.readOnly) return;
      if (!confirm('确定清空所有标注？')) return;
      this._pushHistory();
      this.annotations = []; this.selectedId = null; this.render();
      this._onChange?.('clear');
    }

    setAnnotations(list) {
      this.annotations = Array.isArray(list)? list : [];
      this.selectedId = null; this.history = []; this.future = []; this.render();
    }

    getAnnotations() { return JSON.parse(JSON.stringify(this.annotations)); }

    exportJSON(pretty=true) {
      return JSON.stringify({
        imageId: this.opts.imageId, artifactId: this.opts.artifactId, appraisalId: this.opts.appraisalId,
        exportedAt: new Date().toISOString(), version: '1.0',
        count: this.annotations.length, annotations: this.annotations
      }, null, pretty? 2:0);
    }

    async saveAll(apiPrefix='/api/collab') {
      if (!this.annotations.length) return {count:0};
      const res = await fetch(`${apiPrefix}/annotations/batch`, {
        method:'POST', headers: {'Content-Type':'application/json'}, credentials:'include',
        body: JSON.stringify(this.annotations)
      });
      return await res.json();
    }

    onChange(cb) { this._onChange = cb; return this; }
    onSave(cb)   { this._onSave = cb;   return this; }

    setReadOnly(v) { this.opts.readOnly = !!v; this.canvas.style.cursor = v?'default':'crosshair'; this.render(); }
  }

  AnnotationCanvas.TOOLS = TOOLS;
  AnnotationCanvas.DEFAULTS = DEFAULTS;

  if (typeof define === 'function' && define.amd) define(()=>AnnotationCanvas);
  else if (typeof module !== 'undefined') module.exports = AnnotationCanvas;
  else global.AnnotationCanvas = AnnotationCanvas;
})(window);

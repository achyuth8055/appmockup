// Professional Multi-Device Mockup Editor
// High-quality rendering engine for production mockups

class MultiDeviceEditor {
    constructor() {
        this.canvas = document.getElementById('main-canvas');
        this.ctx = this.canvas.getContext('2d');
        this.overlay = document.getElementById('canvas-overlay');
        this.devices = [];
        this.selectedDevice = null;
        this.zoom = 1;
        this.pan = { x: 0, y: 0 };
        this.isDragging = false;
        this.dragStart = { x: 0, y: 0 };
        this.currentTool = 'select';
        this.undoStack = [];
        this.redoStack = [];
        this.quality = '4k';
        this.renderScale = 2; // For high-DPI rendering
        this.annotations = []; // Text overlays, shapes, arrows
        this.selectedAnnotation = null;
        this.isCreatingAnnotation = false;
        
        this.init();
    }

    init() {
        this.setupCanvas();
        this.loadDeviceData();
        this.setupEventListeners();
        this.setupUI();
        this.render();
    }

    setupCanvas() {
        // Setup high-DPI canvas for crisp rendering
        const rect = this.canvas.getBoundingClientRect();
        const dpr = window.devicePixelRatio || 1;
        
        this.canvas.width = rect.width * dpr * this.renderScale;
        this.canvas.height = rect.height * dpr * this.renderScale;
        this.canvas.style.width = rect.width + 'px';
        this.canvas.style.height = rect.height + 'px';
        
        this.ctx.scale(dpr * this.renderScale, dpr * this.renderScale);
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
    }

    async loadDeviceData() {
        try {
            // Load device data from existing JSON files
            const [deviceInfo, deviceModels, deviceTypes, brands] = await Promise.all([
                fetch('/scripts/device_info.json').then(r => r.json()),
                fetch('/scripts/device_model.json').then(r => r.json()),
                fetch('/scripts/device_type.json').then(r => r.json()),
                fetch('/scripts/brand.json').then(r => r.json())
            ]);

            this.deviceData = {
                info: deviceInfo,
                models: deviceModels,
                types: deviceTypes,
                brands: brands
            };

            this.populateDeviceGrid();
        } catch (error) {
            console.error('Failed to load device data:', error);
            this.showError('Failed to load device library');
        }
    }

    populateDeviceGrid() {
        const grid = document.getElementById('devices-grid');
        if (!grid || !this.deviceData) return;

        grid.innerHTML = '';

        // Group devices by type for better organization
        const devicesByType = {};
        Object.entries(this.deviceData.info).forEach(([key, device]) => {
            const type = device.type || 'other';
            if (!devicesByType[type]) devicesByType[type] = [];
            devicesByType[type].push({ key, ...device });
        });

        // Create device cards
        Object.entries(devicesByType).forEach(([type, devices]) => {
            if (devices.length === 0) return;

            const typeHeader = document.createElement('div');
            typeHeader.className = 'device-type-header';
            typeHeader.textContent = type.charAt(0).toUpperCase() + type.slice(1);
            grid.appendChild(typeHeader);

            devices.forEach(device => {
                const card = this.createDeviceCard(device);
                grid.appendChild(card);
            });
        });
    }

    createDeviceCard(device) {
        const card = document.createElement('div');
        card.className = 'device-card';
        card.dataset.deviceKey = device.key;
        
        const templatePath = `/images/mockup_templates/${device.key}.png`;
        
        card.innerHTML = `
            <div class="device-preview">
                <img src="${templatePath}" alt="${device.name}" 
                     onerror="this.src='/images/devices_picture/placeholder.png'">
            </div>
            <div class="device-info">
                <div class="device-name">${device.name}</div>
                <div class="device-brand">${device.brand || 'Unknown'}</div>
                <div class="device-resolution">${device.width}×${device.height}</div>
            </div>
            <button class="add-device-btn" data-device="${device.key}">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 13h-6v6h-2v-6H5v-2h6V5h2v6h6v2z"/>
                </svg>
                Add
            </button>
        `;

        // Add click handler
        card.addEventListener('click', (e) => {
            if (!e.target.closest('.add-device-btn')) {
                this.previewDevice(device);
            }
        });

        // Add device button handler
        const addBtn = card.querySelector('.add-device-btn');
        addBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.addDevice(device);
        });

        return card;
    }

    addDevice(deviceInfo) {
        const device = {
            id: `device_${Date.now()}`,
            info: deviceInfo,
            x: this.canvas.width / (2 * this.renderScale) - deviceInfo.width / 2,
            y: this.canvas.height / (2 * this.renderScale) - deviceInfo.height / 2,
            scale: 1,
            rotation: 0,
            perspective: 0,
            frameColor: '#000000',
            image: null,
            shadow: {
                enabled: true,
                intensity: 0.3,
                distance: 15,
                blur: 25
            }
        };

        this.devices.push(device);
        this.selectedDevice = device;
        this.hideEmptyState();
        this.updatePropertiesPanel();
        this.updateLayersList();
        this.saveState();
        this.render();
    }

    previewDevice(device) {
        // Show device preview in a tooltip or modal
        console.log('Previewing device:', device.name);
    }

    hideEmptyState() {
        const emptyState = document.getElementById('empty-state');
        if (emptyState) {
            emptyState.style.display = 'none';
        }
    }

    setupEventListeners() {
        // Canvas events
        this.canvas.addEventListener('mousedown', this.handleMouseDown.bind(this));
        this.canvas.addEventListener('mousemove', this.handleMouseMove.bind(this));
        this.canvas.addEventListener('mouseup', this.handleMouseUp.bind(this));
        this.canvas.addEventListener('wheel', this.handleWheel.bind(this));

        // Tool selection
        document.querySelectorAll('.tool-btn[data-tool]').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.selectTool(e.target.closest('.tool-btn').dataset.tool);
            });
        });

        // Zoom controls
        document.getElementById('zoom-in')?.addEventListener('click', () => this.zoomIn());
        document.getElementById('zoom-out')?.addEventListener('click', () => this.zoomOut());
        document.getElementById('zoom-fit')?.addEventListener('click', () => this.zoomToFit());

        // Quality selector
        document.getElementById('quality-selector')?.addEventListener('change', (e) => {
            this.quality = e.target.value;
            this.updateExportQuality();
        });

        // Background controls
        this.setupBackgroundControls();
        this.setupPropertyControls();
        this.setupExportModal();
        this.setupUploadModal();

        // Keyboard shortcuts
        document.addEventListener('keydown', this.handleKeyboard.bind(this));

        // Device search
        document.getElementById('device-search')?.addEventListener('input', this.handleDeviceSearch.bind(this));

        // Category tabs
        document.querySelectorAll('.tab-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                this.filterDevicesByCategory(e.target.dataset.category);
            });
        });
    }

    selectTool(tool) {
        this.currentTool = tool;
        document.querySelectorAll('.tool-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-tool="${tool}"]`)?.classList.add('active');
        
        // Update cursor
        this.canvas.style.cursor = this.getToolCursor(tool);
    }

    getToolCursor(tool) {
        const cursors = {
            select: 'default',
            move: 'move',
            resize: 'nw-resize',
            rotate: 'crosshair',
            text: 'text',
            shape: 'crosshair',
            arrow: 'crosshair'
        };
        return cursors[tool] || 'default';
    }

    handleMouseDown(e) {
        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoom - this.pan.x;
        const y = (e.clientY - rect.top) / this.zoom - this.pan.y;

        this.isDragging = true;
        this.dragStart = { x, y };

        // Handle different tools
        switch (this.currentTool) {
            case 'select':
            case 'move':
                this.handleSelectTool(x, y);
                break;
            case 'text':
                this.startTextAnnotation(x, y);
                break;
            case 'shape':
                this.startShapeAnnotation(x, y);
                break;
            case 'arrow':
                this.startArrowAnnotation(x, y);
                break;
            default:
                this.handleSelectTool(x, y);
        }

        this.render();
    }

    handleSelectTool(x, y) {
        // Check if clicking on an annotation first
        const hitAnnotation = this.getAnnotationAtPoint(x, y);
        if (hitAnnotation) {
            this.selectedAnnotation = hitAnnotation;
            this.selectedDevice = null;
            this.updatePropertiesPanel();
            return;
        }

        // Check if clicking on a device
        const hitDevice = this.getDeviceAtPoint(x, y);
        if (hitDevice) {
            this.selectedDevice = hitDevice;
            this.selectedAnnotation = null;
            this.updatePropertiesPanel();
        } else {
            this.selectedDevice = null;
            this.selectedAnnotation = null;
            this.updatePropertiesPanel();
        }
    }

    startTextAnnotation(x, y) {
        const text = prompt('Enter text:');
        if (text) {
            const annotation = {
                id: `text_${Date.now()}`,
                type: 'text',
                x: x,
                y: y,
                text: text,
                fontSize: 24,
                fontFamily: 'Arial',
                color: '#FFFFFF',
                backgroundColor: 'rgba(0,0,0,0.7)',
                padding: 12,
                borderRadius: 8
            };
            
            this.annotations.push(annotation);
            this.selectedAnnotation = annotation;
            this.updatePropertiesPanel();
            this.saveState();
        }
        this.isCreatingAnnotation = false;
    }

    startShapeAnnotation(x, y) {
        const annotation = {
            id: `shape_${Date.now()}`,
            type: 'rectangle',
            x: x,
            y: y,
            width: 100,
            height: 60,
            fillColor: 'rgba(37, 99, 235, 0.3)',
            strokeColor: '#2563EB',
            strokeWidth: 2,
            borderRadius: 8
        };
        
        this.annotations.push(annotation);
        this.selectedAnnotation = annotation;
        this.isCreatingAnnotation = true;
        this.updatePropertiesPanel();
    }

    startArrowAnnotation(x, y) {
        const annotation = {
            id: `arrow_${Date.now()}`,
            type: 'arrow',
            startX: x,
            startY: y,
            endX: x + 100,
            endY: y - 50,
            color: '#EF4444',
            strokeWidth: 3,
            arrowSize: 12
        };
        
        this.annotations.push(annotation);
        this.selectedAnnotation = annotation;
        this.isCreatingAnnotation = true;
        this.updatePropertiesPanel();
    }

    getAnnotationAtPoint(x, y) {
        // Check annotations in reverse order (top to bottom)
        for (let i = this.annotations.length - 1; i >= 0; i--) {
            const annotation = this.annotations[i];
            
            if (this.isPointInAnnotation(x, y, annotation)) {
                return annotation;
            }
        }
        return null;
    }

    isPointInAnnotation(x, y, annotation) {
        switch (annotation.type) {
            case 'text':
                // Approximate text bounds
                const textWidth = annotation.text.length * annotation.fontSize * 0.6;
                const textHeight = annotation.fontSize + annotation.padding * 2;
                return x >= annotation.x - annotation.padding && 
                       x <= annotation.x + textWidth + annotation.padding &&
                       y >= annotation.y - textHeight && 
                       y <= annotation.y + annotation.padding;
                       
            case 'rectangle':
            case 'circle':
                return x >= annotation.x && 
                       x <= annotation.x + annotation.width &&
                       y >= annotation.y && 
                       y <= annotation.y + annotation.height;
                       
            case 'arrow':
                // Simple proximity check for arrow
                const dist = Math.sqrt(
                    Math.pow(x - annotation.startX, 2) + Math.pow(y - annotation.startY, 2)
                );
                return dist < 20;
                
            default:
                return false;
        }
    }

    handleMouseMove(e) {
        if (!this.isDragging) return;

        const rect = this.canvas.getBoundingClientRect();
        const x = (e.clientX - rect.left) / this.zoom - this.pan.x;
        const y = (e.clientY - rect.top) / this.zoom - this.pan.y;

        if (this.selectedDevice && this.currentTool === 'move') {
            const dx = x - this.dragStart.x;
            const dy = y - this.dragStart.y;
            
            this.selectedDevice.x += dx;
            this.selectedDevice.y += dy;
            
            this.dragStart = { x, y };
            this.render();
        }
    }

    handleMouseUp(e) {
        if (this.isDragging && this.selectedDevice) {
            this.saveState();
        }
        this.isDragging = false;
    }

    handleWheel(e) {
        e.preventDefault();
        
        const rect = this.canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        
        const delta = e.deltaY > 0 ? 0.9 : 1.1;
        const newZoom = Math.max(0.1, Math.min(5, this.zoom * delta));
        
        // Zoom towards mouse position
        this.pan.x = x / this.zoom - x / newZoom + this.pan.x;
        this.pan.y = y / this.zoom - y / newZoom + this.pan.y;
        
        this.zoom = newZoom;
        this.updateZoomDisplay();
        this.render();
    }

    getDeviceAtPoint(x, y) {
        // Check devices in reverse order (top to bottom)
        for (let i = this.devices.length - 1; i >= 0; i--) {
            const device = this.devices[i];
            const bounds = this.getDeviceBounds(device);
            
            if (x >= bounds.x && x <= bounds.x + bounds.width &&
                y >= bounds.y && y <= bounds.y + bounds.height) {
                return device;
            }
        }
        return null;
    }

    getDeviceBounds(device) {
        const info = device.info;
        const width = info.width * device.scale;
        const height = info.height * device.scale;
        
        return {
            x: device.x - width / 2,
            y: device.y - height / 2,
            width: width,
            height: height
        };
    }

    render() {
        // Clear canvas
        this.ctx.clearRect(0, 0, this.canvas.width / this.renderScale, this.canvas.height / this.renderScale);
        
        // Render background
        this.renderBackground();
        
        // Apply zoom and pan
        this.ctx.save();
        this.ctx.scale(this.zoom, this.zoom);
        this.ctx.translate(this.pan.x, this.pan.y);
        
        // Render devices
        this.devices.forEach(device => {
            this.renderDevice(device);
        });
        
        // Render annotations
        this.annotations.forEach(annotation => {
            this.renderAnnotation(annotation);
        });
        
        // Render selection
        if (this.selectedDevice) {
            this.renderSelection(this.selectedDevice);
        }
        
        if (this.selectedAnnotation) {
            this.renderAnnotationSelection(this.selectedAnnotation);
        }
        
        this.ctx.restore();
    }

    renderAnnotation(annotation) {
        this.ctx.save();
        
        switch (annotation.type) {
            case 'text':
                this.renderTextAnnotation(annotation);
                break;
            case 'rectangle':
                this.renderRectangleAnnotation(annotation);
                break;
            case 'circle':
                this.renderCircleAnnotation(annotation);
                break;
            case 'arrow':
                this.renderArrowAnnotation(annotation);
                break;
        }
        
        this.ctx.restore();
    }

    renderTextAnnotation(annotation) {
        const { x, y, text, fontSize, fontFamily, color, backgroundColor, padding, borderRadius } = annotation;
        
        // Set font
        this.ctx.font = `${fontSize}px ${fontFamily}`;
        this.ctx.textAlign = 'left';
        this.ctx.textBaseline = 'top';
        
        // Measure text
        const textMetrics = this.ctx.measureText(text);
        const textWidth = textMetrics.width;
        const textHeight = fontSize;
        
        // Draw background
        if (backgroundColor && backgroundColor !== 'transparent') {
            this.ctx.fillStyle = backgroundColor;
            this.roundRect(
                x - padding, 
                y - padding, 
                textWidth + padding * 2, 
                textHeight + padding * 2, 
                borderRadius
            );
            this.ctx.fill();
        }
        
        // Draw text
        this.ctx.fillStyle = color;
        this.ctx.fillText(text, x, y);
    }

    renderRectangleAnnotation(annotation) {
        const { x, y, width, height, fillColor, strokeColor, strokeWidth, borderRadius } = annotation;
        
        // Draw fill
        if (fillColor && fillColor !== 'transparent') {
            this.ctx.fillStyle = fillColor;
            this.roundRect(x, y, width, height, borderRadius || 0);
            this.ctx.fill();
        }
        
        // Draw stroke
        if (strokeColor && strokeWidth > 0) {
            this.ctx.strokeStyle = strokeColor;
            this.ctx.lineWidth = strokeWidth;
            this.roundRect(x, y, width, height, borderRadius || 0);
            this.ctx.stroke();
        }
    }

    renderCircleAnnotation(annotation) {
        const { x, y, width, height, fillColor, strokeColor, strokeWidth } = annotation;
        
        const centerX = x + width / 2;
        const centerY = y + height / 2;
        const radius = Math.min(width, height) / 2;
        
        this.ctx.beginPath();
        this.ctx.arc(centerX, centerY, radius, 0, Math.PI * 2);
        
        // Draw fill
        if (fillColor && fillColor !== 'transparent') {
            this.ctx.fillStyle = fillColor;
            this.ctx.fill();
        }
        
        // Draw stroke
        if (strokeColor && strokeWidth > 0) {
            this.ctx.strokeStyle = strokeColor;
            this.ctx.lineWidth = strokeWidth;
            this.ctx.stroke();
        }
    }

    renderArrowAnnotation(annotation) {
        const { startX, startY, endX, endY, color, strokeWidth, arrowSize } = annotation;
        
        this.ctx.strokeStyle = color;
        this.ctx.fillStyle = color;
        this.ctx.lineWidth = strokeWidth;
        this.ctx.lineCap = 'round';
        
        // Draw arrow line
        this.ctx.beginPath();
        this.ctx.moveTo(startX, startY);
        this.ctx.lineTo(endX, endY);
        this.ctx.stroke();
        
        // Draw arrowhead
        const angle = Math.atan2(endY - startY, endX - startX);
        const arrowAngle = Math.PI / 6; // 30 degrees
        
        this.ctx.beginPath();
        this.ctx.moveTo(endX, endY);
        this.ctx.lineTo(
            endX - arrowSize * Math.cos(angle - arrowAngle),
            endY - arrowSize * Math.sin(angle - arrowAngle)
        );
        this.ctx.lineTo(
            endX - arrowSize * Math.cos(angle + arrowAngle),
            endY - arrowSize * Math.sin(angle + arrowAngle)
        );
        this.ctx.closePath();
        this.ctx.fill();
    }

    renderAnnotationSelection(annotation) {
        this.ctx.save();
        this.ctx.strokeStyle = '#10B981';
        this.ctx.lineWidth = 2 / this.zoom;
        this.ctx.setLineDash([5 / this.zoom, 5 / this.zoom]);
        
        let bounds;
        switch (annotation.type) {
            case 'text':
                const textWidth = annotation.text.length * annotation.fontSize * 0.6;
                const textHeight = annotation.fontSize + annotation.padding * 2;
                bounds = {
                    x: annotation.x - annotation.padding,
                    y: annotation.y - annotation.padding,
                    width: textWidth + annotation.padding * 2,
                    height: textHeight
                };
                break;
            case 'rectangle':
            case 'circle':
                bounds = {
                    x: annotation.x,
                    y: annotation.y,
                    width: annotation.width,
                    height: annotation.height
                };
                break;
            case 'arrow':
                const minX = Math.min(annotation.startX, annotation.endX) - 10;
                const minY = Math.min(annotation.startY, annotation.endY) - 10;
                const maxX = Math.max(annotation.startX, annotation.endX) + 10;
                const maxY = Math.max(annotation.startY, annotation.endY) + 10;
                bounds = {
                    x: minX,
                    y: minY,
                    width: maxX - minX,
                    height: maxY - minY
                };
                break;
        }
        
        if (bounds) {
            this.ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        }
        
        this.ctx.restore();
    }

    roundRect(x, y, width, height, radius) {
        if (radius === 0) {
            this.ctx.rect(x, y, width, height);
            return;
        }
        
        this.ctx.beginPath();
        this.ctx.moveTo(x + radius, y);
        this.ctx.lineTo(x + width - radius, y);
        this.ctx.quadraticCurveTo(x + width, y, x + width, y + radius);
        this.ctx.lineTo(x + width, y + height - radius);
        this.ctx.quadraticCurveTo(x + width, y + height, x + width - radius, y + height);
        this.ctx.lineTo(x + radius, y + height);
        this.ctx.quadraticCurveTo(x, y + height, x, y + height - radius);
        this.ctx.lineTo(x, y + radius);
        this.ctx.quadraticCurveTo(x, y, x + radius, y);
        this.ctx.closePath();
    }

    renderBackground() {
        const bgType = document.querySelector('.bg-type-btn.active')?.dataset.type || 'solid';
        
        switch (bgType) {
            case 'solid':
                this.renderSolidBackground();
                break;
            case 'gradient':
                this.renderGradientBackground();
                break;
            case 'image':
                this.renderImageBackground();
                break;
            case 'pattern':
                this.renderPatternBackground();
                break;
        }
    }

    renderSolidBackground() {
        const color = document.getElementById('bg-color')?.value || '#F5F5F5';
        this.ctx.fillStyle = color;
        this.ctx.fillRect(0, 0, this.canvas.width / this.renderScale, this.canvas.height / this.renderScale);
    }

    renderGradientBackground() {
        const startColor = document.getElementById('gradient-start')?.value || '#667eea';
        const endColor = document.getElementById('gradient-end')?.value || '#764ba2';
        const direction = document.getElementById('gradient-direction')?.value || 'to-bottom';
        
        const gradient = this.createGradient(startColor, endColor, direction);
        this.ctx.fillStyle = gradient;
        this.ctx.fillRect(0, 0, this.canvas.width / this.renderScale, this.canvas.height / this.renderScale);
    }

    createGradient(startColor, endColor, direction) {
        const width = this.canvas.width / this.renderScale;
        const height = this.canvas.height / this.renderScale;
        let gradient;
        
        switch (direction) {
            case 'to-right':
                gradient = this.ctx.createLinearGradient(0, 0, width, 0);
                break;
            case 'to-bottom-right':
                gradient = this.ctx.createLinearGradient(0, 0, width, height);
                break;
            case '45deg':
                gradient = this.ctx.createLinearGradient(0, height, width, 0);
                break;
            default: // to-bottom
                gradient = this.ctx.createLinearGradient(0, 0, 0, height);
        }
        
        gradient.addColorStop(0, startColor);
        gradient.addColorStop(1, endColor);
        return gradient;
    }

    renderImageBackground() {
        if (this.backgroundImage) {
            const canvasWidth = this.canvas.width / this.renderScale;
            const canvasHeight = this.canvas.height / this.renderScale;
            
            // Scale image to cover canvas
            const scaleX = canvasWidth / this.backgroundImage.width;
            const scaleY = canvasHeight / this.backgroundImage.height;
            const scale = Math.max(scaleX, scaleY);
            
            const scaledWidth = this.backgroundImage.width * scale;
            const scaledHeight = this.backgroundImage.height * scale;
            
            const x = (canvasWidth - scaledWidth) / 2;
            const y = (canvasHeight - scaledHeight) / 2;
            
            this.ctx.drawImage(this.backgroundImage, x, y, scaledWidth, scaledHeight);
        } else {
            // Fallback to solid color
            this.renderSolidBackground();
        }
    }

    renderPatternBackground() {
        const patternType = this.selectedPattern || 'dots';
        const patternColor = document.getElementById('pattern-color')?.value || '#E5E7EB';
        const backgroundColor = document.getElementById('pattern-bg-color')?.value || '#F8F9FA';
        
        // Fill with background color first
        this.ctx.fillStyle = backgroundColor;
        this.ctx.fillRect(0, 0, this.canvas.width / this.renderScale, this.canvas.height / this.renderScale);
        
        // Create pattern
        const pattern = this.createPattern(patternType, patternColor);
        if (pattern) {
            this.ctx.fillStyle = pattern;
            this.ctx.fillRect(0, 0, this.canvas.width / this.renderScale, this.canvas.height / this.renderScale);
        }
    }

    createPattern(type, color) {
        const patternCanvas = document.createElement('canvas');
        const patternCtx = patternCanvas.getContext('2d');
        
        switch (type) {
            case 'dots':
                return this.createDotsPattern(patternCanvas, patternCtx, color);
            case 'grid':
                return this.createGridPattern(patternCanvas, patternCtx, color);
            case 'diagonal':
                return this.createDiagonalPattern(patternCanvas, patternCtx, color);
            case 'hexagon':
                return this.createHexagonPattern(patternCanvas, patternCtx, color);
            default:
                return null;
        }
    }

    createDotsPattern(canvas, ctx, color) {
        canvas.width = 40;
        canvas.height = 40;
        
        ctx.fillStyle = color;
        ctx.beginPath();
        ctx.arc(20, 20, 3, 0, Math.PI * 2);
        ctx.fill();
        
        return this.ctx.createPattern(canvas, 'repeat');
    }

    createGridPattern(canvas, ctx, color) {
        canvas.width = 30;
        canvas.height = 30;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, 0);
        ctx.lineTo(30, 0);
        ctx.moveTo(0, 0);
        ctx.lineTo(0, 30);
        ctx.stroke();
        
        return this.ctx.createPattern(canvas, 'repeat');
    }

    createDiagonalPattern(canvas, ctx, color) {
        canvas.width = 20;
        canvas.height = 20;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.moveTo(0, 20);
        ctx.lineTo(20, 0);
        ctx.stroke();
        
        return this.ctx.createPattern(canvas, 'repeat');
    }

    createHexagonPattern(canvas, ctx, color) {
        canvas.width = 60;
        canvas.height = 52;
        
        ctx.strokeStyle = color;
        ctx.lineWidth = 1.5;
        
        // Draw hexagon
        const centerX = 30;
        const centerY = 26;
        const radius = 15;
        
        ctx.beginPath();
        for (let i = 0; i < 6; i++) {
            const angle = (i * Math.PI) / 3;
            const x = centerX + radius * Math.cos(angle);
            const y = centerY + radius * Math.sin(angle);
            
            if (i === 0) {
                ctx.moveTo(x, y);
            } else {
                ctx.lineTo(x, y);
            }
        }
        ctx.closePath();
        ctx.stroke();
        
        return this.ctx.createPattern(canvas, 'repeat');
    }

    async renderDevice(device) {
        const info = device.info;
        
        this.ctx.save();
        
        // Apply transformations
        this.ctx.translate(device.x, device.y);
        this.ctx.rotate(device.rotation * Math.PI / 180);
        
        // Apply 3D perspective transformation
        if (device.perspective > 0) {
            this.apply3DTransform(device.perspective, device.scale);
        } else {
            this.ctx.scale(device.scale, device.scale);
        }
        
        // Render shadow
        if (device.shadow.enabled) {
            this.renderDeviceShadow(device);
        }
        
        // Load and render device template with frame color
        try {
            const template = await this.loadDeviceTemplate(info.key);
            if (template) {
                // Apply frame color if not default black
                if (device.frameColor !== '#000000') {
                    this.renderDeviceWithFrameColor(template, info, device.frameColor);
                } else {
                    this.ctx.drawImage(template, -info.width / 2, -info.height / 2, info.width, info.height);
                }
            }
        } catch (error) {
            // Render placeholder if template fails to load
            this.renderDevicePlaceholder(info);
        }
        
        // Render user image if present
        if (device.image) {
            this.renderDeviceImage(device);
        }
        
        this.ctx.restore();
    }

    apply3DTransform(perspectiveAngle, scale) {
        // Create 3D perspective effect using 2D transformations
        const perspectiveRad = perspectiveAngle * Math.PI / 180;
        const perspectiveFactor = Math.cos(perspectiveRad);
        const skewFactor = Math.sin(perspectiveRad) * 0.3;
        
        // Apply perspective scaling
        this.ctx.scale(scale, scale * perspectiveFactor);
        
        // Apply skew for 3D effect
        this.ctx.transform(1, skewFactor, 0, 1, 0, 0);
        
        // Adjust brightness based on perspective angle
        const brightness = 1 - (perspectiveAngle / 60) * 0.3;
        this.ctx.globalAlpha *= brightness;
    }

    renderDeviceWithFrameColor(template, info, frameColor) {
        // Create a temporary canvas to apply frame color
        const tempCanvas = document.createElement('canvas');
        const tempCtx = tempCanvas.getContext('2d');
        tempCanvas.width = info.width;
        tempCanvas.height = info.height;
        
        // Draw original template
        tempCtx.drawImage(template, 0, 0, info.width, info.height);
        
        // Apply color overlay using multiply blend mode
        if (frameColor !== '#000000') {
            tempCtx.globalCompositeOperation = 'multiply';
            tempCtx.fillStyle = frameColor;
            tempCtx.fillRect(0, 0, info.width, info.height);
            
            // Restore original composite operation
            tempCtx.globalCompositeOperation = 'destination-over';
            tempCtx.drawImage(template, 0, 0, info.width, info.height);
        }
        
        // Draw the colored template to main canvas
        this.ctx.drawImage(tempCanvas, -info.width / 2, -info.height / 2, info.width, info.height);
    }

    renderDeviceShadow(device) {
        const shadow = device.shadow;
        const info = device.info;
        
        this.ctx.save();
        this.ctx.globalAlpha = shadow.intensity;
        this.ctx.fillStyle = '#000000';
        this.ctx.filter = `blur(${shadow.blur}px)`;
        
        this.ctx.fillRect(
            -info.width / 2 + shadow.distance,
            -info.height / 2 + shadow.distance,
            info.width,
            info.height
        );
        
        this.ctx.restore();
    }

    async loadDeviceTemplate(deviceKey) {
        return new Promise((resolve) => {
            if (this.templateCache && this.templateCache[deviceKey]) {
                resolve(this.templateCache[deviceKey]);
                return;
            }
            
            const img = new Image();
            img.onload = () => {
                if (!this.templateCache) this.templateCache = {};
                this.templateCache[deviceKey] = img;
                resolve(img);
            };
            img.onerror = () => resolve(null);
            img.src = `/images/mockup_templates/${deviceKey}.png`;
        });
    }

    renderDevicePlaceholder(info) {
        // Render a simple rectangle as placeholder
        this.ctx.fillStyle = '#E5E7EB';
        this.ctx.strokeStyle = '#9CA3AF';
        this.ctx.lineWidth = 2;
        
        this.ctx.fillRect(-info.width / 2, -info.height / 2, info.width, info.height);
        this.ctx.strokeRect(-info.width / 2, -info.height / 2, info.width, info.height);
        
        // Add device name
        this.ctx.fillStyle = '#6B7280';
        this.ctx.font = '14px -apple-system, BlinkMacSystemFont, sans-serif';
        this.ctx.textAlign = 'center';
        this.ctx.fillText(info.name, 0, 5);
    }

    renderDeviceImage(device) {
        if (!device.image || !device.info.screen) return;
        
        const screen = device.info.screen;
        const img = device.image;
        
        this.ctx.save();
        
        // Clip to screen area
        this.ctx.beginPath();
        this.ctx.rect(screen.x - device.info.width / 2, screen.y - device.info.height / 2, screen.width, screen.height);
        this.ctx.clip();
        
        // Calculate image scaling to fit screen
        const scaleX = screen.width / img.width;
        const scaleY = screen.height / img.height;
        const scale = Math.max(scaleX, scaleY); // Cover the screen
        
        const scaledWidth = img.width * scale;
        const scaledHeight = img.height * scale;
        
        // Center the image in the screen
        const x = screen.x - device.info.width / 2 + (screen.width - scaledWidth) / 2;
        const y = screen.y - device.info.height / 2 + (screen.height - scaledHeight) / 2;
        
        this.ctx.drawImage(img, x, y, scaledWidth, scaledHeight);
        
        this.ctx.restore();
    }

    renderSelection(device) {
        const bounds = this.getDeviceBounds(device);
        
        this.ctx.save();
        this.ctx.strokeStyle = '#2563EB';
        this.ctx.lineWidth = 2 / this.zoom;
        this.ctx.setLineDash([5 / this.zoom, 5 / this.zoom]);
        
        this.ctx.strokeRect(bounds.x, bounds.y, bounds.width, bounds.height);
        
        // Render resize handles
        this.renderResizeHandles(bounds);
        
        this.ctx.restore();
    }

    renderResizeHandles(bounds) {
        const handleSize = 8 / this.zoom;
        const handles = [
            { x: bounds.x - handleSize / 2, y: bounds.y - handleSize / 2 }, // Top-left
            { x: bounds.x + bounds.width - handleSize / 2, y: bounds.y - handleSize / 2 }, // Top-right
            { x: bounds.x - handleSize / 2, y: bounds.y + bounds.height - handleSize / 2 }, // Bottom-left
            { x: bounds.x + bounds.width - handleSize / 2, y: bounds.y + bounds.height - handleSize / 2 } // Bottom-right
        ];
        
        this.ctx.fillStyle = '#2563EB';
        this.ctx.strokeStyle = '#FFFFFF';
        this.ctx.lineWidth = 1 / this.zoom;
        this.ctx.setLineDash([]);
        
        handles.forEach(handle => {
            this.ctx.fillRect(handle.x, handle.y, handleSize, handleSize);
            this.ctx.strokeRect(handle.x, handle.y, handleSize, handleSize);
        });
    }

    // Property panel updates
    updatePropertiesPanel() {
        const deviceProps = document.getElementById('device-properties');
        if (this.selectedDevice) {
            deviceProps.style.display = 'block';
            this.populateDeviceProperties();
        } else {
            deviceProps.style.display = 'none';
        }
    }

    populateDeviceProperties() {
        if (!this.selectedDevice) return;
        
        const device = this.selectedDevice;
        
        // Update sliders and inputs
        this.updateSlider('device-rotation', device.rotation, '°');
        this.updateSlider('device-perspective', device.perspective, '°');
        this.updateSlider('device-scale', device.scale * 100, '%');
        
        document.getElementById('frame-color').value = device.frameColor;
        
        // Update shadow controls
        document.getElementById('enable-shadow').checked = device.shadow.enabled;
        this.updateSlider('shadow-intensity', device.shadow.intensity * 100, '%');
        this.updateSlider('shadow-distance', device.shadow.distance, 'px');
    }

    updateSlider(id, value, unit) {
        const slider = document.getElementById(id);
        const valueSpan = slider?.nextElementSibling;
        
        if (slider) slider.value = value;
        if (valueSpan) valueSpan.textContent = value + unit;
    }

    setupPropertyControls() {
        // Device property controls
        ['device-rotation', 'device-perspective', 'device-scale'].forEach(id => {
            const slider = document.getElementById(id);
            if (!slider) return;
            
            slider.addEventListener('input', (e) => {
                if (!this.selectedDevice) return;
                
                const value = parseFloat(e.target.value);
                const unit = e.target.nextElementSibling?.textContent.slice(-1) || '';
                
                switch (id) {
                    case 'device-rotation':
                        this.selectedDevice.rotation = value;
                        break;
                    case 'device-perspective':
                        this.selectedDevice.perspective = value;
                        break;
                    case 'device-scale':
                        this.selectedDevice.scale = value / 100;
                        break;
                }
                
                e.target.nextElementSibling.textContent = value + (unit === '%' ? '%' : unit === '°' ? '°' : 'px');
                this.render();
            });
        });

        // Shadow controls
        document.getElementById('enable-shadow')?.addEventListener('change', (e) => {
            if (this.selectedDevice) {
                this.selectedDevice.shadow.enabled = e.target.checked;
                document.getElementById('shadow-controls').style.display = e.target.checked ? 'block' : 'none';
                this.render();
            }
        });

        ['shadow-intensity', 'shadow-distance'].forEach(id => {
            const slider = document.getElementById(id);
            if (!slider) return;
            
            slider.addEventListener('input', (e) => {
                if (!this.selectedDevice) return;
                
                const value = parseFloat(e.target.value);
                
                switch (id) {
                    case 'shadow-intensity':
                        this.selectedDevice.shadow.intensity = value / 100;
                        e.target.nextElementSibling.textContent = value + '%';
                        break;
                    case 'shadow-distance':
                        this.selectedDevice.shadow.distance = value;
                        e.target.nextElementSibling.textContent = value + 'px';
                        break;
                }
                
                this.render();
            });
        });
    }

    setupBackgroundControls() {
        // Background type buttons
        document.querySelectorAll('.bg-type-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.bg-type-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                
                // Show/hide relevant controls
                document.querySelectorAll('.bg-controls').forEach(control => {
                    control.style.display = 'none';
                });
                
                const type = e.target.dataset.type;
                const controls = document.getElementById(`${type}-controls`);
                if (controls) controls.style.display = 'block';
                
                this.render();
            });
        });

        // Background color
        document.getElementById('bg-color')?.addEventListener('input', () => {
            this.render();
        });

        // Background image upload
        document.getElementById('upload-bg-image')?.addEventListener('click', () => {
            this.currentUploadContext = 'background';
            document.getElementById('upload-modal').style.display = 'flex';
        });

        // Pattern controls
        document.querySelectorAll('.pattern-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                document.querySelectorAll('.pattern-btn').forEach(b => b.classList.remove('active'));
                e.target.classList.add('active');
                this.selectedPattern = e.target.dataset.pattern;
                this.render();
            });
        });

        ['pattern-color', 'pattern-bg-color'].forEach(id => {
            document.getElementById(id)?.addEventListener('input', () => {
                this.render();
            });
        });
    }

    setupExportModal() {
        const exportBtn = document.getElementById('export-btn');
        const exportModal = document.getElementById('export-modal');
        const exportClose = document.getElementById('export-modal-close');
        const exportCancel = document.getElementById('export-cancel');
        const exportConfirm = document.getElementById('export-confirm');

        exportBtn?.addEventListener('click', () => {
            exportModal.style.display = 'flex';
        });

        [exportClose, exportCancel].forEach(btn => {
            btn?.addEventListener('click', () => {
                exportModal.style.display = 'none';
            });
        });

        exportConfirm?.addEventListener('click', () => {
            this.exportMockup();
            exportModal.style.display = 'none';
        });

        // Close on outside click
        exportModal?.addEventListener('click', (e) => {
            if (e.target === exportModal) {
                exportModal.style.display = 'none';
            }
        });
    }

    setupUploadModal() {
        const uploadArea = document.getElementById('upload-area');
        const fileInput = document.getElementById('file-input');
        const uploadModal = document.getElementById('upload-modal');
        const modalClose = document.getElementById('modal-close');

        // Open upload modal when clicking add first device
        document.getElementById('add-first-device')?.addEventListener('click', () => {
            if (this.devices.length === 0) {
                // Show device library instead
                this.filterDevicesByCategory('phone');
            }
        });

        uploadArea?.addEventListener('click', () => {
            fileInput?.click();
        });

        fileInput?.addEventListener('change', (e) => {
            this.handleFileUpload(e.target.files);
        });

        // Drag and drop
        uploadArea?.addEventListener('dragover', (e) => {
            e.preventDefault();
            uploadArea.classList.add('drag-over');
        });

        uploadArea?.addEventListener('dragleave', () => {
            uploadArea.classList.remove('drag-over');
        });

        uploadArea?.addEventListener('drop', (e) => {
            e.preventDefault();
            uploadArea.classList.remove('drag-over');
            this.handleFileUpload(e.dataTransfer.files);
        });

        modalClose?.addEventListener('click', () => {
            uploadModal.style.display = 'none';
        });
    }

    async handleFileUpload(files) {
        if (!files || files.length === 0) return;

        const uploadProgress = document.getElementById('upload-progress');
        const progressFill = document.getElementById('progress-fill');
        const progressText = document.getElementById('progress-text');

        // Show progress for multiple files
        if (files.length > 1) {
            uploadProgress.style.display = 'block';
        }

        try {
            for (let i = 0; i < files.length; i++) {
                const file = files[i];
                
                if (!file.type.startsWith('image/')) {
                    this.showError(`Skipping ${file.name}: Not an image file`);
                    continue;
                }

                // Update progress
                if (files.length > 1) {
                    const progress = ((i + 1) / files.length) * 100;
                    progressFill.style.width = progress + '%';
                    progressText.textContent = `Processing ${i + 1}/${files.length} images... ${Math.round(progress)}%`;
                }

                // Optimize and process image
                const optimizedImage = await this.optimizeImage(file);
                
                if (this.selectedDevice) {
                    // Add to selected device
                    this.selectedDevice.image = optimizedImage;
                } else if (this.currentUploadContext === 'background') {
                    // Set as background image
                    this.backgroundImage = optimizedImage;
                    // Switch to image background
                    document.querySelector('[data-type="image"]')?.click();
                } else {
                    // Auto-add device if none selected
                    if (this.devices.length === 0) {
                        // Add default phone if no devices
                        const defaultDevice = this.getDefaultDevice();
                        if (defaultDevice) {
                            await this.addDevice(defaultDevice);
                        }
                    }
                    
                    if (this.selectedDevice) {
                        this.selectedDevice.image = optimizedImage;
                    }
                }
            }

            this.render();
            this.saveState();
            
            // Hide progress and close modal
            uploadProgress.style.display = 'none';
            document.getElementById('upload-modal').style.display = 'none';
            
        } catch (error) {
            this.showError('Failed to process images: ' + error.message);
            uploadProgress.style.display = 'none';
        }
    }

    async optimizeImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => {
                // Create canvas for optimization
                const canvas = document.createElement('canvas');
                const ctx = canvas.getContext('2d');
                
                // Calculate optimal size (max 2048px on longest side)
                const maxSize = 2048;
                let { width, height } = img;
                
                if (width > maxSize || height > maxSize) {
                    const ratio = Math.min(maxSize / width, maxSize / height);
                    width *= ratio;
                    height *= ratio;
                }
                
                canvas.width = width;
                canvas.height = height;
                
                // Enable high-quality scaling
                ctx.imageSmoothingEnabled = true;
                ctx.imageSmoothingQuality = 'high';
                
                // Draw optimized image
                ctx.drawImage(img, 0, 0, width, height);
                
                // Convert back to image
                canvas.toBlob((blob) => {
                    const optimizedImg = new Image();
                    optimizedImg.onload = () => {
                        // Add metadata
                        optimizedImg.originalName = file.name;
                        optimizedImg.originalSize = file.size;
                        optimizedImg.optimizedSize = blob.size;
                        resolve(optimizedImg);
                    };
                    optimizedImg.src = URL.createObjectURL(blob);
                }, 'image/jpeg', 0.9);
            };
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    getDefaultDevice() {
        // Find iPhone 15 or similar popular device
        if (this.deviceData?.info) {
            const deviceKeys = Object.keys(this.deviceData.info);
            
            // Priority order for auto-selection
            const preferredDevices = [
                'iphone-15',
                'iphone-15-pro',
                'iphone-14',
                'galaxy-s24',
                'pixel-8'
            ];
            
            for (const preferred of preferredDevices) {
                const found = deviceKeys.find(key => key.includes(preferred.replace('-', '_')));
                if (found) {
                    return { key: found, ...this.deviceData.info[found] };
                }
            }
            
            // Fallback to first phone device
            const phoneDevice = deviceKeys.find(key => {
                const device = this.deviceData.info[key];
                return device.type === 'phone' || device.type === 'mobile';
            });
            
            if (phoneDevice) {
                return { key: phoneDevice, ...this.deviceData.info[phoneDevice] };
            }
        }
        
        return null;
    }

    loadImage(file) {
        return new Promise((resolve, reject) => {
            const img = new Image();
            img.onload = () => resolve(img);
            img.onerror = reject;
            img.src = URL.createObjectURL(file);
        });
    }

    async exportMockup() {
        const format = document.getElementById('export-format')?.value || 'png';
        const quality = document.getElementById('export-quality')?.value || '4k';
        const transparentBg = document.getElementById('transparent-bg')?.checked || false;
        const includeShadows = document.getElementById('include-shadows')?.checked || true;

        // Create high-resolution export canvas
        const exportCanvas = document.createElement('canvas');
        const exportCtx = exportCanvas.getContext('2d');

        // Set export dimensions based on quality
        const dimensions = this.getExportDimensions(quality);
        exportCanvas.width = dimensions.width;
        exportCanvas.height = dimensions.height;

        // Setup high-quality rendering
        exportCtx.imageSmoothingEnabled = true;
        exportCtx.imageSmoothingQuality = 'high';

        // Calculate scale for export
        const scaleX = dimensions.width / (this.canvas.width / this.renderScale);
        const scaleY = dimensions.height / (this.canvas.height / this.renderScale);
        exportCtx.scale(scaleX, scaleY);

        // Render background (unless transparent)
        if (!transparentBg) {
            this.renderBackgroundToCanvas(exportCtx);
        }

        // Render devices
        for (const device of this.devices) {
            await this.renderDeviceToCanvas(exportCtx, device, includeShadows);
        }

        // Export the image
        this.downloadCanvas(exportCanvas, format, quality);
    }

    getExportDimensions(quality) {
        const dimensions = {
            'hd': { width: 1920, height: 1080 },
            'fhd': { width: 2560, height: 1440 },
            '4k': { width: 3840, height: 2160 },
            '8k': { width: 7680, height: 4320 }
        };
        return dimensions[quality] || dimensions['4k'];
    }

    renderBackgroundToCanvas(ctx) {
        const bgType = document.querySelector('.bg-type-btn.active')?.dataset.type || 'solid';
        
        ctx.save();
        
        switch (bgType) {
            case 'solid':
                const color = document.getElementById('bg-color')?.value || '#F5F5F5';
                ctx.fillStyle = color;
                ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                break;
            case 'gradient':
                const startColor = document.getElementById('gradient-start')?.value || '#667eea';
                const endColor = document.getElementById('gradient-end')?.value || '#764ba2';
                const direction = document.getElementById('gradient-direction')?.value || 'to-bottom';
                
                const gradient = this.createGradientForCanvas(ctx, startColor, endColor, direction);
                ctx.fillStyle = gradient;
                ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
                break;
        }
        
        ctx.restore();
    }

    createGradientForCanvas(ctx, startColor, endColor, direction) {
        const width = ctx.canvas.width;
        const height = ctx.canvas.height;
        let gradient;
        
        switch (direction) {
            case 'to-right':
                gradient = ctx.createLinearGradient(0, 0, width, 0);
                break;
            case 'to-bottom-right':
                gradient = ctx.createLinearGradient(0, 0, width, height);
                break;
            case '45deg':
                gradient = ctx.createLinearGradient(0, height, width, 0);
                break;
            default: // to-bottom
                gradient = ctx.createLinearGradient(0, 0, 0, height);
        }
        
        gradient.addColorStop(0, startColor);
        gradient.addColorStop(1, endColor);
        return gradient;
    }

    async renderDeviceToCanvas(ctx, device, includeShadows) {
        const info = device.info;
        
        ctx.save();
        
        // Apply transformations
        ctx.translate(device.x, device.y);
        ctx.rotate(device.rotation * Math.PI / 180);
        ctx.scale(device.scale, device.scale);
        
        // Render shadow
        if (includeShadows && device.shadow.enabled) {
            ctx.save();
            ctx.globalAlpha = device.shadow.intensity;
            ctx.fillStyle = '#000000';
            ctx.filter = `blur(${device.shadow.blur}px)`;
            
            ctx.fillRect(
                -info.width / 2 + device.shadow.distance,
                -info.height / 2 + device.shadow.distance,
                info.width,
                info.height
            );
            
            ctx.restore();
        }
        
        // Load and render device template
        try {
            const template = await this.loadDeviceTemplate(info.key);
            if (template) {
                ctx.drawImage(template, -info.width / 2, -info.height / 2, info.width, info.height);
            }
        } catch (error) {
            console.warn('Failed to load device template for export:', error);
        }
        
        // Render user image if present
        if (device.image && info.screen) {
            const screen = info.screen;
            
            ctx.save();
            
            // Clip to screen area
            ctx.beginPath();
            ctx.rect(screen.x - info.width / 2, screen.y - info.height / 2, screen.width, screen.height);
            ctx.clip();
            
            // Calculate image scaling
            const scaleX = screen.width / device.image.width;
            const scaleY = screen.height / device.image.height;
            const scale = Math.max(scaleX, scaleY);
            
            const scaledWidth = device.image.width * scale;
            const scaledHeight = device.image.height * scale;
            
            const x = screen.x - info.width / 2 + (screen.width - scaledWidth) / 2;
            const y = screen.y - info.height / 2 + (screen.height - scaledHeight) / 2;
            
            ctx.drawImage(device.image, x, y, scaledWidth, scaledHeight);
            
            ctx.restore();
        }
        
        ctx.restore();
    }

    downloadCanvas(canvas, format, quality) {
        const mimeType = {
            'png': 'image/png',
            'jpg': 'image/jpeg',
            'webp': 'image/webp',
            'svg': 'image/svg+xml'
        }[format] || 'image/png';

        canvas.toBlob((blob) => {
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `mockup_${quality}_${Date.now()}.${format}`;
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
            URL.revokeObjectURL(url);
        }, mimeType, format === 'jpg' ? 0.95 : undefined);
    }

    // Zoom controls
    zoomIn() {
        this.zoom = Math.min(5, this.zoom * 1.2);
        this.updateZoomDisplay();
        this.render();
    }

    zoomOut() {
        this.zoom = Math.max(0.1, this.zoom / 1.2);
        this.updateZoomDisplay();
        this.render();
    }

    zoomToFit() {
        if (this.devices.length === 0) {
            this.zoom = 1;
            this.pan = { x: 0, y: 0 };
        } else {
            // Calculate bounds of all devices
            const bounds = this.calculateDevicesBounds();
            const canvasWidth = this.canvas.width / this.renderScale;
            const canvasHeight = this.canvas.height / this.renderScale;
            
            const scaleX = (canvasWidth * 0.8) / bounds.width;
            const scaleY = (canvasHeight * 0.8) / bounds.height;
            this.zoom = Math.min(scaleX, scaleY, 2);
            
            this.pan.x = -bounds.centerX + canvasWidth / 2;
            this.pan.y = -bounds.centerY + canvasHeight / 2;
        }
        
        this.updateZoomDisplay();
        this.render();
    }

    calculateDevicesBounds() {
        if (this.devices.length === 0) return { width: 0, height: 0, centerX: 0, centerY: 0 };
        
        let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
        
        this.devices.forEach(device => {
            const bounds = this.getDeviceBounds(device);
            minX = Math.min(minX, bounds.x);
            minY = Math.min(minY, bounds.y);
            maxX = Math.max(maxX, bounds.x + bounds.width);
            maxY = Math.max(maxY, bounds.y + bounds.height);
        });
        
        return {
            width: maxX - minX,
            height: maxY - minY,
            centerX: (minX + maxX) / 2,
            centerY: (minY + maxY) / 2
        };
    }

    updateZoomDisplay() {
        const zoomLevel = document.getElementById('zoom-level');
        if (zoomLevel) {
            zoomLevel.textContent = Math.round(this.zoom * 100) + '%';
        }
    }

    // State management
    saveState() {
        const state = {
            devices: JSON.parse(JSON.stringify(this.devices)),
            zoom: this.zoom,
            pan: { ...this.pan }
        };
        
        this.undoStack.push(state);
        if (this.undoStack.length > 50) {
            this.undoStack.shift();
        }
        
        this.redoStack = []; // Clear redo stack
        this.updateUndoRedoButtons();
    }

    undo() {
        if (this.undoStack.length === 0) return;
        
        const currentState = {
            devices: JSON.parse(JSON.stringify(this.devices)),
            zoom: this.zoom,
            pan: { ...this.pan }
        };
        
        this.redoStack.push(currentState);
        
        const previousState = this.undoStack.pop();
        this.restoreState(previousState);
        this.updateUndoRedoButtons();
    }

    redo() {
        if (this.redoStack.length === 0) return;
        
        const currentState = {
            devices: JSON.parse(JSON.stringify(this.devices)),
            zoom: this.zoom,
            pan: { ...this.pan }
        };
        
        this.undoStack.push(currentState);
        
        const nextState = this.redoStack.pop();
        this.restoreState(nextState);
        this.updateUndoRedoButtons();
    }

    restoreState(state) {
        this.devices = state.devices;
        this.zoom = state.zoom;
        this.pan = state.pan;
        this.selectedDevice = null;
        this.updateZoomDisplay();
        this.updatePropertiesPanel();
        this.updateLayersList();
        this.render();
    }

    updateUndoRedoButtons() {
        const undoBtn = document.querySelector('[data-tool="undo"]');
        const redoBtn = document.querySelector('[data-tool="redo"]');
        
        if (undoBtn) undoBtn.disabled = this.undoStack.length === 0;
        if (redoBtn) redoBtn.disabled = this.redoStack.length === 0;
    }

    // Layer management
    updateLayersList() {
        const layersList = document.getElementById('layers-list');
        if (!layersList) return;
        
        layersList.innerHTML = `
            <div class="layer-item">
                <span class="layer-icon">🖼️</span>
                <span class="layer-name">Background</span>
                <div class="layer-actions">
                    <button class="layer-btn" title="Toggle Visibility">👁️</button>
                    <button class="layer-btn" title="Lock Layer">🔒</button>
                </div>
            </div>
        `;
        
        this.devices.forEach((device, index) => {
            const layerItem = document.createElement('div');
            layerItem.className = 'layer-item';
            layerItem.innerHTML = `
                <span class="layer-icon">📱</span>
                <span class="layer-name">${device.info.name}</span>
                <div class="layer-actions">
                    <button class="layer-btn" title="Toggle Visibility">👁️</button>
                    <button class="layer-btn" title="Lock Layer">🔒</button>
                    <button class="layer-btn" title="Delete Layer">🗑️</button>
                </div>
            `;
            
            layerItem.addEventListener('click', () => {
                this.selectedDevice = device;
                this.updatePropertiesPanel();
                this.render();
            });
            
            layersList.appendChild(layerItem);
        });
    }

    // Device filtering and search
    filterDevicesByCategory(category) {
        document.querySelectorAll('.tab-btn').forEach(btn => btn.classList.remove('active'));
        document.querySelector(`[data-category="${category}"]`)?.classList.add('active');
        
        const cards = document.querySelectorAll('.device-card');
        cards.forEach(card => {
            const deviceKey = card.dataset.deviceKey;
            const deviceInfo = this.deviceData?.info[deviceKey];
            
            if (!deviceInfo) {
                card.style.display = 'none';
                return;
            }
            
            const deviceType = deviceInfo.type || 'other';
            const shouldShow = category === 'all' || deviceType === category;
            card.style.display = shouldShow ? 'block' : 'none';
        });
    }

    handleDeviceSearch(e) {
        const query = e.target.value.toLowerCase();
        const cards = document.querySelectorAll('.device-card');
        
        cards.forEach(card => {
            const deviceKey = card.dataset.deviceKey;
            const deviceInfo = this.deviceData?.info[deviceKey];
            
            if (!deviceInfo) {
                card.style.display = 'none';
                return;
            }
            
            const searchText = [
                deviceInfo.name,
                deviceInfo.brand,
                deviceInfo.type
            ].join(' ').toLowerCase();
            
            const matches = searchText.includes(query);
            card.style.display = matches ? 'block' : 'none';
        });
    }

    // Keyboard shortcuts
    handleKeyboard(e) {
        if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return;
        
        const isCmd = e.metaKey || e.ctrlKey;
        
        if (isCmd && e.key === 'z' && !e.shiftKey) {
            e.preventDefault();
            this.undo();
        } else if (isCmd && (e.key === 'Z' || (e.key === 'z' && e.shiftKey))) {
            e.preventDefault();
            this.redo();
        } else if (e.key === 'Delete' || e.key === 'Backspace') {
            if (this.selectedDevice) {
                this.deleteSelectedDevice();
            }
        } else if (e.key === 'Escape') {
            this.selectedDevice = null;
            this.updatePropertiesPanel();
            this.render();
        }
    }

    deleteSelectedDevice() {
        if (!this.selectedDevice) return;
        
        const index = this.devices.indexOf(this.selectedDevice);
        if (index > -1) {
            this.devices.splice(index, 1);
            this.selectedDevice = null;
            this.updatePropertiesPanel();
            this.updateLayersList();
            this.saveState();
            this.render();
            
            if (this.devices.length === 0) {
                document.getElementById('empty-state').style.display = 'block';
            }
        }
    }

    // Utility methods
    setupUI() {
        // Add CSS for device cards
        const style = document.createElement('style');
        style.textContent = `
            .device-type-header {
                font-size: 12px;
                font-weight: 600;
                color: #6B7280;
                margin: 16px 0 8px 0;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
            
            .device-card {
                background: white;
                border: 1px solid #E5E7EB;
                border-radius: 8px;
                padding: 12px;
                margin-bottom: 8px;
                cursor: pointer;
                transition: all 0.2s;
                position: relative;
            }
            
            .device-card:hover {
                border-color: #2563EB;
                box-shadow: 0 2px 8px rgba(37, 99, 235, 0.1);
            }
            
            .device-preview {
                text-align: center;
                margin-bottom: 8px;
            }
            
            .device-preview img {
                max-width: 60px;
                max-height: 60px;
                object-fit: contain;
            }
            
            .device-info {
                text-align: center;
            }
            
            .device-name {
                font-size: 13px;
                font-weight: 500;
                color: #1F2937;
                margin-bottom: 2px;
            }
            
            .device-brand {
                font-size: 11px;
                color: #6B7280;
                margin-bottom: 2px;
            }
            
            .device-resolution {
                font-size: 10px;
                color: #9CA3AF;
            }
            
            .add-device-btn {
                position: absolute;
                top: 8px;
                right: 8px;
                background: #2563EB;
                color: white;
                border: none;
                border-radius: 4px;
                padding: 4px 6px;
                font-size: 10px;
                cursor: pointer;
                display: flex;
                align-items: center;
                gap: 2px;
                opacity: 0;
                transition: opacity 0.2s;
            }
            
            .device-card:hover .add-device-btn {
                opacity: 1;
            }
            
            .upload-area.drag-over {
                border-color: #2563EB;
                background: #F0F4FF;
            }
        `;
        document.head.appendChild(style);
    }

    updateExportQuality() {
        const exportBtn = document.getElementById('export-btn');
        if (exportBtn) {
            const qualityText = {
                'hd': 'Export HD',
                '4k': 'Export 4K',
                '8k': 'Export 8K',
                'vector': 'Export Vector'
            };
            
            exportBtn.innerHTML = `
                <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M19 9h-4V3H9v6H5l7 7 7-7zM5 18v2h14v-2H5z"/>
                </svg>
                ${qualityText[this.quality] || 'Export HD'}
            `;
        }
    }

    showError(message) {
        // Simple error display - could be enhanced with a proper notification system
        console.error(message);
        alert(message);
    }
}

// Initialize the editor when the page loads
document.addEventListener('DOMContentLoaded', () => {
    new MultiDeviceEditor();
});
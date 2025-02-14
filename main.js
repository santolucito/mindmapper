const canvas = document.getElementById('mindMap');
const ctx = canvas.getContext('2d');

canvas.width = window.innerWidth * 0.8;  // 80% of window width
canvas.height = window.innerHeight * 0.8; // 80% of window height

let nodes = [];
let connections = [];
let isConnecting = false;
let selectedNode = null;
let isDragging = false;
let draggedNode = null;
let regions = [];
let isCreatingRegion = false;
let regionStart = null;
let currentRegion = null;
let draggedRegion = null;
let resizingRegion = null;
let lastMouseX = 0;
let lastMouseY = 0;
let activeFilter = 'all';
let fontSize = 14; // Default font size

class ModalHandler {
    constructor() {
        this.modal = document.getElementById('renameModal');
        this.input = document.getElementById('renameInput');
        this.confirmBtn = document.getElementById('confirmRename');
        this.cancelBtn = document.getElementById('cancelRename');
        this.deleteBtn = document.getElementById('deleteRename');
    }

    show(options = {}) {
        const {
            initialValue = '',
            placeholder = '',
            onConfirm,
            onCancel,
            onDelete,
            showDelete = true
        } = options;

        this.input.value = initialValue;
        this.input.placeholder = placeholder;
        this.modal.style.display = 'block';
        this.deleteBtn.style.display = showDelete ? 'block' : 'none';

        const cleanup = () => {
            this.confirmBtn.removeEventListener('click', handleConfirm);
            this.cancelBtn.removeEventListener('click', handleCancel);
            this.deleteBtn.removeEventListener('click', handleDelete);
            this.input.removeEventListener('keypress', handleKeyPress);
            this.modal.style.display = 'none';
        };

        const handleConfirm = () => {
            const value = this.input.value.trim();
            if (value && onConfirm) {
                onConfirm(value);
            }
            cleanup();
        };

        const handleCancel = () => {
            if (onCancel) onCancel();
            cleanup();
        };

        const handleDelete = () => {
            if (onDelete) onDelete();
            cleanup();
        };

        const handleKeyPress = (e) => {
            if (e.key === 'Enter') handleConfirm();
            else if (e.key === 'Escape') handleCancel();
        };

        this.confirmBtn.addEventListener('click', handleConfirm);
        this.cancelBtn.addEventListener('click', handleCancel);
        this.deleteBtn.addEventListener('click', handleDelete);
        this.input.addEventListener('keypress', handleKeyPress);

        this.input.focus();
        this.input.select();
    }
}

const modalHandler = new ModalHandler();

class Node {
    constructor(x, y, type) {
        this.id = Math.random().toString(36).substr(2, 9); // Generate unique ID
        this.x = x;
        this.y = y;
        this.radius = 30;
        this.type = type; // 'team' or 'project'
        this.label = type === 'team' ? 'New Team Member' : 'New Project'; // Default labels
        this.color = type === 'team' ? '#87CEEB' : '#98FB98';
        this.notes = ''; // Add notes property
    }

    draw() {
        ctx.beginPath();
        ctx.arc(this.x, this.y, this.radius, 0, Math.PI * 2);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.stroke();

        // Update text drawing with font size and handle newlines
        ctx.fillStyle = '#000';
        ctx.font = `${fontSize}px Arial`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';

        // Split text into lines
        const lines = this.label.split('\\n');
        console.log('Lines:', lines);
        const lineHeight = fontSize * 1.2; // Add some spacing between lines
        const totalHeight = lineHeight * (lines.length - 1);

        // Draw each line, centered vertically
        lines.forEach((line, index) => {
            const yOffset = (index - (lines.length - 1) / 2) * lineHeight;
            ctx.fillText(line, this.x, this.y + yOffset);
        });
    }

    isClicked(x, y) {
        return Math.sqrt((x - this.x) ** 2 + (y - this.y) ** 2) <= this.radius;
    }

    rename() {
        const modal = document.getElementById('renameModal');
        const input = document.getElementById('renameInput');
        const confirmBtn = document.getElementById('confirmRename');
        const cancelBtn = document.getElementById('cancelRename');
        const deleteBtn = document.getElementById('deleteRename');

        input.value = this.label;
        modal.style.display = 'block';

        const handleRename = () => {
            const newLabel = input.value.trim();
            if (newLabel) {
                this.label = newLabel;
                drawMindMap();
            }
            modal.style.display = 'none';
            cleanup();
        };

        const handleDelete = () => {
            nodes = nodes.filter(n => n !== this);
            connections = connections.filter(conn =>
                conn.from !== this && conn.to !== this
            );
            modal.style.display = 'none';
            drawMindMap();
            cleanup();
        };

        const handleCancel = () => {
            modal.style.display = 'none';
            cleanup();
        };

        const handleKeyPress = (e) => {
            if (e.key === 'Enter') {
                handleRename();
            } else if (e.key === 'Escape') {
                handleCancel();
            }
        };

        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleRename);
            cancelBtn.removeEventListener('click', handleCancel);
            deleteBtn.removeEventListener('click', handleDelete);
            input.removeEventListener('keypress', handleKeyPress);
        };

        confirmBtn.addEventListener('click', handleRename);
        cancelBtn.addEventListener('click', handleCancel);
        deleteBtn.addEventListener('click', handleDelete);
        input.addEventListener('keypress', handleKeyPress);

        input.focus();
        input.select();
    }
}

class Region {
    constructor(x, y, width, height, label = null) {
        this.x = x;
        this.y = y;
        this.width = width;
        this.height = height;
        this.originalColor = 'rgba(200, 200, 200, 0.2)'; // Store original color
        this.color = this.originalColor;
        this.isResizing = false;
        this.isDragging = false;
        this.resizeHandle = 10;
        this.notes = ''; // Add notes property

        if (label) {
            this.label = label;
            return;
        }

        // Return a promise for the new region
        return new Promise((resolve) => {
            const modal = document.getElementById('renameModal');
            const input = document.getElementById('renameInput');
            const confirmBtn = document.getElementById('confirmRename');
            const cancelBtn = document.getElementById('cancelRename');

            modal.style.display = 'block';
            input.value = '';
            input.placeholder = 'Enter research direction name';

            const handleConfirm = () => {
                const newLabel = input.value.trim();
                if (newLabel) {
                    this.label = newLabel;
                    modal.style.display = 'none';
                    cleanup();
                    resolve(this);
                }
            };

            const handleCancel = () => {
                modal.style.display = 'none';
                cleanup();
                resolve(null);
            };

            const handleKeyPress = (e) => {
                if (e.key === 'Enter') {
                    handleConfirm();
                } else if (e.key === 'Escape') {
                    handleCancel();
                }
            };

            const cleanup = () => {
                confirmBtn.removeEventListener('click', handleConfirm);
                cancelBtn.removeEventListener('click', handleCancel);
                input.removeEventListener('keypress', handleKeyPress);
            };

            confirmBtn.addEventListener('click', handleConfirm);
            cancelBtn.addEventListener('click', handleCancel);
            input.addEventListener('keypress', handleKeyPress);

            input.focus();
            input.select();
        });
    }

    draw() {
        // Draw main region
        ctx.beginPath();
        ctx.rect(this.x, this.y, this.width, this.height);
        ctx.fillStyle = this.color;
        ctx.fill();
        ctx.strokeStyle = '#666';
        ctx.stroke();

        // Update text drawing with font size
        ctx.fillStyle = '#000';
        ctx.font = `${fontSize}px Arial`; // Set font size
        ctx.textAlign = 'left';
        ctx.textBaseline = 'top';
        ctx.fillText(this.label, this.x + 5, this.y + 5);

        // Draw resize handle
        ctx.beginPath();
        ctx.rect(
            this.x + this.width - this.resizeHandle,
            this.y + this.height - this.resizeHandle,
            this.resizeHandle,
            this.resizeHandle
        );
        ctx.fillStyle = '#666';
        ctx.fill();
    }

    isInResizeHandle(x, y) {
        return (
            x >= this.x + this.width - this.resizeHandle &&
            x <= this.x + this.width &&
            y >= this.y + this.height - this.resizeHandle &&
            y <= this.y + this.height
        );
    }

    isInRegion(x, y) {
        return (
            x >= this.x &&
            x <= this.x + this.width &&
            y >= this.y &&
            y <= this.y + this.height
        );
    }

    isInLabel(x, y) {
        // Assuming the label is in the top-left corner with some padding
        const labelMetrics = ctx.measureText(this.label);
        return (
            x >= this.x + 5 &&
            x <= this.x + 5 + labelMetrics.width &&
            y >= this.y + 5 &&
            y <= this.y + 25  // Approximate height for text
        );
    }

    rename() {
        const modal = document.getElementById('renameModal');
        const input = document.getElementById('renameInput');
        const confirmBtn = document.getElementById('confirmRename');
        const cancelBtn = document.getElementById('cancelRename');
        const deleteBtn = document.getElementById('deleteRename');

        input.value = this.label;
        modal.style.display = 'block';

        const handleRename = () => {
            const newLabel = input.value.trim();
            if (newLabel) {
                this.label = newLabel;
                drawMindMap();
            }
            modal.style.display = 'none';
            cleanup();
        };

        const handleDelete = () => {
            regions = regions.filter(r => r !== this);
            modal.style.display = 'none';
            drawMindMap();
            cleanup();
        };

        const handleCancel = () => {
            modal.style.display = 'none';
            cleanup();
        };

        const handleKeyPress = (e) => {
            if (e.key === 'Enter') {
                handleRename();
            } else if (e.key === 'Escape') {
                handleCancel();
            }
        };

        const cleanup = () => {
            confirmBtn.removeEventListener('click', handleRename);
            cancelBtn.removeEventListener('click', handleCancel);
            deleteBtn.removeEventListener('click', handleDelete);
            input.removeEventListener('keypress', handleKeyPress);
        };

        confirmBtn.addEventListener('click', handleRename);
        cancelBtn.addEventListener('click', handleCancel);
        deleteBtn.addEventListener('click', handleDelete);
        input.addEventListener('keypress', handleKeyPress);

        input.focus();
        input.select();
    }
}

function addNode(type) {
    const x = Math.random() * (canvas.width - 60) + 30;
    const y = Math.random() * (canvas.height - 60) + 30;
    nodes.push(new Node(x, y, type));
    drawMindMap();
}

function startConnection() {
    isConnecting = true;
    canvas.style.cursor = 'crosshair';
}

function drawConnection(node1, node2) {
    ctx.beginPath();
    ctx.moveTo(node1.x, node1.y);

    // Set line style based on connection type
    if (node1.type === 'project' && node2.type === 'project') {
        ctx.setLineDash([5, 5]); // Create dashed line
    } else {
        ctx.setLineDash([]); // Solid line for other connections
    }

    ctx.lineTo(node2.x, node2.y);
    ctx.strokeStyle = '#666';
    ctx.stroke();
    ctx.setLineDash([]); // Reset to solid line after drawing
}

function drawMindMap() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw regions first (so they appear behind everything)
    regions.forEach(region => region.draw());

    // Draw connections
    connections.forEach(conn => {
        drawConnection(conn.from, conn.to);
    });

    // Draw nodes
    nodes.forEach(node => node.draw());

    // Draw region being created
    if (isCreatingRegion && regionStart) {
        const rect = canvas.getBoundingClientRect();
        const mouseX = event.clientX - rect.left;
        const mouseY = event.clientY - rect.top;

        ctx.beginPath();
        ctx.rect(
            regionStart.x,
            regionStart.y,
            mouseX - regionStart.x,
            mouseY - regionStart.y
        );
        ctx.strokeStyle = '#666';
        ctx.stroke();
    }
}

// Event Listeners
canvas.addEventListener('click', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    if (!isConnecting) {
        const clickedNode = nodes.find(node => node.isClicked(x, y));
        if (clickedNode) {
            showSidePanel(clickedNode);
            return;
        }

        const clickedRegion = regions.find(region => region.isInRegion(x, y));
        if (clickedRegion) {
            showSidePanel(clickedRegion);
            return;
        }
    }

    const clickedNode = nodes.find(node => node.isClicked(x, y));

    if (isConnecting) {
        if (clickedNode) {
            if (!selectedNode) {
                selectedNode = clickedNode;
            } else if (selectedNode !== clickedNode) {
                // Allow connections between any nodes
                connections.push({
                    from: selectedNode,
                    to: clickedNode
                });
                drawMindMap();
                selectedNode = null;
                isConnecting = false;
                canvas.style.cursor = 'default';
            }
        }
    }
});

canvas.addEventListener('mousedown', handleMouseDown);

canvas.addEventListener('mousemove', handleMouseMove);

canvas.addEventListener('mouseup', handleMouseUp);

// Add function to start region creation
function startRegionCreation() {
    isCreatingRegion = true;
    canvas.style.cursor = 'crosshair';
}

function exportToJson() {
    const mindMapData = {
        nodes: nodes.map(node => ({
            id: node.id,
            type: node.type,
            label: node.label,
            x: node.x,
            y: node.y,
            notes: node.notes
        })),
        connections: connections.map(conn => ({
            from: conn.from.id,
            to: conn.to.id
        })),
        regions: regions.map(region => ({
            label: region.label,
            x: region.x,
            y: region.y,
            width: region.width,
            height: region.height,
            notes: region.notes
        }))
    };

    // Create and trigger download
    const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(mindMapData, null, 2));
    const downloadAnchorNode = document.createElement('a');
    downloadAnchorNode.setAttribute("href", dataStr);
    downloadAnchorNode.setAttribute("download", "mind_map.json");
    document.body.appendChild(downloadAnchorNode);
    downloadAnchorNode.click();
    downloadAnchorNode.remove();
}

function loadFromJson() {
    // Create file input element
    const fileInput = document.createElement('input');
    fileInput.type = 'file';
    fileInput.accept = '.json';

    fileInput.onchange = function (e) {
        const file = e.target.files[0];
        const reader = new FileReader();

        reader.onload = function (e) {
            try {
                const mindMapData = JSON.parse(e.target.result);

                // Clear existing data
                nodes = [];
                connections = [];
                regions = [];

                // Recreate nodes
                mindMapData.nodes.forEach(nodeData => {
                    const node = new Node(nodeData.x, nodeData.y, nodeData.type);
                    node.label = nodeData.label;
                    node.id = nodeData.id || Math.random().toString(36).substr(2, 9); // Use existing ID or generate new one
                    node.notes = nodeData.notes || '';
                    nodes.push(node);
                });

                // Recreate connections
                mindMapData.connections.forEach(connData => {
                    const fromNode = nodes.find(n => n.id === connData.from);
                    const toNode = nodes.find(n => n.id === connData.to);
                    if (fromNode && toNode) {
                        connections.push({ from: fromNode, to: toNode });
                    }
                });

                // Recreate regions
                mindMapData.regions.forEach(regionData => {
                    const region = new Region(
                        regionData.x,
                        regionData.y,
                        regionData.width,
                        regionData.height,
                        regionData.label
                    );
                    region.notes = regionData.notes || '';
                    regions.push(region);
                });

                // Redraw the mind map
                drawMindMap();

            } catch (error) {
                console.error('Error loading mind map:', error);
                alert('Error loading mind map file. Please ensure it\'s a valid JSON file.');
            }
        };

        reader.readAsText(file);
    };

    fileInput.click();
}

canvas.addEventListener('dblclick', (e) => {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    // Check if a node was double-clicked first
    const clickedNode = nodes.find(node => node.isClicked(x, y));
    if (clickedNode) {
        clickedNode.rename();
        return;
    }

    // Check if a region was double-clicked
    const clickedRegion = regions.find(region => region.isInRegion(x, y));
    if (clickedRegion) {
        clickedRegion.rename();
    }
});

// Show modal
const modal = document.getElementById('renameModal');
const overlay = document.getElementById('modalOverlay');
modal.style.display = 'block';
overlay.style.display = 'block';

// Hide modal (in cleanup or cancel functions)
modal.style.display = 'none';
overlay.style.display = 'none';

// Add new function to handle side panel
function showSidePanel(item) {
    const sidePanel = document.getElementById('sidePanel') || createSidePanel();
    const textarea = sidePanel.querySelector('textarea');
    const titleSpan = sidePanel.querySelector('.title');

    titleSpan.textContent = item.label;
    textarea.value = item.notes || '';

    // Save notes when textarea changes
    textarea.oninput = () => {
        item.notes = textarea.value;
        updateNotesExplorer();
    };

    sidePanel.style.right = '0';
}

function createSidePanel() {
    const sidePanel = document.createElement('div');
    sidePanel.id = 'sidePanel';
    sidePanel.innerHTML = `
        <div class="header">
            <span class="title"></span>
            <button class="close-btn">&times;</button>
        </div>
        <textarea placeholder="Add notes here..."></textarea>
    `;

    document.body.appendChild(sidePanel);

    // Add close button handler
    sidePanel.querySelector('.close-btn').onclick = () => {
        sidePanel.style.right = '-300px';
    };

    return sidePanel;
}


function clearMindMap() {
    // Clear all data structures
    nodes = [];
    connections = [];
    regions = [];

    // Reset all state variables
    isConnecting = false;
    selectedNode = null;
    isDragging = false;
    draggedNode = null;
    isCreatingRegion = false;
    regionStart = null;
    currentRegion = null;
    draggedRegion = null;
    resizingRegion = null;

    // Clear the canvas
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Reset cursor
    canvas.style.cursor = 'default';
}

function toggleNotesExplorer() {
    const explorer = document.getElementById('notesExplorer');
    explorer.classList.toggle('active');

    // Add close button functionality here
    const closeBtn = explorer.querySelector('.notes-close-btn');
    if (closeBtn) {
        closeBtn.onclick = () => {
            explorer.classList.remove('active');
        };
    }

    // Update filter buttons
    const buttons = explorer.querySelectorAll('button[id^="filter"]');
    buttons.forEach(button => {
        button.classList.toggle('active', button.id === `filter${activeFilter.charAt(0).toUpperCase() + activeFilter.slice(1)}`);
    });

    if (explorer.classList.contains('active')) {
        updateNotesExplorer();
    }

    // Update filter button event listeners
    ['All', 'Team', 'Project', 'Region'].forEach(filterType => {
        const button = document.getElementById(`filter${filterType}`);
        if (button) {
            button.addEventListener('click', () => {
                console.log(`${filterType} filter clicked`); // Debug logging
                activeFilter = filterType.toLowerCase();
                updateNotesExplorer();

                // Update active button styling
                document.querySelectorAll('button[id^="filter"]').forEach(btn => {
                    btn.classList.remove('active');
                });
                button.classList.add('active');
            });
        } else {
            console.error(`Button filter${filterType} not found`);
        }
    });

    initializeResizablePanel();

}

function updateNotesExplorer() {
    const notesList = document.getElementById('notesList');
    if (!notesList) {
        console.error('Notes list element not found');
        return;
    }

    notesList.innerHTML = '';

    const allItems = [
        ...nodes.map(node => ({ type: node.type, label: node.label, notes: node.notes, item: node })),
        ...regions.map(region => ({ type: 'region', label: region.label, notes: region.notes, item: region }))
    ];

    const filteredItems = allItems.filter(item => {
        if (activeFilter === 'all') return true;
        return item.type === activeFilter;
    });

    filteredItems.forEach(item => {
        if (!item.notes) return;

        const noteCard = document.createElement('div');
        noteCard.className = 'bg-gray-50 p-3 rounded shadow mb-2 cursor-pointer hover:bg-gray-100';

        const typeColor = item.type === 'team' ? 'text-blue-600' :
            item.type === 'project' ? 'text-green-600' :
                'text-yellow-600';

        // Convert URLs to clickable links
        const notesWithLinks = item.notes.replace(
            /(https?:\/\/[^\s]+)/g,
            '<a href="$1" class="text-blue-600 hover:underline" target="_blank" onclick="event.stopPropagation()">$1</a>'
        );

        noteCard.innerHTML = `
            <div class="flex items-center justify-between mb-2">
                <h3 class="font-semibold">${item.label}</h3>
                <span class="text-xs ${typeColor} capitalize">${item.type}</span>
            </div>
            <p class="text-sm text-gray-600">${notesWithLinks}</p>
        `;

        // Add click handler to highlight corresponding item
        noteCard.addEventListener('click', () => highlightItem(item.item));

        notesList.appendChild(noteCard);
    });
}

function highlightItem(item) {
    console.log('Highlighting item:', item); // Debug log

    if (item instanceof Region) {
        const tempColor = 'rgba(255, 0, 0, 0.5)'; // Brighter red for testing
        const originalColor = 'rgba(200, 200, 200, 0.2)';
        let flashCount = 6; // Total number of color changes (3 flashes)

        function flashRegion() {
            console.log('Flashing region, count:', flashCount); // Debug log
            if (flashCount > 0) {
                item.color = (flashCount % 2 === 0) ? tempColor : originalColor;
                drawMindMap();
                flashCount--;
                setTimeout(flashRegion, 200);
            } else {
                item.color = originalColor;
                drawMindMap();
            }
        }

        flashRegion();
    } else {
        // Original node flashing logic
        const highlightColor = '#ff0000';
        const originalColor = item.color;
        const flashDuration = 1000;
        const flashCount = 3;
        let flashIteration = 0;

        function flash() {
            flashIteration++;
            item.color = item.color === highlightColor ? originalColor : highlightColor;
            drawMindMap();

            if (flashIteration < flashCount * 2) {
                setTimeout(flash, flashDuration / (flashCount * 2));
            } else {
                item.color = originalColor;
                drawMindMap();
            }
        }

        flash();
    }
}

function initializeResizablePanel() {
    const notesExplorer = document.getElementById('notesExplorer');
    const resizeHandle = notesExplorer.querySelector('.resize-handle');
    let isResizing = false;
    let startWidth;
    let startX;

    resizeHandle.addEventListener('mousedown', (e) => {
        isResizing = true;
        startX = e.pageX;
        startWidth = notesExplorer.offsetWidth;

        document.body.style.cursor = 'ew-resize';
        e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
        if (!isResizing) return;

        const width = startWidth - (e.pageX - startX);
        if (width >= 200 && width <= 800) { // Min and max width constraints
            notesExplorer.style.width = `${width}px`;
        }
    });

    document.addEventListener('mouseup', () => {
        isResizing = false;
        document.body.style.cursor = 'default';
    });
}

function addEventListeners(element, events) {
    const cleanup = () => {
        Object.entries(events).forEach(([event, handler]) => {
            element.removeEventListener(event, handler);
        });
    };

    Object.entries(events).forEach(([event, handler]) => {
        element.addEventListener(event, handler);
    });

    return cleanup;
}

// Usage example:
const cleanup = addEventListeners(canvas, {
    'mousedown': handleMouseDown,
    'mousemove': handleMouseMove,
    'mouseup': handleMouseUp
});

// Add new function to control font size
function changeFontSize(newSize) {
    fontSize = newSize;
    drawMindMap();
}

document.getElementById('fontSize').addEventListener('input', (e) => {
    const newSize = parseInt(e.target.value);
    document.getElementById('fontSizeValue').textContent = `${newSize}px`;
    changeFontSize(newSize);
});

function handleMouseDown(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    lastMouseX = x;
    lastMouseY = y;

    if (isCreatingRegion) {
        regionStart = { x, y };
    } else {
        // Check for node drag first
        draggedNode = nodes.find(node => node.isClicked(x, y));
        if (draggedNode) {
            isDragging = true;
            return;
        }

        // Check for region resize
        resizingRegion = regions.find(region => region.isInResizeHandle(x, y));
        if (resizingRegion) {
            return;
        }

        // Check for region label drag first
        draggedRegion = regions.find(region => region.isInLabel(x, y));
        if (draggedRegion) {
            return;
        }

        // Check for region drag
        draggedRegion = regions.find(region => region.isInRegion(x, y));
    }
}

function handleMouseMove(e) {
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;

    const dx = x - lastMouseX;
    const dy = y - lastMouseY;

    if (resizingRegion) {
        resizingRegion.width = Math.max(50, resizingRegion.width + dx);
        resizingRegion.height = Math.max(50, resizingRegion.height + dy);
        drawMindMap();
    } else if (draggedRegion) {
        draggedRegion.x += dx;
        draggedRegion.y += dy;
        drawMindMap();
    } else if (isDragging && draggedNode) {
        draggedNode.x = x;
        draggedNode.y = y;
        drawMindMap();
    }

    lastMouseX = x;
    lastMouseY = y;
}

async function handleMouseUp(e) {
    if (isCreatingRegion && regionStart) {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;

        const width = x - regionStart.x;
        const height = y - regionStart.y;

        if (Math.abs(width) > 10 && Math.abs(height) > 10) {
            const region = await new Region(
                Math.min(regionStart.x, x),
                Math.min(regionStart.y, y),
                Math.abs(width),
                Math.abs(height)
            );

            if (region) {
                regions.push(region);
                drawMindMap();
            }
        }

        isCreatingRegion = false;
        regionStart = null;
        canvas.style.cursor = 'default';
    }

    isDragging = false;
    draggedNode = null;
    draggedRegion = null;
    resizingRegion = null;
}


document.addEventListener('DOMContentLoaded', () => {
  const socket = io();
  const authKey = 'default-secret-key'; // Should match server
  
  // DOM elements
  const elements = {
    pendingList: document.getElementById('pending-list'),
    approvedList: document.getElementById('approved-list'),
    rejectedList: document.getElementById('rejected-list'),
    activeBotsList: document.getElementById('active-bots-list'),
    botName: document.getElementById('bot-name'),
    botOwner: document.getElementById('bot-owner'),
    botIp: document.getElementById('bot-ip'),
    requestTime: document.getElementById('request-time'),
    requestStatus: document.getElementById('request-status'),
    btnApprove: document.getElementById('btn-approve'),
    btnReject: document.getElementById('btn-reject'),
    btnDelete: document.getElementById('btn-delete'),
    btnMessage: document.getElementById('btn-message'),
    messageModal: document.getElementById('message-modal'),
    messageInput: document.getElementById('message-input'),
    sendMessageBtn: document.getElementById('send-message'),
    toast: document.getElementById('toast')
  };

  let currentRequest = null;
  let activeBots = [];

  // Initialize UI
  function initUI(data) {
    updateRequests(data.requests, 'pending');
    updateRequests(data.approved, 'approved');
    updateRequests(data.rejected, 'rejected');
    updateActiveBots(data.activeBots);
  }

  // Update requests list
  function updateRequests(requests, type) {
    const list = elements[`${type}List`];
    list.innerHTML = '';

    if (requests.length === 0) {
      list.innerHTML = `<div class="empty">No ${type} requests</div>`;
      return;
    }

    requests.forEach(request => {
      const item = document.createElement('div');
      item.className = `request-item ${type}`;
      item.dataset.id = request.id;
      
      const time = new Date(request.createdAt).toLocaleString();
      const lastActive = request.lastActive ? 
        `Last active: ${new Date(request.lastActive).toLocaleTimeString()}` : '';
      
      item.innerHTML = `
        <div class="request-info">
          <h3>${request.botName || 'Unknown'}</h3>
          <p>Owner: ${request.owner || 'Unknown'}</p>
          <p>IP: ${request.ip || 'Unknown'}</p>
          <small>${time} • ${lastActive}</small>
        </div>
        <div class="request-actions">
          <span class="status-badge ${type}">${type.toUpperCase()}</span>
        </div>
      `;

      item.addEventListener('click', () => showRequestDetails(request));
      list.appendChild(item);
    });
  }

  // Update active bots list
  function updateActiveBots(bots) {
    activeBots = bots;
    const list = elements.activeBotsList;
    list.innerHTML = '';

    if (bots.length === 0) {
      list.innerHTML = '<div class="empty">No active bots</div>';
      return;
    }

    bots.forEach(bot => {
      const item = document.createElement('div');
      item.className = 'bot-item';
      item.dataset.id = bot.id;
      
      const lastActive = new Date(bot.lastActive).toLocaleTimeString();
      const uptime = Math.floor((new Date() - new Date(bot.lastActive)) / 60000);
      
      item.innerHTML = `
        <div class="bot-info">
          <h3>${bot.botName || 'Unknown'}</h3>
          <p>IP: ${bot.ip || 'Unknown'}</p>
          <small>Active now • Uptime: ${uptime} mins</small>
        </div>
        <div class="bot-status online"></div>
      `;

      list.appendChild(item);
    });
  }

  // Show request details
  function showRequestDetails(request) {
    currentRequest = request;
    
    elements.botName.textContent = request.botName || '-';
    elements.botOwner.textContent = request.owner || '-';
    elements.botIp.textContent = request.ip || '-';
    elements.requestTime.textContent = request.createdAt ? 
      new Date(request.createdAt).toLocaleString() : '-';
    
    updateStatusUI(request.status);
    
    // Enable/disable buttons based on status
    elements.btnApprove.disabled = request.status !== 'pending';
    elements.btnReject.disabled = request.status !== 'pending';
  }

  // Update status UI
  function updateStatusUI(status) {
    elements.requestStatus.className = 'status-badge';
    elements.requestStatus.classList.add(status);
    elements.requestStatus.textContent = status.toUpperCase();
  }

  // Show toast notification
  function showToast(message, type = 'info') {
    elements.toast.textContent = message;
    elements.toast.className = `toast ${type} show`;
    
    setTimeout(() => {
      elements.toast.classList.remove('show');
    }, 3000);
  }

  // Socket.io events
  socket.on('init', initUI);
  
  socket.on('new-request', (request) => {
    showToast(`New request from ${request.botName || 'unknown bot'}`, 'info');
    updateRequests([request], 'pending');
  });
  
  socket.on('request-approved', (request) => {
    showToast(`Approved: ${request.botName}`, 'success');
    updateRequests([request], 'approved');
    if (currentRequest?.id === request.id) showRequestDetails(request);
  });
  
  socket.on('request-rejected', (request) => {
    showToast(`Rejected: ${request.botName}`, 'error');
    updateRequests([request], 'rejected');
    if (currentRequest?.id === request.id) showRequestDetails(request);
  });
  
  socket.on('active-bots', (bots) => {
    updateActiveBots(bots);
  });

  // Button event listeners
  elements.btnApprove.addEventListener('click', () => {
    if (!currentRequest) return;
    
    fetch('/api/approve', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-key': authKey
      },
      body: JSON.stringify({ requestId: currentRequest.id })
    })
    .then(res => res.json())
    .then(data => {
      if (!data.success) throw new Error('Failed to approve');
    })
    .catch(err => {
      showToast(err.message, 'error');
    });
  });

  elements.btnReject.addEventListener('click', () => {
    if (!currentRequest) return;
    
    fetch('/api/reject', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-auth-key': authKey
      },
      body: JSON.stringify({ requestId: currentRequest.id })
    })
    .then(res => res.json())
    .then(data => {
      if (!data.success) throw new Error('Failed to reject');
    })
    .catch(err => {
      showToast(err.message, 'error');
    });
  });

  elements.btnDelete.addEventListener('click', () => {
    if (!currentRequest) return;
    
    if (confirm('Delete this request permanently?')) {
      showToast('Request deleted', 'info');
      window.location.href = '/admin';
    }
  });

  // Message modal
  elements.btnMessage.addEventListener('click', () => {
    if (!currentRequest) return;
    elements.messageModal.classList.add('show');
    elements.messageInput.focus();
  });

  elements.sendMessageBtn.addEventListener('click', sendMessage);

  function sendMessage() {
    const message = elements.messageInput.value.trim();
    if (!message || !currentRequest) return;
    
    // In a real app, you would send this to the bot
    showToast(`Message sent to ${currentRequest.botName}`, 'success');
    elements.messageInput.value = '';
    elements.messageModal.classList.remove('show');
  }

  // Close modal when clicking outside
  elements.messageModal.addEventListener('click', (e) => {
    if (e.target === elements.messageModal) {
      elements.messageModal.classList.remove('show');
    }
  });

  // Close modal with Escape key
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      elements.messageModal.classList.remove('show');
    }
  });

  // Initial load
  fetch('/api/data', {
    headers: { 'x-auth-key': authKey }
  })
  .then(res => res.json())
  .then(initUI)
  .catch(err => {
    console.error('Failed to load data:', err);
    showToast('Failed to load data', 'error');
  });
});
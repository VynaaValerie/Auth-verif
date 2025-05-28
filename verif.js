document.addEventListener('DOMContentLoaded', function() {
    // Connect to Socket.io
    const socket = io();
    
    // UI Elements
    const botNameEl = document.getElementById('bot-name');
    const botOwnerEl = document.getElementById('bot-owner');
    const requestTimeEl = document.getElementById('request-time');
    const requestIpEl = document.getElementById('request-ip');
    const requestStatusEl = document.getElementById('request-status');
    const btnApprove = document.getElementById('btn-approve');
    const btnReject = document.getElementById('btn-reject');
    const btnDelete = document.getElementById('btn-delete');
    const btnMessage = document.getElementById('btn-message');
    const requestsList = document.getElementById('requests-list');
    const pendingList = document.getElementById('pending-list');
    const approvedList = document.getElementById('approved-list');
    const rejectedList = document.getElementById('rejected-list');
    const messageModal = document.getElementById('message-modal');
    const closeModal = document.querySelector('.close-modal');
    const sendMessageBtn = document.getElementById('send-message');
    const messagesContainer = document.getElementById('messages-container');
    
    let currentRequest = null;
    let allRequests = [];
    
    // Load initial data
    function loadInitialData(data) {
        allRequests = [
            ...data.requests,
            ...data.approved,
            ...data.rejected
        ];
        
        // Get current request from URL
        const params = new URLSearchParams(window.location.search);
        const requestId = params.get('id');
        
        if (requestId) {
            currentRequest = allRequests.find(r => r.id === requestId);
            if (currentRequest) {
                displayRequestDetails(currentRequest);
            }
        }
        
        updateRequestsLists(data);
    }
    
    // Display request details
    function displayRequestDetails(request) {
        botNameEl.textContent = request.botName;
        botOwnerEl.textContent = request.owner;
        requestTimeEl.textContent = new Date(request.time).toLocaleString();
        requestIpEl.textContent = request.ip;
        updateStatusUI(request.status);
        
        // Enable/disable buttons based on status
        btnApprove.disabled = request.status !== 'pending';
        btnReject.disabled = request.status !== 'pending';
    }
    
    // Update status UI
    function updateStatusUI(status) {
        requestStatusEl.className = 'request-status';
        
        switch(status) {
            case 'approved':
                requestStatusEl.classList.add('status-approved');
                requestStatusEl.textContent = 'APPROVED';
                break;
            case 'rejected':
                requestStatusEl.classList.add('status-rejected');
                requestStatusEl.textContent = 'REJECTED';
                break;
            default:
                requestStatusEl.classList.add('status-pending');
                requestStatusEl.textContent = 'PENDING';
        }
    }
    
    // Update all requests lists
    function updateRequestsLists(data) {
        updateRequestList(pendingList, data.requests);
        updateRequestList(approvedList, data.approved);
        updateRequestList(rejectedList, data.rejected);
    }
    
    // Update a single request list
    function updateRequestList(listElement, requests) {
        listElement.innerHTML = '';
        
        if (requests.length === 0) {
            listElement.innerHTML = '<div class="empty-message">No requests found</div>';
            return;
        }
        
        requests.forEach(request => {
            const requestItem = document.createElement('div');
            requestItem.className = 'request-item';
            requestItem.dataset.id = request.id;
            
            let statusClass = '';
            let statusText = '';
            
            switch(request.status) {
                case 'approved':
                    statusClass = 'status-approved';
                    statusText = 'APPROVED';
                    break;
                case 'rejected':
                    statusClass = 'status-rejected';
                    statusText = 'REJECTED';
                    break;
                default:
                    statusClass = 'status-pending';
                    statusText = 'PENDING';
            }
            
            requestItem.innerHTML = `
                <div class="request-info">
                    <strong>${request.botName}</strong>
                    <div class="request-meta">
                        <span>Owner: ${request.owner}</span>
                        <span>IP: ${request.ip}</span>
                    </div>
                    <small>${new Date(request.time).toLocaleString()}</small>
                </div>
                <span class="request-status ${statusClass}">${statusText}</span>
            `;
            
            // Add click event to view details
            requestItem.addEventListener('click', () => {
                window.location.href = `?id=${request.id}`;
            });
            
            listElement.appendChild(requestItem);
        });
    }
    
    // Load messages for current request
    function loadMessages(requestId) {
        fetch(`/api/get-requests`)
            .then(res => res.json())
            .then(data => {
                const messages = data.messages.filter(m => m.requestId === requestId);
                displayMessages(messages);
            });
    }
    
    // Display messages
    function displayMessages(messages) {
        messagesContainer.innerHTML = '';
        
        if (messages.length === 0) {
            messagesContainer.innerHTML = '<div class="empty-message">No messages yet</div>';
            return;
        }
        
        messages.forEach(message => {
            const messageEl = document.createElement('div');
            messageEl.className = `message ${message.admin ? 'admin-message' : 'bot-message'}`;
            
            messageEl.innerHTML = `
                <div class="message-content">${message.message}</div>
                <div class="message-time">${new Date(message.time).toLocaleTimeString()}</div>
            `;
            
            messagesContainer.appendChild(messageEl);
        });
        
        // Scroll to bottom
        messagesContainer.scrollTop = messagesContainer.scrollHeight;
    }
    
    // Socket.io event listeners
    socket.on('initial-data', loadInitialData);
    socket.on('new-request', (request) => {
        allRequests.push(request);
        if (currentRequest && currentRequest.id === request.id) {
            displayRequestDetails(request);
        }
        // Show notification
        showNotification(`New request from ${request.botName}`);
    });
    socket.on('request-approved', (request) => {
        allRequests = allRequests.map(r => r.id === request.id ? request : r);
        if (currentRequest && currentRequest.id === request.id) {
            displayRequestDetails(request);
        }
    });
    socket.on('request-rejected', (request) => {
        allRequests = allRequests.map(r => r.id === request.id ? request : r);
        if (currentRequest && currentRequest.id === request.id) {
            displayRequestDetails(request);
        }
    });
    socket.on('request-updated', updateRequestsLists);
    socket.on('new-message', ({ requestId, message }) => {
        if (currentRequest && currentRequest.id === requestId) {
            const messagesContainer = document.getElementById('messages-container');
            const messageEl = document.createElement('div');
            messageEl.className = `message ${message.admin ? 'admin-message' : 'bot-message'}`;
            
            messageEl.innerHTML = `
                <div class="message-content">${message.message}</div>
                <div class="message-time">${new Date(message.time).toLocaleTimeString()}</div>
            `;
            
            messagesContainer.appendChild(messageEl);
            messagesContainer.scrollTop = messagesContainer.scrollHeight;
        }
    });
    
    // Show notification
    function showNotification(message) {
        if (Notification.permission === 'granted') {
            new Notification('New Bot Request', { body: message });
        } else if (Notification.permission !== 'denied') {
            Notification.requestPermission().then(permission => {
                if (permission === 'granted') {
                    new Notification('New Bot Request', { body: message });
                }
            });
        }
    }
    
    // Event listeners for buttons
    btnApprove.addEventListener('click', function() {
        if (currentRequest && confirm('Are you sure you want to approve this request?')) {
            fetch('/api/approve-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId: currentRequest.id })
            }).then(res => res.json())
              .then(data => {
                  if (data.success) {
                      currentRequest.status = 'approved';
                      displayRequestDetails(currentRequest);
                  }
              });
        }
    });
    
    btnReject.addEventListener('click', function() {
        if (currentRequest && confirm('Are you sure you want to reject this request?')) {
            fetch('/api/reject-request', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ requestId: currentRequest.id })
            }).then(res => res.json())
              .then(data => {
                  if (data.success) {
                      currentRequest.status = 'rejected';
                      displayRequestDetails(currentRequest);
                  }
              });
        }
    });
    
    btnDelete.addEventListener('click', function() {
        if (currentRequest && confirm('Are you sure you want to delete this request?')) {
            // In a real app, you would call an API endpoint to delete
            alert('Request deleted!');
            window.location.href = window.location.pathname;
        }
    });
    
    btnMessage.addEventListener('click', function() {
        if (currentRequest) {
            messageModal.style.display = 'flex';
        }
    });
    
    closeModal.addEventListener('click', function() {
        messageModal.style.display = 'none';
    });
    
    sendMessageBtn.addEventListener('click', function() {
        const messageText = document.getElementById('message-text').value;
        if (messageText.trim() === '') {
            alert('Please enter a message!');
            return;
        }
        
        if (currentRequest) {
            fetch('/api/send-message', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    requestId: currentRequest.id,
                    message: messageText
                })
            }).then(res => res.json())
              .then(data => {
                  if (data.success) {
                      document.getElementById('message-text').value = '';
                      messageModal.style.display = 'none';
                  }
              });
        }
    });
    
    // Close modal when clicking outside
    window.addEventListener('click', function(event) {
        if (event.target === messageModal) {
            messageModal.style.display = 'none';
        }
    });
    
    // Load messages if viewing a request
    const params = new URLSearchParams(window.location.search);
    const requestId = params.get('id');
    if (requestId) {
        loadMessages(requestId);
    }
    
    // Request notification permission
    if (window.Notification) {
        Notification.requestPermission();
    }
});
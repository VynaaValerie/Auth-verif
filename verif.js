document.addEventListener('DOMContentLoaded', function() {
    // Elemen UI
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
    const messageModal = document.getElementById('message-modal');
    const closeModal = document.querySelector('.close-modal');
    const sendMessageBtn = document.getElementById('send-message');
    
    // Data dummy untuk contoh
    let currentRequest = {
        id: 'req-001',
        botName: 'Vynaa AI',
        owner: 'Pinaa',
        time: new Date().toLocaleString(),
        ip: '192.168.1.1',
        status: 'pending'
    };
    
    let requestsHistory = [
        {
            id: 'req-002',
            botName: 'Vynaa AI',
            owner: 'Pinaa',
            time: '2023-11-15 14:30:00',
            ip: '192.168.1.2',
            status: 'approved'
        }
    ];
    
    // Fungsi untuk memuat data permintaan
    function loadRequestData() {
        // Ambil data dari query string (contoh sederhana)
        const params = new URLSearchParams(window.location.search);
        const requestId = params.get('id');
        
        if (requestId) {
            // Di sini seharusnya ada request ke API untuk mendapatkan data berdasarkan ID
            // Untuk contoh kita gunakan data dummy
            botNameEl.textContent = currentRequest.botName;
            botOwnerEl.textContent = currentRequest.owner;
            requestTimeEl.textContent = currentRequest.time;
            requestIpEl.textContent = currentRequest.ip;
            
            // Update status
            updateStatusUI(currentRequest.status);
        }
        
        // Load history
        loadRequestsHistory();
    }
    
    // Fungsi untuk memperbarui tampilan status
    function updateStatusUI(status) {
        requestStatusEl.className = 'request-status';
        
        switch(status) {
            case 'approved':
                requestStatusEl.classList.add('status-approved');
                requestStatusEl.textContent = 'DISETUJUI';
                break;
            case 'rejected':
                requestStatusEl.classList.add('status-rejected');
                requestStatusEl.textContent = 'DITOLAK';
                break;
            default:
                requestStatusEl.classList.add('status-pending');
                requestStatusEl.textContent = 'MENUNGGU';
        }
        
        currentRequest.status = status;
    }
    
    // Fungsi untuk memuat riwayat permintaan
    function loadRequestsHistory() {
        requestsList.innerHTML = '';
        
        // Gabungkan permintaan saat ini dengan riwayat jika status bukan pending
        const allRequests = [...requestsHistory];
        if (currentRequest.status !== 'pending') {
            allRequests.unshift(currentRequest);
        }
        
        if (allRequests.length === 0) {
            requestsList.innerHTML = '<p>Tidak ada riwayat permintaan</p>';
            return;
        }
        
        allRequests.forEach(request => {
            const requestItem = document.createElement('div');
            requestItem.className = 'request-item';
            
            let statusClass = '';
            let statusText = '';
            
            switch(request.status) {
                case 'approved':
                    statusClass = 'status-approved';
                    statusText = 'DISETUJUI';
                    break;
                case 'rejected':
                    statusClass = 'status-rejected';
                    statusText = 'DITOLAK';
                    break;
                default:
                    statusClass = 'status-pending';
                    statusText = 'MENUNGGU';
            }
            
            requestItem.innerHTML = `
                <div>
                    <strong>${request.botName}</strong>
                    <div>IP: ${request.ip}</div>
                    <small>${request.time}</small>
                </div>
                <span class="request-status ${statusClass}">${statusText}</span>
            `;
            
            requestsList.appendChild(requestItem);
        });
    }
    
    // Event listeners
    btnApprove.addEventListener('click', function() {
        if (confirm('Anda yakin ingin menyetujui permintaan ini?')) {
            // Di sini seharusnya ada request ke API untuk update status
            updateStatusUI('approved');
            loadRequestsHistory();
            alert('Permintaan telah disetujui!');
        }
    });
    
    btnReject.addEventListener('click', function() {
        if (confirm('Anda yakin ingin menolak permintaan ini?')) {
            // Di sini seharusnya ada request ke API untuk update status
            updateStatusUI('rejected');
            loadRequestsHistory();
            alert('Permintaan telah ditolak!');
        }
    });
    
    btnDelete.addEventListener('click', function() {
        if (confirm('Anda yakin ingin menghapus permintaan ini?')) {
            // Di sini seharusnya ada request ke API untuk hapus data
            alert('Permintaan telah dihapus!');
            // Redirect atau reset UI
            window.location.href = window.location.pathname;
        }
    });
    
    btnMessage.addEventListener('click', function() {
        messageModal.style.display = 'flex';
    });
    
    closeModal.addEventListener('click', function() {
        messageModal.style.display = 'none';
    });
    
    sendMessageBtn.addEventListener('click', function() {
        const messageText = document.getElementById('message-text').value;
        if (messageText.trim() === '') {
            alert('Silakan isi pesan terlebih dahulu!');
            return;
        }
        
        // Di sini seharusnya ada request ke API untuk mengirim pesan ke bot
        alert(`Pesan "${messageText}" telah dikirim ke bot!`);
        document.getElementById('message-text').value = '';
        messageModal.style.display = 'none';
    });
    
    // Tutup modal ketika klik di luar konten modal
    window.addEventListener('click', function(event) {
        if (event.target === messageModal) {
            messageModal.style.display = 'none';
        }
    });
    
    // Muat data saat halaman dimuat
    loadRequestData();
});
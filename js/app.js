/**
 * GÜRKAN YAPI MALZEMELERİ - KURUMSAL SEVKİYAT TAKİP YÖNETİCİSİ
 */

// Kullanıcı isteği üzerine başlangıç pazarlamacı listesi boş bırakılmıştır
const DEFAULT_REPRESENTATIVES = [];

class ShipmentApp {
  constructor() {
    this.shipments = [];
    this.disabledDays = [];
    this.representatives = [];
    this.currentWeekStart = this.getMonday(new Date());
    this.draggedShipmentId = null;
    this.searchTerm = '';
    this.statusFilter = 'ALL';
    this.editingShipmentId = null;

    this.initElements();
    this.loadData();
    this.initEventListeners();
    this.initSyncEngine();
    this.render();
  }

  // --- 1. ELEMENT REFERANSLARI ---
  initElements() {
    this.weeklyGridEl = document.getElementById('weeklyGrid');
    this.weekTitleEl = document.getElementById('weekTitle');
    this.prevWeekBtn = document.getElementById('prevWeekBtn');
    this.nextWeekBtn = document.getElementById('nextWeekBtn');
    this.todayWeekBtn = document.getElementById('todayWeekBtn');

    this.totalCountEl = document.getElementById('totalCount');
    this.pendingCountEl = document.getElementById('pendingCount');
    this.transitCountEl = document.getElementById('transitCount');
    this.deliveredCountEl = document.getElementById('deliveredCount');

    this.searchInput = document.getElementById('searchInput');
    this.filterStatusSelect = document.getElementById('filterStatusSelect');
    this.newShipmentBtn = document.getElementById('newShipmentBtn');
    this.manageRepsBtn = document.getElementById('manageRepsBtn');
    this.audioToggleBtn = document.getElementById('audioToggleBtn');
    this.testSoundBtn = document.getElementById('testSoundBtn');

    this.shipmentModal = document.getElementById('shipmentModal');
    this.modalTitle = document.getElementById('modalTitle');
    this.shipmentForm = document.getElementById('shipmentForm');
    this.closeModalBtn = document.getElementById('closeModalBtn');
    this.cancelModalBtn = document.getElementById('cancelModalBtn');

    this.inputDaySelect = document.getElementById('inputDay');
    this.inputOrderSelect = document.getElementById('inputShipmentOrder');
    this.inputRepSelect = document.getElementById('inputRepresentative');

    // Pazarlamacı Yönetimi Modal Elemanları
    this.repManagerModal = document.getElementById('repManagerModal');
    this.closeRepModalBtn = document.getElementById('closeRepModalBtn');
    this.doneRepModalBtn = document.getElementById('doneRepModalBtn');
    this.newRepInput = document.getElementById('newRepInput');
    this.addRepBtn = document.getElementById('addRepBtn');
    this.repListEl = document.getElementById('repListEl');

    this.toastContainer = document.getElementById('toastContainer');
  }

  // --- 2. VERİ YÜKLEME & KAYDETME ---
  loadData() {
    const saved = localStorage.getItem('sevkiyat_data_v1');
    const savedDisabled = localStorage.getItem('sevkiyat_disabled_days_v1');
    const savedReps = localStorage.getItem('sevkiyat_reps_v1');
    const baseWeekKey = this.getWeekKey(this.getMonday(new Date()));

    if (savedReps) {
      try {
        const parsedReps = JSON.parse(savedReps);
        const oldMockSample = ["Mehmet Kaya (Saha Satış)", "Ahmet Yılmaz (Mağaza)"];
        if (parsedReps.length > 0 && oldMockSample.some(m => parsedReps.includes(m))) {
          this.representatives = [];
          localStorage.setItem('sevkiyat_reps_v1', JSON.stringify([]));
        } else {
          this.representatives = parsedReps;
        }
      } catch (e) {
        this.representatives = [];
      }
    } else {
      this.representatives = [];
      localStorage.setItem('sevkiyat_reps_v1', JSON.stringify(this.representatives));
    }

    if (saved) {
      try {
        const parsed = JSON.parse(saved);
        this.shipments = parsed.map(s => {
          if (!s.weekKey) s.weekKey = baseWeekKey;
          if (!s.representative) s.representative = 'Belirtilmedi';
          if (!s.createdAt) s.createdAt = new Date().toISOString();
          return s;
        });
      } catch (e) {
        this.shipments = INITIAL_SHIPMENTS.map(s => ({ ...s, weekKey: baseWeekKey }));
      }
    } else {
      this.shipments = INITIAL_SHIPMENTS.map(s => ({ ...s, weekKey: baseWeekKey }));
      this.saveData();
    }

    if (savedDisabled) {
      try {
        this.disabledDays = JSON.parse(savedDisabled);
      } catch (e) {
        this.disabledDays = [];
      }
    }

    this.populateRepDropdown();
  }

  saveData(notifySync = false, actionType = 'UPDATE', payloadData = null) {
    localStorage.setItem('sevkiyat_data_v1', JSON.stringify(this.shipments));
    localStorage.setItem('sevkiyat_disabled_days_v1', JSON.stringify(this.disabledDays));
    localStorage.setItem('sevkiyat_reps_v1', JSON.stringify(this.representatives));
    
    if (notifySync && window.syncManager) {
      window.syncManager.broadcast(actionType, payloadData || this.shipments);
    }
    this.updateMetrics();
  }

  populateRepDropdown() {
    this.inputRepSelect.innerHTML = '';

    if (this.representatives.length === 0) {
      const opt = document.createElement('option');
      opt.value = 'Belirtilmedi';
      opt.textContent = '-- Pazarlamacı Eklenmedi (Yönetimden Ekleyin) --';
      this.inputRepSelect.appendChild(opt);
    } else {
      this.representatives.forEach(rep => {
        const opt = document.createElement('option');
        opt.value = rep;
        opt.textContent = rep;
        this.inputRepSelect.appendChild(opt);
      });
    }
  }

  getWeekKey(mondayDate) {
    const d = new Date(mondayDate);
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  formatDateTime(isoStr) {
    if (!isoStr) return '';
    try {
      const d = new Date(isoStr);
      const options = { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' };
      return d.toLocaleDateString('tr-TR', options);
    } catch (e) {
      return '';
    }
  }

  isDayDisabled(dayIndex) {
    const currentWeekKey = this.getWeekKey(this.currentWeekStart);
    return this.disabledDays.some(d => d.weekKey === currentWeekKey && d.dayIndex === dayIndex);
  }

  toggleDayDisabled(dayIndex, dayName) {
    const currentWeekKey = this.getWeekKey(this.currentWeekStart);
    const index = this.disabledDays.findIndex(d => d.weekKey === currentWeekKey && d.dayIndex === dayIndex);

    if (index !== -1) {
      this.disabledDays.splice(index, 1);
      this.showToast('Sevk Açıldı', `${dayName} günü sevkiyata tekrar açıldı.`);
    } else {
      this.disabledDays.push({
        weekKey: currentWeekKey,
        dayIndex: dayIndex,
        reason: 'Araç Serviste / Sevk Yok'
      });
      this.showToast('🚫 Araç Serviste', `${dayName} günü araç serviste/sevk kapalı olarak işaretlendi.`);
    }

    this.saveData(true, 'DISABLE_DAY', { weekKey: currentWeekKey, dayIndex });
    this.render();
  }

  getNextAvailableOrder(dayIndex, excludeId = null) {
    const currentWeekKey = this.getWeekKey(this.currentWeekStart);

    const existingOrders = this.shipments
      .filter(s => (s.weekKey === currentWeekKey || !s.weekKey) && s.dayOfWeek === dayIndex && s.id !== excludeId && s.status !== 'İptal')
      .map(s => s.shipmentOrder);

    const availableOrders = ['1. Sevk', '2. Sevk', '3. Sevk', '4. Sevk'];
    
    for (let order of availableOrders) {
      if (!existingOrders.includes(order)) {
        return order;
      }
    }
    return 'Ek Sevk';
  }

  getMonday(d) {
    const date = new Date(d);
    const day = date.getDay();
    const diff = date.getDate() - day + (day === 0 ? -6 : 1);
    return new Date(date.setDate(diff));
  }

  formatDate(date) {
    const options = { day: 'numeric', month: 'long' };
    return date.toLocaleDateString('tr-TR', options);
  }

  getWeekDays() {
    const days = [];
    const monday = new Date(this.currentWeekStart);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    const dayNames = ['Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

    for (let i = 0; i < 6; i++) {
      const dayDate = new Date(monday);
      dayDate.setDate(monday.getDate() + i);
      
      const checkDate = new Date(dayDate);
      checkDate.setHours(0, 0, 0, 0);

      const isToday = checkDate.getTime() === today.getTime();
      const isPast = checkDate.getTime() < today.getTime();

      days.push({
        dayIndex: i + 1,
        name: dayNames[i],
        dateStr: this.formatDate(dayDate),
        fullDate: dayDate,
        isToday: isToday,
        isPast: isPast
      });
    }
    return days;
  }

  initSyncEngine() {
    if (window.syncManager) {
      window.syncManager.onSync((payload) => {
        this.loadData();
        this.render();

        if (payload.action === 'ADD' && payload.data) {
          const item = payload.data;
          this.showToast(
            'Yeni Sevkiyat Eklendi',
            `${item.customerName} (${item.shipmentOrder}) sisteme eklendi.`
          );
        } else if (payload.action === 'UPDATE_REPS') {
          this.showToast('Pazarlamacı Listesi Güncellendi', 'Pazarlamacı/temsilci listesi canlı olarak güncellendi.');
        } else if (payload.action === 'MOVE') {
          this.showToast(
            'Sıralama Güncellendi',
            `Sevkiyat planı canlı olarak güncellendi.`
          );
        }
      });
    }
  }

  initEventListeners() {
    this.prevWeekBtn.addEventListener('click', () => {
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() - 7);
      this.triggerWeekAnimation('prev');
      this.render();
    });

    this.nextWeekBtn.addEventListener('click', () => {
      this.currentWeekStart.setDate(this.currentWeekStart.getDate() + 7);
      this.triggerWeekAnimation('next');
      this.render();
    });

    this.todayWeekBtn.addEventListener('click', () => {
      const todayMonday = this.getMonday(new Date());
      const direction = todayMonday > this.currentWeekStart ? 'next' : 'prev';
      this.currentWeekStart = todayMonday;
      this.triggerWeekAnimation(direction);
      this.render();
    });

    this.searchInput.addEventListener('input', (e) => {
      this.searchTerm = e.target.value.toLowerCase().trim();
      this.renderGridOnly();
    });

    this.filterStatusSelect.addEventListener('change', (e) => {
      this.statusFilter = e.target.value;
      this.renderGridOnly();
    });

    this.audioToggleBtn.addEventListener('click', () => {
      const isMuted = this.audioToggleBtn.classList.contains('muted');
      const newState = isMuted;
      window.syncManager.setAudioEnabled(newState);
      this.updateAudioBtnUI(newState);
    });

    this.testSoundBtn.addEventListener('click', () => {
      window.syncManager.testSound();
      this.showToast('Ses Testi', 'Bildirim sesi çalındı.');
    });

    this.inputDaySelect.addEventListener('change', () => {
      const selectedDay = parseInt(this.inputDaySelect.value, 10);
      const suggestedOrder = this.getNextAvailableOrder(selectedDay, this.editingShipmentId);
      this.inputOrderSelect.value = suggestedOrder;
    });

    this.newShipmentBtn.addEventListener('click', () => this.openModal());
    this.closeModalBtn.addEventListener('click', () => this.closeModal());
    this.cancelModalBtn.addEventListener('click', () => this.closeModal());

    this.shipmentForm.addEventListener('submit', (e) => {
      e.preventDefault();
      this.handleFormSubmit();
    });

    this.manageRepsBtn.addEventListener('click', () => this.openRepManagerModal());
    this.closeRepModalBtn.addEventListener('click', () => this.closeRepManagerModal());
    this.doneRepModalBtn.addEventListener('click', () => this.closeRepManagerModal());

    this.addRepBtn.addEventListener('click', () => this.handleAddRep());
    this.newRepInput.addEventListener('keypress', (e) => {
      if (e.key === 'Enter') {
        e.preventDefault();
        this.handleAddRep();
      }
    });

    this.updateAudioBtnUI(window.syncManager.audioEnabled);
  }

  openRepManagerModal() {
    this.renderRepList();
    this.repManagerModal.classList.add('active');
  }

  closeRepManagerModal() {
    this.repManagerModal.classList.remove('active');
    this.populateRepDropdown();
  }

  renderRepList() {
    this.repListEl.innerHTML = '';
    
    if (this.representatives.length === 0) {
      this.repListEl.innerHTML = `<li class="rep-item" style="color: #64748b; padding: 1rem; text-align: center;">Henüz pazarlamacı eklenmedi. Yukarıdaki kutudan ekleyebilirsiniz.</li>`;
      return;
    }

    this.representatives.forEach((rep, index) => {
      const li = document.createElement('li');
      li.className = 'rep-item';
      li.innerHTML = `
        <span class="rep-item-name">👤 ${rep}</span>
        <div class="rep-item-actions">
          <button class="action-btn edit-rep-btn" title="Düzenle">✏️</button>
          <button class="action-btn delete-rep-btn" title="Sil">🗑️</button>
        </div>
      `;

      li.querySelector('.edit-rep-btn').addEventListener('click', () => {
        const newName = prompt("Pazarlamacı / Temsilci adını düzenleyin:", rep);
        if (newName && newName.trim() && newName.trim() !== rep) {
          const updatedName = newName.trim();
          this.representatives[index] = updatedName;

          this.shipments.forEach(s => {
            if (s.representative === rep) s.representative = updatedName;
          });

          this.saveData(true, 'UPDATE_REPS');
          this.renderRepList();
          this.populateRepDropdown();
          this.render();
          this.showToast('Pazarlamacı Güncellendi', `${rep} ismi "${updatedName}" olarak değiştirildi.`);
        }
      });

      li.querySelector('.delete-rep-btn').addEventListener('click', () => {
        if (confirm(`"${rep}" temsilcisini listeden silmek istediğinize emin misiniz?`)) {
          this.representatives.splice(index, 1);
          this.saveData(true, 'UPDATE_REPS');
          this.renderRepList();
          this.populateRepDropdown();
          this.render();
          this.showToast('Pazarlamacı Silindi', `${rep} listeden silindi.`);
        }
      });

      this.repListEl.appendChild(li);
    });
  }

  handleAddRep() {
    const name = this.newRepInput.value.trim();
    if (!name) {
      alert("Lütfen pazarlamacı / temsilci adı giriniz!");
      return;
    }

    if (this.representatives.includes(name)) {
      alert("Bu pazarlamacı zaten listede ekli!");
      return;
    }

    this.representatives.push(name);
    this.saveData(true, 'UPDATE_REPS');
    this.newRepInput.value = '';
    this.renderRepList();
    this.populateRepDropdown();
    this.showToast('Pazarlamacı Eklendi', `"${name}" pazarlamacı listesine eklendi.`);
  }

  triggerWeekAnimation(direction = 'next') {
    this.weeklyGridEl.classList.remove('slide-next', 'slide-prev');
    void this.weeklyGridEl.offsetWidth;
    this.weeklyGridEl.classList.add(direction === 'next' ? 'slide-next' : 'slide-prev');
    
    setTimeout(() => {
      this.weeklyGridEl.classList.remove('slide-next', 'slide-prev');
    }, 350);
  }

  updateAudioBtnUI(enabled) {
    if (enabled) {
      this.audioToggleBtn.classList.remove('muted');
      this.audioToggleBtn.innerHTML = 'Sesli İkaz Açık';
    } else {
      this.audioToggleBtn.classList.add('muted');
      this.audioToggleBtn.innerHTML = 'Ses Kapalı';
    }
  }

  render() {
    this.renderHeaderDates();
    this.renderGridOnly();
    this.updateMetrics();
  }

  renderHeaderDates() {
    const days = this.getWeekDays();
    const startDate = days[0].dateStr;
    const endDate = days[5].dateStr;
    const year = days[0].fullDate.getFullYear();
    this.weekTitleEl.textContent = `${startDate} - ${endDate} ${year}`;
  }

  renderGridOnly() {
    const days = this.getWeekDays();
    const currentWeekKey = this.getWeekKey(this.currentWeekStart);

    this.weeklyGridEl.innerHTML = '';

    days.forEach(day => {
      const isDayDisabled = this.isDayDisabled(day.dayIndex);

      const dayShipments = this.shipments.filter(s => {
        const itemWeekKey = s.weekKey || currentWeekKey;
        if (itemWeekKey !== currentWeekKey) return false;
        if (s.dayOfWeek !== day.dayIndex) return false;

        if (this.searchTerm) {
          const matchTarget = `${s.customerName} ${s.representative} ${s.deliveryAddress} ${s.notes}`.toLowerCase();
          if (!matchTarget.includes(this.searchTerm)) return false;
        }

        if (this.statusFilter !== 'ALL' && s.status !== this.statusFilter) {
          return false;
        }

        return true;
      });

      const orderRank = { '1. Sevk': 1, '2. Sevk': 2, '3. Sevk': 3, '4. Sevk': 4, 'Ek Sevk': 5 };
      dayShipments.sort((a, b) => (orderRank[a.shipmentOrder] || 99) - (orderRank[b.shipmentOrder] || 99));

      const totalCount = dayShipments.length;
      const isOverCapacity = totalCount > 4 && !isDayDisabled;
      const capacityPercent = Math.min(100, Math.round((totalCount / 4) * 100));

      const colEl = document.createElement('div');
      colEl.className = `day-column ${day.isToday ? 'today' : ''} ${day.isPast ? 'past-day' : ''} ${isOverCapacity ? 'over-capacity' : ''} ${isDayDisabled ? 'is-out-of-service' : ''}`;
      colEl.dataset.dayIndex = day.dayIndex;

      colEl.innerHTML = `
        <div class="day-header ${day.isToday ? 'today-header' : ''} ${isOverCapacity ? 'over-capacity-header' : ''} ${isDayDisabled ? 'out-of-service-header' : ''}">
          <div class="day-header-top">
            <div class="day-title-group">
              <span class="day-name">${day.name}</span>
              <span class="day-date">${day.dateStr}</span>
            </div>
            <div class="day-header-controls">
              <button class="toggle-service-btn ${isDayDisabled ? 'active' : ''}" title="${day.name} günü için Araç Serviste / Sevk İptali İşaretle">🚫</button>
              <button class="print-day-btn" title="${day.name} Yükleme Listesini Yazdır">🖨️</button>
              <span class="shipment-count-badge ${isOverCapacity ? 'over-capacity-badge' : ''}">
                ${isDayDisabled ? 'SEVK YOK' : (isOverCapacity ? 'Kapasite Aşımı (' + totalCount + ')' : totalCount + ' Sevkiyat')}
              </span>
            </div>
          </div>

          ${!isDayDisabled ? `
            <div class="capacity-label">
              <span>Kapasite Doluluk</span>
              <span>%${capacityPercent}</span>
            </div>
            <div class="capacity-progress-bar">
              <div class="capacity-fill ${isOverCapacity ? 'over' : ''}" style="width: ${capacityPercent}%;"></div>
            </div>
          ` : ''}
        </div>
        <div class="cards-dropzone" data-day-index="${day.dayIndex}"></div>
      `;

      colEl.querySelector('.toggle-service-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.toggleDayDisabled(day.dayIndex, day.name);
      });

      colEl.querySelector('.print-day-btn').addEventListener('click', (e) => {
        e.stopPropagation();
        this.printDayManifest(day.name, day.dateStr, dayShipments);
      });

      const dropzone = colEl.querySelector('.cards-dropzone');

      if (isDayDisabled) {
        dropzone.innerHTML = `
          <div class="out-of-service-banner">
            <span class="title">🚫 ARAÇ SERVİSTE / SEVK YOK</span>
            <span class="desc">Araç bakımda veya bu gün için sevk alımı kapatılmıştır.</span>
          </div>
        `;
        if (dayShipments.length > 0) {
          dayShipments.forEach(shipment => {
            const cardEl = this.createShipmentCard(shipment);
            dropzone.appendChild(cardEl);
          });
        }
      } else if (dayShipments.length === 0) {
        dropzone.innerHTML = `<div class="empty-day-state">Sevkiyat Bulunmuyor</div>`;
      } else {
        dayShipments.forEach(shipment => {
          const cardEl = this.createShipmentCard(shipment);
          dropzone.appendChild(cardEl);
        });
      }

      this.attachDropzoneEvents(dropzone);
      this.weeklyGridEl.appendChild(colEl);
    });
  }

  extractDistrict(address) {
    if (!address) return null;
    const knownDistricts = [
      'Kadıköy', 'Ataşehir', 'Ümraniye', 'Maltepe', 'Kartal', 'Pendik', 'Tuzla',
      'Üsküdar', 'Beykoz', 'Sancaktepe', 'Sultanbeyli', 'Şile', 'Çekmeköy',
      'Beşiktaş', 'Şişli', 'Sarıyer', 'Fatih', 'Zeytinburnu', 'Bakırköy', 'Başakşehir'
    ];

    for (let district of knownDistricts) {
      if (address.toLowerCase().includes(district.toLowerCase())) {
        return district;
      }
    }
    return null;
  }

  createShipmentCard(shipment) {
    const card = document.createElement('div');
    
    const isCancelled = shipment.status === 'İptal';
    const isDelivered = shipment.status === 'Teslim Edildi';
    const isPreparing = shipment.status === 'Hazırlanıyor';
    const isNewShipment = shipment.isNew || (shipment.createdAt && (Date.now() - new Date(shipment.createdAt).getTime()) < 2 * 60 * 60 * 1000);

    card.className = `shipment-card ${isCancelled ? 'is-cancelled' : ''} ${isDelivered ? 'is-delivered' : ''} ${isPreparing ? 'is-preparing' : ''} ${isNewShipment && !isCancelled && !isDelivered ? 'is-new' : ''}`;
    card.draggable = true;
    card.dataset.id = shipment.id;

    const statusSlug = shipment.status.toLowerCase().replace(/\s+/g, '-').replace(/ı/g, 'i').replace(/ş/g, 's');

    let statusText = shipment.status;
    if (isDelivered) statusText = '✓ TESLİM EDİLDİ';
    else if (isPreparing) statusText = '⚡ HAZIRLANIYOR';
    else if (isCancelled) statusText = '✕ İPTAL EDİLDİ';
    else if (shipment.status === 'Beklemede') statusText = '⏳ BEKLEMEDE';
    else if (shipment.status === 'Yolda') statusText = '🚛 YOLDA';

    const district = this.extractDistrict(shipment.deliveryAddress);
    const formattedCreatedDate = this.formatDateTime(shipment.createdAt);

    card.innerHTML = `
      ${isNewShipment && !isCancelled && !isDelivered ? `
        <div class="floating-new-badge-on-top">✨ YENİ SEVKİYAT</div>
      ` : ''}

      <div class="card-top">
        <div class="order-handle-group" title="Sıralamayı değiştirmek için sürükleyin">
          <span class="drag-handle-icon">⋮⋮</span>
          <span class="order-badge">${shipment.shipmentOrder || '1. Sevk'}</span>
        </div>
        <div class="status-pill status-${statusSlug}" title="Tıklayarak durumu hızlıca değiştirin">
          <span>${statusText}</span>
        </div>
      </div>

      <div class="card-customer-title" title="Müşteri / Alıcı">
        <span>${shipment.customerName || 'Alıcı Unvanı Yok'}</span>
      </div>

      <div class="card-meta-bar">
        <span class="rep-tag" title="Pazarlamacı / Temsilci">
          👤 ${shipment.representative || 'Belirtilmedi'}
        </span>
        ${formattedCreatedDate ? `<span class="created-at-tag" title="Kayıt / Ekleme Zamanı">🕒 ${formattedCreatedDate}</span>` : ''}
      </div>

      <div class="card-address-box" title="Teslimat Adresi">
        ${district ? `<span class="district-pill">📍 ${district}</span>` : ''}
        <span class="address-text">${shipment.deliveryAddress || 'Adres Girilmedi'}</span>
      </div>

      ${shipment.notes ? `<div class="card-note-snippet">Not: ${shipment.notes}</div>` : ''}

      <div class="card-footer">
        <span class="time-tag">${shipment.timeOfDay || 'Gün Boyu / Esnek'}</span>
        <div class="card-actions">
          <button class="action-btn edit-btn" title="Düzenle">✏️</button>
          <button class="action-btn delete-btn" title="Sil">🗑️</button>
        </div>
      </div>
    `;

    card.querySelector('.status-pill').addEventListener('click', (e) => {
      e.stopPropagation();
      this.cycleShipmentStatus(shipment.id);
    });

    card.addEventListener('dragstart', (e) => {
      this.draggedShipmentId = shipment.id;
      card.classList.add('dragging');
      e.dataTransfer.setData('text/plain', shipment.id);
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragend', () => {
      card.classList.remove('dragging');
      this.draggedShipmentId = null;
    });

    card.querySelector('.edit-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.openModal(shipment);
    });

    card.querySelector('.delete-btn').addEventListener('click', (e) => {
      e.stopPropagation();
      this.deleteShipment(shipment.id);
    });

    return card;
  }

  cycleShipmentStatus(id) {
    const statusCycle = ['Beklemede', 'Hazırlanıyor', 'Yolda', 'Teslim Edildi', 'İptal'];
    const shipment = this.shipments.find(s => s.id === id);
    if (!shipment) return;

    const currentIndex = statusCycle.indexOf(shipment.status);
    const nextStatus = statusCycle[(currentIndex + 1) % statusCycle.length];

    shipment.status = nextStatus;
    this.saveData(true, 'UPDATE', shipment);
    this.render();

    if (window.syncManager) {
      window.syncManager.playAlertSound('update_shipment');
    }

    this.showToast('Durum Güncellendi', `${shipment.customerName} durumu "${nextStatus}" olarak değiştirildi.`);
  }

  printDayManifest(dayName, dateStr, shipments) {
    const printWindow = window.open('', '_blank');
    if (!printWindow) return;

    const rowsHtml = shipments.map((s, i) => `
      <tr>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center; font-weight: bold;">${s.shipmentOrder || (i + 1) + '. Sevk'}</td>
        <td style="padding: 10px; border: 1px solid #ddd; font-weight: bold;">${s.customerName}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${s.representative || 'Belirtilmedi'}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${s.deliveryAddress}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${s.timeOfDay}</td>
        <td style="padding: 10px; border: 1px solid #ddd;">${s.status}</td>
        <td style="padding: 10px; border: 1px solid #ddd; text-align: center;">[  ]</td>
      </tr>
    `).join('');

    printWindow.document.write(`
      <!DOCTYPE html>
      <html>
      <head>
        <title>Gürkan Yapı Malzemeleri - Yükleme Listesi (${dayName} ${dateStr})</title>
        <style>
          body { font-family: sans-serif; padding: 20px; color: #000; }
          h2 { text-transform: uppercase; margin-bottom: 5px; }
          table { width: 100%; border-collapse: collapse; margin-top: 15px; }
          th { background: #0f172a; color: #fff; padding: 10px; text-align: left; }
        </style>
      </head>
      <body>
        <h2>GÜRKAN YAPI MALZEMELERİ</h2>
        <p><strong>Yükleme & Sevkiyat Listesi:</strong> ${dayName} (${dateStr})</p>
        <table>
          <thead>
            <tr>
              <th>Sıra</th>
              <th>Müşteri / Unvan</th>
              <th>Pazarlamacı</th>
              <th>Teslimat Adresi</th>
              <th>Zaman</th>
              <th>Durum</th>
              <th>Teslim İmzası</th>
            </tr>
          </thead>
          <tbody>
            ${rowsHtml || '<tr><td colspan="7" style="padding: 15px; text-align: center;">Sevkiyat Kaydı Yok</td></tr>'}
          </tbody>
        </table>
        <script>
          window.onload = function() { window.print(); window.close(); };
        </script>
      </body>
      </html>
    `);
    printWindow.document.close();
  }

  attachDropzoneEvents(dropzone) {
    const targetDayIndex = parseInt(dropzone.dataset.dayIndex, 10);

    dropzone.addEventListener('dragover', (e) => {
      if (this.isDayDisabled(targetDayIndex)) {
        return;
      }

      e.preventDefault();
      e.dataTransfer.dropEffect = 'move';
      dropzone.classList.add('drag-over');

      const draggingCard = document.querySelector('.shipment-card.dragging');
      if (!draggingCard) return;

      const afterElement = this.getDragAfterElement(dropzone, e.clientY);
      if (afterElement == null) {
        dropzone.appendChild(draggingCard);
      } else {
        dropzone.insertBefore(draggingCard, afterElement);
      }
    });

    dropzone.addEventListener('dragleave', (e) => {
      if (!dropzone.contains(e.relatedTarget)) {
        dropzone.classList.remove('drag-over');
      }
    });

    dropzone.addEventListener('drop', (e) => {
      e.preventDefault();
      dropzone.classList.remove('drag-over');

      const draggedId = this.draggedShipmentId;

      if (!draggedId || !targetDayIndex) return;

      if (this.isDayDisabled(targetDayIndex)) {
        alert("Bu gün araç serviste/sevk kapalı olarak işaretlendiği için sevkiyat bu güne taşınamaz!");
        this.render();
        return;
      }

      const currentWeekKey = this.getWeekKey(this.currentWeekStart);

      const cardElements = Array.from(dropzone.querySelectorAll('.shipment-card'));
      const availableOrders = ['1. Sevk', '2. Sevk', '3. Sevk', '4. Sevk'];

      cardElements.forEach((cardEl, index) => {
        const shipmentId = cardEl.dataset.id;
        const shipment = this.shipments.find(s => s.id === shipmentId);
        if (shipment) {
          shipment.dayOfWeek = targetDayIndex;
          shipment.weekKey = currentWeekKey;
          if (index < availableOrders.length) {
            shipment.shipmentOrder = availableOrders[index];
          } else {
            shipment.shipmentOrder = 'Ek Sevk';
          }
        }
      });

      this.saveData(true, 'MOVE', { dayIndex: targetDayIndex });
      this.render();

      if (window.syncManager) {
        window.syncManager.playAlertSound('update_shipment');
      }

      const dayNames = ['', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];
      this.showToast('Sıralama Güncellendi', `${dayNames[targetDayIndex]} günü sevk sırası güncellendi.`);
    });
  }

  getDragAfterElement(container, y) {
    const draggableElements = [...container.querySelectorAll('.shipment-card:not(.dragging)')];

    return draggableElements.reduce((closest, child) => {
      const box = child.getBoundingClientRect();
      const offset = y - box.top - box.height / 2;
      if (offset < 0 && offset > closest.offset) {
        return { offset: offset, element: child };
      } else {
        return closest;
      }
    }, { offset: Number.NEGATIVE_INFINITY }).element;
  }

  openModal(shipment = null) {
    this.editingShipmentId = shipment ? shipment.id : null;
    this.populateRepDropdown();

    if (shipment) {
      this.modalTitle.textContent = 'SEVKİYAT DÜZENLE';
      document.getElementById('inputDay').value = shipment.dayOfWeek;
      document.getElementById('inputShipmentOrder').value = shipment.shipmentOrder || '1. Sevk';
      document.getElementById('inputRepresentative').value = shipment.representative || (this.representatives[0] || 'Belirtilmedi');
      document.getElementById('inputCustomerName').value = shipment.customerName || '';
      document.getElementById('inputAddress').value = shipment.deliveryAddress || '';
      document.getElementById('inputStatus').value = shipment.status;
      document.getElementById('inputTimeOfDay').value = shipment.timeOfDay || 'Sabah Sevkiyatı';
      document.getElementById('inputNotes').value = shipment.notes || '';
    } else {
      this.modalTitle.textContent = 'YENİ SEVKİYAT GİRİŞİ';
      this.shipmentForm.reset();

      const defaultDay = 1;
      document.getElementById('inputDay').value = defaultDay;
      document.getElementById('inputShipmentOrder').value = this.getNextAvailableOrder(defaultDay);
      document.getElementById('inputTimeOfDay').value = 'Sabah Sevkiyatı';
      if (this.representatives.length > 0) {
        document.getElementById('inputRepresentative').value = this.representatives[0];
      }
    }

    this.shipmentModal.classList.add('active');
  }

  closeModal() {
    this.shipmentModal.classList.remove('active');
    this.editingShipmentId = null;
  }

  handleFormSubmit() {
    const dayOfWeek = parseInt(document.getElementById('inputDay').value, 10);
    const shipmentOrder = document.getElementById('inputShipmentOrder').value;
    const timeOfDay = document.getElementById('inputTimeOfDay').value;
    const representative = document.getElementById('inputRepresentative').value || 'Belirtilmedi';
    const customerName = document.getElementById('inputCustomerName').value.trim();
    const deliveryAddress = document.getElementById('inputAddress').value.trim();
    const status = document.getElementById('inputStatus').value;
    const notes = document.getElementById('inputNotes').value.trim();
    const currentWeekKey = this.getWeekKey(this.currentWeekStart);

    if (!customerName || !deliveryAddress) {
      alert("Lütfen Müşteri Unvanı ve Teslimat Adresini giriniz!");
      return;
    }

    if (this.isDayDisabled(dayOfWeek)) {
      alert("Seçilen gün için araç serviste/sevk kapalı olarak işaretlenmiştir! Lütfen başka bir gün seçin.");
      return;
    }

    if (this.editingShipmentId) {
      const index = this.shipments.findIndex(s => s.id === this.editingShipmentId);
      if (index !== -1) {
        this.shipments[index] = {
          ...this.shipments[index],
          customerName, representative, deliveryAddress, shipmentOrder,
          dayOfWeek, status, timeOfDay, notes, weekKey: currentWeekKey
        };
        this.saveData(true, 'UPDATE', this.shipments[index]);
        this.showToast('Sevkiyat Güncellendi', `${customerName} (${shipmentOrder}) güncellendi.`);
      }
    } else {
      const newShipment = {
        id: 'SEV-' + Date.now().toString().slice(-5),
        customerName, representative, deliveryAddress, shipmentOrder,
        dayOfWeek, status, timeOfDay, notes,
        weekKey: currentWeekKey,
        isNew: true,
        createdAt: new Date().toISOString()
      };

      this.shipments.push(newShipment);
      this.saveData(true, 'ADD', newShipment);
      
      if (window.syncManager) {
        window.syncManager.playAlertSound('new_shipment');
      }

      this.showToast(
        'Yeni Sevkiyat Eklendi',
        `${customerName} için ${shipmentOrder} girişi yapıldı.`
      );
    }

    this.closeModal();
    this.render();
  }

  deleteShipment(id) {
    const shipment = this.shipments.find(s => s.id === id);
    if (!shipment) return;

    if (confirm(`${shipment.customerName} sevkiyat kaydını silmek istediğinize emin misiniz?`)) {
      this.shipments = this.shipments.filter(s => s.id !== id);
      this.saveData(true, 'DELETE', { id });
      this.render();
      this.showToast('Kayıt Silindi', 'Sevkiyat kaydı silindi.');
    }
  }

  updateMetrics() {
    const currentWeekKey = this.getWeekKey(this.currentWeekStart);
    const activeShipments = this.shipments.filter(s => (s.weekKey || currentWeekKey) === currentWeekKey);

    const total = activeShipments.length;
    const pending = activeShipments.filter(s => s.status === 'Beklemede').length;
    const transit = activeShipments.filter(s => s.status === 'Yolda' || s.status === 'Hazırlanıyor').length;
    const delivered = activeShipments.filter(s => s.status === 'Teslim Edildi').length;

    this.totalCountEl.textContent = total;
    this.pendingCountEl.textContent = pending;
    this.transitCountEl.textContent = transit;
    this.deliveredCountEl.textContent = delivered;
  }

  showToast(title, desc) {
    const toast = document.createElement('div');
    toast.className = 'toast-item';
    toast.innerHTML = `
      <div class="toast-content">
        <div class="title">${title}</div>
        <div class="desc">${desc}</div>
      </div>
    `;

    this.toastContainer.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateX(100%)';
      toast.style.transition = 'all 0.3s ease';
      setTimeout(() => toast.remove(), 300);
    }, 4000);
  }
}

document.addEventListener('DOMContentLoaded', () => {
  window.app = new ShipmentApp();
});

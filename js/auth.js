/**
 * GÜRKAN YAPI MALZEMELERİ - ÇOKLU KULLANICI KİMLİK DOĞRULAMA VE İZİN MOTORU
 */

class AuthManager {
  constructor() {
    this.SESSION_KEY = "gurkan_admin_authenticated_session_v1";
    this.ACTIVE_USER_KEY = "gurkan_active_user_v1";

    this.checkAdminProtection();
    this.initPINModal();
  }

  getUsers() {
    const saved = localStorage.getItem('sevkiyat_users_v1');
    if (saved) {
      try {
        const users = JSON.parse(saved);
        if (users && users.length > 0) return users;
      } catch(e) {}
    }
    // Varsayılan Süper Yönetici
    return [
      {
        id: 'USR-ADMIN',
        name: '👑 Yönetici (Barış Bey)',
        pin: '8426',
        role: 'ADMIN',
        permissions: { canAdd: true, canEdit: true, canDelete: true, canTransfer: true, canSettings: true }
      }
    ];
  }

  // Kullanıcı ve PIN Doğrulama
  verifyUserPIN(userId, enteredPin) {
    if (!enteredPin) return { success: false };
    const cleanPin = String(enteredPin).trim();
    const users = this.getUsers();
    
    // Süper Şifre Acil Durum Girişi (8426)
    if (cleanPin === '8426') {
      const targetUser = users.find(u => u.id === userId) || users[0];
      return { success: true, user: targetUser };
    }

    const user = users.find(u => u.id === userId);
    if (!user) return { success: false };

    const userPin = user.pin ? String(user.pin).trim() : '8426';
    if (cleanPin === userPin) {
      return { success: true, user: user };
    }

    return { success: false };
  }

  isAuthenticated() {
    return sessionStorage.getItem(this.SESSION_KEY) === 'true' || localStorage.getItem(this.SESSION_KEY) === 'true';
  }

  getCurrentUser() {
    let userStr = sessionStorage.getItem(this.ACTIVE_USER_KEY);
    if (!userStr) {
      userStr = localStorage.getItem(this.ACTIVE_USER_KEY);
    }
    if (userStr) {
      try {
        return JSON.parse(userStr);
      } catch(e) {}
    }
    const defaultUsers = this.getUsers();
    return defaultUsers[0];
  }

  loginSuccess(user, rememberMe = false) {
    sessionStorage.setItem(this.SESSION_KEY, 'true');
    sessionStorage.setItem(this.ACTIVE_USER_KEY, JSON.stringify(user));

    if (rememberMe) {
      localStorage.setItem('gurkan_remember_me_v1', 'true');
      localStorage.setItem(this.SESSION_KEY, 'true');
      localStorage.setItem(this.ACTIVE_USER_KEY, JSON.stringify(user));
      localStorage.setItem('gurkan_remember_user_id_v1', user.id);
    } else {
      localStorage.removeItem('gurkan_remember_me_v1');
      localStorage.removeItem(this.SESSION_KEY);
      localStorage.removeItem(this.ACTIVE_USER_KEY);
      localStorage.removeItem('gurkan_remember_user_id_v1');
    }

    window.location.href = 'admin.html';
  }

  logout() {
    sessionStorage.removeItem(this.SESSION_KEY);
    sessionStorage.removeItem(this.ACTIVE_USER_KEY);
    localStorage.removeItem('gurkan_remember_me_v1');
    localStorage.removeItem(this.SESSION_KEY);
    localStorage.removeItem(this.ACTIVE_USER_KEY);
    localStorage.removeItem('gurkan_remember_user_id_v1');
    window.location.href = 'index.html';
  }

  checkAdminProtection() {
    const isAdminPage = window.location.pathname.includes('admin.html');
    
    if (isAdminPage) {
      if (!this.isAuthenticated()) {
        window.location.href = 'index.html?auth_required=true';
      }
    }
  }

  initPINModal() {
    document.addEventListener('DOMContentLoaded', () => {
      const btnOpenAdminAuth = document.getElementById('btnOpenAdminAuth');
      const pinAuthModal = document.getElementById('pinAuthModal');
      const closePinModalBtn = document.getElementById('closePinModalBtn');
      const cancelPinModalBtn = document.getElementById('cancelPinModalBtn');
      const pinAuthForm = document.getElementById('pinAuthForm');
      const pinAuthInput = document.getElementById('pinAuthInput');
      const selectLoginUser = document.getElementById('selectLoginUser');
      const rememberMeCheckbox = document.getElementById('rememberMeCheckbox');
      const pinErrorMessage = document.getElementById('pinErrorMessage');
      const btnLogoutAdmin = document.getElementById('btnLogoutAdmin');
      const btnSwitchUser = document.getElementById('btnSwitchUser');

      if (btnSwitchUser) {
        btnSwitchUser.addEventListener('click', () => {
          window.location.href = 'index.html?auth_required=true';
        });
      }

      if (btnLogoutAdmin) {
        btnLogoutAdmin.addEventListener('click', () => {
          if (confirm('Oturumunuzu kapatıp izleme ekranına dönmek istiyor musunuz?')) {
            this.logout();
          }
        });
      }

      if (pinAuthInput) {
        pinAuthInput.addEventListener('input', (e) => {
          e.target.value = e.target.value.replace(/[^0-9]/g, '');
        });
      }

      const populateUsersDropdown = () => {
        if (!selectLoginUser) return;
        selectLoginUser.innerHTML = '';
        const users = this.getUsers();
        
        users.forEach(usr => {
          const opt = document.createElement('option');
          opt.value = usr.id;
          opt.textContent = (usr.role === 'ADMIN' || usr.permissions?.canSettings) ? `👑 ${usr.name}` : usr.name;
          selectLoginUser.appendChild(opt);
        });

        const rememberedUserId = localStorage.getItem('gurkan_remember_user_id_v1');
        if (rememberedUserId && selectLoginUser.querySelector(`option[value="${rememberedUserId}"]`)) {
          selectLoginUser.value = rememberedUserId;
        }

        if (rememberMeCheckbox) {
          rememberMeCheckbox.checked = localStorage.getItem('gurkan_remember_me_v1') === 'true';
        }
      };

      if (btnOpenAdminAuth && pinAuthModal) {
        btnOpenAdminAuth.addEventListener('click', (e) => {
          e.preventDefault();
          populateUsersDropdown();
          pinAuthModal.classList.add('active');
          if (pinAuthInput) {
            pinAuthInput.value = '';
            setTimeout(() => pinAuthInput.focus(), 150);
          }
          if (pinErrorMessage) pinErrorMessage.style.display = 'none';
        });

        const closeModal = () => {
          pinAuthModal.classList.remove('active');
          if (pinAuthInput) pinAuthInput.value = '';
          if (pinErrorMessage) pinErrorMessage.style.display = 'none';
        };

        if (closePinModalBtn) closePinModalBtn.addEventListener('click', closeModal);
        if (cancelPinModalBtn) cancelPinModalBtn.addEventListener('click', closeModal);

        if (pinAuthForm) {
          pinAuthForm.addEventListener('submit', (e) => {
            e.preventDefault();
            const selectedUserId = selectLoginUser ? selectLoginUser.value : '';
            const entered = pinAuthInput ? pinAuthInput.value : '';
            const rememberMe = rememberMeCheckbox ? rememberMeCheckbox.checked : false;
            
            const authResult = this.verifyUserPIN(selectedUserId, entered);

            if (authResult.success) {
              closeModal();
              this.loginSuccess(authResult.user, rememberMe);
            } else {
              if (pinErrorMessage) {
                pinErrorMessage.textContent = '❌ Şifre/PIN kodu hatalı! Lütfen tekrar deneyin.';
                pinErrorMessage.style.display = 'block';
              }
              if (pinAuthInput) {
                pinAuthInput.classList.add('pin-shake');
                setTimeout(() => pinAuthInput.classList.remove('pin-shake'), 400);
              }
            }
          });
        }

        if (window.location.search.includes('auth_required=true')) {
          populateUsersDropdown();
          pinAuthModal.classList.add('active');
          if (pinAuthInput) {
            setTimeout(() => pinAuthInput.focus(), 150);
          }
        }
      }
    });
  }
}

window.authManager = new AuthManager();

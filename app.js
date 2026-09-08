// System Config
const jsPDF = window.jspdf ? window.jspdf.jsPDF : null;
const $ = id => document.getElementById(id);

const API_URL = 'https://pixelme-back.onrender.com/api';

// 🔴 🔴 🔴 3. เอา Client ID ของคุณมาใส่ตรงนี้อีก 1 ที่ 🔴 🔴 🔴
const GOOGLE_CLIENT_ID = '69202104731-mjr9km6etjdslf3ljmkc77bc5nfacekj.apps.googleusercontent.com';

let selectedFiles = [], appWorkspaces = [], recentColors = [];
let userTier = 'BASIC'; 
let activeTab = 'AUTO'; 
let isHorizontal = false;
let currentSlide = 0;
let manualCount = 1;
const defaultSwatches = ['#EF4444', '#F97316', '#F59E0B', '#84CC16', '#10B981', '#06B6D4', '#3B82F6', '#6366F1', '#8B5CF6', '#D946EF', '#F43F5E', '#000000', '#6B7280', '#FFFFFF'];
// 🟢 สร้างตัวแปรเก็บค่าสี Fixed Palette เริ่มต้น (เตรียมเผื่อไว้สูงสุด 100 สีสำหรับ Premium)
// 🟢 สร้างตัวแปรเก็บค่าสี Fixed Palette เริ่มต้น
let globalFixedPalette = ['#EF4444','#F97316','#F59E0B','#84CC16','#10B981','#06B6D4','#3B82F6','#6366F1','#8B5CF6','#D946EF','#F43F5E','#000000','#6B7280','#9CA3AF','#FFFFFF'];
for(let i=15; i<100; i++) globalFixedPalette.push('#FFFFFF'); 

const renderFixedPalette = () => {
    const box = $('fixedPaletteBox');
    if (!box) return;
    
    let isBasic = (userTier === 'BASIC' && activeQuotaMode !== 'TRIAL');
    let maxC = isBasic ? 15 : (parseInt($('globalColors').value) || 24);
    
    let html = '';
    for (let i = 0; i < maxC; i++) {
        html += `<div style="display:flex; flex-direction:column; align-items:center; gap:4px;">
                    <input type="color" class="fixed-color-pick" data-idx="${i}" value="${globalFixedPalette[i]}" style="width:32px; height:32px; border:none; border-radius:8px; cursor:pointer; padding:0; background:transparent;">
                    <span style="font-size:10px; color:var(--text-mut); font-weight:bold;">${i+1}</span>
                 </div>`;
    }
    box.innerHTML = html;
    
    box.querySelectorAll('.fixed-color-pick').forEach(inp => {
        // 🟢 เปลี่ยนมาใช้ 'input' เพื่อให้สีในภาพเปลี่ยนตามทันทีตอนลากเมาส์
        inp.addEventListener('input', (e) => {
            let hex = e.target.value.toUpperCase();
            let idx = parseInt(e.target.dataset.idx);
            globalFixedPalette[idx] = hex;

            // 🟢 วิ่งไปสั่งอัปเดตทุกภาพที่เปิดโหมด Fixed ไว้แบบ Real-time
            appWorkspaces.forEach(ws => {
                if(ws.isFixed && ws.updateFixedColor) {
                    ws.updateFixedColor(idx, hex);
                }
            });
        });
    });
};
// 🟢 ฟังก์ชันสำหรับเปิด/ปิดกล่องสี (สั่งตรงจาก HTML)
window.toggleFixedPalette = (isChecked) => {
    const box = $('fixedPaletteBox');
    if (box) {
        box.style.display = isChecked ? 'flex' : 'none';
        if (isChecked) renderFixedPalette();
    }
};

let sessionUser = null;
let pendingVerificationEmail = ''; // 🟢 เพิ่มตัวแปรสำหรับจำอีเมลที่กำลังรอ OTP
let activeQuotaMode = 'BASIC';

// เอาไปทับฟังก์ชัน showToast เดิมใน app.js
let toastTimeout;
const showToast = (msg, type="success") => {
    const toast = document.getElementById('toast');
    
    // 🟢 สร้างไอคอน SVG แบบ Modern (เส้นเรียบๆ)
    const successIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--success)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"></path><polyline points="22 4 12 14.01 9 11.01"></polyline></svg>`;
    const errorIcon = `<svg viewBox="0 0 24 24" fill="none" stroke="var(--danger)" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"></circle><line x1="15" y1="9" x2="9" y2="15"></line><line x1="9" y1="9" x2="15" y2="15"></line></svg>`;
    
    const icon = type === "error" ? errorIcon : successIcon;
    
    // จัดเลย์เอาต์ใหม่: ซ้ายไอคอน ขวาข้อความ
    toast.innerHTML = `
        <div class="toast-icon">${icon}</div>
        <div class="toast-msg">${msg}</div>
    `;
    
    toast.className = `toast show ${type}`;
    
    clearTimeout(toastTimeout);
    toastTimeout = setTimeout(() => { 
        toast.classList.remove('show'); 
    }, 2000); // ให้อยู่บนจอนานขึ้นนิดนึง (3 วินาที)
};

// --- ⭐ Reviews System ---
const aiReviews = [
    { name: "Daniel", text: "PixelMe changed how I make pixel art! The process is unbelievably fast and accurate." },
    { name: "Sophia", text: "The Paint by Numbers feature is a lifesaver. I use it for my art classes every day." },
    { name: "Michael", text: "I love the Blank Canvas mode. The color picking is so intuitive and smooth." },
    { name: "Emma", text: "Exporting to PDF is seamless. The glassmorphism UI makes it a joy to use." },
    { name: "Oliver", text: "Best web-based pixel art studio! The custom grid options give me full control." },
    { name: "Isabella", text: "Very user-friendly. Even on the basic plan, it delivers top-notch quality." }
];

let storedReviews = JSON.parse(localStorage.getItem('pixelMeReviews')) || [];
let combinedReviews = [];
let currentReviewIdx = 0;

const censorName = (name) => {
    if(!name) return 'A***Z';
    if(name.length <= 2) return name[0] + '***' + (name[1] || '');
    return name[0] + '***' + name[name.length - 1];
};

const shuffleArray = (array) => { return array.slice().sort(() => Math.random() - 0.5); };

const initReviews = () => {
    let all = [...aiReviews, ...storedReviews];
    combinedReviews = shuffleArray(all);
    if(combinedReviews.length < 6) {
        combinedReviews = [...combinedReviews, ...aiReviews].slice(0, 6);
    }
    renderReviews();
};

const renderReviews = () => {
    const track = $('reviewTrack');
    if(!track) return;
    track.innerHTML = '';
    for(let i = 0; i < 3; i++) {
        let idx = (currentReviewIdx + i) % combinedReviews.length;
        let r = combinedReviews[idx];
        let initial = r.name.charAt(0).toUpperCase();
        let censored = censorName(r.name);
        
        track.innerHTML += `
            <div class="review-card">
                <div class="review-card-header">
                    <div class="review-avatar">${initial}</div>
                    <div class="review-name">${censored}</div>
                </div>
                <div class="review-text">"${r.text}"</div>
            </div>
        `;
    }
};

const nextReview = () => { currentReviewIdx = (currentReviewIdx + 1) % combinedReviews.length; renderReviews(); };
const prevReview = () => { currentReviewIdx = (currentReviewIdx - 1 + combinedReviews.length) % combinedReviews.length; renderReviews(); };

const initFAQ = () => {
    document.querySelectorAll('.faq-question').forEach(q => {
        q.addEventListener('click', () => {
            const item = q.parentElement;
            const isActive = item.classList.contains('active');
            document.querySelectorAll('.faq-item').forEach(i => i.classList.remove('active'));
            if (!isActive) item.classList.add('active');
        });
    });
};

const showLimitModal = (typeName, limit) => {
    const title = $('limitModalTitle');
    const desc = $('limitModalDesc');
    title.innerText = "Daily Download Limit Reached";
    let planName = userTier === 'ECO' ? 'Economy' : 'Basic';
    desc.innerHTML = `${planName} Plan is limited to ${limit} ${typeName} downloads per day.<br><br>Please upgrade to a higher plan for more downloads!`;
    $('limitExceededModal').classList.add('show');
};

const askConfirm = (title, callback) => {
    $('confirmTitle').innerText = title;
    $('confirmActionBtn').onclick = () => { callback(); $('customConfirmModal').classList.remove('show'); };
    $('customConfirmModal').classList.add('show');
}
const closeCustomConfirm = () => $('customConfirmModal').classList.remove('show');

// --- 🗄️ Backend Auth System ---
const authArea = $('authArea');
const settingsDropdown = $('settingsDropdown');
const getAuthToken = () => localStorage.getItem('pixelMeToken');

const initAuth = async () => {
    const token = getAuthToken();
    if (!token) { updateAuthUI(); return; }
    try {
        const res = await fetch(`${API_URL}/user/me`, { headers: { 'Authorization': `Bearer ${token}` } });
        if (res.ok) {
            const data = await res.json();
            sessionUser = data.user;
        } else {
            localStorage.removeItem('pixelMeToken');
        }
    } catch (error) { console.error("Auth check failed:", error); }
    updateAuthUI();
};

const updateAuthUI = () => {
    const btnManageSub = $('btnManageSub');
    const btnAccount = $('btnAccount');
    const btnTryPremium = $('btnTryPremium'); 
    const btnToggleMode = $('btnToggleMode'); // 🟢 หาปุ่มสลับโหมด
    const btnSupportUs = $('btnSupportUs');

    if (sessionUser) {
        userTier = sessionUser.tier || 'BASIC';
        
        // 🟢 สร้างตัวแปรใหม่สำหรับโชว์ข้อความ ถ้าสลับเป็นโหมดทดลองให้แสดงคำว่า TRIAL
        let displayTier = (userTier === 'BASIC' && activeQuotaMode === 'TRIAL') ? 'TRIAL' : userTier;
        
        const initial = sessionUser.name ? sessionUser.name.charAt(0).toUpperCase() : 'U';
        authArea.innerHTML = `
            <div class="user-profile">
                <div class="avatar">${initial}</div>
                <span>${sessionUser.name} <b style="color:var(--primary); font-size:10px; background:var(--input-bg); padding:2px 6px; border-radius:8px; border:1px solid var(--brd);">${displayTier}</b></span>
            </div>
            <button class="icon-btn" onclick="toggleSettingsDropdown(event)">☰</button>
        `;
        
        if (btnManageSub) btnManageSub.style.display = (userTier === 'ECO' || userTier === 'PREMIUM') ? 'flex' : 'none';
        if (btnAccount) btnAccount.style.display = 'flex';
        
        if (btnTryPremium) btnTryPremium.style.display = (!sessionUser.isTrialActive && userTier === 'BASIC') ? 'flex' : 'none';
        if (btnSupportUs) btnSupportUs.style.display = (userTier === 'PREMIUM') ? 'none' : 'flex';

        // 🟢 ตรรกะโชว์ปุ่มสลับโหมด
        if (btnToggleMode) {
            const trialEmpty = (sessionUser.trialAutoUsed >= 3 && sessionUser.trialManualUsed >= 1);
            if (sessionUser.isTrialActive && userTier === 'BASIC' && !trialEmpty) {
                btnToggleMode.style.display = 'flex';
                if (activeQuotaMode === 'BASIC') {
                    btnToggleMode.innerText = "🎁 Try Premium";
                    btnToggleMode.style.color = "var(--text)";
                    btnToggleMode.style.border = "1px solid var(--brd)";
                } else {
                    btnToggleMode.innerText = "🌟 Using Trial";
                    btnToggleMode.style.color = "var(--warning)";
                    btnToggleMode.style.border = "1px solid var(--warning)";
                }
            } else {
                btnToggleMode.style.display = 'none';
                if (trialEmpty) activeQuotaMode = 'BASIC'; // ถ้าโควต้าหมดให้กลับเป็น Basic
            }
        }
    } else {
        userTier = 'BASIC';
        authArea.innerHTML = `
            <button class="btn-text" onclick="handleLoginClick()">Log In</button>
            <button class="btn-primary" onclick="openAuthModal('signup')" style="padding: 10px 20px; border:none; cursor:pointer;">Sign Up</button>
        `;
        if (btnManageSub) btnManageSub.style.display = 'none';
        if (btnAccount) btnAccount.style.display = 'none';
        if (btnTryPremium) btnTryPremium.style.display = 'none'; 
        if (btnToggleMode) btnToggleMode.style.display = 'none';
        
        // 🟢 3. ถ้ายังไม่ล็อกอิน ก็ให้โชว์ปุ่ม Support Us ไว้ดึงดูดลูกค้า
        if (btnSupportUs) btnSupportUs.style.display = 'flex';
    }
    updateUIState();
    renderPricingModal();
};

const activateTrial = async () => {
    askConfirm("Activate Premium Trial?\nYou get 3 Auto & 1 Blank Canvas downloads with Pro Tools unlocked! (One-time use)", async () => {
        const btn = $('btnTryPremium');
        btn.innerText = "⏳ Loading...";
        try {
            const res = await fetch(`${API_URL}/user/start-trial`, {
                method: 'POST',
                headers: { 'Authorization': `Bearer ${getAuthToken()}` }
            });
            const data = await res.json();
            if (res.ok) {
                sessionUser = data.user;
                updateAuthUI();
                showToast("Premium Trial Activated! 🎉");
            } else {
                showToast(data.message || "Failed to activate trial", "error");
                btn.innerText = "🎁 Try Premium";
            }
        } catch (err) {
            showToast("Server error", "error");
            btn.innerText = "🎁 Try Premium";
        }
    });
};

// // 🟢 ฟังก์ชันสลับโหมดกระเป๋าโควต้า (ล้างทุกหน้าจอแบบ 100% ทุกแท็บ)
const toggleQuotaMode = () => {
    // เช็คว่ามีภาพค้างอยู่ใน "ทุกแท็บ" หรือไม่ (เปลี่ยนจากการเช็คแค่ activeTab)
    if (appWorkspaces.length > 0) {
        askConfirm("Switching modes will clear ALL your works in both tabs. Continue?", () => {
            // 1. ลบ HTML ของทุก Workspace และทุก Popup ทิ้งให้หมด
            document.querySelectorAll('.workspace').forEach(w => {
                const popup = document.getElementById('cp_' + w.id);
                if (popup) popup.remove();
                w.remove();
            });
            
            // 2. ล้างข้อมูลใน Array หลักให้เกลี้ยง
            appWorkspaces = []; 

            // 3. รีเซ็ตหน้าต่างอัปโหลดรูปของโหมด AUTO ให้กลับเป็นค่าเริ่มต้น
            selectedFiles = []; 
            $('previewContainer').innerHTML = '';
            $('imageLoader').value = ''; 
            if($('dropText')) $('dropText').innerHTML = `<strong>Drag and drop images here</strong><br><span style="font-size: 13px; color: var(--text-mut);">(PNG, JPG, WEBP)</span>`;
            if($('processBtn')) $('processBtn').disabled = true;

            // 4. อัปเดต UI หน้าจอให้ว่างเปล่า พับกล่องเก็บ
            toggleWorkspaceMode();
            updateSliderView();

            // 5. สลับโหมดและแจ้งเตือน
            activeQuotaMode = (activeQuotaMode === 'BASIC') ? 'TRIAL' : 'BASIC';
            updateAuthUI();
            showToast(`Switched to ${activeQuotaMode} Mode!`, "success");
        });
    } else {
        // ถ้าไม่มีรูปค้างเลย สลับได้ทันที
        activeQuotaMode = (activeQuotaMode === 'BASIC') ? 'TRIAL' : 'BASIC';
        updateAuthUI();
        showToast(`Switched to ${activeQuotaMode} Mode!`, "success");
    }
};

const renderPricingModal = () => {
    if(userTier === 'BASIC') {
        $('btnBuyBasic').innerText = "Current Plan"; $('btnBuyBasic').disabled = true;
        $('btnBuyEco').innerText = "Upgrade to Economy"; $('btnBuyEco').disabled = false;
        $('btnBuyPremium').innerText = "Upgrade to Premium"; $('btnBuyPremium').disabled = false;
    } else if (userTier === 'TRIAL') {
        $('btnBuyBasic').innerText = "Trial Active"; $('btnBuyBasic').disabled = true;
        $('btnBuyEco').innerText = "Upgrade to Economy"; $('btnBuyEco').disabled = false;
        $('btnBuyPremium').innerText = "Upgrade to Premium"; $('btnBuyPremium').disabled = false;
    } else if (userTier === 'ECO') {
        $('btnBuyBasic').innerText = "Downgrade"; $('btnBuyBasic').disabled = false;
        $('btnBuyEco').innerText = "Current Plan"; $('btnBuyEco').disabled = true;
        $('btnBuyPremium').innerText = "Upgrade to Premium"; $('btnBuyPremium').disabled = false;
    } else if (userTier === 'PREMIUM') {
        $('btnBuyBasic').innerText = "Downgrade"; $('btnBuyBasic').disabled = false;
        $('btnBuyEco').innerText = "Downgrade"; $('btnBuyEco').disabled = false;
        $('btnBuyPremium').innerText = "Current Plan"; $('btnBuyPremium').disabled = true;
    }
};

// 🟢 ระบบจัดการหน้าต่าง Account
const openAccountModal = () => {
    if (!sessionUser) return;
    $('settingsDropdown').classList.remove('show'); 
    
    $('accEmail').value = sessionUser.email;
    $('accName').value = sessionUser.name;
    
    // 🟢 เปลี่ยนคำที่โชว์ในกล่อง Current Plan
    let displayTier = sessionUser.tier || 'BASIC';
    if (displayTier === 'BASIC' && activeQuotaMode === 'TRIAL') {
        displayTier = 'TRIAL';
    }
    $('accTierDisplay').innerText = displayTier;
    
    // โชว์ข้อความ Billing
    const billingDiv = $('accBillingDate');
    if (sessionUser.tier === 'ECO' || sessionUser.tier === 'PREMIUM') {
        billingDiv.innerText = "Renewing Monthly";
        billingDiv.style.color = "var(--success)";
    } else {
        billingDiv.innerText = "Free Plan Forever";
        billingDiv.style.color = "var(--text-mut)";
    }
    
    $('accountModal').classList.add('show');
};

const closeAccountModal = () => $('accountModal').classList.remove('show');

const saveAccountName = async () => {
    const newName = $('accName').value.trim();
    if (!newName) { showToast("Name cannot be empty", "error"); return; }
    
    const btn = $('btnSaveName');
    const origText = btn.innerText;
    btn.innerText = "Saving...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/user/name`, {
            method: 'PUT',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({ name: newName })
        });
        
        if (res.ok) {
            sessionUser.name = newName; // อัปเดตข้อมูลในระบบหน้าเว็บ
            updateAuthUI(); // รีเฟรชชื่อที่มุมขวาบน
            showToast("Name updated successfully!");
        } else {
            showToast("Failed to update name", "error");
        }
    } catch (e) {
        showToast("Server error", "error");
    }
    btn.innerText = origText;
    btn.disabled = false;
};

const handleLoginClick = () => openAuthModal('login');

// 🟢 อัปเดต: สลับให้ Signup ยิง OTP แทนการเข้าสู่ระบบทันที
const processManualSignup = async () => {
    const name = $('signupName').value.trim();
    const email = $('signupEmail').value.trim();
    const password = $('signupPassword').value;
    const terms = $('termsCheck').checked;
    const errorDiv = $('signupError');
    
    if(!name || !email || !password || !terms) {
        errorDiv.innerText = "Please fill all fields and agree to terms.";
        errorDiv.style.display = 'block'; return;
    }

    try {
        const btn = document.querySelector('#formSignup button');
        const originalText = btn.innerText;
        btn.innerText = 'Sending OTP...';
        btn.disabled = true;

        const res = await fetch(`${API_URL}/auth/register`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ name, email, password })
        });
        const data = await res.json();
        
        btn.innerText = originalText;
        btn.disabled = false;

        if (!res.ok) {
            errorDiv.innerText = data.message || "Registration failed.";
            errorDiv.style.display = 'block'; return;
        }

        // สำเร็จ! เคลียร์ Error และสลับหน้าไปกล่อง OTP
        errorDiv.style.display = 'none';
        pendingVerificationEmail = email; // จำอีเมลไว้
        
        $('formSignup').classList.remove('active');
        $('tabLogin').style.display = 'none';
        $('tabSignup').style.display = 'none';
        
        if($('otpEmailDisplay')) $('otpEmailDisplay').innerText = email;
        if($('formOtp')) $('formOtp').style.display = 'block';

    } catch (error) {
        showToast("Server error. Please check backend connection.", "error");
    }
};

// 🟢 เพิ่มใหม่: ฟังก์ชันกดยืนยันตัวเลข OTP 6 หลัก
const processOtpVerification = async () => {
    const otp = $('otpInput').value.trim();
    const errorDiv = $('otpError');
    const btn = $('btnVerifyOtp');

    if (!otp || otp.length !== 6) {
        errorDiv.innerText = "Please enter the 6-digit code.";
        errorDiv.style.display = 'block';
        return;
    }

    try {
        const originalText = btn.innerText;
        btn.innerText = 'Verifying...';
        btn.disabled = true;
        errorDiv.style.display = 'none';

        const response = await fetch(`${API_URL}/auth/verify-otp`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: pendingVerificationEmail, otp: otp })
        });

        const data = await response.json();
        
        btn.innerText = originalText;
        btn.disabled = false;

        if (!response.ok) {
            errorDiv.innerText = data.message || "Invalid or expired OTP.";
            errorDiv.style.display = 'block';
            $('otpInput').value = ''; 
        } else {
            // 🎉 รหัสถูกต้อง! เข้าสู่ระบบสำเร็จ
            localStorage.setItem('pixelMeToken', data.token);
            sessionUser = data.user;
            
            closeAuthModal();
            $('otpInput').value = ''; 
            
            // ให้ระบบจัดการอัปเดตเมนูมุมขวาบนให้อัตโนมัติ
            updateAuthUI();
            
            showToast(`Welcome to PixelMe, ${data.user.name}!`);
        }
    } catch (err) {
        errorDiv.innerText = "Server error. Please try again.";
        errorDiv.style.display = 'block';
        btn.innerText = 'Verify & Continue';
        btn.disabled = false;
    }
};

const processManualLogin = async () => {
    const email = $('loginEmail').value.trim();
    const password = $('loginPassword').value;

    try {
        const res = await fetch(`${API_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password })
        });
        const data = await res.json();
        
        if (!res.ok) {
            $('loginError').innerText = data.message || "Invalid email or password.";
            $('loginError').style.display = 'block'; return;
        }

        localStorage.setItem('pixelMeToken', data.token);
        sessionUser = data.user;
        closeAuthModal(); updateAuthUI();
        showToast(`Welcome back, ${sessionUser.name}!`);
    } catch (error) {
        showToast("Server error. Please check backend connection.", "error");
    }
};

const processLogout = () => {
    sessionUser = null;
    localStorage.removeItem('pixelMeToken');
    settingsDropdown.classList.remove('show');
    updateAuthUI();
    showToast("Logged out successfully.");
};

// --- Google Login System ---
window.handleGoogleResponse = async (response) => {
    try {
        const res = await fetch(`${API_URL}/auth/google`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ token: response.credential })
        });

        const data = await res.json();
        if (!res.ok) {
            showToast(data.message || "Google Login failed", "error");
            return;
        }

        localStorage.setItem('pixelMeToken', data.token);
        sessionUser = data.user;
        
        closeAuthModal(); 
        updateAuthUI();
        showToast(`Welcome, ${sessionUser.name}!`);

    } catch (error) {
        console.error(error);
        showToast("Server error. Please check backend connection.", "error");
    }
};

// --- ระบบชำระเงิน และ อัปเกรดแพ็กเกจ ---
const upgradeTier = async (tier) => {
    if(!sessionUser) { openAuthModal('signup'); return; }
    
    // เปลี่ยนปุ่มเป็นสถานะกำลังโหลด (ภาษาอังกฤษ)
    const btnId = tier === 'ECO' ? 'btnBuyEco' : 'btnBuyPremium';
    const btn = $(btnId);
    const originalText = btn.innerText;
    btn.innerText = "⏳ Redirecting...";
    btn.disabled = true;

    try {
        const res = await fetch(`${API_URL}/payment/create-checkout`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            },
            body: JSON.stringify({ tier })
        });
        
        const data = await res.json();

        if (res.ok && data.checkoutUrl) {
            window.location.href = data.checkoutUrl;
        } else {
            showToast("Failed to create checkout session. Please try again.", "error");
            btn.innerText = originalText;
            btn.disabled = false;
        }
    } catch (err) { 
        showToast("Payment connection failed.", "error");
        btn.innerText = originalText;
        btn.disabled = false;
    }
};

// --- ตรวจสอบเมื่อลูกค้าจ่ายเงินเสร็จแล้วเด้งกลับมา ---
const checkPaymentSuccess = async () => {
    const urlParams = new URLSearchParams(window.location.search);
    const status = urlParams.get('payment');
    const newTier = urlParams.get('tier');
    const sessionId = urlParams.get('session_id'); 

    if (status === 'success' && newTier) {
        try {
            await fetch(`${API_URL}/user/upgrade`, {
                method: 'POST',
                headers: { 
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${getAuthToken()}`
                },
                body: JSON.stringify({ tier: newTier, sessionId: sessionId }) 
            });
            
            // 🟢 เปลี่ยนแจ้งเตือนเป็นภาษาอังกฤษ
            showToast(`Successfully upgraded to ${newTier} plan!`);
            
            window.history.replaceState({}, document.title, window.location.pathname);
            await initAuth(); 

        } catch (error) {
            showToast("Failed to upgrade account.", "error");
            console.error(error);
        }
    }
};

// 🟢 ฟังก์ชันส่งลูกค้าไปหน้าจัดการสมาชิก (ยกเลิกรายเดือน)
const manageSubscription = async () => {
    const btn = $('btnManageSub');
    const originalText = btn.innerText;
    btn.innerText = "⏳ Loading...";

    try {
        const res = await fetch(`${API_URL}/payment/create-portal`, {
            method: 'POST',
            headers: { 
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${getAuthToken()}`
            }
        });
        
        const data = await res.json();

        if (res.ok && data.portalUrl) {
            window.location.href = data.portalUrl; // เด้งไปหน้า Stripe
        } else {
            // 🟢 เปลี่ยนแจ้งเตือนเป็นภาษาอังกฤษ
            showToast("You don't have an active subscription.", "error");
            btn.innerText = originalText;
        }
    } catch (err) {
        showToast("Server connection error.", "error");
        btn.innerText = originalText;
    }
};


window.onload = async () => { 
    await initAuth();
    await checkPaymentSuccess(); 
    initReviews();
    initFAQ();
    
    // 🟢 ดักจับการเปิด/ปิดสวิตช์ Fixed Palette
    if($('useFixedPalette')) {
        $('useFixedPalette').addEventListener('change', (e) => {
            $('fixedPaletteBox').style.display = e.target.checked ? 'flex' : 'none';
            if(e.target.checked) renderFixedPalette();
        });
    }
    // 🟢 ถ้า User พรีเมียมเปลี่ยนจำนวนสี ให้ช่องเลือกสีอัปเดตตาม
    if($('globalColors')) {
        $('globalColors').addEventListener('change', () => {
            if($('useFixedPalette') && $('useFixedPalette').checked) renderFixedPalette();
        });
    }
};

const openAuthModal = (tab) => { $('authModal').classList.add('show'); switchAuthTab(tab); $('loginError').style.display = 'none'; $('signupError').style.display = 'none'; };
const closeAuthModal = () => $('authModal').classList.remove('show');

// 🟢 อัปเดต: สลับแท็บพร้อมกับควบคุมหน้าต่าง OTP
const switchAuthTab = (tab) => {
    const formOtp = $('formOtp');
    if(formOtp) formOtp.style.display = 'none'; // ซ่อนฟอร์ม OTP เสมอเวลาสลับแท็บ
    
    $('tabLogin').style.display = 'block'; // โชว์ปุ่มแท็บกลับมา
    $('tabSignup').style.display = 'block';

    $('tabLogin').classList.remove('active'); $('tabSignup').classList.remove('active');
    $('formLogin').classList.remove('active'); $('formSignup').classList.remove('active');
    
    if(tab === 'login') { 
        $('tabLogin').classList.add('active'); 
        $('formLogin').classList.add('active'); 
    } else { 
        $('tabSignup').classList.add('active'); 
        $('formSignup').classList.add('active'); 
    }
};

const toggleSettingsDropdown = (e) => { e.stopPropagation(); settingsDropdown.classList.toggle('show'); };
const openLegal = (type) => {
    $('legalModal').classList.add('show');
    $('legalTitle').innerText = type === 'tos' ? "Terms of Service" : "Privacy Policy";
    
    if (type === 'tos') {
        $('legalBody').innerHTML = `
            <div style="font-size: 13px; color: var(--text-mut); line-height: 1.6; text-align: left;">
                <p><i>Last Updated: September 2026</i></p>
                <h4 style="color: var(--text); margin-bottom: 5px;">1. Acceptance of Terms</h4>
                <p style="margin-top: 0;">By accessing and using PixelMe ("the Service"), you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to abide by these terms, please do not use this Service.</p>
                
                <h4 style="color: var(--text); margin-bottom: 5px;">2. User Accounts and Security</h4>
                <p style="margin-top: 0;">You may register an account using your email or a third-party service (e.g., Google). You are entirely responsible for maintaining the confidentiality of your password and account. PixelMe will not be liable for any loss that you may incur as a result of someone else using your password or account.</p>

                <h4 style="color: var(--text); margin-bottom: 5px;">3. Subscriptions, Billing, and Cancellation</h4>
                <p style="margin-top: 0;">PixelMe offers both free and paid subscription tiers (Economy, Premium). Paid subscriptions are billed on a recurring monthly basis. All payment processing is securely handled by our third-party provider, Stripe. You may cancel your subscription at any time through the "Manage Subscription" portal. Cancellations take effect at the end of the current billing cycle. Payments are non-refundable.</p>

                <h4 style="color: var(--text); margin-bottom: 5px;">4. User Content and Intellectual Property</h4>
                <p style="margin-top: 0;"><strong>You own your art.</strong> PixelMe claims no intellectual property rights over the images you upload or the pixel art and Paint-by-Number grids you generate. Because our image processing occurs entirely locally within your web browser, we do not monitor, store, or claim any ownership over your creative works.</p>

                <h4 style="color: var(--text); margin-bottom: 5px;">5. Prohibited Conduct</h4>
                <p style="margin-top: 0;">You agree not to use the Service for any unlawful purpose or in any way that might harm, damage, or disparage any other party. You may not attempt to reverse-engineer, exploit, or bypass our subscription constraints or daily download limits.</p>

                <h4 style="color: var(--text); margin-bottom: 5px;">6. Disclaimer of Warranties and Limitation of Liability</h4>
                <p style="margin-top: 0;">The Service is provided on an "AS IS" and "AS AVAILABLE" basis. PixelMe makes no warranties, expressed or implied, regarding the continuous availability or error-free operation of the Service. In no event shall PixelMe be liable for any indirect, incidental, special, or consequential damages arising out of your use of the Service.</p>
            </div>
        `;
    } else {
        $('legalBody').innerHTML = `
            <div style="font-size: 13px; color: var(--text-mut); line-height: 1.6; text-align: left;">
                <p><i>Last Updated: September 2026</i></p>
                <h4 style="color: var(--primary); margin-bottom: 5px;">1. Core Privacy Principle: Local Processing</h4>
                <p style="margin-top: 0;">Your privacy is our highest priority. <strong>PixelMe processes all uploaded images directly inside your device's web browser.</strong> We do NOT upload, transmit, view, or store your original photos or generated pixel artworks on our servers. What happens on your device, stays on your device.</p>
                
                <h4 style="color: var(--text); margin-bottom: 5px;">2. Information We Collect</h4>
                <p style="margin-top: 0;">To provide our Service, we collect minimal personal information, which includes:
                <ul style="margin-top: 5px; padding-left: 20px;">
                    <li>Your name and email address (provided during sign-up or via Google OAuth).</li>
                    <li>Account credentials (passwords are securely hashed; we cannot see them).</li>
                    <li>Subscription status and download usage statistics (to enforce daily quotas).</li>
                </ul></p>

                <h4 style="color: var(--text); margin-bottom: 5px;">3. Payment Processing</h4>
                <p style="margin-top: 0;">We use Stripe, a certified PCI-compliant payment gateway, to process all transactions. PixelMe never collects, processes, or stores your credit card numbers or financial details on our servers.</p>

                <h4 style="color: var(--text); margin-bottom: 5px;">4. Local Storage and Cookies</h4>
                <p style="margin-top: 0;">We use your browser's Local Storage to save your authentication token (to keep you logged in), your UI theme preference (Dark/Light mode), and your locally submitted reviews. We do not use intrusive tracking cookies for third-party advertising.</p>

                <h4 style="color: var(--text); margin-bottom: 5px;">5. Data Sharing and Disclosure</h4>
                <p style="margin-top: 0;">We do not sell, rent, or trade your personal information to third parties. Information is only shared with trusted service providers (like Stripe for payments and email providers for OTP delivery) strictly for the purpose of operating our Service.</p>

                <h4 style="color: var(--text); margin-bottom: 5px;">6. Your Data Rights</h4>
                <p style="margin-top: 0;">Depending on your location (e.g., under GDPR or PDPA), you have the right to request access to, correction of, or deletion of your personal data. To request account deletion, please contact our support team.</p>
            </div>
        `;
    }
};
const closeLegalModal = () => $('legalModal').classList.remove('show');

const openFeedbackModal = () => { $('feedbackModal').classList.add('show'); settingsDropdown.classList.remove('show'); };
const closeFeedbackModal = () => { $('feedbackModal').classList.remove('show'); $('feedbackText').value = ''; };
const submitFeedback = () => {
    const text = $('feedbackText').value.trim();
    if(!text) { showToast("Please enter your feedback.", "error"); return; }
    showToast("Feedback sent successfully!");
    closeFeedbackModal();
};

const openAddReviewModal = () => {
    if(!sessionUser) { openAuthModal('login'); showToast("Please log in to write a review.", "error"); return; }
    $('addReviewModal').classList.add('show');
}
const closeAddReviewModal = () => { $('addReviewModal').classList.remove('show'); $('newReviewText').value = ''; };
const submitAddReview = () => {
    const text = $('newReviewText').value.trim();
    if(!text) { showToast("Please enter your review.", "error"); return; }
    storedReviews.push({ name: sessionUser.name, text: text });
    localStorage.setItem('pixelMeReviews', JSON.stringify(storedReviews));
    initReviews(); 
    showToast("Review submitted successfully!");
    closeAddReviewModal();
};

const openPackages = () => { $('packageModal').classList.add('show'); settingsDropdown.classList.remove('show'); };
const closePackages = () => { $('packageModal').classList.remove('show'); };

const openLanguage = () => { $('languageModal').classList.add('show'); settingsDropdown.classList.remove('show'); };
const closeLanguage = () => { $('languageModal').classList.remove('show'); };
const triggerGoogleTranslate = (langCode) => {
    const selectField = document.querySelector("select.goog-te-combo");
    if (selectField) { selectField.value = langCode; selectField.dispatchEvent(new Event('change')); } 
    else { setTimeout(() => triggerGoogleTranslate(langCode), 500); }
};

document.querySelectorAll('.lang-btn').forEach(btn => {
    btn.onclick = () => {
        document.querySelectorAll('.lang-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        triggerGoogleTranslate(btn.getAttribute('data-lang'));
        setTimeout(closeLanguage, 300);
    };
});

const menuThemeToggle = $('menuThemeToggle');
let isDarkMode = localStorage.getItem('theme') === 'dark';
const applyTheme = () => {
    if (isDarkMode) { document.documentElement.setAttribute('data-theme', 'dark'); menuThemeToggle.innerText = '☀️ Light Mode'; } 
    else { document.documentElement.removeAttribute('data-theme'); menuThemeToggle.innerText = '🌙 Dark Mode'; }
};
menuThemeToggle.onclick = () => { isDarkMode = !isDarkMode; localStorage.setItem('theme', isDarkMode ? 'dark' : 'light'); applyTheme(); settingsDropdown.classList.remove('show'); };

document.addEventListener('click', e => {
    if(!e.target.closest('.color-popup') && !e.target.closest('.color-btn')) document.querySelectorAll('.color-popup.show').forEach(p => p.classList.remove('show'));
    if(!e.target.closest('#settingsDropdown') && !e.target.closest('.icon-btn')) settingsDropdown.classList.remove('show');
    if(e.target.classList.contains('modal-overlay')) e.target.classList.remove('show');
});

// -----------------------------------------------------------
// --- App UI Logic
// -----------------------------------------------------------

const switchActiveTab = (tab) => {
    if (activeTab === tab) return;
    activeTab = tab;
    
    if(tab === 'AUTO') {
        $('tabAuto').classList.add('active'); $('tabManual').classList.remove('active');
        $('autoView').classList.add('active'); $('manualView').classList.remove('active');
    } else {
        $('tabManual').classList.add('active'); $('tabAuto').classList.remove('active');
        $('manualView').classList.add('active'); $('autoView').classList.remove('active');
    }
    
    document.querySelectorAll('.workspace').forEach(w => {
        if (w.dataset.tab === activeTab) w.style.display = 'block';
        else w.style.display = 'none';
    });

    updateUIState();
    toggleWorkspaceMode(); 
    
    currentSlide = 0;
    updateSliderView();
};

const updateUIState = () => {
    const pnl = $('globalSettingsPanel'); 
    const cInput = $('globalColors'); const wInput = $('globalCols'); const hInput = $('globalRows');
    
    // 🟢 เช็คก่อนว่าแม้จะเป็น BASIC แต่เปิดโหมด Trial อยู่หรือเปล่า
    let displayTier = userTier;
    if (userTier === 'BASIC' && typeof activeQuotaMode !== 'undefined' && activeQuotaMode === 'TRIAL') {
        displayTier = 'TRIAL';
    }
    
    if(displayTier === 'BASIC') {
        pnl.style.display = 'none'; 
        cInput.value = 15; wInput.value = 50; hInput.value = 65;
    } else {
        pnl.style.display = 'flex'; 
        $('lblColors').style.display = activeTab === 'MANUAL' ? 'none' : 'flex';
    }
};

const toggleSidebar = () => {
    const wrap = $('mainBoxWrapper'); const btn = $('menuToggleBtn');
    wrap.classList.toggle('open');
    btn.innerText = wrap.classList.contains('open') ? "◀ CLOSE" : "➕ ADD";
};

const toggleWorkspaceMode = () => {
    const visibleCount = appWorkspaces.filter(ws => ws.tab === activeTab).length;
    
    if (visibleCount > 0) {
        $('appContainer').classList.add('has-workspaces');
        $('viewToggle').style.display = 'flex'; 
        $('globalExportContainer').style.display = 'block';
        $('mainBoxWrapper').classList.remove('open'); 
        $('menuToggleBtn').innerText = "➕ ADD";
    } else {
        $('appContainer').classList.remove('has-workspaces');
        $('viewToggle').style.display = 'none'; 
        $('globalExportContainer').style.display = 'none';
        $('mainBoxWrapper').classList.remove('open'); 
        $('sliderNav').style.display = 'none';
        document.querySelectorAll('.color-popup.show').forEach(p => p.classList.remove('show'));
    }
};

const clearEverything = () => {
    appWorkspaces = appWorkspaces.filter(ws => ws.tab !== activeTab);
    
    document.querySelectorAll('.workspace').forEach(w => {
        if (w.dataset.tab === activeTab) {
            const popup = document.getElementById('cp_' + w.id);
            if (popup) popup.remove();
            w.remove();
        }
    });
    
    if (activeTab === 'AUTO') {
        selectedFiles=[]; 
        $('previewContainer').innerHTML='';
        $('imageLoader').value=''; 
        if($('dropText')) $('dropText').innerHTML=`<strong>Drag and drop images here</strong><br><span style="font-size: 13px; color: var(--text-mut);">(PNG, JPG, WEBP)</span>`;
        if($('processBtn')) $('processBtn').disabled=true;
    }

    toggleWorkspaceMode();
    updateSliderView();
};

$('clearBtnAuto').onclick = clearEverything;
$('clearBtnManual').onclick = clearEverything;

const updateSliderView = () => {
    const visibleWorkspaces = Array.from(document.querySelectorAll('.workspace')).filter(w => w.dataset.tab === activeTab);
    
    if (!isHorizontal || visibleWorkspaces.length <= 1) { $('sliderNav').style.display = 'none'; return; }
    $('sliderNav').style.display = 'flex';
    
    if (currentSlide < 0) currentSlide = 0;
    if (currentSlide >= visibleWorkspaces.length) currentSlide = visibleWorkspaces.length - 1;
    $('prevSlide').disabled = currentSlide === 0; 
    $('nextSlide').disabled = currentSlide === visibleWorkspaces.length - 1;
    
    if(visibleWorkspaces[currentSlide]) {
        const container = $('resultsContainer');
        const targetLeft = visibleWorkspaces[currentSlide].offsetLeft - container.offsetLeft;
        container.scrollTo({ left: targetLeft, behavior: 'smooth' });
        document.querySelectorAll('.color-popup.show').forEach(p => p.classList.remove('show'));
    }
};

$('prevSlide').onclick = () => { currentSlide--; updateSliderView(); };
$('nextSlide').onclick = () => { currentSlide++; updateSliderView(); };
window.addEventListener('keydown', e => {
    if (!isHorizontal || appWorkspaces.filter(ws => ws.tab === activeTab).length <= 1) return;
    if (['INPUT', 'TEXTAREA'].includes(document.activeElement.tagName)) return; 
    if (e.key === 'ArrowLeft') { currentSlide--; updateSliderView(); }
    if (e.key === 'ArrowRight') { currentSlide++; updateSliderView(); }
});

$('btnVert').onclick = () => { isHorizontal = false; $('btnVert').classList.add('active'); $('btnHorz').classList.remove('active'); $('resultsContainer').classList.remove('horizontal'); updateSliderView(); };
$('btnHorz').onclick = () => { isHorizontal = true; $('btnHorz').classList.add('active'); $('btnVert').classList.remove('active'); $('resultsContainer').classList.add('horizontal'); updateSliderView(); };

// --- Core Helpers ---
const safeC = c => isNaN(c) || c===undefined ? 255 : Math.max(0, Math.min(255, Math.round(c)));
const rgbToHex = (r,g,b) => "#" + (1<<24 | safeC(r)<<16 | safeC(g)<<8 | safeC(b)).toString(16).slice(1).toUpperCase();
const hexToRgb = h => { const r=/^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(h); return r ? {r:parseInt(r[1],16), g:parseInt(r[2],16), b:parseInt(r[3],16)} : null; };
const contrast = (r,g,b) => ((safeC(r)*299 + safeC(g)*587 + safeC(b)*114)/1000 >= 128) ? '#000' : '#fff';
const sqDist = (p, c) => (p.r-c.r)**2 + (p.g-c.g)**2 + (p.b-c.b)**2;
const isValidImage = f => f && (f.type.startsWith('image/') || f.name.match(/\.(jpg|jpeg|png|webp|gif|bmp)$/i));

const updateAllRecentColorsUI = () => {
    document.querySelectorAll('.recent-colors-list').forEach(el => {
        el.innerHTML = recentColors.map(h => `<div class="popup-swatch" style="background:${h}" title="Use ${h}" data-hex="${h}"></div>`).join('');
        el.querySelectorAll('.popup-swatch').forEach(sw => {
            sw.onclick = () => {
                const popup = sw.closest('.color-popup');
                if(popup){ 
                    // 🟢 รองรับทั้ง popup แก้ไขสี (.a-pick) และ popup เพิ่มสี (.a-pick-add)
                    const p = popup.querySelector('.a-pick') || popup.querySelector('.a-pick-add'); 
                    const hp = popup.querySelector('.h-pick') || popup.querySelector('.h-pick-add'); 
                    if(p) { p.value = sw.dataset.hex; if(hp) hp.value = sw.dataset.hex.replace('#',''); p.dispatchEvent(new Event('change')); } 
                }
            };
        });
    });
};
const addRecent = hex => { hex = hex.toUpperCase(); recentColors = [hex, ...recentColors.filter(c => c !== hex)].slice(0, 14); updateAllRecentColorsUI(); };

const getKMeansAsync = (imgData, k) => {
    return new Promise((resolve) => {
        const workerCode = `
            function sqDist(p, c) { return (p.r-c.r)**2 + (p.g-c.g)**2 + (p.b-c.b)**2; }
            self.onmessage = function(e) {
                let { imgData, k } = e.data;
                let pxs = [];
                let step = Math.ceil((imgData.length / 4) / 5000) * 4; 
                if (step < 4) step = 4;
                for(let i=0; i<imgData.length; i+=step) {
                    if(imgData[i+3] >= 128) pxs.push({r:imgData[i], g:imgData[i+1], b:imgData[i+2]});
                }
                if(!pxs.length) { self.postMessage([{r:255,g:255,b:255}]); return; }
                if(k > pxs.length) k = pxs.length;

                let cents = [pxs[Math.floor(Math.random() * pxs.length)]];
                let subset = pxs.length > 500 ? pxs.filter((_, idx) => idx % Math.ceil(pxs.length/500) === 0) : pxs;
                
                while(cents.length < k) {
                    let maxD = -1, bestP = subset[0];
                    for(let p of subset) {
                        let minD = Infinity;
                        for(let c of cents) { let d = sqDist(p,c); if(d < minD) minD = d; }
                        if(minD > maxD) { maxD = minD; bestP = p; }
                    }
                    cents.push(bestP);
                }

                for(let iter=0; iter<5; iter++) {
                    let sums = Array.from({length: k}, () => ({r:0, g:0, b:0, count:0}));
                    for (let i = 0; i < pxs.length; i++) {
                        let p = pxs[i], min = Infinity, best = 0;
                        for (let j = 0; j < k; j++) {
                            let d = sqDist(p, cents[j]);
                            if (d < min) { min = d; best = j; }
                        }
                        sums[best].r += p.r; sums[best].g += p.g; sums[best].b += p.b; sums[best].count++;
                    }
                    let changed = false;
                    for (let j = 0; j < k; j++) {
                        if (sums[j].count > 0) {
                            let nr = Math.round(sums[j].r / sums[j].count), ng = Math.round(sums[j].g / sums[j].count), nb = Math.round(sums[j].b / sums[j].count);
                            if (cents[j].r !== nr || cents[j].g !== ng || cents[j].b !== nb) changed = true;
                            cents[j] = {r: nr, g: ng, b: nb};
                        }
                    }
                    if(!changed) break;
                }
                self.postMessage(cents);
            };
        `;
        const blob = new Blob([workerCode], { type: 'application/javascript' });
        const worker = new Worker(URL.createObjectURL(blob));
        
        worker.onmessage = (e) => {
            let finalCents = [];
            let cents = e.data;
            for (let i=0; i<cents.length; i++) {
                let isSim = false;
                for(let j=0; j<finalCents.length; j++) { if(sqDist(cents[i], finalCents[j]) < 400) { isSim = true; break; } }
                if(!isSim) finalCents.push(cents[i]);
            }
            worker.terminate();
            resolve(finalCents);
        };
        worker.postMessage({ imgData, k });
    });
};

// --- Drag & Drop ---
const dz = $('dropZone');
const preventDefault = e => { e.preventDefault(); e.stopPropagation(); };
['dragenter', 'dragover', 'dragleave', 'drop'].forEach(evt => { dz.addEventListener(evt, preventDefault, false); document.body.addEventListener(evt, preventDefault, false); });
dz.addEventListener('dragover', () => dz.classList.add('dragover'));
dz.addEventListener('dragleave', () => dz.classList.remove('dragover'));
dz.addEventListener('drop', e => {
    dz.classList.remove('dragover'); let files = [];
    if (e.dataTransfer.files) {
        for (let i = 0; i < e.dataTransfer.files.length; i++) {
            const file = e.dataTransfer.files[i];
            if (e.dataTransfer.items && e.dataTransfer.items[i].webkitGetAsEntry) { const entry = e.dataTransfer.items[i].webkitGetAsEntry(); if (entry && entry.isDirectory) continue; }
            if (isValidImage(file)) files.push(file);
        }
    }
    handleFiles(files);
});

$('imageLoader').onchange = e => handleFiles(Array.from(e.target.files));

const handleFiles = f => {
    const valid = f.filter(isValidImage);
    if(valid.length) {
        selectedFiles.push(...valid);
        $('dropText').innerHTML = `<strong style="color:var(--success); font-size:16px;">✅ Ready: ${selectedFiles.length} images</strong>`;
        $('processBtn').disabled = false;
        $('previewContainer').innerHTML = selectedFiles.map(file => `<img src="${URL.createObjectURL(file)}" title="${file.name}">`).join('');
    }
    $('imageLoader').value = '';
};

// ---------------- Workspace Creation ----------------
$('processBtn').onclick = async () => {
    if(!selectedFiles.length) return;
    $('processBtn').disabled = true;
    $('resultsContainer').insertAdjacentHTML('afterbegin', '<div id="loadingBox" style="text-align:center; padding:30px; background:var(--card-bg); border-radius:12px; box-shadow:var(--sh-md); color:var(--text); font-weight:bold; font-size:18px;">⏳ Processing Colors...</div>');
    
    const queue = [...selectedFiles]; selectedFiles=[]; $('previewContainer').innerHTML='';
    $('dropText').innerHTML=`<strong>Drag and drop images here</strong><br><span style="font-size:13px; color:var(--text-mut);">(PNG, JPG, WEBP)</span>`;
    
    // 🟢 เช็คว่าผู้ใช้เปิดสวิตช์ Fixed Palette ไว้หรือไม่
    const isFixed = $('useFixedPalette') && $('useFixedPalette').checked;
    
    await new Promise(r => setTimeout(r, 50));
    for(let f of queue) {
        await new Promise(resolve => { 
            let i = new Image(); 
            // 🟢 ส่งพารามิเตอร์ isFixed เข้าไปท้ายสุด
            i.onload = () => { setTimeout(() => { try { buildWorkspace(f.name, i, userTier, false, isFixed); } catch(err) { console.error(err); } resolve(); }, 50); }; 
            i.onerror = () => resolve(); i.src = URL.createObjectURL(f); 
        });
    }
    if($('loadingBox')) $('loadingBox').remove();
    toggleWorkspaceMode(); updateSliderView();
};

$('createBlankBtn').onclick = () => { 
    if(!sessionUser) {
        openAuthModal('login');
        showToast("Please Log In to use Blank Canvas.", "error");
        return;
    }
    buildWorkspace(`Blank Canvas ${manualCount++}`, null, userTier, true); 
    toggleWorkspaceMode(); 
    updateSliderView();
};

function buildWorkspace(fileName, img, tier, isManual, useFixedPal = false) {
    const wid = 'ws_' + Date.now() + Math.random().toString(36).substr(2,5);
    const w = document.createElement('div'); w.className = 'workspace'; w.id = wid;
    
    w.dataset.tab = activeTab;
    
    // 🟢 เช็คว่าเปิดโหมด Trial สำหรับหน้านี้อยู่ไหม
    const isTrialForThisTab = sessionUser && sessionUser.isTrialActive && activeQuotaMode === 'TRIAL';
    
    // 🟢 ถ้าเปิด Trial อยู่ จะถือว่าไม่ใช่ Basic 
    const isBasic = tier === 'BASIC' && !isTrialForThisTab;
    
    // 🟢 ตัวหนังสือป้ายกำกับที่จะโชว์บนหัว Workspace
    const displayTier = isTrialForThisTab ? 'TRIAL' : tier;

    const canPaint = (tier === 'PREMIUM' || isTrialForThisTab) || isManual;
    const canEditPalette = (tier === 'ECO' || tier === 'PREMIUM' || isTrialForThisTab) || isManual;
    const canAddColor = (tier === 'PREMIUM' || isTrialForThisTab) || isManual;
    const hasHistory = (tier === 'ECO' || tier === 'PREMIUM' || isTrialForThisTab) || isManual;

    let initColors = isBasic ? 15 : (parseInt($('globalColors').value) || 24);
    let initCols = isBasic ? 50 : (parseInt($('globalCols').value) || 50);
    let initRows = isBasic ? 65 : (parseInt($('globalRows').value) || 65);

    w.innerHTML = `
        <div class="workspace-header">
            <div class="workspace-header-left">
                <!-- 🟢 เปลี่ยนตัวแปรตรงนี้ให้โชว์เป็น displayTier แทน tier เดิม -->
                <div class="workspace-title">${img ? '🖼️' : '✏️'} ${fileName} <span style="font-size:11px; background:var(--primary); color:var(--primary-text); padding:4px 10px; border-radius:12px; font-weight:600; letter-spacing:0.5px;">${displayTier}</span></div>
            </div>
            <button class="btn-delete-workspace" title="Remove Workspace">
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="3 6 5 6 21 6"></polyline><path d="M19 6v14a2 2 0 01-2 2H7a2 2 0 01-2-2V6m3 0V4a2 2 0 012-2h4a2 2 0 012 2v2"></path></svg>
            </button>
        </div>
        
        <div class="workspace-controls">
            <div class="history-controls">
                <button class="btn-history z-out" title="Zoom Out">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                </button>
                <span class="z-val">100%</span>
                <button class="btn-history z-in" title="Zoom In">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="11" cy="11" r="8"></circle><line x1="21" y1="21" x2="16.65" y2="16.65"></line><line x1="11" y1="8" x2="11" y2="14"></line><line x1="8" y1="11" x2="14" y2="11"></line></svg>
                </button>
            </div>
            ${hasHistory ? `
            <div class="history-controls">
                <button class="btn-history u-btn" disabled title="Undo">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 7v6h6"></path><path d="M21 17a9 9 0 00-9-9 9 9 0 00-6 2.3L3 13"></path></svg>
                </button>
                <button class="btn-history r-btn" disabled title="Redo">
                    <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 7v6h-6"></path><path d="M3 17a9 9 0 019-9 9 9 0 016 2.3l3 2.7"></path></svg>
                </button>
            </div>` : ''}
            <div class="local-controls">
                ${!isManual ? `<label>Col <input type="number" class="l-col" value="${initColors}" min="2" max="100" ${isBasic ? 'disabled title="Fixed at 15 for Basic"' : ''}></label>` : ''}
                <label>W <input type="number" class="l-w" value="${initCols}" min="5" max="300" ${isBasic ? 'disabled title="Fixed at 50 for Basic"' : ''}></label>
                <label>H <input type="number" class="l-h" value="${initRows}" min="5" max="300" ${isBasic ? 'disabled title="Fixed at 65 for Basic"' : ''}></label>
            </div>
        </div>
        
        ${canEditPalette ? `
        <!-- 🎨 1. Pop-up สำหรับแก้ไขสี (Edit Color) -->
        <div class="color-popup glass" id="cp_${wid}">
            <div class="popup-header"><span class="popup-title">Edit Color</span><span class="popup-close" onclick="this.closest('.color-popup').classList.remove('show')">✖</span></div>
            <div class="color-input-wrapper"><label>Color Spectrum & Hue</label><input type="color" class="big-color-picker a-pick" title="Click to open color spectrum"></div>
            <div class="color-input-wrapper"><label>Hex Code</label><div class="hex-input-group"><span>#</span><input type="text" class="hex-input h-pick" maxlength="6" value="FFFFFF"></div></div>
            <div class="color-input-wrapper" style="margin-top:5px;"><label>Document Colors</label><div class="popup-swatches-grid doc-colors-list"></div></div>
            <div class="color-input-wrapper" style="margin-top:5px;"><label>Default Swatches</label><div class="popup-swatches-grid default-colors-list">
                    ${defaultSwatches.map(h => `<div class="popup-swatch" style="background:${h}" onclick="const ws=document.getElementById('${wid}'); const popup=document.getElementById('cp_${wid}'); const ap=popup.querySelector('.a-pick'); ap.value='${h}'; ap.dispatchEvent(new Event('change'));"></div>`).join('')}
            </div></div>
            <div class="color-input-wrapper" style="margin-top:5px;"><label>Recent Colors</label><div class="popup-swatches-grid recent-colors-list"></div></div>
            
            ${canAddColor ? `<button class="btn-danger btn-delete-color" style="display:flex; justify-content:center; width:100%; margin-top:15px; border-radius:12px; padding:12px; font-size:14px; box-sizing:border-box; border:none; cursor:pointer;">🗑️ Remove Color</button>` : ''}
        </div>
        
        <!-- 🟢 2. Pop-up สำหรับเพิ่มสีใหม่ (Add New Color) แบบหน้าตาเหมือนกันเป๊ะ -->
        ${canAddColor ? `
        <div class="color-popup glass" id="cp_add_${wid}">
            <div class="popup-header"><span class="popup-title">Add New Color</span><span class="popup-close" onclick="this.closest('.color-popup').classList.remove('show')">✖</span></div>
            <div class="color-input-wrapper"><label>Color Spectrum & Hue</label><input type="color" class="big-color-picker a-pick-add" title="Click to open color spectrum" value="#10B981"></div>
            <div class="color-input-wrapper"><label>Hex Code</label><div class="hex-input-group"><span>#</span><input type="text" class="hex-input h-pick-add" maxlength="6" value="10B981"></div></div>
            <div class="color-input-wrapper" style="margin-top:5px;"><label>Default Swatches</label><div class="popup-swatches-grid default-colors-list">
                    ${defaultSwatches.map(h => `<div class="popup-swatch" style="background:${h}" onclick="const popup=document.getElementById('cp_add_${wid}'); const ap=popup.querySelector('.a-pick-add'); ap.value='${h}'; ap.dispatchEvent(new Event('change'));"></div>`).join('')}
            </div></div>
            <div class="color-input-wrapper" style="margin-top:5px;"><label>Recent Colors</label><div class="popup-swatches-grid recent-colors-list"></div></div>
            
            <button class="btn-primary btn-confirm-add" style="display:flex; justify-content:center; width:100%; margin-top:15px; border-radius:12px; padding:12px; font-size:14px; border:none; box-sizing:border-box; cursor:pointer;">➕ Add Color</button>
        </div>
        ` : ''}
        ` : ''}

        <div class="palette"></div>
        
        ${canPaint ? `
        <div class="tool-controls flex-center" style="gap:10px; margin-bottom:15px; margin-top:-15px;">
            <button class="tool-btn active" data-tool="brush" style="padding:8px 16px; border-radius:10px; border:1px solid var(--primary); background:var(--primary); color:var(--primary-text); cursor:pointer; font-weight:600;">🖌️ Brush</button>
            <button class="tool-btn" data-tool="fill" style="padding:8px 16px; border-radius:10px; border:1px solid var(--brd); background:var(--card-bg); color:var(--text); cursor:pointer; font-weight:600;">🪣 Fill</button>
            <button class="tool-btn" data-tool="eraser" style="padding:8px 16px; border-radius:10px; border:1px solid var(--brd); background:var(--card-bg); color:var(--text); cursor:pointer; font-weight:600;">🧼 Eraser</button>
        </div>` : ''}

        <div class="canvas-container"><canvas></canvas></div>
        <div class="hint">💡 Click a color above to paint. Double-click to edit.</div>
    `;
    $('resultsContainer').appendChild(w);

    const s = { 
        id: wid, fileName: fileName, tier: tier, C: initCols, R: initRows, zoom: 1.0,
        grid:[], pal:[], actIdx:0, hist:[], hIdx:-1, isPaint:false, isCh:false, activeTool: 'brush', 
        tab: activeTab, 
        el: { c:w.querySelector('canvas'), ctx:w.querySelector('canvas').getContext('2d'), pBox:w.querySelector('.palette'), 
              aPk:w.querySelector('.a-pick'), hPk:w.querySelector('.h-pick'), popup:w.querySelector('.color-popup'),
              uBtn:w.querySelector('.u-btn'), rBtn:w.querySelector('.r-btn') }
    };
    const lCol = w.querySelector('.l-col'); const lW = w.querySelector('.l-w'); const lH = w.querySelector('.l-h');
    // 🟢 จดจำว่าภาพนี้ถูกสร้างมาด้วยระบบ Fixed Palette
    s.isFixed = useFixedPal;

    // 🟢 สร้างตัวรับคำสั่งเปลี่ยนสีจาก Global
    s.updateFixedColor = (idx, hex) => {
        if (idx < s.pal.length) {
            let rgb = hexToRgb(hex);
            if (rgb) {
                s.pal[idx] = rgb;
                // สั่งให้วาดกระดานใหม่ด้วยสีใหม่ทันที
                drawPal(); 
                drawGrid();
                
                // อัปเดตกล่องเครื่องมือแก้ไขสีด้วย (ถ้ามี)
                if (s.actIdx === idx && canEditPalette) {
                    syncPopupColors(hex);
                }
            }
        }
    };
    appWorkspaces.push(s);

    w.querySelector('.btn-delete-workspace').onclick = () => { 
        askConfirm("Remove this workspace?", () => {
            if(s.el.popup) s.el.popup.remove(); 
            w.remove(); 
            appWorkspaces = appWorkspaces.filter(x => x.id !== wid); 
            updateSliderView(); 
            toggleWorkspaceMode(); 
        });
    };

    const updateZoom = () => { s.el.c.style.width = Math.floor(s.C * s.cs * s.zoom) + 'px'; s.el.c.style.height = Math.floor(s.R * s.cs * s.zoom) + 'px'; w.querySelector('.z-val').innerText = Math.round(s.zoom * 100) + '%'; };
    w.querySelector('.z-out').onclick = () => { if(s.zoom > 0.2) { s.zoom -= 0.2; updateZoom(); } };
    w.querySelector('.z-in').onclick = () => { if(s.zoom < 4.0) { s.zoom += 0.2; updateZoom(); } };

    const saveHist = () => { if(!hasHistory) return; if(s.hIdx < s.hist.length-1) s.hist = s.hist.slice(0, s.hIdx+1); s.hist.push({g: s.grid.map(r=>[...r]), p: s.pal.map(c=>({...c}))}); if(s.hist.length>50) { s.hist.shift(); s.hIdx--; } s.hIdx++; updateH(); };
    const goHist = d => { s.hIdx+=d; let state=s.hist[s.hIdx]; s.grid=state.g.map(r=>[...r]); s.pal=state.p.map(c=>({...c})); s.actIdx=Math.min(s.actIdx, s.pal.length-1); syncPopupColors(rgbToHex(s.pal[s.actIdx].r, s.pal[s.actIdx].g, s.pal[s.actIdx].b)); drawPal(); drawGrid(); updateH(); };
    const updateH = () => { if(s.el.uBtn) s.el.uBtn.disabled = s.hIdx<=0; if(s.el.rBtn) s.el.rBtn.disabled = s.hIdx>=s.hist.length-1; };
    if(hasHistory) { s.el.uBtn.onclick = () => goHist(-1); s.el.rBtn.onclick = () => goHist(1); }

    const syncPopupColors = (hex) => { if(!s.el.aPk) return; s.el.aPk.value = hex; s.el.hPk.value = hex.replace('#', ''); };
    const openPopup = () => { if(!s.el.popup) return; document.querySelectorAll('.color-popup.show').forEach(p => p.classList.remove('show')); s.el.popup.classList.add('show'); };

    const drawPal = () => {
        let html = s.pal.map((c,i) => `<div class="color-btn ${i===s.actIdx?'active':''}" style="background:rgb(${c.r},${c.g},${c.b}); color:${contrast(c.r,c.g,c.b)}; cursor:${canEditPalette?'pointer':'default'};" data-i="${i}">${i+1}</div>`).join('');
        if(canAddColor) html += `<div class="color-btn add-new" title="Add New Color">➕</div>`;
        s.el.pBox.innerHTML = html;

        if(canEditPalette) {
            if(s.el.popup) s.el.popup.querySelector('.doc-colors-list').innerHTML = s.pal.map((c,i) => `<div class="popup-swatch" style="background:rgb(${c.r},${c.g},${c.b})" onclick="const ws=document.getElementById('${wid}'); const popup=document.getElementById('cp_${wid}'); const ap=popup.querySelector('.a-pick'); ap.value='${rgbToHex(c.r,c.g,c.b)}'; ap.dispatchEvent(new Event('change'));"></div>`).join('');
            s.el.pBox.querySelectorAll('.color-btn:not(.add-new)').forEach(b => {
                b.onclick = (e) => { s.actIdx = parseInt(b.dataset.i); syncPopupColors(rgbToHex(s.pal[s.actIdx].r, s.pal[s.actIdx].g, s.pal[s.actIdx].b)); drawPal(); if(canEditPalette) openPopup(); };
            });
        }
        
        if(canAddColor) s.el.pBox.querySelector('.add-new').onclick = () => { 
            if (isBasic && s.pal.length >= 15) { 
                showToast("Basic plan is limited to 15 colors. Upgrade for more!", "error");
                return;
            }
            
            // 🟢 ปิดกล่องเปลี่ยนสีเดิม (ถ้าเปิดค้างไว้) แล้วโชว์กล่องเพิ่มสีขึ้นมาแทน
            document.querySelectorAll('.color-popup.show').forEach(p => p.classList.remove('show'));
            const addPopup = document.getElementById(`cp_add_${wid}`);
            if(addPopup) addPopup.classList.add('show');
        };
    };
    
    const drawGrid = () => { 
        s.el.ctx.clearRect(0,0,s.el.c.width, s.el.c.height); 
        s.el.ctx.fillStyle = '#fff';
        s.el.ctx.fillRect(0,0,s.el.c.width, s.el.c.height);

        let colorGroups = Array.from({length: s.pal.length}, () => []);
        for(let r=0; r<s.R; r++) {
            for(let c=0; c<s.C; c++) {
                if (s.grid[r][c] !== -1) {
                    colorGroups[s.grid[r][c]].push({r, c});
                }
            }
        }
        
        s.el.ctx.lineWidth = 1;
        s.el.ctx.strokeStyle = 'rgba(156,163,175,0.2)';
        
        for(let i=0; i<s.pal.length; i++) {
            if (colorGroups[i].length === 0) continue;
            s.el.ctx.fillStyle = `rgb(${s.pal[i].r},${s.pal[i].g},${s.pal[i].b})`;
            s.el.ctx.beginPath();
            for(let cell of colorGroups[i]) {
                let cx = cell.c * s.cs, cy = cell.r * s.cs;
                s.el.ctx.fillRect(cx, cy, s.cs, s.cs);
                s.el.ctx.rect(cx, cy, s.cs, s.cs);
            }
            s.el.ctx.stroke();
        }
    };

    const initArt = () => {
        // 🟢 เปลี่ยนจาก tier === 'BASIC' เป็น isBasic เพื่อปลดล็อกโหมดทดลอง และใส่ค่ากันเหนียว (||) เผื่อกันบั๊ก
        let maxC = isBasic ? 15 : (isManual ? 0 : (lCol ? (parseInt(lCol.value) || 24) : 24));
        let C = isBasic ? 50 : (parseInt(lW.value) || 50); 
        let R = isBasic ? 65 : (parseInt(lH.value) || 65);
        
        s.C=C; s.R=R; s.cs = Math.max(10, Math.floor(650/Math.max(C,R))); 
        s.el.c.width=C*s.cs; s.el.c.height=R*s.cs;
        updateZoom();
        
        const finishInitArt = () => {
            s.hist=[]; s.hIdx=-1; s.actIdx=0; 
            if(canEditPalette) syncPopupColors(rgbToHex(s.pal[0].r,s.pal[0].g,s.pal[0].b));
            drawPal(); drawGrid(); if(hasHistory) saveHist();
        };

        if (isManual) {
            s.pal = [{r:255,g:255,b:255}, {r:0,g:0,b:0}]; s.grid=[]; 
            for(let r=0; r<R; r++) { s.grid[r]=[]; for(let c=0; c<C; c++) s.grid[r][c]=0; }
            finishInitArt();
        } else if (useFixedPal) {
            let tr=C/R, sr=img.width/img.height, sw=img.width, sh=img.height, sx=0, sy=0;
            if(sr>tr){ sw=sh*tr; sx=(img.width-sw)/2; } else { sh=sw/tr; sy=(img.height-sh)/2; }
            let tc = document.createElement('canvas').getContext('2d', {willReadFrequently:true}); tc.canvas.width=C; tc.canvas.height=R;
            tc.fillStyle='#fff'; tc.fillRect(0,0,C,R); tc.drawImage(img, sx, sy, sw, sh, 0, 0, C, R);
            
            // ดึงสีจากพาเลตต์ส่วนกลางมาใช้ตามโควต้าของ User
            s.pal = globalFixedPalette.slice(0, maxC).map(h => hexToRgb(h)); 
            s.grid=[];
            let imgDataArr = tc.getImageData(0,0,C,R).data;
            for(let r=0; r<R; r++) {
                s.grid[r]=[];
                for(let c=0; c<C; c++) {
                    let id=(r*C+c)*4, pr=imgDataArr[id], pg=imgDataArr[id+1], pb=imgDataArr[id+2];
                    let best=0, min=Infinity; 
                    s.pal.forEach((pl,i)=>{ let d=sqDist({r:pr,g:pg,b:pb}, pl); if(d<min){min=d;best=i;} }); 
                    s.grid[r][c]=best; // แทนค่าสีพิกเซลด้วยสีที่ใกล้เคียงที่สุดจาก Palette ของเรา
                }
            }
            finishInitArt();
        } else {
            let tr=C/R, sr=img.width/img.height, sw=img.width, sh=img.height, sx=0, sy=0;
            if(sr>tr){ sw=sh*tr; sx=(img.width-sw)/2; } else { sh=sw/tr; sy=(img.height-sh)/2; }
            let tc = document.createElement('canvas').getContext('2d', {willReadFrequently:true}); tc.canvas.width=C; tc.canvas.height=R;
            tc.fillStyle='#fff'; tc.fillRect(0,0,C,R); tc.drawImage(img, sx, sy, sw, sh, 0, 0, C, R);
            
            getKMeansAsync(tc.getImageData(0,0,C,R).data, maxC).then(newPal => {
                s.pal = newPal; s.grid=[];
                let imgDataArr = tc.getImageData(0,0,C,R).data;
                for(let r=0; r<R; r++) {
                    s.grid[r]=[];
                    for(let c=0; c<C; c++) {
                        let id=(r*C+c)*4, pr=imgDataArr[id], pg=imgDataArr[id+1], pb=imgDataArr[id+2];
                        let best=0, min=Infinity; 
                        s.pal.forEach((pl,i)=>{ let d=sqDist({r:pr,g:pg,b:pb}, pl); if(d<min){min=d;best=i;} }); 
                        s.grid[r][c]=best;
                    }
                }
                finishInitArt();
            });
        }
    };

    const chgColor = (hex, push) => { 
        let rgb=hexToRgb(hex); 
        if(rgb){ if(push){s.pal.push(rgb); s.actIdx=s.pal.length-1;} else {s.pal[s.actIdx]=rgb;} syncPopupColors(hex); drawPal(); drawGrid(); saveHist(); addRecent(hex); } 
    };

    if(canEditPalette && s.el.aPk) {
        s.el.aPk.addEventListener('input', e => { s.el.hPk.value = e.target.value.replace('#','').toUpperCase(); let rgb=hexToRgb(e.target.value); if(rgb){s.pal[s.actIdx]=rgb; drawPal(); drawGrid();} });
        s.el.aPk.addEventListener('change', e => chgColor(e.target.value, false));
        s.el.hPk.addEventListener('change', e => { let val = e.target.value; if(!val.startsWith('#')) val = '#' + val; if(/^#[0-9A-F]{6}$/i.test(val)) { chgColor(val, false); } else { syncPopupColors(rgbToHex(s.pal[s.actIdx].r, s.pal[s.actIdx].g, s.pal[s.actIdx].b)); } });
        
        // 🟢 ฟังก์ชันลบสีออกจาก Palette พร้อมล้างเม็ดสีทิ้ง
        const btnDelColor = s.el.popup.querySelector('.btn-delete-color');
        if(btnDelColor) {
            btnDelColor.onclick = () => {
                if(s.pal.length <= 2) {
                    showToast("Palette must have at least 2 colors.", "error");
                    return;
                }
                askConfirm("Remove this color? Pixels using this color will be erased.", () => {
                    const rmIdx = s.actIdx;
                    
                    // 1. ลบสีออกจากตารางสี
                    s.pal.splice(rmIdx, 1);
                    
                    // 2. ล้างค่าสีเดิมในกระดานวาดภาพ (Grid) ออกให้เป็นที่ว่าง (-1)
                    // และขยับ Index สีที่เหลือให้ตรงกับตารางสีใหม่
                    for(let r=0; r<s.R; r++) {
                        for(let c=0; c<s.C; c++) {
                            if(s.grid[r][c] === rmIdx) {
                                s.grid[r][c] = -1; // ล้างสีให้โปร่งใส
                            } else if(s.grid[r][c] > rmIdx) {
                                s.grid[r][c] -= 1; // เลื่อน Index สีถัดไปลงมา
                            }
                        }
                    }
                    
                    // 3. ปรับสถานะปุ่มที่เลือกอยู่ให้ถูกต้อง
                    if(s.actIdx >= s.pal.length) s.actIdx = s.pal.length - 1;
                    
                    s.el.popup.classList.remove('show');
                    syncPopupColors(rgbToHex(s.pal[s.actIdx].r, s.pal[s.actIdx].g, s.pal[s.actIdx].b));
                    drawPal(); 
                    drawGrid(); 
                    saveHist(); // บันทึกประวัติเพื่อให้กด Undo กลับมาได้ถ้าเผลอลบ
                    showToast("Color removed successfully.");
                    
                });
            };
        }
    }

    // 🟢 สร้างระบบควบคุมการจิ้มสี และการกดยืนยันสำหรับกล่อง "เพิ่มสีใหม่"
    const addPopup = document.getElementById(`cp_add_${wid}`);
    if(addPopup && canAddColor) {
        const aPkAdd = addPopup.querySelector('.a-pick-add');
        const hPkAdd = addPopup.querySelector('.h-pick-add');
        const btnConfirmAdd = addPopup.querySelector('.btn-confirm-add');

        // สัมพันธ์รหัสสี Hex เข้ากับแป้นสี
        aPkAdd.addEventListener('input', e => { hPkAdd.value = e.target.value.replace('#','').toUpperCase(); });
        aPkAdd.addEventListener('change', e => { hPkAdd.value = e.target.value.replace('#','').toUpperCase(); });
        hPkAdd.addEventListener('change', e => { 
            let val = e.target.value; 
            if(!val.startsWith('#')) val = '#' + val; 
            if(/^#[0-9A-F]{6}$/i.test(val)) { aPkAdd.value = val; } 
            else { hPkAdd.value = aPkAdd.value.replace('#','').toUpperCase(); } 
        });

        // เวลากดปุ่ม ➕ Add Color ค่อยเอาสีไปเข้า Palette
        btnConfirmAdd.onclick = () => {
            let hex = aPkAdd.value;
            chgColor(hex, true); // true = สั่งเพิ่มสีเข้าไปใหม่
            addPopup.classList.remove('show'); // พับหน้าต่างเก็บ
            showToast("New color added!");
        };
    }

    if(canPaint) {
        const toolBtns = w.querySelectorAll('.tool-btn');
        toolBtns.forEach(btn => {
            btn.onclick = () => {
                toolBtns.forEach(b => {
                    b.style.background = 'var(--card-bg)'; b.style.color = 'var(--text)'; b.style.borderColor = 'var(--brd)'; b.classList.remove('active');
                });
                btn.style.background = 'var(--primary)'; btn.style.color = 'var(--primary-text)'; btn.style.borderColor = 'var(--primary)'; btn.classList.add('active');
                s.activeTool = btn.dataset.tool;
            };
        });

        const drawCellDirect = (r, c, colorIndex) => {
            if(colorIndex === -1) {
                s.el.ctx.clearRect(c * s.cs, r * s.cs, s.cs, s.cs);
                s.el.ctx.fillStyle = '#fff';
                s.el.ctx.fillRect(c * s.cs, r * s.cs, s.cs, s.cs);
            } else {
                let cl = s.pal[colorIndex];
                s.el.ctx.fillStyle = `rgb(${cl.r},${cl.g},${cl.b})`;
                s.el.ctx.fillRect(c * s.cs, r * s.cs, s.cs, s.cs);
            }
            s.el.ctx.strokeStyle = 'rgba(156,163,175,0.2)';
            s.el.ctx.lineWidth = 1;
            s.el.ctx.strokeRect(c * s.cs, r * s.cs, s.cs, s.cs);
        };

        const floodFill = (r, c, targetIdx, fillIdx) => {
            if (targetIdx === fillIdx) return;
            const stack = [{r, c}];
            while(stack.length > 0) {
                const curr = stack.pop();
                const cr = curr.r, cc = curr.c;
                if (cr < 0 || cr >= s.R || cc < 0 || cc >= s.C) continue;
                if (s.grid[cr][cc] !== targetIdx) continue;
                
                s.grid[cr][cc] = fillIdx;
                drawCellDirect(cr, cc, fillIdx);
                
                stack.push({r: cr + 1, c: cc});
                stack.push({r: cr - 1, c: cc});
                stack.push({r: cr, c: cc + 1});
                stack.push({r: cr, c: cc - 1});
            }
        };

        const paint = e => {
            let ev = e.touches ? e.touches[0] : e; let rct = s.el.c.getBoundingClientRect(); let borderW = 1;
            let scaleX = s.el.c.width / (rct.width - borderW*2); let scaleY = s.el.c.height / (rct.height - borderW*2);
            let c = Math.floor((ev.clientX - rct.left - borderW) * scaleX / s.cs); let r = Math.floor((ev.clientY - rct.top - borderW) * scaleY / s.cs);
            
            if (r >= 0 && r < s.R && c >= 0 && c < s.C) {
                if (s.activeTool === 'brush' && s.grid[r][c] !== s.actIdx) {
                    s.grid[r][c] = s.actIdx; drawCellDirect(r, c, s.actIdx); s.isCh = true;
                }
                else if (s.activeTool === 'eraser' && s.grid[r][c] !== -1) {
                    s.grid[r][c] = -1; drawCellDirect(r, c, -1); s.isCh = true;
                }
                else if (s.activeTool === 'fill' && s.isPaint) {
                    const targetIdx = s.grid[r][c];
                    if(targetIdx !== s.actIdx) {
                        floodFill(r, c, targetIdx, s.actIdx);
                        s.isCh = true;
                        s.isPaint = false;
                    }
                }
            }
        };

        s.el.c.addEventListener('mousedown', e => { s.isPaint=true; s.isCh=false; paint(e); });
        s.el.c.addEventListener('touchstart', e => { s.isPaint=true; s.isCh=false; paint(e); e.preventDefault(); }, {passive:false});
        s.el.c.addEventListener('mousemove', e => { if(s.isPaint && s.activeTool !== 'fill') paint(e); });
        s.el.c.addEventListener('touchmove', e => { if(s.isPaint && s.activeTool !== 'fill') paint(e); e.preventDefault(); }, {passive:false});
        const finishStroke = () => { if(s.isPaint && s.isCh){ saveHist(); s.isCh=false; } s.isPaint=false; };
        window.addEventListener('mouseup', finishStroke); window.addEventListener('touchend', finishStroke); window.addEventListener('touchcancel', finishStroke);
    }
    
    if(lCol) lCol.addEventListener('change', () => setTimeout(initArt, 50));
    if(lW) lW.addEventListener('change', () => setTimeout(initArt, 50));
    if(lH) lH.addEventListener('change', () => setTimeout(initArt, 50));
    
    initArt(); if(canEditPalette) updateAllRecentColorsUI();
}

// ---------------- Export & Quota System (Backend Update) ----------------
// ---------------- Export & Quota System ----------------
// ---------------- Export & Quota System ----------------
const closeDownloadConfirm = () => { $('downloadConfirmModal').classList.remove('show'); };

const proceedDownload = async () => {
    const activeWorkspaces = appWorkspaces.filter(ws => ws.tab === activeTab);
    
    // 🟢 ล็อกเป้า: เช็คจากโหมดที่เลือกบนปุ่มเท่านั้น! ห้ามไปอ่านค่าอื่น
    const usingTrial = (activeQuotaMode === 'TRIAL');

    const today = new Date().toDateString();
    if(sessionUser && sessionUser.lastDownloadDate !== today && !usingTrial) {
        sessionUser.autoDownloadsToday = 0;
        sessionUser.manualDownloadsToday = 0;
        sessionUser.lastDownloadDate = today;
    }

    let limit = Infinity;
    let currentCount = 0;
    let typeName = activeTab === 'AUTO' ? "Auto Pixel Art" : "Blank Canvas";

    if (usingTrial) {
        limit = activeTab === 'AUTO' ? 3 : 1;
        currentCount = activeTab === 'AUTO' ? (sessionUser.trialAutoUsed || 0) : (sessionUser.trialManualUsed || 0);
        typeName = "Premium Trial";
    } else {
        if (userTier === 'BASIC') {
            limit = activeTab === 'AUTO' ? 10 : 1;
            currentCount = activeTab === 'AUTO' ? (sessionUser.autoDownloadsToday || 0) : (sessionUser.manualDownloadsToday || 0);
        } else if (userTier === 'ECO') {
            limit = activeTab === 'AUTO' ? Infinity : 5;
            currentCount = activeTab === 'AUTO' ? (sessionUser.autoDownloadsToday || 0) : (sessionUser.manualDownloadsToday || 0);
        }
    }

    const remaining = limit - currentCount;

    if(limit !== Infinity && activeWorkspaces.length > remaining) {
        closeDownloadConfirm(); 
        showLimitModal(typeName, limit); 
        return;
    }

    closeDownloadConfirm();

    if (userTier !== 'PREMIUM') {
        try {
            await fetch(`${API_URL}/user/download`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${getAuthToken()}` },
                // 🟢 ส่งคำสั่ง useTrial ตรงๆ ไปให้หลังบ้านตัดยอดตาม
                body: JSON.stringify({ tab: activeTab, amount: activeWorkspaces.length, useTrial: usingTrial }) 
            });
            
            if (usingTrial) {
                if (activeTab === 'AUTO') sessionUser.trialAutoUsed = (sessionUser.trialAutoUsed || 0) + activeWorkspaces.length;
                else sessionUser.trialManualUsed = (sessionUser.trialManualUsed || 0) + activeWorkspaces.length;
            } else {
                if (activeTab === 'AUTO') sessionUser.autoDownloadsToday = (sessionUser.autoDownloadsToday || 0) + activeWorkspaces.length;
                else sessionUser.manualDownloadsToday = (sessionUser.manualDownloadsToday || 0) + activeWorkspaces.length;
            }
        } catch (err) { console.error("Failed to update quota"); }
    }

    const wArt=$('global_dl_art').checked, wPbn=$('global_dl_pbn').checked, wPal=$('global_dl_pal').checked;
    let btn=$('global_dl_btn'), fmt=$('global_format').value, pVal=$('global_paper_size').value.split('x'), bW=parseFloat(pVal[0]), bH=parseFloat(pVal[1]);
    btn.innerText="⏳ Packaging files..."; btn.disabled=true; 
    await new Promise(r=>setTimeout(r,50));
    
    try {
        const PDFConstructor = window.jspdf ? window.jspdf.jsPDF : null;

        if(fmt=='zip') {
            const zip = new JSZip();
            activeWorkspaces.forEach((ws, i) => {
                let bn=ws.fileName.split('.')[0]+`_(${i+1})`, f=zip.folder(bn), pW=ws.C>ws.R?Math.max(bW,bH):Math.min(bW,bH), pH=ws.C>ws.R?Math.min(bW,bH):Math.max(bW,bH);
                if(wArt) f.file(`${bn}_PixelArt.png`, getExpCanvas(ws,'art',pW,pH).toDataURL('image/png').split(',')[1], {base64:true});
                if(wPbn) f.file(`${bn}_NumberGrid.png`, getExpCanvas(ws,'pbn',pW,pH).toDataURL('image/png').split(',')[1], {base64:true});
                if(wPal) f.file(`${bn}_Palette.png`, getPalCanvas(ws).toDataURL('image/png').split(',')[1], {base64:true});
            });
            const blob = await zip.generateAsync({type:"blob"}); const a=document.createElement('a'); a.href=URL.createObjectURL(blob); a.download=`PixelArt_Export.zip`; a.click(); setTimeout(()=>URL.revokeObjectURL(a.href),2000);
        } else {
            let pdf=null;
            activeWorkspaces.forEach(ws => {
                let pW=ws.C>ws.R?Math.max(bW,bH):Math.min(bW,bH), pH=ws.C>ws.R?Math.min(bW,bH):Math.max(bW,bH), o=pW>pH?'l':'p', exp=[];
                if(wArt) exp.push(getExpCanvas(ws,'art',pW,pH)); 
                if(wPbn) exp.push(getExpCanvas(ws,'pbn',pW,pH)); 
                if(wPal) exp.push(getPalCanvas(ws));
                exp.forEach(c => {
                    if(!pdf) pdf=new PDFConstructor({orientation:o, unit:'in', format:[pW,pH]}); else pdf.addPage([pW,pH],o);
                    if(c.isPal){ let m=0.5, uw=pW-m*2, uh=pH-m*2, r=Math.min(uw/c.width, uh/c.height), dw=c.width*r, dh=c.height*r; pdf.addImage(c.toDataURL('image/png',1.0),'PNG',m+(uw-dw)/2,m+(uh-dh)/2,dw,dh); } 
                    else pdf.addImage(c.toDataURL('image/png',1.0),'PNG',0,0,pW,pH);
                });
            });
            if(pdf) pdf.save(`PixelArt_Book.pdf`);
        }
        showToast("Download Complete!");
    } catch(e) { showToast(e.message, "error"); }
    btn.innerText="Download Workspaces"; btn.disabled=false;
};

$('global_dl_btn').onclick = () => {
    if (!sessionUser) { openAuthModal('login'); showToast("Please log in to download.", "error"); return; }

    const wArt=$('global_dl_art').checked, wPbn=$('global_dl_pbn').checked, wPal=$('global_dl_pal').checked;
    if(!wArt && !wPbn && !wPal) { showToast("Please select at least one file type to export!", "error"); return; }
    
    const activeWorkspaces = appWorkspaces.filter(ws => ws.tab === activeTab);
    if(activeWorkspaces.length === 0) { showToast("No active artworks to download.", "error"); return; }

    const previewArea = $('exportPreviewArea');
    previewArea.innerHTML = '<div style="color: var(--text-mut); font-weight: 600;">⏳ Generating Preview...</div>';
    
    $('downloadConfirmModal').classList.add('show');

    setTimeout(() => {
        previewArea.innerHTML = '';
        let pVal = $('global_paper_size').value.split('x');
        let bW = parseFloat(pVal[0]), bH = parseFloat(pVal[1]);

        activeWorkspaces.forEach((ws, idx) => {
            let pW = ws.C > ws.R ? Math.max(bW, bH) : Math.min(bW, bH);
            let pH = ws.C > ws.R ? Math.min(bW, bH) : Math.max(bW, bH);
            const wsRow = document.createElement('div');
            wsRow.style.display = 'flex'; wsRow.style.flexDirection = 'column'; wsRow.style.gap = '10px'; wsRow.style.paddingBottom = '20px';
            wsRow.style.borderBottom = idx < activeWorkspaces.length - 1 ? '1px dashed var(--brd)' : 'none';

            const wsTitle = document.createElement('div');
            wsTitle.innerText = `📄 File ${idx + 1} : ${ws.fileName}`;
            wsTitle.style.fontWeight = '700'; wsTitle.style.fontSize = '14px'; wsTitle.style.color = 'var(--text)'; wsTitle.style.textAlign = 'left';
            wsRow.appendChild(wsTitle);

            const canvasContainer = document.createElement('div');
            canvasContainer.style.display = 'flex'; canvasContainer.style.gap = '15px'; canvasContainer.style.justifyContent = 'center'; canvasContainer.style.flexWrap = 'wrap';

            const appendPreview = (canvas, title) => {
                const wrapper = document.createElement('div');
                wrapper.style.display = 'flex'; wrapper.style.flexDirection = 'column'; wrapper.style.alignItems = 'center'; wrapper.style.gap = '8px';
                canvas.style.width = '100px'; canvas.style.height = 'auto'; canvas.style.maxHeight = '140px'; canvas.style.objectFit = 'contain';
                canvas.style.border = '1px solid var(--brd)'; canvas.style.borderRadius = '8px'; canvas.style.boxShadow = 'var(--sh-sm)'; canvas.style.backgroundColor = '#fff';
                const label = document.createElement('div'); label.innerText = title; label.style.fontSize = '11px'; label.style.fontWeight = '600'; label.style.color = 'var(--text-mut)';
                wrapper.appendChild(canvas); wrapper.appendChild(label); canvasContainer.appendChild(wrapper);
            };
            if (wArt) appendPreview(getExpCanvas(ws, 'art', pW, pH), 'Pixel Art');
            if (wPbn) appendPreview(getExpCanvas(ws, 'pbn', pW, pH), 'By Numbers');
            if (wPal) appendPreview(getPalCanvas(ws), 'Color Palette');

            wsRow.appendChild(canvasContainer); previewArea.appendChild(wsRow);
        });

        // 🟢 ล็อกเป้า: เช็คข้อความเตือนให้เป๊ะตามโหมดที่เลือก
        const usingTrial = (activeQuotaMode === 'TRIAL');

        let limit = Infinity;
        let currentCount = 0;
        let typeName = activeTab === 'AUTO' ? "Auto Pixel Art" : "Blank Canvas";

        if (usingTrial) {
            limit = activeTab === 'AUTO' ? 3 : 1;
            currentCount = activeTab === 'AUTO' ? (sessionUser.trialAutoUsed || 0) : (sessionUser.trialManualUsed || 0);
            typeName = "Premium Trial";
        } else {
            if (userTier === 'BASIC') {
                limit = activeTab === 'AUTO' ? 10 : 1;
                currentCount = activeTab === 'AUTO' ? (sessionUser.autoDownloadsToday || 0) : (sessionUser.manualDownloadsToday || 0);
            } else if (userTier === 'ECO') {
                limit = activeTab === 'AUTO' ? Infinity : 5;
                currentCount = activeTab === 'AUTO' ? (sessionUser.autoDownloadsToday || 0) : (sessionUser.manualDownloadsToday || 0);
            }
        }

        const confirmDesc = $('dlConfirmDesc');
        const btnProceed = $('btnProceedDownload'); 
        const btnUpgrade = $('btnUpgradeFromPreview'); 
        const remaining = limit - currentCount;

        if (limit !== Infinity) {
            if (activeWorkspaces.length > remaining) {
                let limitMsg = usingTrial ? 'Trial Limit Exceeded' : 'Daily Limit Exceeded';
                let descMsg = usingTrial ? `Your trial allows up to <b>${limit} total downloads</b>.` : `Your plan allows up to <b>${limit} downloads per day</b>.`;

                confirmDesc.innerHTML = 
                    `<b style="color: var(--danger); font-size: 15px;">⚠️ ${limitMsg}</b><br>` +
                    `${descMsg}<br>` +
                    `You are trying to download <b style="color:var(--text);">${activeWorkspaces.length}</b>, but you only have <b style="color: var(--danger);">${Math.max(0, remaining)}</b> remaining.`;
                
                btnProceed.style.display = 'none';
                btnUpgrade.style.display = 'flex';
            } else {
                let descMsg = usingTrial ? `Your trial allows up to <b>${limit} ${typeName} total downloads</b>.` : `Your plan allows up to <b>${limit} ${typeName} downloads per day</b>.`;

                confirmDesc.innerHTML = 
                    `${descMsg}<br>` +
                    `You are about to download <b style="color:var(--text);">${activeWorkspaces.length}</b> image(s).<br>` +
                    `Remaining quota: <b style="color: var(--success);">${remaining}</b>`;
                
                btnProceed.style.display = 'flex';
                btnUpgrade.style.display = 'none';
            }
            confirmDesc.style.display = 'block';
        } else {
            confirmDesc.style.display = 'none'; 
            btnProceed.style.display = 'flex';
            btnUpgrade.style.display = 'none';
        }

    }, 150);
};

const getExpCanvas = (ws, type, pW, pH) => {
    const dpi=300, w=Math.round(pW*dpi), h=Math.round(pH*dpi), cvs=document.createElement('canvas'); cvs.width=w; cvs.height=h; const ctx=cvs.getContext('2d');
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,w,h);
    let m=0.5*dpi, uW=w-m*2, uH=h-m*2, cs=Math.floor(Math.min(uW/ws.C, uH/ws.R)), ox=m+(uW-cs*ws.C)/2, oy=m+(uH-cs*ws.R)/2;
    ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.font=`bold ${Math.floor(cs*0.45)}px 'Prompt'`; let lw=Math.max(2, Math.floor(cs*0.05));
    let colorGroups = Array.from({length: ws.pal.length}, () => []);
    
    for(let r=0; r<ws.R; r++) {
        for(let c=0; c<ws.C; c++) {
            if (ws.grid[r][c] !== -1) { 
                colorGroups[ws.grid[r][c]].push({r, c});
            }
        }
    }

    if(type === 'art') {
        ctx.strokeStyle = 'rgba(0,0,0,0.1)'; ctx.lineWidth = 1;
        for(let i=0; i<ws.pal.length; i++) {
            if(colorGroups[i].length === 0) continue;
            ctx.fillStyle = `rgb(${ws.pal[i].r},${ws.pal[i].g},${ws.pal[i].b})`; ctx.beginPath();
            for(let cell of colorGroups[i]) { let cx = ox + cell.c * cs, cy = oy + cell.r * cs; ctx.fillRect(cx, cy, cs, cs); ctx.rect(cx, cy, cs, cs); }
            ctx.stroke();
        }
    } else {
        ctx.strokeStyle = '#333'; ctx.lineWidth = lw; ctx.fillStyle = 'rgba(0,0,0,0.35)';
        for(let i=0; i<ws.pal.length; i++) {
            if(colorGroups[i].length === 0) continue;
            ctx.beginPath();
            for(let cell of colorGroups[i]) { let cx = ox + cell.c * cs, cy = oy + cell.r * cs; ctx.rect(cx, cy, cs, cs); } ctx.stroke();
            for(let cell of colorGroups[i]) { let cx = ox + cell.c * cs, cy = oy + cell.r * cs; ctx.fillText(i+1, cx + cs/2, cy + cs/2); }
        }
    }
    return cvs;
};

const getPalCanvas = ws => {
    const cvs=document.createElement('canvas'), ctx=cvs.getContext('2d'), rows=Math.ceil(ws.pal.length/5); cvs.width=1200; cvs.height=Math.max(400, rows*220+150);
    ctx.fillStyle='#fff'; ctx.fillRect(0,0,cvs.width,cvs.height); ctx.textAlign='left'; ctx.fillStyle='#1F2937'; ctx.font='bold 36px "Prompt"'; ctx.fillText(`Color Palette - ${ws.fileName}`,40,60);
    ctx.fillStyle='#6B7280'; ctx.font='20px "Prompt"'; ctx.fillText(`Grid: ${ws.C}x${ws.R} | Colors: ${ws.pal.length}`,40,95);
    ws.pal.forEach((c,i)=>{ let cx=(i%5)*240+120, cy=150+Math.floor(i/5)*220; ctx.fillStyle=`rgb(${c.r},${c.g},${c.b})`; ctx.fillRect(cx-40,cy,80,80); ctx.strokeStyle='#E5E7EB'; ctx.lineWidth=4; ctx.strokeRect(cx-40,cy,80,80); ctx.fillStyle=contrast(c.r,c.g,c.b); ctx.font='bold 40px "Prompt"'; ctx.textAlign='center'; ctx.textBaseline='middle'; ctx.fillText(i+1,cx,cy+40); ctx.fillStyle='#374151'; ctx.textBaseline='top'; ctx.font='bold 20px "Prompt"'; ctx.fillText(`No. ${i+1}`,cx,cy+90); ctx.fillStyle='#6B7280'; ctx.font='18px monospace'; ctx.fillText(`HEX: ${rgbToHex(c.r,c.g,c.b)}`,cx,cy+120); ctx.fillText(`RGB: ${c.r},${c.g},${c.b}`,cx,cy+145); });
    cvs.isPal = true; return cvs;
};
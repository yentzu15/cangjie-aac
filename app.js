// ====== 設定變數 & 字典 ======
const RADICALS = [
    ["", "", "", ""], 
    ["日", "月", "金", "木"], 
    ["水", "火", "土", "竹"], 
    ["戈", "十", "大", "中"], 
    ["一", "弓", "人", "心"], 
    ["手", "口", "尸", "廿"], 
    ["山", "女", "田", "卜"], 
    ["刪除字根", "清空字根", "刪除內文", "加空白"] 
];

const LETTER_MAP = {
    "日": "a", "月": "b", "金": "c", "木": "d",
    "水": "e", "火": "f", "土": "g", "竹": "h",
    "戈": "i", "十": "j", "大": "k", "中": "l",
    "一": "m", "弓": "n", "人": "o", "心": "p",
    "手": "q", "口": "r", "尸": "s", "廿": "t",
    "山": "u", "女": "v", "田": "w", "卜": "y"
};

const SCAN_MS = 2500;
let state = "GROUP_SCAN"; // GROUP_SCAN (選排) 或 ITEM_SCAN (選字)
let currentGroupObjIdx = 1; // 自動掃描預設從行 1 開始 (跳過空候選區0)
let currentItemIdx = 0;
let scanTimer = null;
let lastClickTime = 0;

let typedRadicals = "";
let currentSentence = "";
let currentCandidates = [];

// DOM 綁定
const sentenceDisplay = document.getElementById('sentence-display');
const radicalDisplay = document.getElementById('radical-display');
const predictionText = document.getElementById('prediction-text');
const btnSpeak = document.getElementById('btn-speak');
const gridContainer = document.getElementById('main-grid');

let btnElements = []; 
let rowElements = []; 

function init() {
    buildGrid();
    startScanning();
    
    // 全域防抖與網頁版面全觸控支援 (病患專屬，對應單一實體按鍵)
    document.body.addEventListener('click', (e) => {
        // 如果這個點擊是照顧者直接點選「發聲」或是「其它專用按鍵」，就不觸發掃描
        if (e.target.closest('.caregiver-btn') || e.target.closest('.direct-click')) {
            return; 
        }
        handlePatientSwitch();
    });
    
    // 照顧者的語音點擊
    btnSpeak.addEventListener('click', (e) => {
        e.stopPropagation();
        speak(currentSentence);
    });
}

function buildGrid() {
    gridContainer.innerHTML = '';
    btnElements = [];
    rowElements = [];
    
    for (let r = 0; r < RADICALS.length; r++) {
        const rowDiv = document.createElement('div');
        rowDiv.className = 'grid-row';
        rowElements.push(rowDiv);
        
        const rowBtns = [];
        for (let c = 0; c < RADICALS[r].length; c++) {
            const btn = document.createElement('button');
            btn.className = 'grid-btn'; // 照顧者可用滑鼠直接點
            let char = RADICALS[r][c];
            btn.textContent = char;
            
            if (r === 0) {
                btn.classList.add('btn-candidate', 'empty');
                btn.classList.add('direct-click'); // 第0排專屬照顧者
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleCaregiverDirectClick(r, c);
                });
            } else if (r === 7) {
                btn.classList.add('direct-click'); // 第7排專屬照顧者
                if (char.includes("刪除") || char.includes("清空")) {
                    btn.classList.add('btn-danger');
                } else {
                    btn.classList.add('btn-warning');
                }
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handleCaregiverDirectClick(r, c);
                });
            } else {
                // 1~6 為字根區，嚴格遵守「唯有掃描才能選取」
                // 因此點擊這區的按鍵，會完全等同於病患按下了 Switch(空白鍵)！
                btn.addEventListener('click', (e) => {
                    e.stopPropagation();
                    handlePatientSwitch();
                });
            }
            
            rowDiv.appendChild(btn);
            rowBtns.push(btn);
        }
        btnElements.push(rowBtns);
        gridContainer.appendChild(rowDiv);
    }
}

function updateTranslation() {
    radicalDisplay.textContent = typedRadicals;
    predictionText.textContent = "";
    
    // 刷新候選區 UI
    currentCandidates = [];
    for(let i=0; i<4; i++){
        btnElements[0][i].textContent = "";
        btnElements[0][i].classList.add('empty');
    }
    
    if (!typedRadicals) return;
    
    let code = "";
    for(let r of typedRadicals) {
        code += LETTER_MAP[r] || "";
    }
    if(!code) return;
    
    // 如果全域宣告有 CJ_DICT 就使用它
    if (typeof CJ_DICT !== "undefined") {
        const exact = CJ_DICT[code] || [];
        currentCandidates.push(...exact);
        
        for(const key in CJ_DICT) {
            if(key.startsWith(code) && key !== code) {
                for(let ch of CJ_DICT[key]) {
                    if(!currentCandidates.includes(ch)) {
                        currentCandidates.push(ch);
                    }
                    if(currentCandidates.length >= 4) break;
                }
            }
            if(currentCandidates.length >= 4) break;
        }
        
        for(let i=0; i<4; i++){
            if(i < currentCandidates.length) {
                btnElements[0][i].textContent = currentCandidates[i];
                btnElements[0][i].classList.remove('empty');
            }
        }
        
        if(currentCandidates.length > 0) {
            predictionText.textContent = currentCandidates.slice(0, 6).join(" ");
        } else {
            predictionText.textContent = "無相符字";
        }
    }
}

function speak(text) {
    if(!text) return;
    if('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.lang = 'zh-TW';
        utterance.rate = 1.0;
        window.speechSynthesis.speak(utterance);
    }
}

// 實際觸發按鈕邏輯
function applyLogic(r, c) {
    let char = RADICALS[r][c];
    if(r === 0) {
        let ch = btnElements[0][c].textContent;
        if(ch) {
            currentSentence += ch;
            sentenceDisplay.textContent = currentSentence;
            typedRadicals = "";
            updateTranslation();
        }
    } else if (r === 7) {
        let action = char;
        if(action === "清空字根") {
            typedRadicals = "";
            updateTranslation();
        } else if (action === "刪除字根") {
            typedRadicals = typedRadicals.slice(0, -1);
            updateTranslation();
        } else if (action === "刪除內文") {
            currentSentence = currentSentence.slice(0, -1);
            sentenceDisplay.textContent = currentSentence;
        } else if (action === "加空白") {
            currentSentence += " ";
            sentenceDisplay.textContent = currentSentence;
        }
    } else {
        typedRadicals += char;
        updateTranslation();
    }
}

// ===== 照顧者手動強勢介入點擊 =====
function handleCaregiverDirectClick(r, c) {
    if(r === 0 && !btnElements[0][c].textContent) return; 
    
    clearInterval(scanTimer);
    applyLogic(r, c);
    
    state = "GROUP_SCAN";
    currentGroupObjIdx = 1; // 手動點擊後固定強制回到打字區，防止畫面混亂
    currentItemIdx = 0;
    updateHighlight();
    scanTimer = setInterval(stepScan, SCAN_MS);
}

// ===== 病患全域單鍵驅動 / SPACE 鍵 =====
function handlePatientSwitch() {
    const now = Date.now();
    if(now - lastClickTime < 500) return; 
    lastClickTime = now;
    
    clearInterval(scanTimer);
    
    // 設定綠色成功閃爍
    if(state === "GROUP_SCAN") {
        rowElements[currentGroupObjIdx].classList.remove('highlight-group');
        for(let btn of btnElements[currentGroupObjIdx]) {
            if(btn.textContent) btn.classList.add('flash-success');
        }
    } else {
        const btn = btnElements[currentGroupObjIdx][currentItemIdx];
        btn.classList.remove('highlight-item');
        btn.classList.add('flash-success');
    }
    
    setTimeout(() => {
        // 清除暫時綠色
        for(let r=0; r<8; r++) {
            for(let btn of btnElements[r]) btn.classList.remove('flash-success');
        }
        
        if (state === "GROUP_SCAN") {
            // 從選排進入選字，完美支援左到右的第二階體驗！
            state = "ITEM_SCAN";
            currentItemIdx = 0;
        } else {
            // 選中了某一格字根
            applyLogic(currentGroupObjIdx, currentItemIdx);
            state = "GROUP_SCAN";
            currentGroupObjIdx = 1; 
            currentItemIdx = 0;
        }
        
        updateHighlight();
        scanTimer = setInterval(stepScan, SCAN_MS);
    }, 300);
}

// 可選支援用鍵盤空白鍵觸發（PC測試方便）
document.addEventListener('keyup', (e) => {
    if(e.code === 'Space') {
        e.preventDefault();
        handlePatientSwitch();
    }
});

// ====== 掃描演算法 ======
function startScanning() {
    updateHighlight();
    scanTimer = setInterval(stepScan, SCAN_MS);
}

function stepScan() {
    if (state === "GROUP_SCAN") {
        // 全域防呆限制：掃描永遠只在 1 到 6 (字根區) 走，保證不會掃到 0 或是 7 造成困惑
        currentGroupObjIdx++;
        if(currentGroupObjIdx > 6) currentGroupObjIdx = 1; 
    } else if (state === "ITEM_SCAN") {
        // 由左至右換下一格
        currentItemIdx = (currentItemIdx + 1) % 4;
    }
    updateHighlight();
}

function updateHighlight() {
    // 預先清空所擁標記
    for(let r=0; r<8; r++) {
        rowElements[r].classList.remove('highlight-group');
        for(let c=0; c<4; c++) {
            btnElements[r][c].classList.remove('highlight-item');
        }
    }
    
    // 套用高光。如果是 GROUP_SCAN，給 row-element 加上整排亮邊背景！如果是 ITEM_SCAN，那就只給該顆 button 加
    if (state === "GROUP_SCAN") {
        rowElements[currentGroupObjIdx].classList.add('highlight-group');
    } else if (state === "ITEM_SCAN") {
        let btn = btnElements[currentGroupObjIdx][currentItemIdx];
        btn.classList.add('highlight-item');
    }
}

document.addEventListener('DOMContentLoaded', init);

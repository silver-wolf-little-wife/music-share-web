// 全局变量
let currentMusic = null;
let musicList = [];
let currentMusicIndex = 0;
let isPlaying = false;
let audio = new Audio();

// 歌词同步相关变量
let currentParsedLyrics = null;
let currentLyricIndex = -1;

// 播放模式常量
const PLAY_MODE = {
    SEQUENCE: 'sequence',    // 顺序播放
    SHUFFLE: 'shuffle',      // 随机播放
    SINGLE: 'single',        // 单曲循环
    LOOP: 'loop'            // 列表循环
};

// 播放模式状态
let currentPlayMode = PLAY_MODE.SEQUENCE;
let shuffleHistory = []; // 随机播放历史记录

// DOM 元素
const playBtn = document.getElementById('play-btn');
const prevBtn = document.getElementById('prev-btn');
const nextBtn = document.getElementById('next-btn');
const progress = document.getElementById('progress');
const currentTimeEl = document.getElementById('current-time');
const totalTimeEl = document.getElementById('total-time');
const trackNameEl = document.getElementById('track-name');
const trackArtistEl = document.getElementById('track-artist');
const currentCoverEl = document.getElementById('current-cover');
const currentCoverWrapper = document.getElementById('current-cover-wrapper');

const playlistBtn = document.getElementById('playlist-btn');
const lyricsBtn = document.getElementById('lyrics-btn');
const lyricsPanel = document.getElementById('lyrics-panel');
const playlistPanel = document.getElementById('playlist-panel');
const closeLyricsBtn = document.getElementById('close-lyrics');
const closePlaylistBtn = document.getElementById('close-playlist');

// 播放详情页元素
const playerDetailPage = document.getElementById('player-detail-page');
const playerDetailBackground = document.getElementById('player-detail-background');
const playerDetailBackBtn = document.getElementById('player-detail-back-btn');

const playerDetailCover = document.getElementById('player-detail-cover');
const playerDetailAlbumArt = document.getElementById('player-detail-album-art');
const playerDetailNeedle = document.getElementById('player-detail-needle');
const playerDetailTitle = document.getElementById('player-detail-title');
const playerDetailArtist = document.getElementById('player-detail-artist');
const playerDetailProgress = document.getElementById('player-detail-progress');
const playerDetailCurrentTime = document.getElementById('player-detail-current-time');
const playerDetailTotalTime = document.getElementById('player-detail-total-time');
const playerDetailPlayBtn = document.getElementById('player-detail-play-btn');
const playerDetailPrevBtn = document.getElementById('player-detail-prev-btn');
const playerDetailNextBtn = document.getElementById('player-detail-next-btn');
const playerDetailShuffleBtn = document.getElementById('player-detail-shuffle-btn');
const playerDetailRepeatBtn = document.getElementById('player-detail-repeat-btn');



const playerDetailPlaylistBtn = document.getElementById('player-detail-playlist-btn');
const playerDetailLyricsContainer = document.getElementById('player-detail-lyrics-container');

// 浮动图标
const gridViewBtn = document.getElementById('grid-view-btn');
const langToggleBtn = document.getElementById('lang-toggle-btn');

// 视图状态
let isGridView = false;
let currentLang = 'zh';

// 页面元素
const navItems = document.querySelectorAll('.nav-item');
const pageContents = document.querySelectorAll('.page-content');
const searchInput = document.getElementById('search-input');
const searchBtn = document.getElementById('search-btn');
const uploadBox = document.getElementById('upload-box');
const fileInput = document.getElementById('file-input');

// 初始化
document.addEventListener('DOMContentLoaded', function() {
    initEventListeners();
    loadMusicList();
    loadUserInfo();
    setupAudioEvents();
    updatePlayModeButtons();
    initScanFeature();
});

// 初始化事件监听器
function initEventListeners() {
    // 播放控制
    playBtn.addEventListener('click', togglePlay);
    prevBtn.addEventListener('click', playPrev);
    nextBtn.addEventListener('click', playNext);
    
    // 点击播放器封面显示播放详情页
    currentCoverWrapper.addEventListener('click', function() {
        if (currentMusic) {
            showPlayerDetail();
        }
    });
    
    // 进度条控制
    const progressBar = document.querySelector('.progress-bar');
    progressBar.addEventListener('click', function(e) {
        const rect = progressBar.getBoundingClientRect();
        const percent = (e.clientX - rect.left) / rect.width;
        audio.currentTime = percent * audio.duration;
    });
    
    
    
    // 面板控制
    playlistBtn.addEventListener('click', () => {
        playlistPanel.classList.toggle('show');
        lyricsPanel.classList.remove('show');
    });
    
    lyricsBtn.addEventListener('click', () => {
        lyricsPanel.classList.toggle('show');
        playlistPanel.classList.remove('show');
        if (currentMusic && currentMusic.lyrics) {
            displayLyrics(currentMusic.lyrics);
        }
    });
    
    closeLyricsBtn.addEventListener('click', () => {
        lyricsPanel.classList.remove('show');
    });
    
    closePlaylistBtn.addEventListener('click', () => {
        playlistPanel.classList.remove('show');
    });
    
    // 导航切换
    navItems.forEach(item => {
        item.addEventListener('click', function() {
            const page = this.dataset.page;
            switchPage(page);
        });
    });
    
    // 搜索功能
    searchBtn.addEventListener('click', performSearch);
    searchInput.addEventListener('keypress', function(e) {
        if (e.key === 'Enter') {
            performSearch();
        }
    });
    
    // 上传功能
    uploadBox.addEventListener('click', () => fileInput.click());
    fileInput.addEventListener('change', handleFileSelect);
    
    // 拖拽上传
    uploadBox.addEventListener('dragover', function(e) {
        e.preventDefault();
        this.classList.add('dragover');
    });
    
    uploadBox.addEventListener('dragleave', function() {
        this.classList.remove('dragover');
    });
    
    uploadBox.addEventListener('drop', function(e) {
        e.preventDefault();
        this.classList.remove('dragover');
        handleFiles(e.dataTransfer.files);
    });
    
    // 浮动图标事件
    gridViewBtn.addEventListener('click', toggleGridView);
    langToggleBtn.addEventListener('click', toggleLanguage);
    
    // 播放详情页事件
    playerDetailBackBtn.addEventListener('click', hidePlayerDetail);
    
    playerDetailPlayBtn.addEventListener('click', togglePlay);
    playerDetailPrevBtn.addEventListener('click', playPrev);
    playerDetailNextBtn.addEventListener('click', playNext);
    
    // 播放模式控制
    playerDetailShuffleBtn.addEventListener('click', toggleShuffleMode);
    playerDetailRepeatBtn.addEventListener('click', toggleRepeatMode);
    
    // 增强的播放列表按钮事件监听器
if (playerDetailPlaylistBtn) {
    playerDetailPlaylistBtn.addEventListener('click', function(e) {
        e.preventDefault();
        e.stopPropagation();
        console.log('播放详情页播放列表按钮被点击'); // 调试日志
        
        if (playlistPanel) {
            // 临时提高播放列表面板的z-index，确保在播放详情页之上显示
            playlistPanel.style.zIndex = '2001';
            playlistPanel.classList.toggle('show');
            console.log('播放列表面板状态:', playlistPanel.classList.contains('show'));
        }
        if (lyricsPanel) {
            lyricsPanel.classList.remove('show');
            // 同样调整歌词面板的z-index
            lyricsPanel.style.zIndex = '2001';
        }
    });
} else {
    console.error('播放详情页播放列表按钮未找到');
}
}

// 设置音频事件
function setupAudioEvents() {
    audio.addEventListener('timeupdate', updateProgress);
    audio.addEventListener('loadedmetadata', updateDuration);
    audio.addEventListener('ended', playNext);
    audio.addEventListener('error', function() {
        console.error('音频加载错误');
        playNext();
    });
}

// 页面切换
function switchPage(page) {
    navItems.forEach(item => {
        item.classList.remove('active');
        if (item.dataset.page === page) {
            item.classList.add('active');
        }
    });
    
    pageContents.forEach(content => {
        content.classList.remove('active');
        if (content.id === `${page}-page`) {
            content.classList.add('active');
        }
    });
}

// 加载用户信息
function loadUserInfo() {
    fetch('/auth/user')
        .then(response => response.json())
        .then(data => {
            if (data.success) {
                document.getElementById('username').textContent = data.user.username;
            } else {
                window.location.href = '/login';
            }
        })
        .catch(error => {
            console.error('获取用户信息失败:', error);
            window.location.href = '/login';
        });
}

// 加载音乐列表
function loadMusicList() {
    fetch('/api/music/list')
        .then(response => {
            if (!response.ok) {
                throw new Error('网络错误');
            }
            return response.json();
        })
        .then(data => {
            if (data.success) {
                musicList = data.music;
                displayMusicList(musicList);
                displayRecentMusic(musicList.slice(0, 6));
                updatePlaylist();
                // 加载统计信息
                fetchMusicStats();
            } else {
                // 显示错误信息
                const allMusicEl = document.getElementById('all-music');
                allMusicEl.innerHTML = `<p class="text-center text-danger">${data.message || '加载音乐列表失败'}</p>`;
                
                const recentMusicEl = document.getElementById('recent-music');
                recentMusicEl.innerHTML = `<p class="text-center text-danger">${data.message || '加载音乐列表失败'}</p>`;
            }
        })
        .catch(error => {
            console.error('加载音乐列表失败:', error);
            // 显示错误信息
            const allMusicEl = document.getElementById('all-music');
            allMusicEl.innerHTML = '<p class="text-center text-danger">加载音乐列表失败，请检查网络连接</p>';
            
            const recentMusicEl = document.getElementById('recent-music');
            recentMusicEl.innerHTML = '<p class="text-center text-danger">加载音乐列表失败，请检查网络连接</p>';
        });
}

// 显示音乐列表
function displayMusicList(music) {
    const allMusicEl = document.getElementById('all-music');
    allMusicEl.innerHTML = '';
    
    if (music.length === 0) {
        allMusicEl.innerHTML = '<p class="text-center text-muted">暂无音乐</p>';
        return;
    }
    
    music.forEach((item, index) => {
        const musicItem = createMusicListItem(item, index);
        allMusicEl.appendChild(musicItem);
    });
}

// 显示最近音乐
function displayRecentMusic(music) {
    const recentMusicEl = document.getElementById('recent-music');
    recentMusicEl.innerHTML = '';
    
    if (music.length === 0) {
        recentMusicEl.innerHTML = '<p class="text-center text-muted">暂无音乐</p>';
        return;
    }
    
    music.forEach((item, index) => {
        const musicItem = createMusicGridItem(item, index);
        recentMusicEl.appendChild(musicItem);
    });
}

// 创建音乐列表项
function createMusicListItem(music, index) {
    const div = document.createElement('div');
    div.className = 'music-list-item';
    div.innerHTML = `
        <div class="music-list-cover">
            ${music.cover ? `<img src="/api/music/cover/${escapeHtml(music.id)}" alt="${escapeHtml(music.title)}">` : '<i class="fas fa-music"></i>'}
        </div>
        <div class="music-list-info">
            <div class="music-list-title">${escapeHtml(music.title)}</div>
            <div class="music-list-meta">
                <span>${escapeHtml(music.artist)}</span>
                <span>${formatDuration(music.duration)}</span>
                <span>${formatFileSize(music.size)}</span>
            </div>
        </div>
        <div class="music-list-actions">
            <button class="action-btn" onclick="playMusic(${index})">
                <i class="fas fa-play"></i>
            </button>
        </div>
    `;
    return div;
}

// 创建音乐网格项
function createMusicGridItem(music, index) {
    const div = document.createElement('div');
    div.className = 'music-item';
    div.innerHTML = `
        <div class="music-item-cover" onclick="playMusic(${index})">
            ${music.cover ? `<img src="/api/music/cover/${escapeHtml(music.id)}" alt="${escapeHtml(music.title)}">` : '<i class="fas fa-music"></i>'}
        </div>
        <div class="music-item-info">
            <div class="music-item-title">${escapeHtml(music.title)}</div>
            <div class="music-item-artist">${escapeHtml(music.artist)}</div>
        </div>
    `;
    return div;
}

// 播放音乐
function playMusic(index) {
    if (index < 0 || index >= musicList.length) return;
    
    currentMusicIndex = index;
    currentMusic = musicList[index];
    
    // 更新播放器UI
    trackNameEl.textContent = currentMusic.title;
    trackArtistEl.textContent = currentMusic.artist;
    
    if (currentMusic.cover) {
        currentCoverWrapper.innerHTML = `<img src="/api/music/cover/${currentMusic.id}" alt="${currentMusic.title}" class="album-cover">`;
    } else {
        currentCoverWrapper.innerHTML = '<i class="fas fa-music album-cover"></i>';
    }
    
    // 先停止当前播放
    audio.pause();
    audio.currentTime = 0;
    
    // 加载音频
    if (!currentMusic.filename) {
        console.error('缺少文件名:', currentMusic);
        playNext();
        return;
    }
    audio.src = `/music/file/${encodeURIComponent(currentMusic.filename)}`;

    audio.onloadstart = function() {
        console.log('开始加载音频:', currentMusic.filename);
    };
    
    // 尝试播放
    audio.play().then(() => {
        console.log('播放成功:', currentMusic.filename);
        isPlaying = true;
        updatePlayButton();
        updatePlaylistHighlight();
    }).catch(error => {
        console.error('播放失败:', error);
        playNext();
    });
    
    // 重置歌词状态
    currentParsedLyrics = null;
    currentLyricIndex = -1;
    
    // 更新播放详情页内容（如果打开）
    updatePlayerDetailContent();
}

// 播放/暂停切换
function togglePlay() {
    if (!currentMusic) {
        if (musicList.length > 0) {
            playMusic(0);
        }
        return;
    }
    
    if (isPlaying) {
        audio.pause();
    } else {
        audio.play();
    }
    isPlaying = !isPlaying;
    updatePlayButton();
}

// 切换随机播放模式
function toggleShuffleMode() {
    if (currentPlayMode === PLAY_MODE.SHUFFLE) {
        currentPlayMode = PLAY_MODE.SEQUENCE;
        shuffleHistory = [];
    } else {
        currentPlayMode = PLAY_MODE.SHUFFLE;
        shuffleHistory = [];
    }
    updatePlayModeButtons();
}

// 切换循环播放模式
function toggleRepeatMode() {
    switch (currentPlayMode) {
        case PLAY_MODE.SEQUENCE:
            currentPlayMode = PLAY_MODE.LOOP;
            break;
        case PLAY_MODE.LOOP:
            currentPlayMode = PLAY_MODE.SINGLE;
            break;
        case PLAY_MODE.SINGLE:
            currentPlayMode = PLAY_MODE.SEQUENCE;
            break;
        case PLAY_MODE.SHUFFLE:
            currentPlayMode = PLAY_MODE.SINGLE;
            break;
    }
    updatePlayModeButtons();
}

// 更新播放模式按钮状态
function updatePlayModeButtons() {
    // 更新随机播放按钮状态
    if (currentPlayMode === PLAY_MODE.SHUFFLE) {
        playerDetailShuffleBtn.classList.add('active');
    } else {
        playerDetailShuffleBtn.classList.remove('active');
    }
    
    // 更新循环播放按钮状态
    playerDetailRepeatBtn.classList.remove('active', 'single-mode');
    if (currentPlayMode === PLAY_MODE.LOOP) {
        playerDetailRepeatBtn.classList.add('active');
    } else if (currentPlayMode === PLAY_MODE.SINGLE) {
        playerDetailRepeatBtn.classList.add('active', 'single-mode');
    }
}

// 获取随机播放的下一个索引
function getRandomIndex() {
    if (musicList.length <= 1) return 0;
    
    let randomIndex;
    do {
        randomIndex = Math.floor(Math.random() * musicList.length);
    } while (randomIndex === currentMusicIndex && musicList.length > 1);
    
    return randomIndex;
}

// 播放上一首
function playPrev() {
    if (musicList.length === 0) return;
    
    switch (currentPlayMode) {
        case PLAY_MODE.SHUFFLE:
            if (shuffleHistory.length > 0) {
                currentMusicIndex = shuffleHistory.pop();
            } else {
                currentMusicIndex = getRandomIndex();
            }
            break;
        case PLAY_MODE.SINGLE:
            // 单曲循环模式，播放当前歌曲
            break;
        case PLAY_MODE.LOOP:
        case PLAY_MODE.SEQUENCE:
        default:
            currentMusicIndex = (currentMusicIndex - 1 + musicList.length) % musicList.length;
            break;
    }
    
    playMusic(currentMusicIndex);
}

// 播放下一首
function playNext() {
    if (musicList.length === 0) return;
    
    switch (currentPlayMode) {
        case PLAY_MODE.SHUFFLE:
            shuffleHistory.push(currentMusicIndex);
            currentMusicIndex = getRandomIndex();
            break;
        case PLAY_MODE.SINGLE:
            // 单曲循环模式，播放当前歌曲
            break;
        case PLAY_MODE.LOOP:
        case PLAY_MODE.SEQUENCE:
        default:
            currentMusicIndex = (currentMusicIndex + 1) % musicList.length;
            break;
    }
    
    playMusic(currentMusicIndex);
}

// 更新播放按钮
function updatePlayButton() {
    const icon = playBtn.querySelector('i');
    if (isPlaying) {
        icon.className = 'fas fa-pause';
    } else {
        icon.className = 'fas fa-play';
    }
    
    // 同步更新播放详情页的播放按钮和唱针状态
    updatePlayerDetailPlayButton();
    updateNeedleState();
}

// 更新进度条
function updateProgress() {
    if (audio.duration) {
        const percent = (audio.currentTime / audio.duration) * 100;
        progress.style.width = percent + '%';
        playerDetailProgress.style.width = percent + '%';
        currentTimeEl.textContent = formatTime(audio.currentTime);
        playerDetailCurrentTime.textContent = formatTime(audio.currentTime);
        
        // 歌词同步
        if (playerDetailPage.classList.contains('show')) {
            syncLyrics(audio.currentTime);
        }
    }
}

// 更新总时长
function updateDuration() {
    totalTimeEl.textContent = formatTime(audio.duration);
    playerDetailTotalTime.textContent = formatTime(audio.duration);
}

// ========== 歌词系统 ==========

// 解析LRC格式歌词
function parseLRCLyrics(lyricsText) {
    const lines = lyricsText.split('\n');
    const parsedLyrics = [];

    lines.forEach(line => {
        const timeMatch = line.match(/\[(\d{2}):(\d{2})\.(\d{2,3})\]/);
        if (!timeMatch) return;

        const minutes = parseInt(timeMatch[1]);
        const seconds = parseInt(timeMatch[2]);
        const milliseconds = parseInt(timeMatch[3].padEnd(3, '0'));
        const time = minutes * 60 + seconds + milliseconds / 1000;

        const text = line.replace(/\[\d{2}:\d{2}\.\d{2,3}\]/g, '').trim();
        if (!text) return;

        parsedLyrics.push({ time, text, isTranslation: false });
    });

    parsedLyrics.sort((a, b) => a.time - b.time);

    // 连续相同时间戳的第二条标记为翻译行
    for (let i = 1; i < parsedLyrics.length; i++) {
        if (parsedLyrics[i].time === parsedLyrics[i - 1].time) {
            parsedLyrics[i].isTranslation = true;
        }
    }

    return parsedLyrics;
}

// 根据解析结果生成 HTML
function renderLyricsHTML(parsed) {
    return parsed.map(lyric => {
        const cls = lyric.isTranslation ? 'lyrics-line lyrics-line--translation' : 'lyrics-line';
        return `<div class="${cls}">${escapeHtml(lyric.text)}</div>`;
    }).join('');
}

// 同步歌词高亮与滚动
function syncLyrics(currentTime) {
    if (!currentParsedLyrics || currentParsedLyrics.length === 0) return;

    // 找到当前时间对应的原文索引（跳过翻译行）
    let newIndex = -1;
    for (let i = 0; i < currentParsedLyrics.length; i++) {
        if (currentParsedLyrics[i].isTranslation) continue;
        if (currentTime >= currentParsedLyrics[i].time) {
            newIndex = i;
        } else {
            break;
        }
    }

    if (newIndex === currentLyricIndex) return;
    currentLyricIndex = newIndex;

    const container = playerDetailLyricsContainer;
    if (!container) return;

    const lines = container.querySelectorAll('.lyrics-line');

    // 更新高亮状态（原文 + 紧接的翻译行）
    lines.forEach((el, i) => {
        const isActive = i === newIndex
            || (i === newIndex + 1 && currentParsedLyrics[i] && currentParsedLyrics[i].isTranslation);
        el.classList.toggle('active', isActive);
    });

    // 滚动高亮行到视图中央
    if (lines[newIndex]) {
        lines[newIndex].scrollIntoView({ behavior: 'smooth', block: 'center' });
    }
}

// 渲染播放详情页歌词
function displayPlayerDetailLyrics(lyrics) {
    if (!lyrics) {
        playerDetailLyricsContainer.innerHTML = '<p class="no-lyrics">暂无歌词</p>';
        currentParsedLyrics = null;
        currentLyricIndex = -1;
        return;
    }

    const hasTimeStamps = /\[\d{2}:\d{2}\.\d{2,3}\]/.test(lyrics);

    if (hasTimeStamps) {
        currentParsedLyrics = parseLRCLyrics(lyrics);
        playerDetailLyricsContainer.innerHTML = renderLyricsHTML(currentParsedLyrics);
    } else {
        currentParsedLyrics = null;
        currentLyricIndex = -1;
        const lines = lyrics.split('\n').filter(l => l.trim());
        playerDetailLyricsContainer.innerHTML = lines.map(l => `<div class="lyrics-line">${escapeHtml(l.trim())}</div>`).join('');
    }
}

// 侧滑面板歌词（支持 LRC 解析）
function displayLyrics(lyrics) {
    const container = document.getElementById('lyrics-content');
    if (!container) return;

    if (!lyrics) {
        container.innerHTML = '<p class="no-lyrics">暂无歌词</p>';
        return;
    }

    const hasTimeStamps = /\[\d{2}:\d{2}\.\d{2,3}\]/.test(lyrics);

    if (hasTimeStamps) {
        const parsed = parseLRCLyrics(lyrics);
        container.innerHTML = renderLyricsHTML(parsed);
    } else {
        const lines = lyrics.split('\n').filter(l => l.trim());
        container.innerHTML = lines.map(l => `<div class="lyrics-line">${escapeHtml(l.trim())}</div>`).join('');
    }
}



// 显示播放详情页
function showPlayerDetail() {
    if (!currentMusic) return;
    
    // 更新播放详情页内容
    const coverUrl = currentMusic.cover ? `/api/music/cover/${currentMusic.id}` : 'https://picsum.photos/seed/default/300/300.jpg';
    playerDetailCover.src = coverUrl;
    playerDetailTitle.textContent = currentMusic.title;
    playerDetailArtist.textContent = currentMusic.artist;
    playerDetailCurrentTime.textContent = currentTimeEl.textContent;
    playerDetailTotalTime.textContent = totalTimeEl.textContent;
    
    // 更新播放按钮状态
    updatePlayerDetailPlayButton();
    
    // 更新唱针状态
    updateNeedleState();
    
    // 显示歌词
    if (currentMusic.lyrics) {
        displayPlayerDetailLyrics(currentMusic.lyrics);
    }
    
    // 显示播放详情页
    playerDetailPage.classList.add('show');
}

// 更新唱针状态
function updateNeedleState() {
    if (isPlaying) {
        playerDetailNeedle.classList.add('playing');
    } else {
        playerDetailNeedle.classList.remove('playing');
    }
}



// 更新播放详情页内容
function updatePlayerDetailContent() {
    if (!currentMusic) return;
    
    // 检查播放详情页是否打开
    const isPlayerDetailVisible = playerDetailPage.classList.contains('show');
    
    if (isPlayerDetailVisible) {
        // 更新播放详情页内容
        const coverUrl = currentMusic.cover ? `/api/music/cover/${currentMusic.id}` : 'https://picsum.photos/seed/default/300/300.jpg';
        playerDetailCover.src = coverUrl;
        playerDetailTitle.textContent = currentMusic.title;
        playerDetailArtist.textContent = currentMusic.artist;
        playerDetailCurrentTime.textContent = currentTimeEl.textContent;
        playerDetailTotalTime.textContent = totalTimeEl.textContent;
        
        // 更新背景图片
        if (currentMusic.cover) {
            playerDetailBackground.style.backgroundImage = `url(${coverUrl})`;
        }
        
        // 更新歌词
        if (currentMusic.lyrics) {
            displayPlayerDetailLyrics(currentMusic.lyrics);
        } else {
            playerDetailLyricsContainer.innerHTML = '<p class="no-lyrics">暂无歌词</p>';
        }
        
        // 更新播放按钮状态
        updatePlayerDetailPlayButton();
        
        // 更新唱针状态
        updateNeedleState();
    }
}

// 隐藏播放详情页
function hidePlayerDetail() {
    playerDetailPage.classList.remove('show');
}

// 更新播放详情页播放按钮
function updatePlayerDetailPlayButton() {
    const icon = playerDetailPlayBtn.querySelector('i');
    if (isPlaying) {
        icon.className = 'fas fa-pause';
    } else {
        icon.className = 'fas fa-play';
    }
}

// 更新播放列表
function updatePlaylist() {
    const playlistContent = document.getElementById('playlist-content');
    playlistContent.innerHTML = '';
    
    musicList.forEach((music, index) => {
        const item = document.createElement('div');
        item.className = 'playlist-item';
        if (index === currentMusicIndex) {
            item.classList.add('active');
        }
        
        item.innerHTML = `
            <div class="playlist-item-info">
                <div class="playlist-item-title">${escapeHtml(music.title)}</div>
                <div class="playlist-item-artist">${escapeHtml(music.artist)}</div>
            </div>
            <div class="playlist-item-duration">${formatDuration(music.duration)}</div>
        `;
        
        item.addEventListener('click', () => playMusic(index));
        playlistContent.appendChild(item);
    });
}

// 更新播放列表高亮
function updatePlaylistHighlight() {
    const items = document.querySelectorAll('.playlist-item');
    items.forEach((item, index) => {
        if (index === currentMusicIndex) {
            item.classList.add('active');
        } else {
            item.classList.remove('active');
        }
    });
}

// 搜索功能
function performSearch() {
    const query = searchInput.value.trim();
    if (!query) {
        displayMusicList(musicList);
        return;
    }
    
    const results = musicList.filter(music => 
        music.title.toLowerCase().includes(query.toLowerCase()) ||
        music.artist.toLowerCase().includes(query.toLowerCase()) ||
        music.album.toLowerCase().includes(query.toLowerCase())
    );
    
    const searchResultsEl = document.getElementById('search-results');
    if (results.length === 0) {
        searchResultsEl.innerHTML = '<p class="text-center text-muted">未找到相关音乐</p>';
    } else {
        searchResultsEl.innerHTML = '';
        results.forEach((music, index) => {
            const originalIndex = musicList.indexOf(music);
            const musicItem = createMusicListItem(music, originalIndex);
            searchResultsEl.appendChild(musicItem);
        });
    }
    
    switchPage('search');
}

// 文件选择处理
function handleFileSelect(e) {
    handleFiles(e.target.files);
}

// 处理文件上传
function handleFiles(files) {
    const uploadList = document.getElementById('upload-list');
    const validTypes = ['audio/mpeg', 'audio/flac', 'audio/mp3'];
    
    Array.from(files).forEach(file => {
        if (!validTypes.includes(file.type) && !file.name.match(/\.(mp3|flac)$/i)) {
            alert(`不支持的文件格式: ${file.name}`);
            return;
        }
        
        const uploadItem = createUploadItem(file);
        uploadList.appendChild(uploadItem);
        
        uploadFile(file, uploadItem);
    });
}

// 创建上传项
function createUploadItem(file) {
    const div = document.createElement('div');
    div.className = 'upload-item';
    div.innerHTML = `
        <div class="upload-item-info">
            <div class="upload-item-name">${file.name}</div>
            <div class="upload-item-size">${formatFileSize(file.size)}</div>
        </div>
        <div class="upload-progress">
            <div class="upload-progress-bar" style="width: 0%"></div>
        </div>
    `;
    return div;
}

// 上传文件
function uploadFile(file, uploadItem) {
    const formData = new FormData();
    formData.append('music', file);
    
    const progressBar = uploadItem.querySelector('.upload-progress-bar');
    
    fetch('/api/music/upload', {
        method: 'POST',
        body: formData
    })
    .then(response => response.json())
    .then(data => {
        if (data.success) {
            progressBar.style.width = '100%';
            setTimeout(() => {
                uploadItem.remove();
                loadMusicList(); // 重新加载音乐列表
            }, 1000);
        } else {
            alert(`上传失败: ${data.message}`);
            uploadItem.remove();
        }
    })
    .catch(error => {
        console.error('上传错误:', error);
        alert('上传失败，请重试');
        uploadItem.remove();
    });
}

// 切换网格视图
function toggleGridView() {
    isGridView = !isGridView;
    const allMusicEl = document.getElementById('all-music');
    
    if (isGridView) {
        allMusicEl.classList.add('grid-view');
        displayMusicGrid(musicList);
    } else {
        allMusicEl.classList.remove('grid-view');
        displayMusicList(musicList);
    }
}

// 显示音乐网格
function displayMusicGrid(music) {
    const allMusicEl = document.getElementById('all-music');
    allMusicEl.innerHTML = '';
    
    if (music.length === 0) {
        allMusicEl.innerHTML = '<p class="text-center text-muted">暂无音乐</p>';
        return;
    }
    
    music.forEach((item, index) => {
        const musicItem = createMusicGridItem(item, index);
        allMusicEl.appendChild(musicItem);
    });
}

// 切换语言
function toggleLanguage() {
    currentLang = currentLang === 'zh' ? 'en' : 'zh';
    langToggleBtn.innerHTML = currentLang === 'zh' ? '<span>中A</span>' : '<span>EnA</span>';
    
    // 更新界面文本
    updateUIText();
}

// 更新界面文本
function updateUIText() {
    if (currentLang === 'en') {
        const logo = document.querySelector('.logo span');
        if (logo) logo.textContent = 'Music Share';
        const homeH2 = document.querySelector('#home-page h2');
        if (homeH2) homeH2.textContent = 'Discover Music';
        const searchH2 = document.querySelector('#search-page h2');
        if (searchH2) searchH2.textContent = 'Search Music';
        const uploadH2 = document.querySelector('#upload-page h2');
        if (uploadH2) uploadH2.textContent = 'Upload Music';
        const catH3 = document.querySelector('.category-section h3');
        if (catH3) catH3.textContent = 'All Music';
        const searchInp = document.querySelector('#search-input');
        if (searchInp) searchInp.placeholder = 'Search songs, artists...';
    } else {
        const logo = document.querySelector('.logo span');
        if (logo) logo.textContent = '音乐分享';
        const homeH2 = document.querySelector('#home-page h2');
        if (homeH2) homeH2.textContent = '发现音乐';
        const searchH2 = document.querySelector('#search-page h2');
        if (searchH2) searchH2.textContent = '搜索音乐';
        const uploadH2 = document.querySelector('#upload-page h2');
        if (uploadH2) uploadH2.textContent = '上传音乐';
        const catH3 = document.querySelector('.category-section h3');
        if (catH3) catH3.textContent = '全部音乐';
        const searchInp = document.querySelector('#search-input');
        if (searchInp) searchInp.placeholder = '搜索歌曲、艺术家...';
    }
}

// HTML 转义（防 XSS）
function escapeHtml(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
}

// 工具函数
function formatTime(seconds) {
    if (isNaN(seconds)) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

function formatDuration(seconds) {
    if (!seconds) return currentLang === 'en' ? 'Unknown' : '未知';
    return formatTime(seconds);
}

function formatFileSize(bytes) {
    if (!bytes) return currentLang === 'en' ? 'Unknown' : '未知';
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(1024));
    return Math.round(bytes / Math.pow(1024, i) * 100) / 100 + ' ' + sizes[i];
}

// 格式化总时长（秒 → X小时X分 或 分:秒）
function formatTotalDuration(seconds) {
    if (!seconds || seconds <= 0) return '0:00';
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    if (h > 0) return h + 'h ' + m + 'm';
    const s = Math.floor(seconds % 60);
    return m + ':' + s.toString().padStart(2, '0');
}

// 获取并显示音乐统计信息
function fetchMusicStats() {
    fetch('/api/music/stats')
        .then(response => {
            if (!response.ok) throw new Error('网络错误');
            return response.json();
        })
        .then(data => {
            if (data.success && data.stats) {
                const stats = data.stats;
                document.getElementById('stat-total-count').textContent = stats.totalCount;
                document.getElementById('stat-total-size').textContent = formatFileSize(stats.totalSize);
                document.getElementById('stat-total-duration').textContent = formatTotalDuration(stats.totalDuration);

                // 格式分布
                const formatListEl = document.getElementById('stat-format-list');
                formatListEl.innerHTML = '';
                if (stats.formatBreakdown && stats.formatBreakdown.length > 0) {
                    stats.formatBreakdown.forEach(item => {
                        const div = document.createElement('div');
                        div.className = 'stat-item';
                        div.innerHTML = `<i class="fas fa-file-audio"></i><span>${escapeHtml(item.format.toUpperCase())}: <strong>${item.count}</strong></span>`;
                        formatListEl.appendChild(div);
                    });
                }
            }
        })
        .catch(error => {
            console.error('加载音乐统计失败:', error);
        });
}

// 扫描功能相关变量
let scanInterval = null;
let isScanning = false;

// DOM 元素
const scanBtn = document.getElementById('scan-btn');
const scanStatusBtn = document.getElementById('scan-status-btn');
const scanStopBtn = document.getElementById('scan-stop-btn');
const scanProgress = document.getElementById('scan-progress');
const scanProgressBar = document.getElementById('scan-progress-bar');
const scanStatusText = document.getElementById('scan-status-text');
const scanResults = document.getElementById('scan-results');
const resultAdded = document.getElementById('result-added');
const resultUpdated = document.getElementById('result-updated');
const resultDeleted = document.getElementById('result-deleted');
const resultErrors = document.getElementById('result-errors');
const scanDuration = document.getElementById('scan-duration');

// 初始化扫描功能
function initScanFeature() {
    // 绑定事件监听器
    if (scanBtn) {
        scanBtn.addEventListener('click', startScan);
    }
    
    if (scanStatusBtn) {
        scanStatusBtn.addEventListener('click', checkScanStatus);
    }
    
    if (scanStopBtn) {
        scanStopBtn.addEventListener('click', stopScan);
    }
}

// 开始扫描
async function startScan() {
    if (isScanning) {
        showMessage('扫描正在进行中，请稍候...', 'warning');
        return;
    }
    
    try {
        // 显示扫描进度
        showScanProgress();
        updateScanProgress(0, '正在启动扫描...');
        
        // 发送扫描请求
        const response = await fetch('/api/music/rescan', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('扫描已开始，请稍候...', 'success');
            // 开始轮询扫描状态
            startStatusPolling();
        } else {
            showMessage('启动扫描失败: ' + result.message, 'error');
            hideScanProgress();
        }
        
    } catch (error) {
        console.error('启动扫描失败:', error);
        showMessage('启动扫描失败，请检查网络连接', 'error');
        hideScanProgress();
    }
}

// 检查扫描状态
async function checkScanStatus() {
    try {
        const response = await fetch('/api/music/scan-status');
        const result = await response.json();
        
        if (result.success) {
            displayScanStatus(result.status);
        } else {
            showMessage('获取扫描状态失败: ' + result.message, 'error');
        }
        
    } catch (error) {
        console.error('获取扫描状态失败:', error);
        showMessage('获取扫描状态失败，请检查网络连接', 'error');
    }
}

// 停止扫描
async function stopScan() {
    try {
        const response = await fetch('/api/music/scan-stop', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            }
        });
        
        const result = await response.json();
        
        if (result.success) {
            showMessage('扫描已停止', 'info');
            stopStatusPolling();
            hideScanProgress();
        } else {
            showMessage('停止扫描失败: ' + result.message, 'error');
        }
        
    } catch (error) {
        console.error('停止扫描失败:', error);
        showMessage('停止扫描失败，请检查网络连接', 'error');
    }
}

// 显示扫描进度
function showScanProgress() {
    isScanning = true;
    scanProgress.style.display = 'block';
    scanBtn.disabled = true;
    scanStopBtn.style.display = 'inline-flex';
    scanResults.style.display = 'none';
}

// 隐藏扫描进度
function hideScanProgress() {
    isScanning = false;
    scanProgress.style.display = 'none';
    scanBtn.disabled = false;
    scanStopBtn.style.display = 'none';
}

// 更新扫描进度
function updateScanProgress(progress, statusText) {
    scanProgressBar.style.width = progress + '%';
    scanProgressBar.textContent = progress + '%';
    scanStatusText.textContent = statusText;
}

// 显示扫描状态
function displayScanStatus(status) {
    if (status.isScanning) {
        showScanProgress();
        updateScanProgress(status.progress, '扫描进行中...');
    } else {
        hideScanProgress();
        
        if (status.status === 'completed' && status.results) {
            showScanResults(status.results);
        } else if (status.status === 'error') {
            showMessage('扫描过程中发生错误', 'error');
        }
    }
}

// 显示扫描结果
function showScanResults(results) {
    scanResults.style.display = 'block';
    
    resultAdded.textContent = results.added ? results.added.length : 0;
    resultUpdated.textContent = results.updated ? results.updated.length : 0;
    resultDeleted.textContent = results.deleted ? results.deleted.length : 0;
    resultErrors.textContent = results.errors ? results.errors.length : 0;
    
    const duration = results.duration ? Math.round(results.duration / 1000) : 0;
    scanDuration.textContent = duration;
    
    // 刷新音乐列表
    loadMusicList();
    
    showMessage(`扫描完成！新增 ${resultAdded.textContent} 首，更新 ${resultUpdated.textContent} 首，删除 ${resultDeleted.textContent} 首`, 'success');
}

// 开始状态轮询
function startStatusPolling() {
    if (scanInterval) {
        clearInterval(scanInterval);
    }
    
    scanInterval = setInterval(async () => {
        try {
            const response = await fetch('/api/music/scan-status');
            const result = await response.json();
            
            if (result.success) {
                displayScanStatus(result.status);
                
                // 如果扫描完成，停止轮询
                if (!result.status.isScanning) {
                    stopStatusPolling();
                }
            }
        } catch (error) {
            console.error('轮询扫描状态失败:', error);
        }
    }, 2000); // 每2秒轮询一次
}

// 停止状态轮询
function stopStatusPolling() {
    if (scanInterval) {
        clearInterval(scanInterval);
        scanInterval = null;
    }
}

// 显示消息提示
function showMessage(message, type = 'info') {
    // 创建消息元素
    const messageEl = document.createElement('div');
    messageEl.className = `alert alert-${type === 'error' ? 'danger' : type === 'warning' ? 'warning' : type === 'success' ? 'success' : 'info'} position-fixed`;
    messageEl.style.cssText = `
        top: 20px;
        right: 20px;
        z-index: 9999;
        min-width: 300px;
        animation: slideInRight 0.3s ease;
    `;
    messageEl.textContent = message;
    
    document.body.appendChild(messageEl);
    
    // 3秒后自动移除
    setTimeout(() => {
        messageEl.style.animation = 'slideOutRight 0.3s ease';
        setTimeout(() => {
            if (messageEl.parentNode) {
                messageEl.parentNode.removeChild(messageEl);
            }
        }, 300);
    }, 3000);
}

// 添加消息动画样式
const style = document.createElement('style');
style.textContent = `
    @keyframes slideInRight {
        from {
            transform: translateX(100%);
            opacity: 0;
        }
        to {
            transform: translateX(0);
            opacity: 1;
        }
    }
    
    @keyframes slideOutRight {
        from {
            transform: translateX(0);
            opacity: 1;
        }
        to {
            transform: translateX(100%);
            opacity: 0;
        }
    }
`;
document.head.appendChild(style);
